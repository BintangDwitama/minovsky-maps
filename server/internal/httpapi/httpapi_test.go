package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/schema"
	"github.com/BintangDwitama/minovsky-maps/server/internal/httpapi"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

type fixture struct {
	h     http.Handler
	store *memory.Store
	clock *time.Time
}

func newFixture(t *testing.T, opt httpapi.Options) *fixture {
	t.Helper()
	v, err := scenario.NewValidator()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC)
	f := &fixture{store: memory.NewWithClock(func() time.Time { return now }), clock: &now}
	opt.Now = func() time.Time { return *f.clock }
	f.h = httpapi.New(publishing.NewService(f.store, v), f.store, opt)
	return f
}

func (f *fixture) do(method, path, body string, headers ...string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	rec := httptest.NewRecorder()
	f.h.ServeHTTP(rec, req)
	return rec
}

func wrap(t *testing.T, file string) string {
	t.Helper()
	doc, err := fs.ReadFile(schema.Examples, file)
	if err != nil {
		t.Fatal(err)
	}
	return `{"scenario":` + string(doc) + `}`
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return v
}

type created struct {
	ID        string `json:"id"`
	EditToken string `json:"editToken"`
}

type errorsBody struct {
	Errors []string `json:"errors"`
}

func TestPublishReadUpdate(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	rec := f.do("POST", "/api/scenarios", wrap(t, "examples/sample-mesa.scenario.json"))
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body)
	}
	c := decode[created](t, rec)

	rec = f.do("GET", "/api/scenarios/"+c.ID, "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Sample: Desert Mesa") {
		t.Fatalf("get: %d %s", rec.Code, rec.Body)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("reads must not be cached")
	}

	updated := strings.Replace(wrap(t, "examples/sample-mesa.scenario.json"), "Sample: Desert Mesa", "Desert Mesa v2", 1)
	rec = f.do("PUT", "/api/scenarios/"+c.ID, updated, "Authorization", "Bearer "+c.EditToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("update: %d %s", rec.Code, rec.Body)
	}
	rec = f.do("GET", "/api/scenarios/"+c.ID, "")
	if !strings.Contains(rec.Body.String(), "Desert Mesa v2") {
		t.Fatalf("update not visible: %s", rec.Body)
	}
}

func TestStatusCodes(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	c := decode[created](t, f.do("POST", "/api/scenarios", wrap(t, "examples/minimal.scenario.json")))
	good := wrap(t, "examples/minimal.scenario.json")

	cases := []struct {
		name   string
		rec    *httptest.ResponseRecorder
		status int
	}{
		{"bad json", f.do("POST", "/api/scenarios", "{nope"), 400},
		{"missing scenario", f.do("POST", "/api/scenarios", `{}`), 400},
		{"too large", f.do("POST", "/api/scenarios", `{"scenario":"`+strings.Repeat("x", httpapi.MaxBodyBytes)+`"}`), 413},
		{"invalid scenario", f.do("POST", "/api/scenarios", wrap(t, "examples/invalid/off-board-carrier.json")), 422},
		{"unknown id", f.do("GET", "/api/scenarios/zzzzzzzz", ""), 404},
		{"malformed id", f.do("GET", "/api/scenarios/..%2Fx", ""), 404},
		{"no token", f.do("PUT", "/api/scenarios/"+c.ID, good), 401},
		{"wrong token", f.do("PUT", "/api/scenarios/"+c.ID, good, "Authorization", "Bearer nope"), 403},
		{"update unknown", f.do("PUT", "/api/scenarios/zzzzzzzz", good, "Authorization", "Bearer x"), 404},
		{"unknown route", f.do("GET", "/api/nope", ""), 404},
		{"wrong method", f.do("DELETE", "/api/scenarios/"+c.ID, ""), 405},
	}
	for _, tc := range cases {
		if tc.rec.Code != tc.status {
			t.Errorf("%s: got %d want %d (%s)", tc.name, tc.rec.Code, tc.status, tc.rec.Body)
		}
	}
}

func TestErrorsAreReadableJSON(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	rec := f.do("POST", "/api/scenarios", wrap(t, "examples/invalid/off-board-carrier.json"))
	body := decode[errorsBody](t, rec)
	if len(body.Errors) == 0 || !strings.Contains(body.Errors[0], "not on the board") {
		t.Fatalf("unexpected errors %v", body.Errors)
	}
	if !strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatal("errors must be JSON")
	}
}

func TestWriteRateLimitPerIP(t *testing.T) {
	f := newFixture(t, httpapi.Options{WritesPerMinute: 2, WriteBurst: 2})
	doc := wrap(t, "examples/minimal.scenario.json")
	ip := func(addr string) []string { return []string{"X-Forwarded-For", addr + ", 10.0.0.1"} }

	for i := 0; i < 2; i++ {
		if rec := f.do("POST", "/api/scenarios", doc, ip("1.2.3.4")...); rec.Code != 201 {
			t.Fatalf("write %d: %d", i, rec.Code)
		}
	}
	rec := f.do("POST", "/api/scenarios", doc, ip("1.2.3.4")...)
	if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("expected 429 with Retry-After, got %d", rec.Code)
	}
	if rec := f.do("POST", "/api/scenarios", doc, ip("5.6.7.8")...); rec.Code != 201 {
		t.Fatalf("other IP should not be limited: %d", rec.Code)
	}
	if rec := f.do("GET", "/api/health", "", ip("1.2.3.4")...); rec.Code != 200 {
		t.Fatalf("reads are not limited: %d", rec.Code)
	}
	*f.clock = f.clock.Add(31 * time.Second) // 2/min ⇒ one token per 30 s
	if rec := f.do("POST", "/api/scenarios", doc, ip("1.2.3.4")...); rec.Code != 201 {
		t.Fatalf("token should refill: %d", rec.Code)
	}
}

type failingDB struct{}

func (failingDB) Ping(context.Context) error { return errors.New("down") }

func TestHealth(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	if rec := f.do("GET", "/api/health", ""); rec.Code != 200 {
		t.Fatalf("health: %d", rec.Code)
	}
	v, _ := scenario.NewValidator()
	h := httpapi.New(publishing.NewService(memory.New(), v), failingDB{}, httpapi.Options{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/health", bytes.NewReader(nil)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("health with db down: %d", rec.Code)
	}
}
