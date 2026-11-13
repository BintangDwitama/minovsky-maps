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
	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
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

// BotCheck verifies a human-check token (Cloudflare Turnstile). Verify returns ErrBot for a
// missing or rejected token, and any other error when the check itself could not run.
type BotCheck interface {
	Verify(ctx context.Context, token, remoteIP string) error
}

// ErrBot is returned by a BotCheck for missing or rejected tokens.
var ErrBot = errors.New("bot check failed")

// Reporter files reports about published scenarios.
type Reporter interface {
	Report(ctx context.Context, in reports.Input) error
}

// Options tune limits and optional features (tests use tighter values and a fake clock).
type Options struct {
	WritesPerMinute int
	WriteBurst      int
	Now             func() time.Time
	Logger          *slog.Logger
	// Bot verifies Turnstile tokens on writes and reports; nil skips the check.
	Bot BotCheck
	// Reports handles POST /api/reports; nil answers 503.
	Reports Reporter
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
	a := &api{
		svc:     svc,
		db:      db,
		log:     opt.Logger,
		writes:  newLimiter(opt.WritesPerMinute, opt.WriteBurst, opt.Now),
		bot:     opt.Bot,
		reports: opt.Reports,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("POST /api/scenarios", a.limited("write", a.publish))
	mux.HandleFunc("GET /api/scenarios/{id}", a.get)
	mux.HandleFunc("PUT /api/scenarios/{id}", a.limited("write", a.update))
	mux.HandleFunc("POST /api/reports", a.limited("report", a.report))
	// JSON 404 for unknown GET routes; method-only mismatches still get the mux's 405
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		writeErrors(w, http.StatusNotFound, "Not found.")
	})
	return a.recoverer(mux)
}

type api struct {
	svc     Publisher
	db      Pinger
	log     *slog.Logger
	writes  *limiter
	bot     BotCheck
	reports Reporter
}

type scenarioBody struct {
	Scenario       json.RawMessage `json:"scenario"`
	TurnstileToken string          `json:"turnstileToken"`
}

type reportBody struct {
	ScenarioID     string `json:"scenarioId"`
	Reason         string `json:"reason"`
	Details        string `json:"details"`
	TurnstileToken string `json:"turnstileToken"`
}

// human runs the bot check; it writes the error response and returns false when the request
// must stop. Without a configured check every request passes.
func (a *api) human(w http.ResponseWriter, r *http.Request, token string) bool {
	if a.bot == nil {
		return true
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	err := a.bot.Verify(ctx, token, clientIP(r))
	switch {
	case err == nil:
		return true
	case errors.Is(err, ErrBot):
		// "code" lets clients tell this 403 apart from a wrong edit token
		writeJSON(w, http.StatusForbidden, map[string]any{
			"code":   "bot-check",
			"errors": []string{"Could not confirm you're a person. Please try again."},
		})
	default:
		a.log.Error("bot check unavailable", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"code":   "bot-check",
			"errors": []string{"The bot check is unavailable right now. Please try again in a minute."},
		})
	}
	return false
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
	body, ok := a.readScenario(w, r)
	if !ok || !a.human(w, r, body.TurnstileToken) {
		return
	}
	created, err := a.svc.Publish(r.Context(), body.Scenario)
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
	body, ok := a.readScenario(w, r)
	if !ok || !a.human(w, r, body.TurnstileToken) {
		return
	}
	id := r.PathValue("id")
	at, err := a.svc.Update(r.Context(), id, strings.TrimSpace(token), body.Scenario)
	if err != nil {
		a.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "updatedAt": at.UTC()})
}

func (a *api) report(w http.ResponseWriter, r *http.Request) {
	if a.reports == nil {
		writeErrors(w, http.StatusServiceUnavailable, "Reporting is not available on this server.")
		return
	}
	var body reportBody
	if !decodeJSON(w, r, &body, "Request body must be JSON: {\"scenarioId\": …, \"reason\": …}.") {
		return
	}
	if !a.human(w, r, body.TurnstileToken) {
		return
	}
	err := a.reports.Report(r.Context(), reports.Input{ScenarioID: body.ScenarioID, Reason: body.Reason, Details: body.Details})
	var inv *reports.Invalid
	if errors.As(err, &inv) {
		writeErrors(w, http.StatusBadRequest, inv.Message)
		return
	}
	if err != nil {
		a.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"received": true})
}

func (a *api) readScenario(w http.ResponseWriter, r *http.Request) (scenarioBody, bool) {
	var body scenarioBody
	if !decodeJSON(w, r, &body, "Request body must be JSON: {\"scenario\": {...}}.") {
		return body, false
	}
	if len(body.Scenario) == 0 || string(body.Scenario) == "null" {
		writeErrors(w, http.StatusBadRequest, "Missing \"scenario\".")
		return body, false
	}
	return body, true
}

// decodeJSON reads a size-limited JSON body; it writes 413/400 and returns false on failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any, badRequest string) bool {
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeErrors(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("Request is larger than %d KB.", MaxBodyBytes>>10))
			return false
		}
		writeErrors(w, http.StatusBadRequest, badRequest)
		return false
	}
	return true
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

// limited applies a per-IP rate limit; each bucket ("write", "report") is counted separately.
func (a *api) limited(bucket string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ok, wait := a.writes.allow(bucket + ":" + clientIP(r))
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
