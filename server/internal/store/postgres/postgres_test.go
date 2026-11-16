package postgres_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
	"github.com/BintangDwitama/minovsky-maps/server/internal/store/postgres"
)

// Integration tests: run only with TEST_DATABASE_URL (use a disposable Neon branch, never production).
func open(t *testing.T) *postgres.Store {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres integration tests")
	}
	s, err := postgres.Open(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s
}

func TestRepositoryRoundTrip(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	id := "T" + randomSuffix(t)
	doc := json.RawMessage(`{"schemaVersion":1,"meta":{"name":"x"}}`)

	if _, err := s.Create(ctx, id, 0, []byte("hash"), publishing.Link, scenario.Facets{}, doc, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(ctx, id, 0, []byte("hash"), publishing.Link, scenario.Facets{}, doc, 1); !errors.Is(err, publishing.ErrIDTaken) {
		t.Fatalf("duplicate id: %v", err)
	}
	if _, err := s.AddVersion(ctx, id, scenario.Facets{}, json.RawMessage(`{"schemaVersion":1,"meta":{"name":"y"}}`), 1); err != nil {
		t.Fatal(err)
	}
	rec, err := s.Latest(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	var m struct {
		Meta struct{ Name string } `json:"meta"`
	}
	_ = json.Unmarshal(rec.Doc, &m)
	if m.Meta.Name != "y" || string(rec.EditTokenHash) != "hash" || rec.TakenDown {
		t.Fatalf("unexpected record %+v (%s)", rec, rec.Doc)
	}
	if _, err := s.Latest(ctx, "Zzzzzzz0"); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("missing id: %v", err)
	}
	if _, err := s.AddVersion(ctx, "Zzzzzzz0", scenario.Facets{}, rec.Doc, 1); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("version for missing id: %v", err)
	}
}

func TestReports(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	id := "R" + randomSuffix(t)
	if _, err := s.Create(ctx, id, 0, []byte("h"), publishing.Link, scenario.Facets{}, json.RawMessage(`{"schemaVersion":1,"meta":{"name":"Mesa"}}`), 1); err != nil {
		t.Fatal(err)
	}
	name, err := s.ScenarioName(ctx, id)
	if err != nil || name != "Mesa" {
		t.Fatalf("name %q err %v", name, err)
	}
	rid, at, err := s.AddReport(ctx, id, "spam", "details")
	if err != nil || rid == 0 || at.IsZero() {
		t.Fatalf("add report: %d %v %v", rid, at, err)
	}
	if err := s.MarkEmailed(ctx, rid); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ScenarioName(ctx, "Zzzzzzz0"); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("unknown: %v", err)
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	s := open(t)
	_ = s // Open already migrated once; opening again must not fail.
	open(t)
}

