package accounts

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// googleEndpoint is Google's OAuth 2.0 endpoint (written out to avoid golang.org/x/oauth2/google,
// which pulls in the Google Cloud metadata client).
var googleEndpoint = oauth2.Endpoint{
	AuthURL:   "https://accounts.google.com/o/oauth2/v2/auth",
	TokenURL:  "https://oauth2.googleapis.com/token",
	AuthStyle: oauth2.AuthStyleInParams,
}

const (
	googleIssuer = "https://accounts.google.com"
	googleKeys   = "https://www.googleapis.com/oauth2/v3/certs"
)

// Google is the IdentityProvider for "Sign in with Google" (OpenID Connect, authorization code
// with PKCE). Scopes are openid, email and profile only.
type Google struct {
	cfg      oauth2.Config
	once     sync.Once
	verifier *oidc.IDTokenVerifier
}

// NewGoogle configures sign-in; redirectURL is the app's public `/api/auth/google/callback`.
// No network calls happen here: Google's signing keys are fetched on first use and cached.
func NewGoogle(clientID, clientSecret, redirectURL string) *Google {
	return &Google{cfg: oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     googleEndpoint,
		RedirectURL:  redirectURL,
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}}
}

// AuthURL builds Google's consent URL with state, nonce and the S256 PKCE challenge.
func (g *Google) AuthURL(state, nonce, verifier string) string {
	return g.cfg.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier))
}

// Exchange trades the code (with the PKCE verifier) and verifies the ID token: signature against
// Google's published keys, issuer, audience (our client id), expiry, and the nonce.
func (g *Google) Exchange(ctx context.Context, code, verifier, nonce string) (Identity, error) {
	g.once.Do(func() {
		keys := oidc.NewRemoteKeySet(context.Background(), googleKeys)
		g.verifier = oidc.NewVerifier(googleIssuer, keys, &oidc.Config{ClientID: g.cfg.ClientID})
	})
	tok, err := g.cfg.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return Identity{}, fmt.Errorf("code exchange: %w", err)
	}
	raw, ok := tok.Extra("id_token").(string)
	if !ok || raw == "" {
		return Identity{}, errors.New("no id_token in response")
	}
	idt, err := g.verifier.Verify(ctx, raw)
	if err != nil {
		return Identity{}, fmt.Errorf("id token: %w", err)
	}
	if idt.Nonce != nonce {
		return Identity{}, errors.New("id token nonce mismatch")
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
	}
	if err := idt.Claims(&claims); err != nil {
		return Identity{}, fmt.Errorf("id token claims: %w", err)
	}
	return Identity{Subject: idt.Subject, Email: claims.Email, EmailVerified: claims.EmailVerified, Name: claims.Name}, nil
}
