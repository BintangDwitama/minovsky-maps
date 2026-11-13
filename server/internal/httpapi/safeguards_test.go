package httpapi_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/httpapi"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
)

// fakeBot accepts the token "human", rejects others, and can simulate Cloudflare being down.
type fakeBot struct{ down bool }

func (b fakeBot) Verify(_ context.Context, token, _ string) error {
	if b.down {
		return errors.New("cloudflare unreachable")
	}
	if token != "human" {
		return httpapi.ErrBot
	}
	return nil
}

// safeguards is a fixture with a bot check, reports, and alice signed in.
type safeguards struct {
	*fixture
	as []string
}

func newSafeguards(t *testing.T, bot httpapi.BotCheck, burst int) *safeguards {
	t.Helper()
	// sign in on a lenient handler, then serve the tests with the requested limits
	f := newFixture(t, httpapi.Options{WritesPerMinute: 100, WriteBurst: 100})
	s := &safeguards{fixture: f, as: f.signIn(t, "alice")}
	v, _ := scenario.NewValidator()
	f.h = httpapi.New(publishing.NewService(f.store, v), f.store, httpapi.Options{
		Bot:             bot,
		Reports:         reports.NewService(f.store, reports.NoNotifier{}, nil),
		Accounts:        accounts.NewService(f.store, fakeGoogle{}, nil),
		WritesPerMinute: burst,
		WriteBurst:      burst,
	})
	return s
}

// publish sends a scenario as alice.
func (s *safeguards) publish(body string, headers ...string) *httptest.ResponseRecorder {
	return s.do("POST", "/api/scenarios", body, append(headers, s.as...)...)
}
func withToken(t *testing.T, file, token string) string {
	t.Helper()
	body := wrap(t, file)
	return strings.TrimSuffix(body, "}") + `,"turnstileToken":"` + token + `"}`
}

func TestBotCheckOnWrites(t *testing.T) {
	s := newSafeguards(t, fakeBot{}, 100)
	if rec := s.publish(wrap(t, "examples/minimal.scenario.json")); rec.Code != 403 {
		t.Fatalf("no token: %d", rec.Code)
	}
	if rec := s.publish(withToken(t, "examples/minimal.scenario.json", "robot")); rec.Code != 403 || !strings.Contains(rec.Body.String(), `"code":"bot-check"`) {
		t.Fatalf("bad token: %d %s", rec.Code, rec.Body)
	}
	rec := s.publish(withToken(t, "examples/minimal.scenario.json", "human"))
	if rec.Code != 201 {
		t.Fatalf("human: %d %s", rec.Code, rec.Body)
	}
	c := decode[created](t, rec)
	if rec := s.do("PUT", "/api/scenarios/"+c.ID, wrap(t, "examples/minimal.scenario.json"), s.as...); rec.Code != 403 {
		t.Fatalf("update without token: %d", rec.Code)
	}
	if n := s.store.Versions(c.ID); n != 1 {
		t.Fatalf("refused update stored a version: %d", n)
	}
}

func TestBotCheckOutageFailsClosed(t *testing.T) {
	s := newSafeguards(t, fakeBot{down: true}, 100)
	rec := s.publish(withToken(t, "examples/minimal.scenario.json", "human"))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("outage: %d", rec.Code)
	}
}

func TestNoBotCheckConfigured(t *testing.T) {
	s := newSafeguards(t, nil, 100)
	if rec := s.publish(wrap(t, "examples/minimal.scenario.json")); rec.Code != 201 {
		t.Fatalf("without a check, writes pass: %d", rec.Code)
	}
}

func TestReportEndpoint(t *testing.T) {
	s := newSafeguards(t, fakeBot{}, 100)
	c := decode[created](t, s.publish(withToken(t, "examples/minimal.scenario.json", "human")))
	report := func(id, reason, details, token string) *httptest.ResponseRecorder {
		body := `{"scenarioId":"` + id + `","reason":"` + reason + `","details":"` + details + `","turnstileToken":"` + token + `"}`
		return s.do("POST", "/api/reports", body, "X-Forwarded-For", "198.51.100.7")
	}

	if rec := report(c.ID, "spam", "", "robot"); rec.Code != 403 {
		t.Fatalf("bot: %d", rec.Code)
	}
	if rec := report(c.ID, "nope", "", "human"); rec.Code != 400 {
		t.Fatalf("bad reason: %d", rec.Code)
	}
	if rec := report("zzzzzzzz", "spam", "", "human"); rec.Code != 404 {
		t.Fatalf("unknown scenario: %d", rec.Code)
	}
	if rec := report(c.ID, "spam", "dup", "human"); rec.Code != 201 {
		t.Fatalf("valid: %d %s", rec.Code, rec.Body)
	}
	if n := len(s.store.Reports()); n != 1 {
		t.Fatalf("stored %d reports", n)
	}
}

func TestReportRateLimitHasItsOwnBucket(t *testing.T) {
	s := newSafeguards(t, fakeBot{}, 1)
	c := decode[created](t, s.publish(withToken(t, "examples/minimal.scenario.json", "human")))
	ip := []string{"X-Forwarded-For", "198.51.100.7"}
	report := `{"scenarioId":"` + c.ID + `","reason":"spam","turnstileToken":"human"}`
	if rec := s.do("POST", "/api/reports", report, ip...); rec.Code != 201 {
		t.Fatalf("first report: %d", rec.Code)
	}
	if rec := s.do("POST", "/api/reports", report, ip...); rec.Code != 429 {
		t.Fatalf("second report should be limited: %d", rec.Code)
	}
	// reports and writes are counted separately: publishing from the same IP still works
	pub := s.publish(withToken(t, "examples/minimal.scenario.json", "human"), ip...)
	if pub.Code != 201 {
		t.Fatalf("publishing after reports: %d", pub.Code)
	}
	if n := len(s.store.Reports()); n != 1 {
		t.Fatalf("stored %d reports", n)
	}
}
