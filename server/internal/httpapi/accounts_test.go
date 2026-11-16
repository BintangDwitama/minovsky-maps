package httpapi_test

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/httpapi"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

type meBody struct {
	SignedIn  bool `json:"signedIn"`
	Available bool `json:"available"`
	Account   *struct {
		ID          int64  `json:"id"`
		DisplayName string `json:"displayName"`
	} `json:"account"`
}

type readBody struct {
	Owner *struct {
		DisplayName string `json:"displayName"`
	} `json:"owner"`
	IsOwner bool `json:"isOwner"`
}

func TestSignInMeAndSignOut(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	if me := decode[meBody](t, f.do("GET", "/api/me", "")); me.SignedIn || !me.Available {
		t.Fatalf("anonymous me: %+v", me)
	}
	as := f.signIn(t, "alice")
	me := decode[meBody](t, f.do("GET", "/api/me", "", as...))
	if !me.SignedIn || me.Account == nil || me.Account.DisplayName != "Alice" {
		t.Fatalf("me: %+v", me)
	}
	if rec := f.do("GET", "/api/me", "", as...); strings.Contains(rec.Body.String(), "@example.com") {
		t.Fatal("/api/me must not return the email")
	}

	if rec := f.do("POST", "/api/auth/signout", "", as[0], as[1]); rec.Code != http.StatusForbidden {
		t.Fatalf("signout without client header: %d", rec.Code)
	}
	rec := f.do("POST", "/api/auth/signout", "", as...)
	if rec.Code != http.StatusNoContent || cookie(rec, httpapi.SessionCookie).MaxAge >= 0 {
		t.Fatalf("signout: %d", rec.Code)
	}
	if me := decode[meBody](t, f.do("GET", "/api/me", "", as...)); me.SignedIn {
		t.Fatal("still signed in after sign-out")
	}
}

func TestSignInFailures(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	start := f.do("GET", "/api/auth/google/start?return=https://evil.example", "")
	login := cookie(start, httpapi.LoginCookie)
	google, _ := url.Parse(start.Header().Get("Location"))
	state := google.Query().Get("state")
	callback := func(state, code string, withCookie bool) *http.Response {
		var h []string
		if withCookie {
			h = []string{"Cookie", httpapi.LoginCookie + "=" + login.Value}
		}
		return f.do("GET", "/api/auth/google/callback?"+url.Values{"state": {state}, "code": {code}}.Encode(), "", h...).Result()
	}

	if r := callback(state, "alice", false); r.Header.Get("Location") != "/?signin=failed" {
		t.Fatalf("no login cookie: %q", r.Header.Get("Location"))
	}
	if r := callback("forged", "alice", true); r.Header.Get("Location") != "/?signin=failed" {
		t.Fatalf("forged state: %q", r.Header.Get("Location"))
	}
	// the state is still unused, so the genuine callback works once — and goes home, not to evil.example
	if r := callback(state, "alice", true); r.Header.Get("Location") != "/?signin=ok" {
		t.Fatalf("genuine: %q", r.Header.Get("Location"))
	}
	if r := callback(state, "alice", true); r.Header.Get("Location") != "/?signin=failed" {
		t.Fatalf("replayed: %q", r.Header.Get("Location"))
	}

	start = f.do("GET", "/api/auth/google/start", "")
	google, _ = url.Parse(start.Header().Get("Location"))
	login = cookie(start, httpapi.LoginCookie)
	if r := callback(google.Query().Get("state"), "unverified-bob", true); r.Header.Get("Location") != "/?signin=unverified" {
		t.Fatalf("unverified: %q", r.Header.Get("Location"))
	}
	if f.store.AccountCount() != 1 {
		t.Fatalf("accounts: %d", f.store.AccountCount())
	}
}

func TestPublishRequiresSignInAndClientHeader(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	doc := wrap(t, "examples/minimal.scenario.json")
	rec := f.do("POST", "/api/scenarios", doc)
	if rec.Code != http.StatusUnauthorized || decode[errorsBody](t, rec).Code != "signed-out" {
		t.Fatalf("signed out: %d %s", rec.Code, rec.Body)
	}
	as := f.signIn(t, "alice")
	rec = f.do("POST", "/api/scenarios", doc, as[0], as[1]) // cookie only, as a cross-site form would send
	if rec.Code != http.StatusForbidden || decode[errorsBody](t, rec).Code != "client-header" {
		t.Fatalf("missing client header: %d %s", rec.Code, rec.Body)
	}
	if rec := f.do("POST", "/api/scenarios", doc, as...); rec.Code != http.StatusCreated {
		t.Fatalf("signed in: %d %s", rec.Code, rec.Body)
	}
}

