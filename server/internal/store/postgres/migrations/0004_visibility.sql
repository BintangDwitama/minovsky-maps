-- Visibility (private / link / public) and searchable facts for Browse.
-- Existing scenarios were shared by link, so they become 'link'; the service passes an explicit
-- visibility for new ones (default private).
ALTER TABLE scenarios
    ADD COLUMN visibility    text NOT NULL DEFAULT 'link' CHECK (visibility IN ('private', 'link', 'public')),
    ADD COLUMN listed_at     timestamptz,
    ADD COLUMN name          text,
    ADD COLUMN description   text,
    ADD COLUMN board_width   int,
    ADD COLUMN board_height  int,
    ADD COLUMN hex_count     int,
    ADD COLUMN deployment    text,
    ADD COLUMN squad_size    int,
    ADD COLUMN has_elevation boolean,
    -- NULL until facets are computed (new saves set it; a startup backfill fills old rows)
    ADD COLUMN updated_at    timestamptz;

CREATE INDEX scenarios_browse_listed ON scenarios (listed_at DESC, id DESC)
    WHERE visibility = 'public' AND taken_down_at IS NULL;
CREATE INDEX scenarios_browse_updated ON scenarios (updated_at DESC, id DESC)
    WHERE visibility = 'public' AND taken_down_at IS NULL;
CREATE INDEX scenarios_facets_missing ON scenarios (id) WHERE updated_at IS NULL;
