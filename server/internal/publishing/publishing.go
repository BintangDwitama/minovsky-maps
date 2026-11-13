// Package publishing is the use-case layer: publish, read and update scenarios.
// It owns ids, edit tokens and validation, and depends only on the Repository and Validator
// interfaces it declares (implemented by internal/store/* and internal/scenario).
package publishing

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"regexp"
	"time"
)

var (
	// ErrNotFound: unknown or taken-down scenario.
	ErrNotFound = errors.New("scenario not found")
	// ErrMissingToken: an update without an edit token.
	ErrMissingToken = errors.New("edit token required")
	// ErrForbidden: an update with the wrong edit token.
	ErrForbidden = errors.New("edit token does not match")
	// ErrIDTaken is returned by a Repository when a new id already exists.
	ErrIDTaken = errors.New("id already taken")
)

// Record is what a Repository returns for the latest version of a scenario.
type Record struct {
	ID            string
	EditTokenHash []byte
	Doc           json.RawMessage
	UpdatedAt     time.Time
	TakenDown     bool
}

// Repository stores scenarios and their immutable versions.
type Repository interface {
	// Create stores a new scenario with its first version; ErrIDTaken if the id exists.
	Create(ctx context.Context, id string, tokenHash []byte, doc json.RawMessage, schemaVersion int) (time.Time, error)
	// Latest returns the newest version; ErrNotFound if the id does not exist.
	Latest(ctx context.Context, id string) (Record, error)
	// AddVersion appends a version to an existing scenario.
	AddVersion(ctx context.Context, id string, doc json.RawMessage, schemaVersion int) (time.Time, error)
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
}

// Created is the result of a publish; EditToken is returned exactly once.
type Created struct {
	ID        string
	EditToken string
	UpdatedAt time.Time
}

const (
	idLength      = 8
	idAlphabet    = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	tokenBytes    = 32
	maxIDAttempts = 5
)

var idPattern = regexp.MustCompile(`^[A-Za-z0-9]{8}$`)

// ValidID reports whether s looks like a scenario id (cheap pre-check before hitting storage).
func ValidID(s string) bool { return idPattern.MatchString(s) }

// Publish validates and stores a new scenario.
func (s *Service) Publish(ctx context.Context, doc []byte) (Created, error) {
	version, err := s.validate.Validate(doc)
	if err != nil {
		return Created{}, err
	}
	token, err := s.newToken()
	if err != nil {
		return Created{}, err
	}
	for attempt := 0; attempt < maxIDAttempts; attempt++ {
		id, err := s.newID()
		if err != nil {
			return Created{}, err
		}
		at, err := s.repo.Create(ctx, id, hashToken(token), doc, version)
		if errors.Is(err, ErrIDTaken) {
			continue
		}
		if err != nil {
			return Created{}, err
		}
		return Created{ID: id, EditToken: token, UpdatedAt: at}, nil
	}
	return Created{}, errors.New("could not allocate a scenario id")
}

// Get returns the latest version of a published scenario.
func (s *Service) Get(ctx context.Context, id string) (Published, error) {
	rec, err := s.lookup(ctx, id)
	if err != nil {
		return Published{}, err
	}
	return Published{ID: rec.ID, Doc: rec.Doc, UpdatedAt: rec.UpdatedAt}, nil
}

// Update stores a new version if the edit token matches.
func (s *Service) Update(ctx context.Context, id, token string, doc []byte) (time.Time, error) {
	if token == "" {
		return time.Time{}, ErrMissingToken
	}
	rec, err := s.lookup(ctx, id)
	if err != nil {
		return time.Time{}, err
	}
	if subtle.ConstantTimeCompare(rec.EditTokenHash, hashToken(token)) != 1 {
		return time.Time{}, ErrForbidden
	}
	version, err := s.validate.Validate(doc)
	if err != nil {
		return time.Time{}, err
	}
	return s.repo.AddVersion(ctx, id, doc, version)
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

func (s *Service) newToken() (string, error) {
	b := make([]byte, tokenBytes)
	if _, err := s.random(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
