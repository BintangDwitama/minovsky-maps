// Package accounts is sign-in with Google and sessions. It owns login states (state, nonce, PKCE
// verifier), session tokens and display names, and depends only on the Store and
// IdentityProvider interfaces it declares (implemented by internal/store/* and Google in google.go).
//
// Secrets never leave this package unhashed except once: the session token is returned to the
// HTTP layer to be set as a cookie. Only SHA-256 hashes of states and session tokens are stored.
package accounts

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	// ErrLoginFailed: the sign-in could not be completed (forged, replayed or expired state,
	// or Google refused). Deliberately vague towards the user.
	ErrLoginFailed = errors.New("sign-in failed")
	// ErrEmailUnverified: Google reports the email as not verified.
	ErrEmailUnverified = errors.New("google email not verified")
	// ErrNoSession: no valid session (missing, unknown or expired).
	ErrNoSession = errors.New("not signed in")
	// ErrInvalidName: a display name outside 1–40 characters.
	ErrInvalidName = errors.New("display name must be 1 to 40 characters")
	// ErrNotFound is returned by a Store for unknown accounts or login states.
	ErrNotFound = errors.New("not found")
)

const (
	// SessionLifetime is how long a sign-in lasts.
	SessionLifetime = 30 * 24 * time.Hour
	// LoginLifetime is how long a started sign-in may take.
	LoginLifetime = 10 * time.Minute
	// MaxNameLength is the display name limit (characters).
	MaxNameLength = 40
	secretBytes   = 32
)

// Account is a signed-in person.
type Account struct {
	ID          int64
	GoogleSub   string
	Email       string
	DisplayName string
	CreatedAt   time.Time
}