func TestAccountsOwnershipAndClaim(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	now := time.Now()
	sub := "test-" + randomSuffix(t)

	a, err := s.UpsertGoogleAccount(ctx, sub, "a@example.com", "Tester")
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.UpsertGoogleAccount(ctx, sub, "new@example.com", "Ignored")
	if err != nil || again.ID != a.ID || again.Email != "new@example.com" || again.DisplayName != "Tester" {
		t.Fatalf("upsert: %+v %v", again, err)
	}

	// login states are single use
	st := accounts.LoginState{StateHash: []byte("state-" + sub), Nonce: "n", Verifier: "v", ReturnTo: "/", ExpiresAt: now.Add(time.Minute)}
	if err := s.SaveLoginState(ctx, st); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UseLoginState(ctx, st.StateHash, now); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UseLoginState(ctx, st.StateHash, now); !errors.Is(err, accounts.ErrNotFound) {
		t.Fatalf("reuse: %v", err)
	}

	// sessions
	tok := []byte("session-" + sub)
	if err := s.CreateSession(ctx, tok, a.ID, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if got, err := s.SessionAccount(ctx, tok, now); err != nil || got.ID != a.ID {
		t.Fatalf("session: %+v %v", got, err)
	}
	if _, err := s.SessionAccount(ctx, tok, now.Add(2*time.Hour)); !errors.Is(err, accounts.ErrNotFound) {
		t.Fatalf("expired: %v", err)
	}

	// owned and legacy scenarios, claim, list, remove
	doc := json.RawMessage(`{"schemaVersion":1,"meta":{"name":"Owned"}}`)
	owned, legacy := "O"+randomSuffix(t), "L"+randomSuffix(t)
	if _, err := s.Create(ctx, owned, a.ID, nil, publishing.Link, scenario.Facets{}, doc, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(ctx, legacy, 0, []byte("tokhash"), publishing.Link, scenario.Facets{}, doc, 1); err != nil {
		t.Fatal(err)
	}
	if rec, _ := s.Latest(ctx, owned); rec.OwnerID != a.ID || rec.OwnerName != "Tester" {
		t.Fatalf("owner on read: %+v", rec)
	}
	if ok, _ := s.Claim(ctx, legacy, []byte("wrong"), a.ID); ok {
		t.Fatal("wrong hash claimed")
	}
	if ok, err := s.Claim(ctx, legacy, []byte("tokhash"), a.ID); !ok || err != nil {
		t.Fatalf("claim: %v %v", ok, err)
	}
	list, err := s.ListOwned(ctx, a.ID)
	if err != nil || len(list) != 2 {
		t.Fatalf("list: %+v %v", list, err)
	}
	if err := s.Remove(ctx, owned, publishing.RemovedByOwner); err != nil {
		t.Fatal(err)
	}

	// deleting the account takes the rest down and removes sessions
	if err := s.DeleteAccount(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	if rec, _ := s.Latest(ctx, legacy); !rec.TakenDown || rec.OwnerID != 0 {
		t.Fatalf("after account deletion: %+v", rec)
	}
	if _, err := s.SessionAccount(ctx, tok, now); !errors.Is(err, accounts.ErrNotFound) {
		t.Fatalf("session survived: %v", err)
	}
}
func TestVisibilityAndBrowse(t *testing.T) {
	ctx := context.Background()
	s := open(t)
	a, err := s.UpsertGoogleAccount(ctx, "browse-"+randomSuffix(t), "b@example.com", "Browse Tester "+randomSuffix(t))
	if err != nil {
		t.Fatal(err)
	}
	doc := json.RawMessage(`{"schemaVersion":1,"meta":{"name":"x"}}`)
	tag := randomSuffix(t) // unique search text, so other rows on the branch don't interfere
	facets := scenario.Facets{Name: "Browse " + tag, Width: 15, Height: 15, HexCount: 225, Deployment: "carriers", SquadSize: 4, HasElevation: true}
	priv, pub := "P"+randomSuffix(t), "Q"+randomSuffix(t)
	if _, err := s.Create(ctx, priv, a.ID, nil, publishing.Private, facets, doc, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(ctx, pub, a.ID, nil, publishing.Link, facets, doc, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ScenarioName(ctx, priv); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("private must not be reportable: %v", err)
	}
	if rec, _ := s.Latest(ctx, priv); rec.Visibility != publishing.Private {
		t.Fatalf("visibility %q", rec.Visibility)
	}
	search := func(q publishing.BrowseQuery) []publishing.BrowseItem {
		t.Helper()
		q.Q, q.Limit = tag, 25
		items, err := s.Browse(ctx, q)
		if err != nil {
			t.Fatal(err)
		}
		return items
	}
	if n := len(search(publishing.BrowseQuery{})); n != 0 {
		t.Fatalf("link scenarios must not be listed: %d", n)
	}
	if err := s.SetVisibility(ctx, pub, publishing.Public); err != nil {
		t.Fatal(err)
	}
	items := search(publishing.BrowseQuery{Size: publishing.SizeStandard, Deployment: "carriers", Squad: 4, Elevation: true})
	if len(items) != 1 || items[0].ID != pub || items[0].OwnerName != a.DisplayName || items[0].ListedAt.IsZero() || len(items[0].Doc) == 0 {
		t.Fatalf("browse: %+v", items)
	}
	if n := len(search(publishing.BrowseQuery{Deployment: "bases"})); n != 0 {
		t.Fatalf("filter: %d", n)
	}
	if n := len(search(publishing.BrowseQuery{After: &publishing.Cursor{Key: items[0].ListedAt, ID: items[0].ID}})); n != 0 {
		t.Fatalf("cursor after the only item: %d", n)
	}
	if _, err := s.AddVersion(ctx, pub, scenario.Facets{Name: "Renamed " + tag, HexCount: 10, Deployment: "bases"}, doc, 1); err != nil {
		t.Fatal(err)
	}
	if got := search(publishing.BrowseQuery{Size: publishing.SizeSmaller, Sort: publishing.SortUpdated}); len(got) != 1 || got[0].Name != "Renamed "+tag {
		t.Fatalf("facets after update: %+v", got)
	}
	if list, _ := s.ListOwned(ctx, a.ID); len(list) != 2 || list[0].Visibility == "" {
		t.Fatalf("owned: %+v", list)
	}
	if err := s.DeleteAccount(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	s.BackfillFacets(ctx, slog.Default()) // rows saved before facets existed (no-op when none)
}
func randomSuffix(t *testing.T) string {
	t.Helper()
	const a = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 7)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	for i := range b {
		b[i] = a[int(b[i])%len(a)]
	}
	return string(b)
}