func TestOwnershipOverHTTP(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	alice, bob := f.signIn(t, "alice"), f.signIn(t, "bob")
	doc := wrap(t, "examples/minimal.scenario.json")
	c := decode[created](t, f.do("POST", "/api/scenarios", doc, alice...))

	// everyone sees the verified owner name; only the owner is told they own it
	anon := f.do("GET", "/api/scenarios/"+c.ID, "")
	if r := decode[readBody](t, anon); r.Owner == nil || r.Owner.DisplayName != "Alice" || r.IsOwner {
		t.Fatalf("anonymous read: %s", anon.Body)
	}
	if strings.Contains(anon.Body.String(), "@example.com") {
		t.Fatal("reads must not include the email")
	}
	if r := decode[readBody](t, f.do("GET", "/api/scenarios/"+c.ID, "", alice...)); !r.IsOwner {
		t.Fatal("owner should see isOwner")
	}
	if r := decode[readBody](t, f.do("GET", "/api/scenarios/"+c.ID, "", bob...)); r.IsOwner {
		t.Fatal("others must not see isOwner")
	}

	if rec := f.do("PUT", "/api/scenarios/"+c.ID, doc, bob...); rec.Code != http.StatusForbidden || decode[errorsBody](t, rec).Code != "not-owner" {
		t.Fatalf("bob updates: %d %s", rec.Code, rec.Body)
	}
	if rec := f.do("DELETE", "/api/scenarios/"+c.ID, "", bob...); rec.Code != http.StatusForbidden {
		t.Fatalf("bob deletes: %d", rec.Code)
	}
	if rec := f.do("DELETE", "/api/scenarios/"+c.ID, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous delete: %d", rec.Code)
	}
	if rec := f.do("DELETE", "/api/scenarios/"+c.ID, "", alice...); rec.Code != http.StatusNoContent {
		t.Fatalf("alice deletes: %d %s", rec.Code, rec.Body)
	}
	if rec := f.do("GET", "/api/scenarios/"+c.ID, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("deleted scenario: %d", rec.Code)
	}
	if f.store.RemovedReason(c.ID) != publishing.RemovedByOwner {
		t.Fatalf("reason %q", f.store.RemovedReason(c.ID))
	}
}

