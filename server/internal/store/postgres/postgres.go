// Package postgres is the production publishing.Repository on PostgreSQL (Neon) via pgx.
package postgres

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Store implements publishing.Repository.
type Store struct {
	pool *pgxpool.Pool
}

// Open connects, applies pending migrations and returns the store.
func Open(ctx context.Context, databaseURL string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database url: %w", err)
	}
	cfg.MaxConns = 5 // free tier: keep the footprint small
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := Migrate(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

// Close releases connections.
func (s *Store) Close() { s.pool.Close() }

// Ping checks the database (also wakes a scaled-to-zero Neon compute).
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// Migrate applies embedded migrations in file-name order, once each, under an advisory lock.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	files, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(7342001)`); err != nil {
		return fmt.Errorf("migrate lock: %w", err)
	}
	if _, err := tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	for _, f := range files {
		version := strings.TrimSuffix(strings.TrimPrefix(f, "migrations/"), ".sql")
		var done bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&done); err != nil {
			return fmt.Errorf("migrate %s: %w", version, err)
		}
		if done {
			continue
		}
		sql, err := migrations.ReadFile(f)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("migrate %s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			return fmt.Errorf("migrate %s: %w", version, err)
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) Create(ctx context.Context, id string, tokenHash []byte, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	var at time.Time
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO scenarios (id, edit_token_hash) VALUES ($1, $2)`, id, tokenHash); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
				return publishing.ErrIDTaken
			}
			return err
		}
		return tx.QueryRow(ctx,
			`INSERT INTO scenario_versions (scenario_id, doc, schema_version) VALUES ($1, $2, $3) RETURNING created_at`,
			id, []byte(doc), schemaVersion).Scan(&at)
	})
	return at, err
}

func (s *Store) Latest(ctx context.Context, id string) (publishing.Record, error) {
	var (
		rec       = publishing.Record{ID: id}
		doc       []byte
		takenDown *time.Time
	)
	err := s.pool.QueryRow(ctx, `
		SELECT s.edit_token_hash, s.taken_down_at, v.doc, v.created_at
		FROM scenarios s
		JOIN LATERAL (
			SELECT doc, created_at FROM scenario_versions
			WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
		) v ON true
		WHERE s.id = $1`, id).Scan(&rec.EditTokenHash, &takenDown, &doc, &rec.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return publishing.Record{}, publishing.ErrNotFound
	}
	if err != nil {
		return publishing.Record{}, err
	}
	rec.Doc = doc
	rec.TakenDown = takenDown != nil
	return rec, nil
}

// ScenarioName returns the latest version's name; ErrNotFound for unknown or taken-down scenarios.
func (s *Store) ScenarioName(ctx context.Context, id string) (string, error) {
	var (
		name      *string
		takenDown *time.Time
	)
	err := s.pool.QueryRow(ctx, `
		SELECT v.doc->'meta'->>'name', s.taken_down_at
		FROM scenarios s
		JOIN LATERAL (
			SELECT doc FROM scenario_versions
			WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
		) v ON true
		WHERE s.id = $1`, id).Scan(&name, &takenDown)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && takenDown != nil) {
		return "", publishing.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if name == nil {
		return "", nil
	}
	return *name, nil
}

// AddReport stores a report.
func (s *Store) AddReport(ctx context.Context, scenarioID, reason, details string) (int64, time.Time, error) {
	var (
		id int64
		at time.Time
	)
	err := s.pool.QueryRow(ctx,
		`INSERT INTO reports (scenario_id, reason, details) VALUES ($1, $2, $3) RETURNING id, created_at`,
		scenarioID, reason, details).Scan(&id, &at)
	return id, at, err
}

// MarkEmailed records that the owner was notified.
func (s *Store) MarkEmailed(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE reports SET emailed_at = now() WHERE id = $1`, id)
	return err
}

func (s *Store) AddVersion(ctx context.Context, id string, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	var at time.Time
	err := s.pool.QueryRow(ctx,
		`INSERT INTO scenario_versions (scenario_id, doc, schema_version) VALUES ($1, $2, $3) RETURNING created_at`,
		id, []byte(doc), schemaVersion).Scan(&at)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
		return time.Time{}, publishing.ErrNotFound
	}
	return at, err
}
