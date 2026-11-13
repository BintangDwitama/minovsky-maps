// Package notify sends report emails to the owner through Resend's HTTP API.
package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
)

// DefaultEndpoint is Resend's send-email API.
const DefaultEndpoint = "https://api.resend.com/emails"

// sender is Resend's shared address; it may only deliver to the account owner's own address,
// which is exactly who reports go to, so no domain is needed.
const sender = "Minovsky Maps <onboarding@resend.dev>"

// Resend emails reports to one address.
type Resend struct {
	apiKey   string
	to       string
	appURL   string
	endpoint string
	client   *http.Client
}

// NewResend returns a notifier; appURL is the public site address used for short links.
func NewResend(apiKey, to, appURL string) *Resend {
	return &Resend{
		apiKey:   apiKey,
		to:       to,
		appURL:   strings.TrimRight(appURL, "/"),
		endpoint: DefaultEndpoint,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

// WithEndpoint points the notifier at another URL (tests).
func (n *Resend) WithEndpoint(endpoint string) *Resend {
	n.endpoint = endpoint
	return n
}

// Subject is the email subject for a report (the owner filters on its prefix).
func Subject(r reports.Report) string {
	name := r.ScenarioName
	if strings.TrimSpace(name) == "" {
		name = r.ScenarioID
	}
	return fmt.Sprintf("[Minovsky Maps] Report: %s — %s", reports.Reasons[r.Reason], name)
}

// Body is the plain-text email body.
func Body(r reports.Report, appURL string) string {
	details := r.Details
	if details == "" {
		details = "(none)"
	}
	return fmt.Sprintf(`A player reported a published scenario.

Scenario: %s
Link:     %s/s/%s
Reason:   %s
Details:  %s
Received: %s (report #%d)

To take it down, run in the Neon SQL editor (production branch):

  UPDATE scenarios SET taken_down_at = now() WHERE id = '%s';
`, r.ScenarioName, appURL, r.ScenarioID, reports.Reasons[r.Reason], details,
		r.CreatedAt.UTC().Format(time.RFC1123), r.ID, r.ScenarioID)
}

// Notify sends the email.
func (n *Resend) Notify(ctx context.Context, r reports.Report) error {
	payload, err := json.Marshal(map[string]any{
		"from":    sender,
		"to":      []string{n.to},
		"subject": Subject(r),
		"text":    Body(r, n.appURL),
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+n.apiKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("resend: status %d: %s", res.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}
