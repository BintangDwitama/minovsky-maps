// Package publishing is the use-case layer: publish, read, update, delete and claim scenarios.
// It owns ids, ownership rules, legacy edit tokens and validation, and depends only on the
// Repository and Validator interfaces it declares (implemented by internal/store/* and
// internal/scenario).
//
// Scenarios published since accounts exist are owned by an account (OwnerID). Older scenarios
// carry an edit-token hash instead ("legacy") until an account claims them with that token.
package publishing

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"regexp"
	"time"
)

var (
	// ErrNotFound: unknown or taken-down scenario.
	ErrNotFound = errors.New("scenario not found")
	// ErrSignedOut: the action needs a signed-in account.
	ErrSignedOut = errors.New("sign-in required")
	// ErrNotOwner: signed in, but not as the scenario's owner.
	ErrNotOwner = errors.New("not the owner of this scenario")
	// ErrMissingToken: a legacy update without credentials.
	ErrMissingToken = errors.New("edit token required")
	// ErrForbidden: a legacy update with the wrong edit token (or a token for an owned scenario).
	ErrForbidden = errors.New("edit token does not match")
	// ErrIDTaken is returned by a Repository when a new id already exists.
	ErrIDTaken = errors.New("id already taken")
)

// Removal reasons recorded with a takedown.
const (
	RemovedByOwner      = "owner"
	RemovedAccountGone  = "account-deleted"
	RemovedByModeration = "moderation"
)

// Record is what a Repository returns for the latest version of a scenario.
type Record struct {
	ID            string
	EditTokenHash []byte // nil for owned scenarios
	OwnerID       int64  // 0 for unclaimed legacy scenarios
	OwnerName     string // owner's display name (empty when unowned)
	Doc           json.RawMessage
	UpdatedAt     time.Time
	TakenDown     bool
}

// Summary is one entry of an owner's list.
type Summary struct {
	ID        string
	Name      string
	UpdatedAt time.Time
}

// Repository stores scenarios and their immutable versions.
type Repository interface {
	// Create stores a new scenario with its first version; ErrIDTaken if the id exists.
	// Exactly one of ownerID (non-zero) and tokenHash (legacy) is set.
	Create(ctx context.Context, id string, ownerID int64, tokenHash []byte, doc json.RawMessage, schemaVersion int) (time.Time, error)
	// Latest returns the newest version; ErrNotFound if the id does not exist.
	Latest(ctx context.Context, id string) (Record, error)
	// AddVersion appends a version to an existing scenario.
	AddVersion(ctx context.Context, id string, doc json.RawMessage, schemaVersion int) (time.Time, error)
	// ListOwned returns the owner's scenarios that are not taken down, newest update first.
	ListOwned(ctx context.Context, ownerID int64) ([]Summary, error)
	// Claim makes ownerID the owner of an unclaimed, live scenario whose token hash matches and
	// clears the hash; it reports whether it did.
	Claim(ctx context.Context, id string, tokenHash []byte, ownerID int64) (bool, error)
	// Remove takes a scenario down, recording why.
	Remove(ctx context.Context, id, reason string) error
}

// Validator checks a document and returns its schemaVersion (implemented by scenario.Validator).
type Validator interface {
	Validate(raw []byte) (int, error)
}

// Service implements publishing.
type Service struct {
	repo     Repository
	validate Validator
	random   func([]byte) (int, error)
}

// NewService wires the service.
func NewService(repo Repository, v Validator) *Service {
	return &Service{repo: repo, validate: v, random: rand.Read}
}

// Published is a scenario as read by anyone.
type Published struct {
	ID        string
	Doc       json.RawMessage
	UpdatedAt time.Time
	OwnerID   int64  // 0 when unowned; never sent to clients
	OwnerName string // the verified author shown on sheets
}

// Created is the result of a publish.
type Created struct {
	ID        string
	UpdatedAt time.Time
}

// Credential is who is asking to change a scenario: a signed-in account, a legacy edit token, or both.
type Credential struct {
	OwnerID int64
	Token   string
}

// TokenClaim is one legacy scenario a browser holds an edit token for.
type TokenClaim struct {
	ID    string
	Token string
}

const (
	idLength      = 8
	idAlphabet    = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	maxIDAttempts = 5
	// MaxClaims caps one claim request.
	MaxClaims = 100
)

var idPattern = regexp.MustCompile(`^[A-Za-z0-9]{8}$`)

// ValidID reports whether s looks like a scenario id (cheap pre-check before hitting storage).
func ValidID(s string) bool { return idPattern.MatchString(s) }

