package notify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
)

var sample = reports.Report{
	ID:           7,
	ScenarioID:   "k3x9mQ2a",
	ScenarioName: "Desert Mesa",
	Reason:       "official-copy",
	Details:      "Looks like the starter scenario.",
	CreatedAt:    time.Date(2026, 11, 14, 9, 0, 0, 0, time.UTC),
}

func TestSubjectAndBody(t *testing.T) {
	if got := Subject(sample); got != "[Minovsky Maps] Report: Copies official material — Desert Mesa" {
		t.Fatalf("subject %q", got)
	}
	body := Body(sample, "https://minovsky-maps.pages.dev")
	for _, want := range []string{
		"https://minovsky-maps.pages.dev/s/k3x9mQ2a",
		"Looks like the starter scenario.",
		"UPDATE scenarios SET taken_down_at = now() WHERE id = 'k3x9mQ2a';",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body misses %q", want)
		}
	}
}

func TestNotify(t *testing.T) {
	var got struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		Text    string   `json:"text"`
	}
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"id":"x"}`))
	}))
	defer srv.Close()

	n := NewResend("re_key", "owner@example.com", "https://app.example/").WithEndpoint(srv.URL)
	if err := n.Notify(context.Background(), sample); err != nil {
		t.Fatal(err)
	}
	if auth != "Bearer re_key" || len(got.To) != 1 || got.To[0] != "owner@example.com" {
		t.Fatalf("auth %q to %v", auth, got.To)
	}
	if !strings.HasPrefix(got.Subject, "[Minovsky Maps] Report:") || !strings.Contains(got.Text, "https://app.example/s/k3x9mQ2a") {
		t.Fatalf("subject %q text %q", got.Subject, got.Text)
	}
}

func TestNotifyFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(403)
		_, _ = w.Write([]byte(`{"message":"You can only send testing emails to your own email address"}`))
	}))
	defer srv.Close()
	err := NewResend("k", "x@example.com", "").WithEndpoint(srv.URL).Notify(context.Background(), sample)
	if err == nil || !strings.Contains(err.Error(), "403") {
		t.Fatalf("expected a 403 error, got %v", err)
	}
}
