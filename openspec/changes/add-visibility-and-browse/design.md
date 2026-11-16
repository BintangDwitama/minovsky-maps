## Context

After `add-google-accounts`:
- Every new scenario is owned by an account.
- Reads are open to anyone with the id.
- The `scenarios` table holds an id, an owner, a legacy token hash and takedown fields. Documents live in `scenario_versions` as `jsonb`.
- The web has a ScenarioPublisher port (publish, update, fetch, remove), an AccountService (with listOwned), a PublishDialog (confirm, working, done) and a MyScenariosDialog with account and browser modes.
- The sheet renders the board through BoardView. The editor already has `rectangleSize` in the domain.

Constraints:
- free Neon and Vercel, both of which sleep when idle;
- no new vendors;
- the IP rule;
- emails never leave the server.

## Goals / Non-Goals

**Goals:**
- Visibility enforced on the server everywhere a scenario can leak: reads, reports, browse and claims.
- A browse page that is fast enough on the free tier.
- No change for existing links.

**Non-Goals:**
- Forks.
- Likes.
- Author pages.
- Full-text search.
- Image thumbnails.
- Moderation UI.

## Decisions

### 1. Visibility is a column; hiding is a service rule
```sql
ALTER TABLE scenarios
  ADD visibility text NOT NULL DEFAULT 'link' CHECK (visibility IN ('private','link','public')),
  ADD listed_at timestamptz;          -- set whenever it becomes public
```
- **Existing rows** get `'link'` from the column default. The Go service always passes an explicit visibility, with new saves defaulting to `private`, so the database default only matters for existing rows.
- **Claims** keep the scenario's visibility, which is `link`.
- **One gate in `publishing.Service.lookup(ctx, id, viewer)`:** a scenario is not found when it is taken down, or when `visibility = 'private' && viewer != owner`. Every read path goes through this gate: Get, Update, Delete and SetVisibility.
- **Reports:** `reports` uses `ScenarioName`, which now also treats `private` as not found. Reports carry no viewer, so a private scenario can't be reported even by its owner, which is fine.
- *Alternative:* a separate private-drafts table. Rejected: it would duplicate the versioning and give different ids, and an id must not change when visibility changes.

### 2. Facets are denormalised at write time
```sql
ALTER TABLE scenarios
  ADD name text, ADD description text,
  ADD board_width int, ADD board_height int,   -- NULL unless the board is a full rectangle
  ADD hex_count int, ADD deployment text, ADD squad_size int,
  ADD has_elevation boolean, ADD updated_at timestamptz;
CREATE INDEX scenarios_browse_listed  ON scenarios (listed_at DESC, id)  WHERE visibility = 'public' AND taken_down_at IS NULL;
CREATE INDEX scenarios_browse_updated ON scenarios (updated_at DESC, id) WHERE visibility = 'public' AND taken_down_at IS NULL;
```
- `internal/scenario.Facets(doc)` (Go, pure, tested) derives name, description, rectangle size, hex count, deployment, squad size and elevation. The rectangle rule ports the web's `rectangleSize`, and a shared conformance case keeps the two in step.
- The repository's `Create` and `AddVersion` write the facets in the same transaction as the version.
- **Backfill:** on startup the store recomputes facets for rows where `updated_at IS NULL` in batches of 100. This runs once after the migration, at the cost of a little time at first boot.
- *Alternative:* query `jsonb` from the latest version at browse time. Rejected: it needs a lateral join per row plus jsonb expressions per filter, which is slow and can't be indexed on the free tier.

