package accounts

import (
	"context"
	"errors"
	"net/url"
)

// DevProvider is a fake Google for local development and end-to-end tests: the "consent screen"
// is skipped and everyone signs in as one test user. main enables it only with
// DEV_FAKE_SIGNIN=1 and no database (in-memory store), so it can never run in production.
type DevProvider struct{}

const devCode = "dev-sign-in"

// AuthURL sends the browser straight back to our own callback.
func (DevProvider) AuthURL(state, _, _ string) string {
	return "/api/auth/google/callback?" + url.Values{"state": {state}, "code": {devCode}}.Encode()
}

// Exchange accepts only the code AuthURL produced.
func (DevProvider) Exchange(_ context.Context, code, _, _ string) (Identity, error) {
	if code != devCode {
		return Identity{}, errors.New("unknown dev code")
	}
	return Identity{Subject: "dev-user", Email: "dev@localhost", EmailVerified: true, Name: "Dev Player"}, nil
}
