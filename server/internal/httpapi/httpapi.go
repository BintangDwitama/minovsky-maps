// Package httpapi exposes the publishing service over HTTP (JSON). It is reached only through the
// web app's own origin (`/api/*`, forwarded by a Cloudflare Pages Function), so it sets no CORS headers.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
)

// MaxBodyBytes caps request bodies (a large 40×40 scenario is well under this).
const MaxBodyBytes = 64 << 10

// Publisher is what the handlers need from the service layer.
type Publisher interface {
	Publish(ctx context.Context, doc []byte) (publishing.Created, error)
	Get(ctx context.Context, id string) (publishing.Published, error)
	Update(ctx context.Context, id, token string, doc []byte) (time.Time, error)
}

// Pinger checks the database for /api/health.
type Pinger interface {
	Ping(ctx context.Context) error
}

// Options tune limits (tests use tighter values and a fake clock).
type Options struct {
	WritesPerMinute int
	WriteBurst      int
	Now             func() time.Time
	Logger          *slog.Logger
}

// New returns the API handler.
func New(svc Publisher, db Pinger, opt Options) http.Handler {
	if opt.WritesPerMinute == 0 {
		opt.WritesPerMinute = 10
	}
	if opt.WriteBurst == 0 {
		opt.WriteBurst = 5
	}
	if opt.Now == nil {
		opt.Now = time.Now
	}
	if opt.Logger == nil {
		opt.Logger = slog.Default()
	}
	a := &api{svc: svc, db: db, log: opt.Logger, writes: newLimiter(opt.WritesPerMinute, opt.WriteBurst, opt.Now)}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("POST /api/scenarios", a.limited(a.publish))
	mux.HandleFunc("GET /api/scenarios/{id}", a.get)
	mux.HandleFunc("PUT /api/scenarios/{id}", a.limited(a.update))
	// JSON 404 for unknown GET routes; method-only mismatches still get the mux's 405
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		writeErrors(w, http.StatusNotFound, "Not found.")
	})
	return a.recoverer(mux)
}

type api struct {
	svc    Publisher
	db     Pinger
	log    *slog.Logger
	writes *limiter
}

type scenarioBody struct {
	Scenario json.RawMessage `json:"scenario"`
}

func (a *api) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := a.db.Ping(ctx); err != nil {
		a.log.Error("health: database ping failed", "err", err)
		writeErrors(w, http.StatusServiceUnavailable, "Database unavailable.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *api) publish(w http.ResponseWriter, r *http.Request) {
	doc, ok := a.readScenario(w, r)
	if !ok {
		return
	}
	created, err := a.svc.Publish(r.Context(), doc)
	if err != nil {
		a.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":        created.ID,
		"editToken": created.EditToken,
		"updatedAt": created.UpdatedAt.UTC(),
	})
}

func (a *api) get(w http.ResponseWriter, r *http.Request) {
	p, err := a.svc.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		a.fail(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store") // updates must show immediately
	writeJSON(w, http.StatusOK, map[string]any{"id": p.ID, "scenario": p.Doc, "updatedAt": p.UpdatedAt.UTC()})
}

func (a *api) update(w http.ResponseWriter, r *http.Request) {
	token, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	doc, ok := a.readScenario(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	at, err := a.svc.Update(r.Context(), id, strings.TrimSpace(token), doc)
	if err != nil {
		a.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "updatedAt": at.UTC()})
}

func (a *api) readScenario(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	var body scenarioBody
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&body); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeErrors(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("Scenario is larger than %d KB.", MaxBodyBytes>>10))
			return nil, false
		}
		writeErrors(w, http.StatusBadRequest, "Request body must be JSON: {\"scenario\": {...}}.")
		return nil, false
	}
	if len(body.Scenario) == 0 || string(body.Scenario) == "null" {
		writeErrors(w, http.StatusBadRequest, "Missing \"scenario\".")
		return nil, false
	}
	return body.Scenario, true
}

// fail maps service errors to HTTP responses.
func (a *api) fail(w http.ResponseWriter, err error) {
	var inv *scenario.Invalid
	switch {
	case errors.As(err, &inv):
		writeErrors(w, http.StatusUnprocessableEntity, inv.Messages...)
	case errors.Is(err, publishing.ErrNotFound):
		writeErrors(w, http.StatusNotFound, "Scenario not found.")
	case errors.Is(err, publishing.ErrMissingToken):
		w.Header().Set("WWW-Authenticate", "Bearer")
		writeErrors(w, http.StatusUnauthorized, "An edit token is required.")
	case errors.Is(err, publishing.ErrForbidden):
		writeErrors(w, http.StatusForbidden, "This edit token does not match the scenario.")
	default:
		a.log.Error("request failed", "err", err)
		writeErrors(w, http.StatusInternalServerError, "Something went wrong on the server.")
	}
}

// limited applies the per-IP write rate limit.
func (a *api) limited(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ok, wait := a.writes.allow(clientIP(r))
		if !ok {
			w.Header().Set("Retry-After", fmt.Sprint(int(math.Ceil(wait.Seconds()))))
			writeErrors(w, http.StatusTooManyRequests, "Too many changes in a short time. Try again in a minute.")
			return
		}
		next(w, r)
	}
}

func (a *api) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				a.log.Error("panic", "value", v, "path", r.URL.Path)
				writeErrors(w, http.StatusInternalServerError, "Something went wrong on the server.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// clientIP: the first X-Forwarded-For entry (set by the Pages proxy from CF-Connecting-IP),
// falling back to the connection address. Only used for rate limiting.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first, _, _ := strings.Cut(xff, ",")
		if ip := strings.TrimSpace(first); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErrors(w http.ResponseWriter, status int, messages ...string) {
	writeJSON(w, status, map[string][]string{"errors": messages})
}
