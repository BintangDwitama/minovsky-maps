package reports_test

import (
	"context"
	"errors"
	"io/fs"
	"strings"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/schema"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/reports"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

type recordingNotifier struct {
	got  []reports.Report
	fail error
}

func (n *recordingNotifier) Notify(_ context.Context, r reports.Report) error {
	n.got = append(n.got, r)
	return n.fail
}

func setup(t *testing.T, n reports.Notifier) (*reports.Service, *memory.Store, string) {
	t.Helper()
	store := memory.New()
	v, _ := scenario.NewValidator()
	doc, _ := fs.ReadFile(schema.Examples, "examples/sample-mesa.scenario.json")
	created, err := publishing.NewService(store, v).Publish(context.Background(), doc)
	if err != nil {
		t.Fatal(err)
	}
	return reports.NewService(store, n, nil), store, created.ID
}

func TestReportIsStoredThenEmailed(t *testing.T) {
	n := &recordingNotifier{}
	svc, store, id := setup(t, n)
	err := svc.Report(context.Background(), reports.Input{ScenarioID: id, Reason: "official-copy", Details: "  starter map  "})
	if err != nil {
		t.Fatal(err)
	}
	stored := store.Reports()
	if len(stored) != 1 || stored[0].Details != "starter map" || !stored[0].Emailed {
		t.Fatalf("stored %+v", stored)
	}
	if len(n.got) != 1 || n.got[0].ScenarioName != "Sample: Desert Mesa" {
		t.Fatalf("notified %+v", n.got)
	}
}

func TestEmailFailureKeepsTheReport(t *testing.T) {
	n := &recordingNotifier{fail: errors.New("smtp down")}
	svc, store, id := setup(t, n)
	if err := svc.Report(context.Background(), reports.Input{ScenarioID: id, Reason: "spam"}); err != nil {
		t.Fatalf("reporter should still see success: %v", err)
	}
	if s := store.Reports(); len(s) != 1 || s[0].Emailed {
		t.Fatalf("stored %+v", s)
	}
}

func TestNotConfiguredStoresQuietly(t *testing.T) {
	svc, store, id := setup(t, reports.NoNotifier{})
	if err := svc.Report(context.Background(), reports.Input{ScenarioID: id, Reason: "other"}); err != nil {
		t.Fatal(err)
	}
	if len(store.Reports()) != 1 {
		t.Fatal("report not stored")
	}
}

func TestValidation(t *testing.T) {
	svc, store, id := setup(t, &recordingNotifier{})
	ctx := context.Background()
	var inv *reports.Invalid
	if err := svc.Report(ctx, reports.Input{ScenarioID: id, Reason: "nope"}); !errors.As(err, &inv) {
		t.Fatalf("bad reason: %v", err)
	}
	long := strings.Repeat("é", reports.MaxDetails+1)
	if err := svc.Report(ctx, reports.Input{ScenarioID: id, Reason: "other", Details: long}); !errors.As(err, &inv) {
		t.Fatalf("too long: %v", err)
	}
	ok := strings.Repeat("é", reports.MaxDetails)
	if err := svc.Report(ctx, reports.Input{ScenarioID: id, Reason: "other", Details: ok}); err != nil {
		t.Fatalf("1000 characters should be fine: %v", err)
	}
	if err := svc.Report(ctx, reports.Input{ScenarioID: "zzzzzzzz", Reason: "spam"}); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("unknown scenario: %v", err)
	}
	store.TakeDown(id)
	if err := svc.Report(ctx, reports.Input{ScenarioID: id, Reason: "spam"}); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("taken down: %v", err)
	}
	if n := len(store.Reports()); n != 1 {
		t.Fatalf("only the valid report should be stored, got %d", n)
	}
}
