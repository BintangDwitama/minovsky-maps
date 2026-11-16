## Why

Today every published scenario is reachable by anyone with its link, and players can only find scenarios through links someone hands them. Creators want to choose:
- keep a map to themselves, saved to their account;
- share it with a link;
- show it to everyone.

Players want a place to discover scenarios. This starts phase 3 (browse and search), using the accounts added in the previous change.

## What Changes

Touches **server** and **web**; no change to the scenario format (`schema/`).

- **Three visibility levels per scenario:**
  - **Only me** (`private`): only the owner can open it. Anyone else gets "not found", for reads, the sheet and reports.
  - **Anyone with the link** (`link`): today's behaviour.
  - **Everyone** (`public`): also listed in Browse.

  New saves default to **Only me**. Existing scenarios keep **Anyone with the link**, and claimed legacy scenarios do too. The owner can change visibility at any time without changing the link.
- **Publish becomes "Save online"** (Update becomes "Update online"):
  - The save dialog has a "Who can see it?" choice.
  - After saving, the dialog shows the link and lets the owner change the choice straight away.
  - My scenarios shows each scenario's visibility and lets the owner change it.
  - Owners see an "Only you can see this" banner on the sheet of a private scenario.
- **Browse page** at `/browse`, open to everyone without signing in:
  - Lists **Everyone** scenarios as cards: a board thumbnail drawn in the browser, the name, the verified author, the board size and deployment.
  - Search by name, description or author. Filters: board size (standard 15×15, smaller, larger), deployment (Bases or Carriers), squad size, has elevation.
  - Sorted newest listed first, or recently updated. Paged with "Load more".
  - Reached from the toolbar (the phone Menu too) and from sheets.
- **Server facets:** each scenario stores a few searchable facts (name, description, board shape, deployment, squad size, elevation), updated on every save. Existing rows are backfilled at startup.
- **API:**
  - `PATCH /api/scenarios/{id}` sets visibility (owner only);
  - `POST /api/scenarios` accepts a visibility;
  - `GET /api/browse` lists public scenarios with filters and a cursor;
  - reads hide private scenarios from non-owners;
  - owned lists include visibility.

## Capabilities

### New Capabilities
- `scenario-browse`: the Browse page and API (listing, search, filters, sorting, paging, cards and thumbnails).

### Modified Capabilities
- `scenario-publishing`:
  - Publish becomes Save online, with a visibility choice defaulting to Only me;
  - Update becomes Update online;
  - reads hide private scenarios;
  - My scenarios shows and changes visibility;
  - new Visibility requirement.
- `scenario-sheet`: the published sheet shows an owner-only banner for private scenarios and a link to Browse.

## Non-goals

- Forks with credit, likes, author pages, comments: possible follow-ups.
- Moderation tools beyond the existing reports and SQL takedown.
- Ranking by popularity (no likes or view counts yet).
- Full-text search engines or extensions. Simple matching on the free Postgres is enough at this scale.
- Server-side thumbnail images (thumbnails are drawn in the browser from the scenario).

## Impact

- **Server:**
  - Migration `0004_visibility` adds `visibility`, `listed_at` and facet columns (name, description, board width/height when rectangular, hex count, deployment, squad size, has elevation, updated_at), plus browse indexes.
  - A Go facet extractor shares the board-shape rule with the web.
  - A startup backfill fills facets for existing rows.
  - `publishing` gains Visibility, SetVisibility and Browse; the private-hiding rule applies to reads and reports.
- **Web:**
  - ports and adapters for visibility and browse;
  - SaveOnlineDialog (replaces PublishDialog's confirm);
  - VisibilityPicker molecule;
  - My scenarios visibility;
  - private banner on the sheet;
  - BrowsePage with BrowseFilters, ScenarioCard and BoardThumbnail;
  - a `/browse` route;
  - toolbar and Menu entries.
- No new dependencies. Cloudflare Pages already serves `/browse` through the SPA fallback, the same way it serves `/s/<id>`.
