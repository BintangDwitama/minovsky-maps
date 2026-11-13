// Package turnstile verifies Cloudflare Turnstile tokens (a free, mostly invisible bot check).
package turnstile

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultEndpoint is Cloudflare's verification API.
const DefaultEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// ErrRejected means the token is missing, invalid, expired or already used.
var ErrRejected = errors.New("bot check failed")

// Verifier checks tokens with Cloudflare.
type Verifier struct {
	secret   string
	endpoint string
	client   *http.Client
}

// New returns a Verifier for the given secret key.
func New(secret string) *Verifier {
	return &Verifier{secret: secret, endpoint: DefaultEndpoint, client: &http.Client{Timeout: 5 * time.Second}}
}

// WithEndpoint points the verifier at another URL (tests).
func (v *Verifier) WithEndpoint(endpoint string) *Verifier {
	v.endpoint = endpoint
	return v
}

// Verify returns nil for a valid token, ErrRejected for a bad one, or another error when
// Cloudflare could not be asked.
func (v *Verifier) Verify(ctx context.Context, token, remoteIP string) error {
	if strings.TrimSpace(token) == "" {
		return ErrRejected
	}
	form := url.Values{"secret": {v.secret}, "response": {token}}
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("turnstile: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("turnstile: status %d", res.StatusCode)
	}
	var body struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return fmt.Errorf("turnstile: %w", err)
	}
	if !body.Success {
		return ErrRejected
	}
	return nil
}
