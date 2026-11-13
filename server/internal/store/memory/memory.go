// Package memory is an in-memory store (publishing, reports and accounts) for tests and local
// runs without a database.
package memory

import (
	"bytes"
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/BintangDwitama/minovsky-maps/server/internal/accounts"
	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

type version struct {
	doc           json.RawMessage
	schemaVersion int
	at            time.Time
}

type scenario struct {
	tokenHash     []byte
	ownerID       int64
	versions      []version
	takenDown     bool
	removedReason string
}

type session struct {
	accountID int64
	expiresAt time.Time
}

type loginState struct {
	accounts.LoginState
	used bool
}

// Store keeps everything in maps. Safe for concurrent use.
type Store struct {
	mu       sync.Mutex
	data     map[string]*scenario
	reports  []StoredReport
	accounts map[int64]*accounts.Account
	sessions map[string]session
	logins   map[string]*loginState
	nextID   int64
	now      func() time.Time
}

// New returns an empty store using the real clock.
func New() *Store { return NewWithClock(time.Now) }

// NewWithClock lets tests control timestamps.
func NewWithClock(now func() time.Time) *Store {
	return &Store{
		data:     map[string]*scenario{},
		accounts: map[int64]*accounts.Account{},
		sessions: map[string]session{},
		logins:   map[string]*loginState{},
		now:      now,
	}
}

/* ---------------- publishing.Repository ---------------- */

func (s *Store) Create(_ context.Context, id string, ownerID int64, tokenHash []byte, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.data[id]; ok {
		return time.Time{}, publishing.ErrIDTaken
	}
	at := s.now()
	s.data[id] = &scenario{tokenHash: tokenHash, ownerID: ownerID, versions: []version{{clone(doc), schemaVersion, at}}}
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
	rec := publishing.Record{ID: id, EditTokenHash: sc.tokenHash, OwnerID: sc.ownerID, Doc: clone(v.doc), UpdatedAt: v.at, TakenDown: sc.takenDown}
	if a, ok := s.accounts[sc.ownerID]; ok {
		rec.OwnerName = a.DisplayName
	}
	return rec, nil
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

func (s *Store) ListOwned(_ context.Context, ownerID int64) ([]publishing.Summary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []publishing.Summary{}
	for id, sc := range s.data {
		if sc.ownerID != ownerID || sc.takenDown {
			continue
		}
		v := sc.versions[len(sc.versions)-1]
		out = append(out, publishing.Summary{ID: id, Name: nameOf(v.doc), UpdatedAt: v.at})
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (s *Store) Claim(_ context.Context, id string, tokenHash []byte, ownerID int64) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sc, ok := s.data[id]
	if !ok || sc.takenDown || sc.ownerID != 0 || sc.tokenHash == nil || !bytes.Equal(sc.tokenHash, tokenHash) {
		return false, nil
	}
	sc.ownerID, sc.tokenHash = ownerID, nil
	return true, nil
}

func (s *Store) Remove(_ context.Context, id, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sc, ok := s.data[id]
	if !ok {
		return publishing.ErrNotFound
	}
	sc.takenDown, sc.removedReason = true, reason
	return nil
}

/* ---------------- reports.Repository ---------------- */

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
	return nameOf(sc.versions[len(sc.versions)-1].doc), nil
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

/* ---------------- accounts.Store ---------------- */

func (s *Store) SaveLoginState(_ context.Context, st accounts.LoginState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logins[string(st.StateHash)] = &loginState{LoginState: st}
	return nil
}

func (s *Store) UseLoginState(_ context.Context, stateHash []byte, now time.Time) (accounts.LoginState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, ok := s.logins[string(stateHash)]
	if !ok || st.used || !now.Before(st.ExpiresAt) {
		return accounts.LoginState{}, accounts.ErrNotFound
	}
	st.used = true
	return st.LoginState, nil
}

func (s *Store) UpsertGoogleAccount(_ context.Context, sub, email, displayName string) (accounts.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, a := range s.accounts {
		if a.GoogleSub == sub {
			a.Email = email
			return *a, nil
		}
	}
	s.nextID++
	a := &accounts.Account{ID: s.nextID, GoogleSub: sub, Email: email, DisplayName: displayName, CreatedAt: s.now()}
	s.accounts[a.ID] = a
	return *a, nil
}

func (s *Store) CreateSession(_ context.Context, tokenHash []byte, accountID int64, expiresAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[string(tokenHash)] = session{accountID, expiresAt}
	return nil
}

func (s *Store) SessionAccount(_ context.Context, tokenHash []byte, now time.Time) (accounts.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	se, ok := s.sessions[string(tokenHash)]
	if !ok || !now.Before(se.expiresAt) {
		return accounts.Account{}, accounts.ErrNotFound
	}
	a, ok := s.accounts[se.accountID]
	if !ok {
		return accounts.Account{}, accounts.ErrNotFound
	}
	return *a, nil
}

func (s *Store) DeleteSession(_ context.Context, tokenHash []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, string(tokenHash))
	return nil
}

func (s *Store) DeleteExpired(_ context.Context, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for k, se := range s.sessions {
		if !now.Before(se.expiresAt) {
			delete(s.sessions, k)
		}
	}
	for k, st := range s.logins {
		if !now.Before(st.ExpiresAt) {
			delete(s.logins, k)
		}
	}
	return nil
}

func (s *Store) RenameAccount(_ context.Context, id int64, displayName string) (accounts.Account, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.accounts[id]
	if !ok {
		return accounts.Account{}, accounts.ErrNotFound
	}
	a.DisplayName = displayName
	return *a, nil
}

func (s *Store) DeleteAccount(_ context.Context, id int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, sc := range s.data {
		if sc.ownerID == id {
			if !sc.takenDown {
				sc.takenDown, sc.removedReason = true, publishing.RemovedAccountGone
			}
			sc.ownerID = 0
		}
	}
	for k, se := range s.sessions {
		if se.accountID == id {
			delete(s.sessions, k)
		}
	}
	delete(s.accounts, id)
	return nil
}

/* ---------------- test helpers ---------------- */

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

// TakeDown marks a scenario as taken down by moderation (tests; production uses SQL).
func (s *Store) TakeDown(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sc, ok := s.data[id]; ok {
		sc.takenDown, sc.removedReason = true, publishing.RemovedByModeration
	}
}

// RemovedReason reports why a scenario was taken down ("" if live; tests).
func (s *Store) RemovedReason(id string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sc, ok := s.data[id]; ok {
		return sc.removedReason
	}
	return ""
}

// Owner reports a scenario's owner id (0 if unowned; tests).
func (s *Store) Owner(id string) int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sc, ok := s.data[id]; ok {
		return sc.ownerID
	}
	return 0
}

// SessionCount reports how many sessions exist (tests).
func (s *Store) SessionCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.sessions)
}

// AccountCount reports how many accounts exist (tests).
func (s *Store) AccountCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.accounts)
}

func nameOf(doc json.RawMessage) string {
	var d struct {
		Meta struct{ Name string } `json:"meta"`
	}
	_ = json.Unmarshal(doc, &d)
	return d.Meta.Name
}

func clone(b json.RawMessage) json.RawMessage { return append(json.RawMessage(nil), b...) }
