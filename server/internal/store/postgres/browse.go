package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/BintangDwitama/minovsky-maps/server/internal/publishing"
	"github.com/BintangDwitama/minovsky-maps/server/internal/scenario"
)

// SetVisibility changes who can see a scenario; becoming public records the listing time.
func (s *Store) SetVisibility(ctx context.Context, id string, v publishing.Visibility) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE scenarios
		SET listed_at = CASE WHEN $2 = 'public' AND visibility <> 'public' THEN now() ELSE listed_at END,
		    visibility = $2
		WHERE id = $1`, id, string(v))
	if err == nil && tag.RowsAffected() == 0 {
		return publishing.ErrNotFound
	}
	return err
}

// escapeLike makes user text literal inside an ILIKE pattern (escape character \).
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// Browse lists public, live scenarios whose facets are computed, filtered and keyset-paged.
// Ids are compared with COLLATE "C" so the order matches the cursor (and the memory store).
func (s *Store) Browse(ctx context.Context, q publishing.BrowseQuery) ([]publishing.BrowseItem, error) {
	key := "s.listed_at"
	if q.Sort == publishing.SortUpdated {
		key = "s.updated_at"
	}
	where := []string{"s.visibility = 'public'", "s.taken_down_at IS NULL", "s.updated_at IS NOT NULL", key + " IS NOT NULL"}
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if q.Q != "" {
		p := arg("%" + escapeLike(q.Q) + "%")
		where = append(where, fmt.Sprintf("(s.name ILIKE %[1]s OR s.description ILIKE %[1]s OR a.display_name ILIKE %[1]s)", p))
	}
	switch q.Size {
	case publishing.SizeStandard:
		where = append(where, fmt.Sprintf("s.board_width = %s AND s.board_height = %s", arg(publishing.StandardWidth), arg(publishing.StandardHeight)))
	case publishing.SizeSmaller:
		where = append(where, "s.hex_count < "+arg(publishing.StandardHexes))
	case publishing.SizeLarger:
		where = append(where, "s.hex_count > "+arg(publishing.StandardHexes))
	}
	if q.Deployment != "" {
		where = append(where, "s.deployment = "+arg(q.Deployment))
	}
	if q.Squad != 0 {
		where = append(where, "s.squad_size = "+arg(q.Squad))
	}
	if q.Elevation {
		where = append(where, "s.has_elevation")
	}
	if c := q.After; c != nil {
		where = append(where, fmt.Sprintf(`(%s, s.id COLLATE "C") < (%s, %s COLLATE "C")`, key, arg(c.Key), arg(c.ID)))
	}
	limit := q.Limit
	if limit <= 0 {
		limit = publishing.BrowsePageSize
	}
	sql := fmt.Sprintf(`
		SELECT s.id, coalesce(s.name, ''), coalesce(a.display_name, ''), coalesce(s.board_width, 0),
		       coalesce(s.board_height, 0), coalesce(s.hex_count, 0), coalesce(s.deployment, ''),
		       coalesce(s.squad_size, 0), coalesce(s.has_elevation, false),
		       coalesce(s.listed_at, s.updated_at), s.updated_at, v.doc
		FROM scenarios s
		LEFT JOIN accounts a ON a.id = s.owner_id
		JOIN LATERAL (
			SELECT doc FROM scenario_versions WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
		) v ON true
		WHERE %s
		ORDER BY %s DESC, s.id COLLATE "C" DESC
		LIMIT %d`, strings.Join(where, " AND "), key, limit)
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (publishing.BrowseItem, error) {
		var (
			it  publishing.BrowseItem
			doc []byte
		)
		err := r.Scan(&it.ID, &it.Name, &it.OwnerName, &it.Width, &it.Height, &it.HexCount,
			&it.Deployment, &it.SquadSize, &it.HasElevation, &it.ListedAt, &it.UpdatedAt, &doc)
		it.Doc = doc
		return it, err
	})
	if items == nil {
		items = []publishing.BrowseItem{}
	}
	return items, err
}

// BackfillFacets computes facets for scenarios saved before facets existed, in batches, until
// none are left or ctx ends. Safe to run on every start: it only touches rows without facets.
func (s *Store) BackfillFacets(ctx context.Context, log *slog.Logger) {
	total := 0
	for ctx.Err() == nil {
		rows, err := s.pool.Query(ctx, `
			SELECT s.id, v.doc, v.created_at
			FROM scenarios s
			JOIN LATERAL (
				SELECT doc, created_at FROM scenario_versions WHERE scenario_id = s.id ORDER BY id DESC LIMIT 1
			) v ON true
			WHERE s.updated_at IS NULL
			LIMIT 100`)
		if err != nil {
			log.Warn("facet backfill stopped", "err", err)
			return
		}
		type row struct {
			id  string
			doc []byte
			at  time.Time
		}
		batch, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (row, error) {
			var x row
			err := r.Scan(&x.id, &x.doc, &x.at)
			return x, err
		})
		if err != nil {
			log.Warn("facet backfill stopped", "err", err)
			return
		}
		if len(batch) == 0 {
			break
		}
		for _, x := range batch {
			f, err := scenario.ComputeFacets(x.doc)
			if err != nil {
				f = scenario.Facets{} // unreadable document: store empty facets so it is not retried
			}
			if err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error { return writeFacets(ctx, tx, x.id, f, x.at) }); err != nil {
				log.Warn("facet backfill stopped", "err", err)
				return
			}
		}
		total += len(batch)
	}
	if total > 0 {
		log.Info("facet backfill done", "scenarios", total)
	}
}
