package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/schema"
	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/httpapi"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

// fakeGoogle signs in whoever the code names; codes starting with "unverified" have an
// unverified email.
type fakeGoogle struct{}

func (fakeGoogle) AuthURL(state, nonce, _ string) string {
	return "https://accounts.example/auth?" + url.Values{"state": {state}, "nonce": {nonce}}.Encode()
}

func (fakeGoogle) Exchange(_ context.Context, code, _, _ string) (accounts.Identity, error) {
	return accounts.Identity{
		Subject:       code,
		Email:         code + "@example.com",
		EmailVerified: !strings.HasPrefix(code, "unverified"),
		Name:          strings.ToUpper(code[:1]) + code[1:],
	}, nil
}

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
	f := &fixture{clock: &now}
	clock := func() time.Time { return *f.clock }
	f.store = memory.NewWithClock(clock)
	opt.Now = clock
	if opt.Accounts == nil {
		opt.Accounts = accounts.NewService(f.store, fakeGoogle{}, clock)
	}
	f.h = httpapi.New(publishing.NewService(f.store, v), f.store, opt)
	return f
}

// newHandler builds a handler over the fixture's store and clock (so existing sessions stay valid).
func newHandler(t *testing.T, f *fixture, opt httpapi.Options) http.Handler {
	t.Helper()
	v, err := scenario.NewValidator()
	if err != nil {
		t.Fatal(err)
	}
	clock := func() time.Time { return *f.clock }
	opt.Now = clock
	if opt.Accounts == nil {
		opt.Accounts = accounts.NewService(f.store, fakeGoogle{}, clock)
	}
	return httpapi.New(publishing.NewService(f.store, v), f.store, opt)
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

func cookie(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// signIn runs the whole browser flow (start → Google → callback) and returns the headers a
// signed-in app request carries: the session cookie and the client header.
func (f *fixture) signIn(t *testing.T, who string) []string {
	t.Helper()
	start := f.do("GET", "/api/auth/google/start?return="+url.QueryEscape("/#/"), "")
	if start.Code != http.StatusFound {
		t.Fatalf("start: %d %s", start.Code, start.Body)
	}
	login := cookie(start, httpapi.LoginCookie)
	if login == nil || !login.HttpOnly || !login.Secure || login.Path != "/api" {
		t.Fatalf("login cookie %+v", login)
	}
	google, _ := url.Parse(start.Header().Get("Location"))
	state := google.Query().Get("state")
	cb := f.do("GET", "/api/auth/google/callback?"+url.Values{"state": {state}, "code": {who}}.Encode(), "",
		"Cookie", httpapi.LoginCookie+"="+login.Value)
	if cb.Code != http.StatusFound || cb.Header().Get("Location") != "/?signin=ok#/" {
		t.Fatalf("callback: %d %q", cb.Code, cb.Header().Get("Location"))
	}
	s := cookie(cb, httpapi.SessionCookie)
	if s == nil || s.Value == "" || !s.HttpOnly || !s.Secure || s.SameSite != http.SameSiteLaxMode || s.Path != "/api" {
		t.Fatalf("session cookie %+v", s)
	}
	return []string{"Cookie", httpapi.SessionCookie + "=" + s.Value, httpapi.ClientHeader, "web"}
}

func wrap(t *testing.T, file string) string {
	t.Helper()
	doc, err := fs.ReadFile(schema.Examples, file)
	if err != nil {
		t.Fatal(err)
	}
	// shared by link, so anonymous reads work (new saves default to private)
	return `{"visibility":"link","scenario":` + string(doc) + `}`
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
	ID string `json:"id"`
}

type errorsBody struct {
	Code   string   `json:"code"`
	Errors []string `json:"errors"`
}

func TestPublishReadUpdate(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	as := f.signIn(t, "alice")
	rec := f.do("POST", "/api/scenarios", wrap(t, "examples/sample-mesa.scenario.json"), as...)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "editToken") {
		t.Fatal("owned scenarios get no edit token")
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
	rec = f.do("PUT", "/api/scenarios/"+c.ID, updated, as...)
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
	as := f.signIn(t, "alice")
	c := decode[created](t, f.do("POST", "/api/scenarios", wrap(t, "examples/minimal.scenario.json"), as...))
	good := wrap(t, "examples/minimal.scenario.json")

	cases := []struct {
		name   string
		rec    *httptest.ResponseRecorder
		status int
	}{
		{"bad json", f.do("POST", "/api/scenarios", "{nope", as...), 400},
		{"missing scenario", f.do("POST", "/api/scenarios", `{}`, as...), 400},
		{"too large", f.do("POST", "/api/scenarios", `{"scenario":"`+strings.Repeat("x", httpapi.MaxBodyBytes)+`"}`, as...), 413},
		{"invalid scenario", f.do("POST", "/api/scenarios", wrap(t, "examples/invalid/off-board-carrier.json"), as...), 422},
		{"unknown id", f.do("GET", "/api/scenarios/zzzzzzzz", ""), 404},
		{"malformed id", f.do("GET", "/api/scenarios/..%2Fx", ""), 404},
		{"no credentials", f.do("PUT", "/api/scenarios/"+c.ID, good), 401},
		{"wrong token", f.do("PUT", "/api/scenarios/"+c.ID, good, "Authorization", "Bearer nope"), 403},
		{"update unknown", f.do("PUT", "/api/scenarios/zzzzzzzz", good, as...), 404},
		{"unknown route", f.do("GET", "/api/nope", ""), 404},
		{"wrong method", f.do("POST", "/api/scenarios/"+c.ID, ""), 405},
	}
	for _, tc := range cases {
		if tc.rec.Code != tc.status {
			t.Errorf("%s: got %d want %d (%s)", tc.name, tc.rec.Code, tc.status, tc.rec.Body)
		}
	}
}

func TestErrorsAreReadableJSON(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	rec := f.do("POST", "/api/scenarios", wrap(t, "examples/invalid/off-board-carrier.json"), f.signIn(t, "alice")...)
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
	as := f.signIn(t, "alice")
	doc := wrap(t, "examples/minimal.scenario.json")
	from := func(addr string) []string { return append([]string{"X-Forwarded-For", addr + ", 10.0.0.1"}, as...) }

	for i := 0; i < 2; i++ {
		if rec := f.do("POST", "/api/scenarios", doc, from("1.2.3.4")...); rec.Code != 201 {
			t.Fatalf("write %d: %d", i, rec.Code)
		}
	}
	rec := f.do("POST", "/api/scenarios", doc, from("1.2.3.4")...)
	if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("expected 429 with Retry-After, got %d", rec.Code)
	}
	if rec := f.do("POST", "/api/scenarios", doc, from("5.6.7.8")...); rec.Code != 201 {
		t.Fatalf("other IP should not be limited: %d", rec.Code)
	}
	if rec := f.do("GET", "/api/health", "", from("1.2.3.4")...); rec.Code != 200 {
		t.Fatalf("reads are not limited: %d", rec.Code)
	}
	*f.clock = f.clock.Add(31 * time.Second) // 2/min ⇒ one token per 30 s
	if rec := f.do("POST", "/api/scenarios", doc, from("1.2.3.4")...); rec.Code != 201 {
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
