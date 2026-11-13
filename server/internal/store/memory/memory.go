// Package memory is an in-memory publishing.Repository for tests and local runs without a database.
package memory

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

type version struct {
	doc           json.RawMessage
	schemaVersion int
	at            time.Time
}

type scenario struct {
	tokenHash []byte
	versions  []version
	takenDown bool
}

// Store keeps everything in a map. Safe for concurrent use.
type Store struct {
	mu      sync.Mutex
	data    map[string]*scenario
	reports []StoredReport
	now     func() time.Time
}

// New returns an empty store using the real clock.
func New() *Store { return &Store{data: map[string]*scenario{}, now: time.Now} }

// NewWithClock lets tests control timestamps.
func NewWithClock(now func() time.Time) *Store {
	return &Store{data: map[string]*scenario{}, now: now}
}

func (s *Store) Create(_ context.Context, id string, tokenHash []byte, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.data[id]; ok {
		return time.Time{}, publishing.ErrIDTaken
	}
	at := s.now()
	s.data[id] = &scenario{tokenHash: tokenHash, versions: []version{{clone(doc), schemaVersion, at}}}
	return at, nil
}

func (s *Store) Latest(_ context.Context, id string) (publishing.Record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sc, ok := s.data[id]
	if !ok {
		return publishing.Record{}, publishing.ErrNotFound
	}
	v := sc.versions[len(sc.versions)-1]
	return publishing.Record{ID: id, EditTokenHash: sc.tokenHash, Doc: clone(v.doc), UpdatedAt: v.at, TakenDown: sc.takenDown}, nil
}

func (s *Store) AddVersion(_ context.Context, id string, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sc, ok := s.data[id]
	if !ok {
		return time.Time{}, publishing.ErrNotFound
	}
	at := s.now()
	sc.versions = append(sc.versions, version{clone(doc), schemaVersion, at})
	return at, nil
}

// StoredReport is a report kept in memory (tests and local runs).
type StoredReport struct {
	ID         int64
	ScenarioID string
	Reason     string
	Details    string
	At         time.Time
	Emailed    bool
}

// ScenarioName returns the latest version's name; ErrNotFound for unknown or taken-down scenarios.
func (s *Store) ScenarioName(_ context.Context, id string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sc, ok := s.data[id]
	if !ok || sc.takenDown {
		return "", publishing.ErrNotFound
	}
	var doc struct {
		Meta struct{ Name string } `json:"meta"`
	}
	_ = json.Unmarshal(sc.versions[len(sc.versions)-1].doc, &doc)
	return doc.Meta.Name, nil
}

// AddReport stores a report.
func (s *Store) AddReport(_ context.Context, scenarioID, reason, details string) (int64, time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	at := s.now()
	r := StoredReport{ID: int64(len(s.reports) + 1), ScenarioID: scenarioID, Reason: reason, Details: details, At: at}
	s.reports = append(s.reports, r)
	return r.ID, at, nil
}

// MarkEmailed records that the owner was notified.
func (s *Store) MarkEmailed(_ context.Context, id int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.reports {
		if s.reports[i].ID == id {
			s.reports[i].Emailed = true
		}
	}
	return nil
}

// Reports returns a copy of all stored reports (tests).
func (s *Store) Reports() []StoredReport {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]StoredReport(nil), s.reports...)
}

// Ping always succeeds.
func (s *Store) Ping(context.Context) error { return nil }

// Versions reports how many versions a scenario has (tests).
func (s *Store) Versions(id string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sc, ok := s.data[id]; ok {
		return len(sc.versions)
	}
	return 0
}

// TakeDown marks a scenario as taken down (tests; production uses SQL).
func (s *Store) TakeDown(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sc, ok := s.data[id]; ok {
		sc.takenDown = true
	}
}

func clone(b json.RawMessage) json.RawMessage { return append(json.RawMessage(nil), b...) }
