package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

const (
	// SessionCookie holds the session token; LoginCookie the state of a pending sign-in.
	SessionCookie = "mm_session"
	LoginCookie   = "mm_login"
	// ClientHeader must accompany every change made with the session cookie. A custom header
	// cannot be sent cross-site without a CORS preflight, which this API never grants.
	ClientHeader      = "X-Minovsky-Client"
	clientHeaderValue = "web"

	codeSignedOut    = "signed-out"
	codeNotOwner     = "not-owner"
	codeClientHeader = "client-header"
)

/* ---------------- sessions ---------------- */

func hasSessionCookie(r *http.Request) bool {
	c, err := r.Cookie(SessionCookie)
	return err == nil && c.Value != ""
}

// session resolves the session cookie: signedIn is false without a valid session.
func (a *api) session(r *http.Request) (acc accounts.Account, signedIn bool, err error) {
	if a.accounts == nil {
		return accounts.Account{}, false, nil
	}
	c, cerr := r.Cookie(SessionCookie)
	if cerr != nil || c.Value == "" {
		return accounts.Account{}, false, nil
	}
	acc, err = a.accounts.SessionAccount(r.Context(), c.Value)
	if errors.Is(err, accounts.ErrNoSession) {
		return accounts.Account{}, false, nil
	}
	if err != nil {
		return accounts.Account{}, false, err
	}
	return acc, true, nil
}

// requireAccount is the guard for changes made as a signed-in user: a valid session and the
// client header. It writes 401/403/500 and returns false when the request must stop.
func (a *api) requireAccount(w http.ResponseWriter, r *http.Request) (accounts.Account, bool) {
	acc, signedIn, err := a.session(r)
	if err != nil {
		a.fail(w, err)
		return acc, false
	}
	if !signedIn {
		writeCode(w, http.StatusUnauthorized, codeSignedOut, "Sign in to do this.")
		return acc, false
	}
	if r.Header.Get(ClientHeader) != clientHeaderValue {
		writeCode(w, http.StatusForbidden, codeClientHeader, "This request must come from the Minovsky Maps app.")
		return acc, false
	}
	return acc, true
}

func setCookie(w http.ResponseWriter, name, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/api",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearCookie(w http.ResponseWriter, name string) { setCookie(w, name, "", -1) }

/* ---------------- sign-in ---------------- */

// loginStart: GET /api/auth/google/start?return=<app path> → Google.
func (a *api) loginStart(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		http.Redirect(w, r, "/?signin=unavailable", http.StatusFound)
		return
	}
	url, state, err := a.accounts.StartLogin(r.Context(), r.URL.Query().Get("return"))
	if err != nil {
		a.log.Error("sign-in start failed", "err", err)
		http.Redirect(w, r, "/?signin=failed", http.StatusFound)
		return
	}
	setCookie(w, LoginCookie, state, int(accounts.LoginLifetime.Seconds()))
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, url, http.StatusFound)
}

// loginCallback: Google → GET /api/auth/google/callback?code&state → back to the app.
func (a *api) loginCallback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if a.accounts == nil {
		http.Redirect(w, r, "/?signin=unavailable", http.StatusFound)
		return
	}
	clearCookie(w, LoginCookie)
	q := r.URL.Query()
	var cookieState string
	if c, err := r.Cookie(LoginCookie); err == nil {
		cookieState = c.Value
	}
	done, err := a.accounts.FinishLogin(r.Context(), cookieState, q.Get("state"), q.Get("code"))
	switch {
	case errors.Is(err, accounts.ErrEmailUnverified):
		http.Redirect(w, r, "/?signin=unverified", http.StatusFound)
		return
	case err != nil:
		// no codes, tokens or emails in logs
		a.log.Warn("sign-in failed", "reason", errors.Is(err, accounts.ErrLoginFailed), "google_error", q.Get("error"))
		http.Redirect(w, r, "/?signin=failed", http.StatusFound)
		return
	}
	setCookie(w, SessionCookie, done.SessionToken, int(accounts.SessionLifetime.Seconds()))
	a.log.Info("signed in", "account", done.Account.ID)
	http.Redirect(w, r, withQuery(done.ReturnTo, "signin=ok"), http.StatusFound)
}