// Publish validates and stores a new scenario owned by ownerID.
func (s *Service) Publish(ctx context.Context, ownerID int64, doc []byte) (Created, error) {
	if ownerID == 0 {
		return Created{}, ErrSignedOut
	}
	version, err := s.validate.Validate(doc)
	if err != nil {
		return Created{}, err
	}
	for attempt := 0; attempt < maxIDAttempts; attempt++ {
		id, err := s.newID()
		if err != nil {
			return Created{}, err
		}
		at, err := s.repo.Create(ctx, id, ownerID, nil, doc, version)
		if errors.Is(err, ErrIDTaken) {
			continue
		}
		if err != nil {
			return Created{}, err
		}
		return Created{ID: id, UpdatedAt: at}, nil
	}
	return Created{}, errors.New("could not allocate a scenario id")
}

// Get returns the latest version of a published scenario.
func (s *Service) Get(ctx context.Context, id string) (Published, error) {
	rec, err := s.lookup(ctx, id)
	if err != nil {
		return Published{}, err
	}
	return Published{ID: rec.ID, Doc: rec.Doc, UpdatedAt: rec.UpdatedAt, OwnerID: rec.OwnerID, OwnerName: rec.OwnerName}, nil
}

// Update stores a new version for the owner, or with the right token for an unclaimed scenario.
func (s *Service) Update(ctx context.Context, id string, c Credential, doc []byte) (time.Time, error) {
	rec, err := s.lookup(ctx, id)
	if err != nil {
		return time.Time{}, err
	}
	if err := authorize(rec, c); err != nil {
		return time.Time{}, err
	}
	version, err := s.validate.Validate(doc)
	if err != nil {
		return time.Time{}, err
	}
	return s.repo.AddVersion(ctx, id, doc, version)
}

func authorize(rec Record, c Credential) error {
	if rec.OwnerID != 0 {
		switch {
		case c.OwnerID == rec.OwnerID:
			return nil
		case c.OwnerID != 0:
			return ErrNotOwner
		case c.Token != "":
			return ErrForbidden // a claimed scenario no longer accepts its old token
		default:
			return ErrSignedOut
		}
	}
	if c.Token == "" {
		if c.OwnerID != 0 {
			return ErrNotOwner
		}
		return ErrMissingToken
	}
	if subtle.ConstantTimeCompare(rec.EditTokenHash, HashToken(c.Token)) != 1 {
		return ErrForbidden
	}
	return nil
}

// Delete takes down a scenario at its owner's request.
func (s *Service) Delete(ctx context.Context, id string, ownerID int64) error {
	if ownerID == 0 {
		return ErrSignedOut
	}
	rec, err := s.lookup(ctx, id)
	if err != nil {
		return err
	}
	if rec.OwnerID != ownerID {
		return ErrNotOwner
	}
	return s.repo.Remove(ctx, id, RemovedByOwner)
}

// Claim gives ownerID every unclaimed scenario among items whose token matches; it returns the
// ids it claimed. Unknown ids and wrong tokens are skipped, not reported as errors.
func (s *Service) Claim(ctx context.Context, ownerID int64, items []TokenClaim) ([]string, error) {
	if ownerID == 0 {
		return nil, ErrSignedOut
	}
	claimed := []string{}
	for _, it := range items {
		if !ValidID(it.ID) || it.Token == "" {
			continue
		}
		ok, err := s.repo.Claim(ctx, it.ID, HashToken(it.Token), ownerID)
		if err != nil {
			return claimed, err
		}
		if ok {
			claimed = append(claimed, it.ID)
		}
	}
	return claimed, nil
}

// ListOwned returns the account's live scenarios, newest first.
func (s *Service) ListOwned(ctx context.Context, ownerID int64) ([]Summary, error) {
	if ownerID == 0 {
		return nil, ErrSignedOut
	}
	return s.repo.ListOwned(ctx, ownerID)
}

func (s *Service) lookup(ctx context.Context, id string) (Record, error) {
	if !ValidID(id) {
		return Record{}, ErrNotFound
	}
	rec, err := s.repo.Latest(ctx, id)
	if err != nil {
		return Record{}, err
	}
	if rec.TakenDown {
		return Record{}, ErrNotFound
	}
	return rec, nil
}

func (s *Service) newID() (string, error) {
	out := make([]byte, 0, idLength)
	buf := make([]byte, 16)
	for len(out) < idLength {
		if _, err := s.random(buf); err != nil {
			return "", err
		}
		for _, b := range buf {
			// rejection sampling keeps the distribution uniform (248 = 4 * 62)
			if b < 248 && len(out) < idLength {
				out = append(out, idAlphabet[int(b)%len(idAlphabet)])
			}
		}
	}
	return string(out), nil
}

// HashToken is how edit tokens are stored and compared (SHA-256).
func HashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
