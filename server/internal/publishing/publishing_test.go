package publishing_test

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/schema"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/memory"
)

func setup(t *testing.T) (*publishing.Service, *memory.Store) {
	t.Helper()
	v, err := scenario.NewValidator()
	if err != nil {
		t.Fatal(err)
	}
	store := memory.New()
	return publishing.NewService(store, v), store
}

func example(t *testing.T, name string) []byte {
	t.Helper()
	b, err := fs.ReadFile(schema.Examples, "examples/"+name)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func rename(t *testing.T, doc []byte, name string) []byte {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(doc, &m); err != nil {
		t.Fatal(err)
	}
	m["meta"].(map[string]any)["name"] = name
	out, _ := json.Marshal(m)
	return out
}

func nameOf(t *testing.T, doc []byte) string {
	t.Helper()
	var m struct {
		Meta struct{ Name string } `json:"meta"`
	}
	if err := json.Unmarshal(doc, &m); err != nil {
		t.Fatal(err)
	}
	return m.Meta.Name
}

func TestPublishGetUpdate(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)

	created, err := svc.Publish(ctx, example(t, "sample-mesa.scenario.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !publishing.ValidID(created.ID) {
		t.Fatalf("bad id %q", created.ID)
	}
	if len(created.EditToken) < 40 {
		t.Fatalf("token too short: %q", created.EditToken)
	}

	got, err := svc.Get(ctx, created.ID)
	if err != nil || nameOf(t, got.Doc) != "Sample: Desert Mesa" {
		t.Fatalf("get: %v %s", err, got.Doc)
	}

	if _, err := svc.Update(ctx, created.ID, created.EditToken, rename(t, got.Doc, "Desert Mesa v2")); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, created.ID, created.EditToken, rename(t, got.Doc, "Desert Mesa v3")); err != nil {
		t.Fatal(err)
	}
	latest, _ := svc.Get(ctx, created.ID)
	if nameOf(t, latest.Doc) != "Desert Mesa v3" {
		t.Fatalf("latest is %s", nameOf(t, latest.Doc))
	}
	if n := store.Versions(created.ID); n != 3 {
		t.Fatalf("versions = %d, want 3", n)
	}
}

func TestUpdateNeedsTheRightToken(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	doc := example(t, "minimal.scenario.json")
	created, _ := svc.Publish(ctx, doc)

	if _, err := svc.Update(ctx, created.ID, "", doc); !errors.Is(err, publishing.ErrMissingToken) {
		t.Fatalf("missing token: %v", err)
	}
	if _, err := svc.Update(ctx, created.ID, "wrong-token", doc); !errors.Is(err, publishing.ErrForbidden) {
		t.Fatalf("wrong token: %v", err)
	}
	if store.Versions(created.ID) != 1 {
		t.Fatal("a refused update must not store a version")
	}
}

func TestInvalidDocumentsAreRejected(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	bad, _ := fs.ReadFile(schema.Examples, "examples/invalid/off-board-carrier.json")
	_, err := svc.Publish(ctx, bad)
	var inv *scenario.Invalid
	if !errors.As(err, &inv) {
		t.Fatalf("expected *scenario.Invalid, got %v", err)
	}

	created, _ := svc.Publish(ctx, example(t, "minimal.scenario.json"))
	future, _ := fs.ReadFile(schema.Examples, "examples/invalid/future-version.json")
	if _, err := svc.Update(ctx, created.ID, created.EditToken, future); !errors.As(err, &inv) {
		t.Fatalf("unsupported schemaVersion should be invalid, got %v", err)
	}
	if store.Versions(created.ID) != 1 {
		t.Fatal("invalid update stored a version")
	}
}

func TestNotFoundAndTakedown(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	for _, id := range []string{"zzzzzzzz", "short", "../etc/x", ""} {
		if _, err := svc.Get(ctx, id); !errors.Is(err, publishing.ErrNotFound) {
			t.Fatalf("%q: %v", id, err)
		}
	}
	created, _ := svc.Publish(ctx, example(t, "minimal.scenario.json"))
	store.TakeDown(created.ID)
	if _, err := svc.Get(ctx, created.ID); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("taken down should read as not found: %v", err)
	}
	if _, err := svc.Update(ctx, created.ID, created.EditToken, example(t, "minimal.scenario.json")); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("taken down should not update: %v", err)
	}
}

func TestIDsAreUniqueAndWellFormed(t *testing.T) {
	ctx := context.Background()
	svc, _ := setup(t)
	doc := example(t, "minimal.scenario.json")
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		c, err := svc.Publish(ctx, doc)
		if err != nil {
			t.Fatal(err)
		}
		if seen[c.ID] || !publishing.ValidID(c.ID) {
			t.Fatalf("bad or duplicate id %q", c.ID)
		}
		seen[c.ID] = true
	}
}
