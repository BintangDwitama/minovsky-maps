package accounts_test

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

// fakeGoogle signs in whoever the code names ("alice" → subject "alice"); codes starting with
// "unverified" report an unverified email. It checks that the nonce from AuthURL comes back.
type fakeGoogle struct{ nonces map[string]string }

func (f *fakeGoogle) AuthURL(state, nonce, verifier string) string {
	if f.nonces == nil {
		f.nonces = map[string]string{}
	}
	f.nonces[verifier] = nonce
	return "https://accounts.example/auth?" + url.Values{"state": {state}, "nonce": {nonce}}.Encode()
}

func (f *fakeGoogle) Exchange(_ context.Context, code, verifier, nonce string) (accounts.Identity, error) {
	if f.nonces[verifier] != nonce {
		return accounts.Identity{}, errors.New("nonce/verifier mismatch")
	}
	return accounts.Identity{
		Subject:       code,
		Email:         code + "@example.com",
		EmailVerified: !strings.HasPrefix(code, "unverified"),
		Name:          strings.ToUpper(code[:1]) + code[1:],
	}, nil
}

type harness struct {
	svc   *accounts.Service
	store *memory.Store
	now   *time.Time
}

func newHarness() *harness {
	now := time.Date(2026, 11, 14, 9, 0, 0, 0, time.UTC)
	h := &harness{now: &now}
	h.store = memory.NewWithClock(func() time.Time { return *h.now })
	h.svc = accounts.NewService(h.store, &fakeGoogle{}, func() time.Time { return *h.now })
	return h
}

func stateOf(t *testing.T, authURL string) string {
	t.Helper()
	u, err := url.Parse(authURL)
	if err != nil {
		t.Fatal(err)
	}
	return u.Query().Get("state")
}

func (h *harness) signIn(t *testing.T, who, returnTo string) accounts.Finished {
	t.Helper()
	ctx := context.Background()
	u, state, err := h.svc.StartLogin(ctx, returnTo)
	if err != nil || stateOf(t, u) != state {
		t.Fatalf("start: %v", err)
	}
	done, err := h.svc.FinishLogin(ctx, state, state, who)
	if err != nil {
		t.Fatalf("finish: %v", err)
	}
	return done
}

func TestSignInCreatesAccountAndSession(t *testing.T) {
	h := newHarness()
	done := h.signIn(t, "alice", "/#/edit/abc")
	if done.Account.DisplayName != "Alice" || done.Account.Email != "alice@example.com" || done.ReturnTo != "/#/edit/abc" {
		t.Fatalf("unexpected %+v", done)
	}
	if len(done.SessionToken) < 43 { // 32 bytes base64url
		t.Fatalf("short session token %q", done.SessionToken)
	}
	acc, err := h.svc.SessionAccount(context.Background(), done.SessionToken)
	if err != nil || acc.ID != done.Account.ID {
		t.Fatalf("session: %v %+v", err, acc)
	}
	// signing in again finds the same account and keeps a changed display name
	if _, err := h.svc.Rename(context.Background(), acc.ID, "  Bintang   M  "); err != nil {
		t.Fatal(err)
	}
	again := h.signIn(t, "alice", "/")
	if again.Account.ID != acc.ID || again.Account.DisplayName != "Bintang M" || h.store.AccountCount() != 1 {
		t.Fatalf("second sign-in: %+v", again.Account)
	}
}

func TestForgedReplayedAndExpiredStatesFail(t *testing.T) {
	h := newHarness()
	ctx := context.Background()
	_, state, _ := h.svc.StartLogin(ctx, "/")

	if _, err := h.svc.FinishLogin(ctx, "other", state, "alice"); !errors.Is(err, accounts.ErrLoginFailed) {
		t.Fatalf("cookie/state mismatch: %v", err)
	}
	if _, err := h.svc.FinishLogin(ctx, "made-up", "made-up", "alice"); !errors.Is(err, accounts.ErrLoginFailed) {
		t.Fatalf("unknown state: %v", err)
	}
	if _, err := h.svc.FinishLogin(ctx, state, state, "alice"); err != nil {
		t.Fatalf("first use: %v", err)
	}
	if _, err := h.svc.FinishLogin(ctx, state, state, "alice"); !errors.Is(err, accounts.ErrLoginFailed) {
		t.Fatalf("replay: %v", err)
	}

	_, late, _ := h.svc.StartLogin(ctx, "/")
	*h.now = h.now.Add(accounts.LoginLifetime + time.Second)
	if _, err := h.svc.FinishLogin(ctx, late, late, "alice"); !errors.Is(err, accounts.ErrLoginFailed) {
		t.Fatalf("expired: %v", err)
	}
	if h.store.AccountCount() != 1 {
		t.Fatalf("failed sign-ins created accounts: %d", h.store.AccountCount())
	}
}