### 3. Browse API and paging
- **Request:** `GET /api/browse?q&size=standard|smaller|larger&deployment=bases|carriers&squad=1..10&elevation=1&sort=new|updated&cursor=`.
- **Filters** become plain `WHERE` clauses:
  - `q` uses `ILIKE '%q%'` on name, description and `accounts.display_name`, with `%`, `_` and `\` escaped and at most 60 characters;
  - `standard` means `board_width=15 AND board_height=15`;
  - `smaller` means `hex_count < 225`, and `larger` means `hex_count > 225`.
- **Keyset paging:** order by `(listed_at|updated_at) DESC, id DESC`. The cursor is base64url of `<unix-micro>.<id>` and continues with `WHERE (key, id) < (cursor_key, cursor_id)`. That is stable while new scenarios are listed. The page size is 24; the server fetches 25 to know whether there's a next page.
- **Response:**
  ```json
  { "items": [ { "id", "name", "ownerName", "width", "height", "hexCount",
                 "deployment", "squadSize", "hasElevation", "listedAt", "updatedAt",
                 "scenario": { … } } ],
    "next": "<cursor>|null" }
  ```
  The `scenario` document comes from a lateral join to the latest version, and only for the 24 rows on the page.
- **Rate limit:** a separate "browse" bucket that is more generous, because reads are cheap.
- `Cache-Control: no-store`, so visibility changes show at once. Caching can come later.
- `?q` shorter than 2 characters is ignored, not rejected.
- *Alternative:* return only facets and fetch each thumbnail document separately. Rejected: 24 extra requests on a sleepy free tier. Documents are small, typically 5–20 KB.

### 4. Visibility API
- `POST /api/scenarios` accepts an optional `visibility` in the body (default `private`).
- `PATCH /api/scenarios/{id}` with `{visibility}` is owner only, needs the session and the client header, and is limited by the "write" bucket. It returns `{visibility}`.
- `GET /api/scenarios/{id}` includes `visibility` when `isOwner`.
- `/api/me/scenarios` items include `visibility`.
- Legacy-token updates can't change visibility. Those scenarios are unclaimed and stay `link`.

### 5. Web
**Ports:**
- `ScenarioPublisher.publish(s, visibility)`;
- `setVisibility(id, v)`;
- `fetch` returns `visibility?`;
- `OwnedScenario.visibility`;
- a new `ScenarioBrowser` port, `browse(query, cursor)`, with an `HttpScenarioBrowser` adapter.

**Application:**
- `publishScenario(session, publisher, visibility)`;
- `changeVisibility(publisher, id, v)`;
- `Visibility` type with labels in `application/visibility.ts`;
- `BrowseQuery` parse/serialize to the URL search string (pure, tested).

**UI:**
- `molecules/VisibilityPicker`: a radio group with three options and a one-line explanation each. Each option has an icon and a text label, so meaning doesn't rely on colour.
- `organisms/SaveOnlineDialog` replaces PublishDialog:
  - **confirm:** picker, default Only me, plus the IP note;
  - **working;**
  - **done:** link plus the picker, now live — changing it calls setVisibility, shows "Saved" and keeps the link.
  - Update online keeps the working/done states without the picker.
- **Toolbar:** "Save online" or "Update online", plus a "Browse" button (desktop) and Menu item (compact).
- **MyScenariosDialog (account mode):** a visibility badge per row and a "Who can see it" select that saves on change.
- **PublishedSheetPage:** owner banner for private scenarios ("Only you can see this", with the picker inline); a Browse link in the header actions.
- **BrowsePage** (`/browse`, router path like `/s/`):
  - `BrowseFilters` reads and writes `location.search` via `history.replaceState`;
  - a grid of `ScenarioCard`;
  - Load more;
  - empty state with Clear filters;
  - a waking-up notice reused from the sheet.
- `molecules/BoardThumbnail`:
  - renders `BoardView` in a small svg with `role="img"` and an aria-label such as "Board, 15 by 15 hexes";
  - draws only once on screen (IntersectionObserver), so 24 boards don't render at once on phones.
- **Cards:** a link, so they open in a new tab and are announced by screen readers; 44 px targets on touch.

## Risks / Trade-offs

- **[Risk] Private leaks through another path** (reports, claim, browse, sheet). → Every path uses the one `lookup` gate or the browse `WHERE visibility='public'`. There are handler tests for each path with a non-owner.
- **[Risk] Browse payloads on a phone** (24 documents). → Typical pages are 100–400 KB uncompressed, and gzip on Vercel and Cloudflare shrinks JSON well. Thumbnails render lazily. If it becomes a problem, we can move to a facet-only list plus a compact board summary.
- **[Risk] Backfill on cold start** delays the first request after deploy. → Batches of 100 run in the background after the server starts listening. Browse shows only rows with facets.
- **[Trade-off] `ILIKE` without trigram indexes** scans the public rows, which is fine for thousands. Add `pg_trgm` later if needed.
- **[Trade-off] Defaulting to Only me** means a user can "Save online" and then share a link that others can't open. → The done dialog states it plainly and offers the switch right there. The sheet banner repeats it for the owner.
- **[Risk] The wording change from Publish to Save online** may confuse returning users. → The same icon and position, and the dialog explains the visibility choice.

## Migration Plan

1. Deploy the server. Migration `0004` is additive: existing rows become `link`, and the facet backfill runs in the background.
2. Deploy the web.
3. **Rollback:** previous builds ignore the new columns. Private scenarios saved in between would become readable through the previous API, so in an emergency roll back only both together, or set them to `link` explicitly first.

## Open Questions

- None blocking. Page size (24) and the browse rate limit can be tuned later.
