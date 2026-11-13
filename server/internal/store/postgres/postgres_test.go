package postgres_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
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

	if _, err := s.Create(ctx, id, []byte("hash"), doc, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(ctx, id, []byte("hash"), doc, 1); !errors.Is(err, publishing.ErrIDTaken) {
		t.Fatalf("duplicate id: %v", err)
	}
	if _, err := s.AddVersion(ctx, id, json.RawMessage(`{"schemaVersion":1,"meta":{"name":"y"}}`), 1); err != nil {
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
	if _, err := s.AddVersion(ctx, "Zzzzzzz0", rec.Doc, 1); !errors.Is(err, publishing.ErrNotFound) {
		t.Fatalf("version for missing id: %v", err)
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	s := open(t)
	_ = s // Open already migrated once; opening again must not fail.
	open(t)
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