func TestUnverifiedEmailIsRefused(t *testing.T) {
	h := newHarness()
	ctx := context.Background()
	_, state, _ := h.svc.StartLogin(ctx, "/")
	if _, err := h.svc.FinishLogin(ctx, state, state, "unverified-bob"); !errors.Is(err, accounts.ErrEmailUnverified) {
		t.Fatalf("got %v", err)
	}
	if h.store.AccountCount() != 0 || h.store.SessionCount() != 0 {
		t.Fatal("nothing may be created")
	}
}

func TestSessionsExpireAndSignOut(t *testing.T) {
	h := newHarness()
	ctx := context.Background()
	done := h.signIn(t, "alice", "/")
	*h.now = h.now.Add(accounts.SessionLifetime - time.Minute)
	if _, err := h.svc.SessionAccount(ctx, done.SessionToken); err != nil {
		t.Fatalf("still valid: %v", err)
	}
	*h.now = h.now.Add(2 * time.Minute)
	if _, err := h.svc.SessionAccount(ctx, done.SessionToken); !errors.Is(err, accounts.ErrNoSession) {
		t.Fatalf("expired: %v", err)
	}

	fresh := h.signIn(t, "alice", "/")
	if err := h.svc.SignOut(ctx, fresh.SessionToken); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.SessionAccount(ctx, fresh.SessionToken); !errors.Is(err, accounts.ErrNoSession) {
		t.Fatalf("signed out: %v", err)
	}
	if _, err := h.svc.SessionAccount(ctx, ""); !errors.Is(err, accounts.ErrNoSession) {
		t.Fatalf("empty token: %v", err)
	}
}

func TestRenameRules(t *testing.T) {
	h := newHarness()
	ctx := context.Background()
	id := h.signIn(t, "alice", "/").Account.ID
	for _, bad := range []string{"", "   ", strings.Repeat("x", 41)} {
		if _, err := h.svc.Rename(ctx, id, bad); !errors.Is(err, accounts.ErrInvalidName) {
			t.Errorf("%q: %v", bad, err)
		}
	}
	if a, err := h.svc.Rename(ctx, id, strings.Repeat("é", 40)); err != nil || len([]rune(a.DisplayName)) != 40 {
		t.Fatalf("40 characters allowed: %v", err)
	}
}

func TestDeleteAccountRemovesSessions(t *testing.T) {
	h := newHarness()
	ctx := context.Background()
	done := h.signIn(t, "alice", "/")
	if err := h.svc.Delete(ctx, done.Account.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.SessionAccount(ctx, done.SessionToken); !errors.Is(err, accounts.ErrNoSession) {
		t.Fatalf("session survived: %v", err)
	}
	if again := h.signIn(t, "alice", "/"); again.Account.ID == done.Account.ID {
		t.Fatal("a deleted account must not come back")
	}
}

func TestSafeReturn(t *testing.T) {
	cases := map[string]string{
		"/#/edit/abc":          "/#/edit/abc",
		"/s/k3x9mQ2a":          "/s/k3x9mQ2a",
		"":                     "/",
		"https://evil.example": "/",
		"//evil.example/x":     "/",
		`/\evil.example`:       "/",
		"/ok\r\nSet-Cookie:x":  "/",
		"relative":             "/",
	}
	for in, want := range cases {
		if got := accounts.SafeReturn(in); got != want {
			t.Errorf("SafeReturn(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDevProviderOnlyAcceptsItsCode(t *testing.T) {
	p := accounts.DevProvider{}
	u := p.AuthURL("s1", "n", "v")
	if !strings.HasPrefix(u, "/api/auth/google/callback?") || !strings.Contains(u, "state=s1") {
		t.Fatalf("auth url %q", u)
	}
	if _, err := p.Exchange(context.Background(), "guess", "v", "n"); err == nil {
		t.Fatal("other codes must fail")
	}
}
