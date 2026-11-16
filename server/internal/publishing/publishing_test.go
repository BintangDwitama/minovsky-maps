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

// renameWith renames a document and lets the test change anything else in it.
func renameWith(t *testing.T, doc []byte, name string, edit func(map[string]any)) []byte {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(doc, &m); err != nil {
		t.Fatal(err)
	}
	m["meta"].(map[string]any)["name"] = name
	if edit != nil {
		edit(m)
	}
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

const alice, bob int64 = 1, 2

// legacy stores a pre-accounts scenario with an edit token, as old clients created them.
func legacy(t *testing.T, store *memory.Store, id, token string, doc []byte) {
	t.Helper()
	if _, err := store.Create(context.Background(), id, 0, publishing.HashToken(token), publishing.Link, scenario.Facets{}, doc, 1); err != nil {
		t.Fatal(err)
	}
}

func TestPublishGetUpdate(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)

	created, err := svc.Publish(ctx, alice, publishing.Link, example(t, "sample-mesa.scenario.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !publishing.ValidID(created.ID) {
		t.Fatalf("bad id %q", created.ID)
	}
	got, err := svc.Get(ctx, created.ID, 0)
	if err != nil || nameOf(t, got.Doc) != "Sample: Desert Mesa" || got.OwnerID != alice {
		t.Fatalf("get: %v %+v", err, got)
	}

	owner := publishing.Credential{OwnerID: alice}
	if _, err := svc.Update(ctx, created.ID, owner, rename(t, got.Doc, "Desert Mesa v2")); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, created.ID, owner, rename(t, got.Doc, "Desert Mesa v3")); err != nil {
		t.Fatal(err)
	}
	latest, _ := svc.Get(ctx, created.ID, 0)
	if nameOf(t, latest.Doc) != "Desert Mesa v3" {
		t.Fatalf("latest is %s", nameOf(t, latest.Doc))
	}
	if n := store.Versions(created.ID); n != 3 {
		t.Fatalf("versions = %d, want 3", n)
	}
}

func TestPublishNeedsAnAccount(t *testing.T) {
	svc, _ := setup(t)
	if _, err := svc.Publish(context.Background(), 0, "", example(t, "minimal.scenario.json")); !errors.Is(err, publishing.ErrSignedOut) {
		t.Fatalf("got %v", err)
	}
}

func TestOnlyTheOwnerUpdatesAndDeletes(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	doc := example(t, "minimal.scenario.json")
	c, _ := svc.Publish(ctx, alice, publishing.Link, doc)

	cases := []struct {
		name string
		cred publishing.Credential
		want error
	}{
		{"signed out", publishing.Credential{}, publishing.ErrSignedOut},
		{"someone else", publishing.Credential{OwnerID: bob}, publishing.ErrNotOwner},
		{"a token", publishing.Credential{Token: "guess"}, publishing.ErrForbidden},
	}
	for _, tc := range cases {
		if _, err := svc.Update(ctx, c.ID, tc.cred, doc); !errors.Is(err, tc.want) {
			t.Errorf("%s: got %v want %v", tc.name, err, tc.want)
		}
	}
	if err := svc.Delete(ctx, c.ID, bob); !errors.Is(err, publishing.ErrNotOwner) {
		t.Fatalf("delete by other: %v", err)
	}
	if err := svc.Delete(ctx, c.ID, 0); !errors.Is(err, publishing.ErrSignedOut) {
		t.Fatalf("delete signed out: %v", err)
	}
	if store.Versions(c.ID) != 1 {
		t.Fatal("refused changes must not store a version")
	}
	if err := svc.Delete(ctx, c.ID, alice); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get(ctx, c.ID, 0); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("deleted scenario still readable: %v", err)
	}
	if store.RemovedReason(c.ID) != publishing.RemovedByOwner {
		t.Fatalf("reason %q", store.RemovedReason(c.ID))
	}
}

func TestLegacyTokensStillUpdate(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	doc := example(t, "minimal.scenario.json")
	legacy(t, store, "Legacy01", "secret-token", doc)

	if _, err := svc.Update(ctx, "Legacy01", publishing.Credential{}, doc); !errors.Is(err, publishing.ErrMissingToken) {
		t.Fatalf("missing token: %v", err)
	}
	if _, err := svc.Update(ctx, "Legacy01", publishing.Credential{Token: "wrong"}, doc); !errors.Is(err, publishing.ErrForbidden) {
		t.Fatalf("wrong token: %v", err)
	}
	if _, err := svc.Update(ctx, "Legacy01", publishing.Credential{OwnerID: alice}, doc); !errors.Is(err, publishing.ErrNotOwner) {
		t.Fatalf("signed in without the token: %v", err)
	}
	if _, err := svc.Update(ctx, "Legacy01", publishing.Credential{OwnerID: alice, Token: "secret-token"}, doc); err != nil {
		t.Fatalf("right token: %v", err)
	}
	if err := svc.Delete(ctx, "Legacy01", alice); !errors.Is(err, publishing.ErrNotOwner) {
		t.Fatalf("unclaimed scenarios cannot be deleted by accounts: %v", err)
	}
}