func TestClaimAndMyScenarios(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	ctx := context.Background()
	doc := wrap(t, "examples/minimal.scenario.json")
	raw := []byte(strings.TrimSuffix(strings.TrimPrefix(doc, `{"scenario":`), "}"))
	for _, id := range []string{"Legacy01", "Legacy02"} {
		if _, err := f.store.Create(ctx, id, 0, publishing.HashToken("tok-"+id), publishing.Link, scenario.Facets{}, raw, 1); err != nil {
			t.Fatal(err)
		}
	}
	// legacy tokens still update unclaimed scenarios
	if rec := f.do("PUT", "/api/scenarios/Legacy01", doc, "Authorization", "Bearer tok-Legacy01"); rec.Code != http.StatusOK {
		t.Fatalf("legacy update: %d %s", rec.Code, rec.Body)
	}

	if rec := f.do("GET", "/api/me/scenarios", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("list signed out: %d", rec.Code)
	}
	as := f.signIn(t, "alice")
	claim := `{"items":[{"id":"Legacy01","token":"tok-Legacy01"},{"id":"Legacy02","token":"wrong"}]}`
	rec := f.do("POST", "/api/me/claim", claim, as...)
	res := decode[struct {
		Claimed []string `json:"claimed"`
	}](t, rec)
	if rec.Code != http.StatusOK || len(res.Claimed) != 1 || res.Claimed[0] != "Legacy01" {
		t.Fatalf("claim: %d %s", rec.Code, rec.Body)
	}
	if rec := f.do("PUT", "/api/scenarios/Legacy01", doc, "Authorization", "Bearer tok-Legacy01"); rec.Code != http.StatusForbidden {
		t.Fatalf("old token after claim: %d", rec.Code)
	}

	*f.clock = f.clock.Add(time.Minute)
	pub := decode[created](t, f.do("POST", "/api/scenarios", doc, as...))
	list := decode[struct {
		Scenarios []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"scenarios"`
	}](t, f.do("GET", "/api/me/scenarios", "", as...))
	if len(list.Scenarios) != 2 || list.Scenarios[0].ID != pub.ID || list.Scenarios[1].ID != "Legacy01" {
		t.Fatalf("list: %+v", list)
	}

	many := `{"items":[` + strings.TrimSuffix(strings.Repeat(`{"id":"x","token":"y"},`, publishing.MaxClaims+1), ",") + `]}`
	if rec := f.do("POST", "/api/me/claim", many, as...); rec.Code != http.StatusBadRequest {
		t.Fatalf("too many claims: %d", rec.Code)
	}
}

func TestRenameAndDeleteAccount(t *testing.T) {
	f := newFixture(t, httpapi.Options{WriteBurst: 100, WritesPerMinute: 100})
	as := f.signIn(t, "alice")
	c := decode[created](t, f.do("POST", "/api/scenarios", wrap(t, "examples/minimal.scenario.json"), as...))

	if rec := f.do("PATCH", "/api/me", `{"displayName":""}`, as...); rec.Code != http.StatusBadRequest {
		t.Fatalf("empty name: %d", rec.Code)
	}
	if rec := f.do("PATCH", "/api/me", `{"displayName":"Bintang"}`, as...); rec.Code != http.StatusOK {
		t.Fatalf("rename: %d %s", rec.Code, rec.Body)
	}
	if r := decode[readBody](t, f.do("GET", "/api/scenarios/"+c.ID, "")); r.Owner.DisplayName != "Bintang" {
		t.Fatalf("sheet name: %+v", r.Owner)
	}

	if rec := f.do("DELETE", "/api/me", "", as[0], as[1]); rec.Code != http.StatusForbidden {
		t.Fatalf("delete without client header: %d", rec.Code)
	}
	if rec := f.do("DELETE", "/api/me", "", as...); rec.Code != http.StatusNoContent {
		t.Fatalf("delete account: %d %s", rec.Code, rec.Body)
	}
	if rec := f.do("GET", "/api/scenarios/"+c.ID, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("scenario after account deletion: %d", rec.Code)
	}
	if f.store.RemovedReason(c.ID) != publishing.RemovedAccountGone || f.store.AccountCount() != 0 || f.store.SessionCount() != 0 {
		t.Fatal("account data must be gone")
	}
}

func TestExpiredSessionIsSignedOut(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	as := f.signIn(t, "alice")
	*f.clock = f.clock.Add(accounts.SessionLifetime + time.Minute)
	rec := f.do("GET", "/api/me", "", as...)
	if me := decode[meBody](t, rec); me.SignedIn {
		t.Fatal("expired session still signed in")
	}
	if c := cookie(rec, httpapi.SessionCookie); c == nil || c.MaxAge >= 0 {
		t.Fatal("stale cookie should be cleared")
	}
	if rec := f.do("POST", "/api/scenarios", wrap(t, "examples/minimal.scenario.json"), as...); rec.Code != http.StatusUnauthorized {
		t.Fatalf("publish with expired session: %d", rec.Code)
	}
}

func TestSignInNotConfigured(t *testing.T) {
	v, _ := scenario.NewValidator()
	store := memory.New()
	h := httpapi.New(publishing.NewService(store, v), store, httpapi.Options{})
	f := &fixture{h: h, store: store}
	if me := decode[meBody](t, f.do("GET", "/api/me", "")); me.Available || me.SignedIn {
		t.Fatalf("me: %+v", me)
	}
	if rec := f.do("GET", "/api/auth/google/start", ""); rec.Header().Get("Location") != "/?signin=unavailable" {
		t.Fatalf("start: %q", rec.Header().Get("Location"))
	}
	if rec := f.do("POST", "/api/scenarios", wrap(t, "examples/minimal.scenario.json")); rec.Code != http.StatusUnauthorized {
		t.Fatalf("publish: %d", rec.Code)
	}
}

func TestReturnPathKeepsTheFragment(t *testing.T) {
	f := newFixture(t, httpapi.Options{})
	start := f.do("GET", "/api/auth/google/start?return="+url.QueryEscape("/s/k3x9mQ2a#edit"), "")
	google, _ := url.Parse(start.Header().Get("Location"))
	cb := f.do("GET", "/api/auth/google/callback?"+url.Values{"state": {google.Query().Get("state")}, "code": {"alice"}}.Encode(), "",
		"Cookie", httpapi.LoginCookie+"="+cookie(start, httpapi.LoginCookie).Value)
	if got := cb.Header().Get("Location"); got != "/s/k3x9mQ2a?signin=ok#edit" {
		t.Fatalf("return: %q", got)
	}
}
