## Why

Share links (Slice 1) carry the whole scenario, so every edit means a new ~800-character link and old links never see fixes. Creators want to publish once, hand out a short link, and keep improving the scenario behind that same link. This needs a server — the project's first backend — while staying free and requiring no payment card.

## What Changes

- **Go API (`server/`)**: create, read and update published scenarios. Each update stores a new immutable version; reads return the latest. Server-side validation runs the same JSON Schema and integrity rules as the editor.
- **Publishing without accounts**: publishing returns a short id and a secret **edit token**. The server stores only the token's hash. The browser remembers tokens for scenarios it published; a **private edit link** (`/s/<id>#edit=<token>`, token in the fragment) is shown once so the creator can edit from elsewhere.
- **Short links**: `https://<app>/s/<id>` opens the published scenario on the scenario sheet (latest version). Slice 1 `#/view/…` links keep working unchanged.
- **Editor**: Publish (first time) / Update (when the open document is a scenario this browser can edit); publish dialog shows the share link, the private edit link, and a note that published scenarios are visible to anyone with the link.
- **Abuse basics**: 64 KB request cap, per-IP rate limits, random ids, takedown flag.
- **Shared contract**: `schema/` becomes a tiny Go module embedding `scenario.v1.schema.json`; `schema/examples/` becomes a conformance suite run by both the TypeScript and Go test suites.
- **Hosting (free, no card)**: Go API on Render (free web service; sleeps after 15 minutes idle), Postgres on Neon (free), reached through a Cloudflare Pages Function proxy at `/api/*` so the app has a single origin. The sheet shows a "waking up" state while the API starts.
- **CI**: GitHub Actions runs web and server checks on every push.

Sides touched: **web, server, schema** (schema gains a Go embed file; the JSON Schema itself is unchanged).

## Capabilities

### New Capabilities
- `scenario-publishing`: Publishing, reading and updating scenarios through the API; edit tokens; short links; server-side validation; versions; limits and takedown.

### Modified Capabilities
- `scenario-sheet`: adds opening a published scenario by short link, including the waking-up and not-found states. Existing sheet requirements are unchanged.

## Non-goals

- No accounts, login or OAuth (Slice 3); no "claim" of anonymous scenarios yet.
- No browse/search, library, likes or forks; no UI for version history (versions are stored, not shown).
- No chat-app previews / Open Graph images.
- No bot challenge (Turnstile) or report button yet — added if abuse appears / with Slice 3.
- No `schemaVersion` change; scenario files are untouched and stay host-agnostic (publication info is not written into them).
- No paid infrastructure.

## Impact

- **New:** `server/` (Go module), `schema/go.mod` + `schema/schema.go`, `web/functions/api/[[path]].ts` (Pages proxy), `.github/workflows/ci.yml`.
- **Web:** new ports and HTTP adapter for publishing, local store for edit tokens, router path `/s/<id>`, toolbar Publish/Update, publish dialog, sheet loading/waking/not-found states.
- **Accounts/services (owner, one-time, free, no card):** Render web service, Neon project, `API_ORIGIN` setting on Cloudflare Pages.
- **Risk:** Render cold starts (up to ~1 minute after idle) — mitigated by an explicit waking state; integrity rules exist in two languages — mitigated by the shared conformance suite.