func TestClaim(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	doc := example(t, "minimal.scenario.json")
	legacy(t, store, "Legacy01", "tok-1", doc)
	legacy(t, store, "Legacy02", "tok-2", doc)
	legacy(t, store, "Legacy03", "tok-3", doc)
	store.TakeDown("Legacy03")

	claimed, err := svc.Claim(ctx, alice, []publishing.TokenClaim{
		{ID: "Legacy01", Token: "tok-1"},
		{ID: "Legacy02", Token: "wrong"}, // wrong token: skipped
		{ID: "Legacy03", Token: "tok-3"}, // taken down: skipped
		{ID: "zzzzzzzz", Token: "x"},     // unknown: skipped
		{ID: "../bad", Token: "x"},       // malformed: skipped
	})
	if err != nil || len(claimed) != 1 || claimed[0] != "Legacy01" {
		t.Fatalf("claimed %v %v", claimed, err)
	}
	if store.Owner("Legacy01") != alice {
		t.Fatal("owner not set")
	}
	// the old token no longer works; the owner's session does
	if _, err := svc.Update(ctx, "Legacy01", publishing.Credential{Token: "tok-1"}, doc); !errors.Is(err, publishing.ErrForbidden) {
		t.Fatalf("old token after claim: %v", err)
	}
	if _, err := svc.Update(ctx, "Legacy01", publishing.Credential{OwnerID: alice}, doc); err != nil {
		t.Fatalf("owner after claim: %v", err)
	}
	// claiming twice (or by someone else) does nothing
	if again, _ := svc.Claim(ctx, bob, []publishing.TokenClaim{{ID: "Legacy01", Token: "tok-1"}}); len(again) != 0 {
		t.Fatalf("re-claim: %v", again)
	}
	if _, err := svc.Claim(ctx, 0, nil); !errors.Is(err, publishing.ErrSignedOut) {
		t.Fatalf("claim signed out: %v", err)
	}
}

func TestListOwned(t *testing.T) {
	ctx := context.Background()
	svc, _ := setup(t)
	a, _ := svc.Publish(ctx, alice, publishing.Link, rename(t, example(t, "minimal.scenario.json"), "First"))
	b, _ := svc.Publish(ctx, alice, publishing.Link, rename(t, example(t, "minimal.scenario.json"), "Second"))
	_, _ = svc.Publish(ctx, bob, publishing.Link, example(t, "minimal.scenario.json"))
	_ = svc.Delete(ctx, a.ID, alice)

	list, err := svc.ListOwned(ctx, alice)
	if err != nil || len(list) != 1 || list[0].ID != b.ID || list[0].Name != "Second" {
		t.Fatalf("list %+v %v", list, err)
	}
	if _, err := svc.ListOwned(ctx, 0); !errors.Is(err, publishing.ErrSignedOut) {
		t.Fatalf("signed out: %v", err)
	}
}

func TestInvalidDocumentsAreRejected(t *testing.T) {
	ctx := context.Background()
	svc, store := setup(t)
	bad, _ := fs.ReadFile(schema.Examples, "examples/invalid/off-board-carrier.json")
	_, err := svc.Publish(ctx, alice, publishing.Link, bad)
	var inv *scenario.Invalid
	if !errors.As(err, &inv) {
		t.Fatalf("expected *scenario.Invalid, got %v", err)
	}

	created, _ := svc.Publish(ctx, alice, publishing.Link, example(t, "minimal.scenario.json"))
	future, _ := fs.ReadFile(schema.Examples, "examples/invalid/future-version.json")
	if _, err := svc.Update(ctx, created.ID, publishing.Credential{OwnerID: alice}, future); !errors.As(err, &inv) {
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
		if _, err := svc.Get(ctx, id, 0); !errors.Is(err, publishing.ErrNotFound) {
			t.Fatalf("%q: %v", id, err)
		}
	}
	created, _ := svc.Publish(ctx, alice, publishing.Link, example(t, "minimal.scenario.json"))
	store.TakeDown(created.ID)
	if _, err := svc.Get(ctx, created.ID, 0); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("taken down should read as not found: %v", err)
	}
	if _, err := svc.Update(ctx, created.ID, publishing.Credential{OwnerID: alice}, example(t, "minimal.scenario.json")); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("taken down should not update: %v", err)
	}
}

func TestIDsAreUniqueAndWellFormed(t *testing.T) {
	ctx := context.Background()
	svc, _ := setup(t)
	doc := example(t, "minimal.scenario.json")
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		c, err := svc.Publish(ctx, alice, publishing.Link, doc)
		if err != nil {
			t.Fatal(err)
		}
		if seen[c.ID] || !publishing.ValidID(c.ID) {
			t.Fatalf("bad or duplicate id %q", c.ID)
		}
		seen[c.ID] = true
	}
}