// Identity is what Google vouches for after a successful exchange.
type Identity struct {
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

// IdentityProvider talks to Google (or a fake in tests).
type IdentityProvider interface {
	// AuthURL is where to send the browser: it carries state, nonce and the PKCE challenge for verifier.
	AuthURL(state, nonce, verifier string) string
	// Exchange trades the code for a verified identity (ID token signature, issuer, audience,
	// expiry and nonce checked).
	Exchange(ctx context.Context, code, verifier, nonce string) (Identity, error)
}

// LoginState is a pending sign-in.
type LoginState struct {
	StateHash []byte
	Nonce     string
	Verifier  string
	ReturnTo  string
	ExpiresAt time.Time
}

// Store persists accounts, sessions and login states.
type Store interface {
	SaveLoginState(ctx context.Context, s LoginState) error
	// UseLoginState returns and marks used a pending state; ErrNotFound if it is unknown,
	// already used or expired at now.
	UseLoginState(ctx context.Context, stateHash []byte, now time.Time) (LoginState, error)
	// UpsertGoogleAccount finds the account by Google subject or creates it with displayName;
	// an existing account keeps its display name but gets the current email.
	UpsertGoogleAccount(ctx context.Context, sub, email, displayName string) (Account, error)
	CreateSession(ctx context.Context, tokenHash []byte, accountID int64, expiresAt time.Time) error
	// SessionAccount returns the account of an unexpired session; ErrNotFound otherwise.
	SessionAccount(ctx context.Context, tokenHash []byte, now time.Time) (Account, error)
	DeleteSession(ctx context.Context, tokenHash []byte) error
	DeleteExpired(ctx context.Context, now time.Time) error
	RenameAccount(ctx context.Context, id int64, displayName string) (Account, error)
	// DeleteAccount takes down the account's scenarios and deletes it with its sessions, atomically.
	DeleteAccount(ctx context.Context, id int64) error
}

// Service implements sign-in and sessions.
type Service struct {
	store    Store
	provider IdentityProvider
	now      func() time.Time
	random   func([]byte) (int, error)
}

// NewService wires the service; now may be nil (real clock).
func NewService(store Store, provider IdentityProvider, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{store: store, provider: provider, now: now, random: rand.Read}
}

// StartLogin begins a sign-in that will come back to returnTo (an app path). It returns the
// Google URL to redirect to and the state value to keep in the browser's login cookie.
func (s *Service) StartLogin(ctx context.Context, returnTo string) (authURL, state string, err error) {
	state, err = s.secret()
	if err != nil {
		return "", "", err
	}
	nonce, err := s.secret()
	if err != nil {
		return "", "", err
	}
	verifier, err := s.secret()
	if err != nil {
		return "", "", err
	}
	err = s.store.SaveLoginState(ctx, LoginState{
		StateHash: hash(state),
		Nonce:     nonce,
		Verifier:  verifier,
		ReturnTo:  SafeReturn(returnTo),
		ExpiresAt: s.now().Add(LoginLifetime),
	})
	if err != nil {
		return "", "", err
	}
	return s.provider.AuthURL(state, nonce, verifier), state, nil
}

// Finished is a completed sign-in.
type Finished struct {
	SessionToken string
	Account      Account
	ReturnTo     string
}

// FinishLogin completes a sign-in. cookieState is the state kept in the browser; queryState
// and code come back from Google. Mismatched, unknown, used or expired states fail.
func (s *Service) FinishLogin(ctx context.Context, cookieState, queryState, code string) (Finished, error) {
	if cookieState == "" || queryState == "" || code == "" || cookieState != queryState {
		return Finished{}, ErrLoginFailed
	}
	pending, err := s.store.UseLoginState(ctx, hash(queryState), s.now())
	if errors.Is(err, ErrNotFound) {
		return Finished{}, ErrLoginFailed
	}
	if err != nil {
		return Finished{}, err
	}
	id, err := s.provider.Exchange(ctx, code, pending.Verifier, pending.Nonce)
	if err != nil {
		return Finished{}, errors.Join(ErrLoginFailed, err)
	}
	if id.Subject == "" {
		return Finished{}, ErrLoginFailed
	}
	if !id.EmailVerified || id.Email == "" {
		return Finished{}, ErrEmailUnverified
	}
	acc, err := s.store.UpsertGoogleAccount(ctx, id.Subject, id.Email, defaultName(id.Name))
	if err != nil {
		return Finished{}, err
	}
	token, err := s.secret()
	if err != nil {
		return Finished{}, err
	}
	now := s.now()
	if err := s.store.CreateSession(ctx, hash(token), acc.ID, now.Add(SessionLifetime)); err != nil {
		return Finished{}, err
	}
	_ = s.store.DeleteExpired(ctx, now) // housekeeping; failure is harmless
	return Finished{SessionToken: token, Account: acc, ReturnTo: pending.ReturnTo}, nil
}

// SessionAccount resolves a session token; ErrNoSession when it is missing, unknown or expired.
func (s *Service) SessionAccount(ctx context.Context, token string) (Account, error) {
	if token == "" {
		return Account{}, ErrNoSession
	}
	acc, err := s.store.SessionAccount(ctx, hash(token), s.now())
	if errors.Is(err, ErrNotFound) {
		return Account{}, ErrNoSession
	}
	return acc, err
}

// SignOut ends a session (unknown tokens are fine).
func (s *Service) SignOut(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.store.DeleteSession(ctx, hash(token))
}

// Rename sets the display name (trimmed, 1–40 characters).
func (s *Service) Rename(ctx context.Context, accountID int64, name string) (Account, error) {
	name = strings.Join(strings.Fields(name), " ")
	if n := utf8.RuneCountInString(name); n < 1 || n > MaxNameLength {
		return Account{}, ErrInvalidName
	}
	return s.store.RenameAccount(ctx, accountID, name)
}

// Delete removes the account, its sessions and email, and takes down its scenarios.
func (s *Service) Delete(ctx context.Context, accountID int64) error {
	return s.store.DeleteAccount(ctx, accountID)
}

// SafeReturn keeps only app-relative paths ("/…", not "//…" or "/\…"), so a sign-in can never
// redirect to another site.
func SafeReturn(p string) string {
	if p == "" || p[0] != '/' || strings.HasPrefix(p, "//") || strings.HasPrefix(p, `/\`) ||
		strings.ContainsAny(p, "\r\n") {
		return "/"
	}
	return p
}

func defaultName(name string) string {
	name = strings.Join(strings.Fields(name), " ")
	if name == "" {
		return "Player"
	}
	if utf8.RuneCountInString(name) > MaxNameLength {
		name = string([]rune(name)[:MaxNameLength])
	}
	return strings.TrimSpace(name)
}

func (s *Service) secret() (string, error) {
	b := make([]byte, secretBytes)
	if _, err := s.random(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hash(v string) []byte {
	sum := sha256.Sum256([]byte(v))
	return sum[:]
}
