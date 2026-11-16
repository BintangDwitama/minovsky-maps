// Package postgres is the production store (publishing, reports, accounts) on PostgreSQL (Neon) via pgx.
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
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Store implements publishing.Repository, reports.Repository and accounts.Store.
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

func (s *Store) Create(ctx context.Context, id string, ownerID int64, tokenHash []byte, v publishing.Visibility, f scenario.Facets, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	var at time.Time
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO scenarios (id, owner_id, edit_token_hash, visibility) VALUES ($1, $2, $3, $4)`,
			id, nullID(ownerID), tokenHash, string(v)); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
				return publishing.ErrIDTaken
			}
			return err
		}
		if err := tx.QueryRow(ctx,
			`INSERT INTO scenario_versions (scenario_id, doc, schema_version) VALUES ($1, $2, $3) RETURNING created_at`,
			id, []byte(doc), schemaVersion).Scan(&at); err != nil {
			return err
		}
		if err := writeFacets(ctx, tx, id, f, at); err != nil {
			return err
		}
		if v == publishing.Public {
			_, err := tx.Exec(ctx, `UPDATE scenarios SET listed_at = $2 WHERE id = $1`, id, at)
			return err
		}
		return nil
	})
	return at, err
}

// writeFacets stores the searchable facts of the latest version.
func writeFacets(ctx context.Context, tx pgx.Tx, id string, f scenario.Facets, updatedAt time.Time) error {
	_, err := tx.Exec(ctx, `
		UPDATE scenarios SET name = $2, description = $3, board_width = $4, board_height = $5,
			hex_count = $6, deployment = $7, squad_size = $8, has_elevation = $9, updated_at = $10
		WHERE id = $1`,
		id, f.Name, f.Description, nullInt(f.Width), nullInt(f.Height), f.HexCount, f.Deployment,
		f.SquadSize, f.HasElevation, updatedAt)
	return err
}

func nullInt(n int) *int {
	if n == 0 {
		return nil
	}
	return &n
}

func (s *Store) Latest(ctx context.Context, id string) (publishing.Record, error) {
	var (
		rec       = publishing.Record{ID: id}
		doc       []byte
		takenDown *time.Time
		ownerID   *int64
		ownerName *string
		vis       string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT s.edit_token_hash, s.owner_id, a.display_name, s.visibility, s.taken_down_at, v.doc, v.created_at
		FROM scenarios s
		LEFT JOIN accounts a ON a.id = s.owner_id
		JOIN LATERAL (
			SELECT doc, created_at FROM scenario_versions
			WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
		) v ON true
		WHERE s.id = $1`, id).Scan(&rec.EditTokenHash, &ownerID, &ownerName, &vis, &takenDown, &doc, &rec.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return publishing.Record{}, publishing.ErrNotFound
	}
	if err != nil {
		return publishing.Record{}, err
	}
	rec.Doc = doc
	rec.TakenDown = takenDown != nil
	rec.Visibility = publishing.Visibility(vis)
	if ownerID != nil {
		rec.OwnerID = *ownerID
	}
	if ownerName != nil {
		rec.OwnerName = *ownerName
	}
	return rec, nil
}

// ListOwned returns the owner's live scenarios, newest update first.
func (s *Store) ListOwned(ctx context.Context, ownerID int64) ([]publishing.Summary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT s.id, coalesce(v.doc->'meta'->>'name', ''), s.visibility, v.created_at
		FROM scenarios s
		JOIN LATERAL (
			SELECT doc, created_at FROM scenario_versions
			WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
		) v ON true
		WHERE s.owner_id = $1 AND s.taken_down_at IS NULL
		ORDER BY v.created_at DESC, s.id`, ownerID)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (publishing.Summary, error) {
		var sum publishing.Summary
		var vis string
		err := r.Scan(&sum.ID, &sum.Name, &vis, &sum.UpdatedAt)
		sum.Visibility = publishing.Visibility(vis)
		return sum, err
	})
	if out == nil {
		out = []publishing.Summary{}
	}
	return out, err
}

// Claim gives an unclaimed, live scenario with a matching token hash to ownerID.
func (s *Store) Claim(ctx context.Context, id string, tokenHash []byte, ownerID int64) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE scenarios SET owner_id = $3, edit_token_hash = NULL
		WHERE id = $1 AND owner_id IS NULL AND edit_token_hash = $2 AND taken_down_at IS NULL`,
		id, tokenHash, ownerID)
	return tag.RowsAffected() == 1, err
}

// Remove takes a scenario down, recording why.
func (s *Store) Remove(ctx context.Context, id, reason string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE scenarios SET taken_down_at = now(), removed_reason = $2 WHERE id = $1 AND taken_down_at IS NULL`,
		id, reason)
	if err == nil && tag.RowsAffected() == 0 {
		return publishing.ErrNotFound
	}
	return err
}

func nullID(id int64) *int64 {
	if id == 0 {
		return nil
	}
	return &id
}

// ScenarioName returns the latest version's name; ErrNotFound for unknown or taken-down scenarios.
func (s *Store) ScenarioName(ctx context.Context, id string) (string, error) {
	var (
		name      *string
		takenDown *time.Time
		vis       string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT v.doc->'meta'->>'name', s.taken_down_at, s.visibility
		FROM scenarios s
		JOIN LATERAL (
			SELECT doc FROM scenario_versions
			WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
		) v ON true
		WHERE s.id = $1`, id).Scan(&name, &takenDown, &vis)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && (takenDown != nil || vis == string(publishing.Private))) {
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

func (s *Store) AddVersion(ctx context.Context, id string, f scenario.Facets, doc json.RawMessage, schemaVersion int) (time.Time, error) {
	var at time.Time
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx,
			`INSERT INTO scenario_versions (scenario_id, doc, schema_version) VALUES ($1, $2, $3) RETURNING created_at`,
			id, []byte(doc), schemaVersion).Scan(&at); err != nil {
			return err
		}
		return writeFacets(ctx, tx, id, f, at)
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
		return time.Time{}, publishing.ErrNotFound
	}
	return at, err
}