// withQuery adds a query parameter to an app path, before any #fragment.
func withQuery(path, kv string) string {
	before, frag, hasFrag := strings.Cut(path, "#")
	sep := "?"
	if strings.Contains(before, "?") {
		sep = "&"
	}
	out := before + sep + kv
	if hasFrag {
		out += "#" + frag
	}
	return out
}

func (a *api) signOut(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get(ClientHeader) != clientHeaderValue {
		writeCode(w, http.StatusForbidden, codeClientHeader, "This request must come from the Minovsky Maps app.")
		return
	}
	if c, err := r.Cookie(SessionCookie); err == nil && a.accounts != nil {
		if err := a.accounts.SignOut(r.Context(), c.Value); err != nil {
			a.fail(w, err)
			return
		}
	}
	clearCookie(w, SessionCookie)
	w.WriteHeader(http.StatusNoContent)
}

/* ---------------- account ---------------- */

func accountJSON(acc accounts.Account) map[string]any {
	return map[string]any{"id": acc.ID, "displayName": acc.DisplayName}
}

// me: who is signed in. "available" tells the app whether sign-in is configured on this server.
func (a *api) me(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	acc, signedIn, err := a.session(r)
	if err != nil {
		a.fail(w, err)
		return
	}
	out := map[string]any{"signedIn": signedIn, "available": a.accounts != nil}
	if signedIn {
		out["account"] = accountJSON(acc)
	} else if hasSessionCookie(r) {
		clearCookie(w, SessionCookie) // stale or expired: tidy up
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) rename(w http.ResponseWriter, r *http.Request) {
	acc, ok := a.requireAccount(w, r)
	if !ok {
		return
	}
	var body struct {
		DisplayName string `json:"displayName"`
	}
	if !decodeJSON(w, r, &body, `Request body must be JSON: {"displayName": …}.`) {
		return
	}
	updated, err := a.accounts.Rename(r.Context(), acc.ID, body.DisplayName)
	if errors.Is(err, accounts.ErrInvalidName) {
		writeErrors(w, http.StatusBadRequest, "Display name must be 1 to 40 characters.")
		return
	}
	if err != nil {
		a.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"account": accountJSON(updated)})
}

func (a *api) deleteAccount(w http.ResponseWriter, r *http.Request) {
	acc, ok := a.requireAccount(w, r)
	if !ok {
		return
	}
	if err := a.accounts.Delete(r.Context(), acc.ID); err != nil {
		a.fail(w, err)
		return
	}
	a.log.Info("account deleted", "account", acc.ID)
	clearCookie(w, SessionCookie)
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) myScenarios(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	acc, signedIn, err := a.session(r)
	if err != nil {
		a.fail(w, err)
		return
	}
	if !signedIn {
		writeCode(w, http.StatusUnauthorized, codeSignedOut, "Sign in to see your scenarios.")
		return
	}
	list, err := a.svc.ListOwned(r.Context(), acc.ID)
	if err != nil {
		a.fail(w, err)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, s := range list {
		out = append(out, map[string]any{"id": s.ID, "name": s.Name, "updatedAt": s.UpdatedAt.UTC()})
	}
	writeJSON(w, http.StatusOK, map[string]any{"scenarios": out})
}

func (a *api) claim(w http.ResponseWriter, r *http.Request) {
	acc, ok := a.requireAccount(w, r)
	if !ok {
		return
	}
	var body struct {
		Items []struct {
			ID    string `json:"id"`
			Token string `json:"token"`
		} `json:"items"`
	}
	if !decodeJSON(w, r, &body, `Request body must be JSON: {"items": [{"id": …, "token": …}]}.`) {
		return
	}
	if len(body.Items) > publishing.MaxClaims {
		writeErrors(w, http.StatusBadRequest, "Too many scenarios in one request.")
		return
	}
	items := make([]publishing.TokenClaim, 0, len(body.Items))
	for _, it := range body.Items {
		items = append(items, publishing.TokenClaim{ID: it.ID, Token: it.Token})
	}
	claimed, err := a.svc.Claim(r.Context(), acc.ID, items)
	if err != nil {
		a.fail(w, err)
		return
	}
	if len(claimed) > 0 {
		a.log.Info("scenarios claimed", "account", acc.ID, "count", len(claimed))
	}
	writeJSON(w, http.StatusOK, map[string]any{"claimed": claimed})
}

func writeCode(w http.ResponseWriter, status int, code string, messages ...string) {
	writeJSON(w, status, map[string]any{"code": code, "errors": messages})
}
