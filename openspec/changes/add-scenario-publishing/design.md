## Context

The web app is a static SPA on Cloudflare Pages (`*.pages.dev`). Scenarios are shared today as self-contained fragment links (`#/view/1.<payload>`, link-sharing spec). Validation lives in TypeScript: `loadScenario()` = migrate → JSON Schema (`schema/scenario.v1.schema.json`, Ajv) → `checkIntegrity()` (9 rule codes in `web/src/domain/integrity.ts`). `server/` does not exist yet.

Constraints: hosting must be free and need no payment card; the backend is Go (handler → service → repository, small consumer-defined interfaces, wiring in `main.go`, per `openspec/config.yaml`); chat-app integration is not a goal.

## Goals / Non-Goals

**Goals:** publish, short link, update in place; validation identical on both sides; single origin for the browser; a server that can move hosts without code changes; useful cold-start UX on free hosting.

**Non-Goals:** accounts, browse/search, version-history UI, previews, bot challenge, paid services, `schemaVersion` change.

## Decisions

### D1. Topology (free, no card)
```
browser ─▶ Cloudflare Pages ─┬─ static SPA (/, /s/:id via SPA fallback)
                             └─ Pages Function /api/* ──proxy──▶ Vercel (Go) ──▶ Neon (Postgres)
```
- **Vercel Hobby (free, no card)** with the Go framework preset (beta): root `server/`, `server/vercel.json` sets `framework: go` and region `sin1` (next to the Neon database in `aws-ap-southeast-1`). Vercel builds `cmd/api` and runs our ordinary `net/http` server on `$PORT`; instances scale to zero and start in well under a second. *Changed during apply:* Render was the original pick but now asks for a payment card for web services.
- **Neon free** Postgres via the pooled connection string (`DATABASE_URL`); scales to zero after 5 min (sub-second resume). A `dev` branch is used for local work.
- **Pages Function** `web/functions/api/[[path]].ts` forwards method, path, query, body and `Authorization` to `env.API_ORIGIN`, adds `X-Forwarded-For` from `CF-Connecting-IP`, and returns the response unchanged. Same origin ⇒ no CORS, preview deploys work, the API host stays configuration.
- *Alternatives:* direct CORS calls (needs an allowlist incl. preview subdomains; Slice 3 cookies would need cross-site settings); Cloud Run/Fly.io (need a card); Workers + D1 (not Go).

### D2. Server structure (`server/`)
```
server/
  go.mod                      module github.com/BintangDwitama/minovsky-maps/server
  cmd/api/main.go             config from env, wiring, graceful shutdown
  internal/scenario/          domain: Validator (schema + integrity), Scenario types it needs
  internal/publishing/        service: Publish, Get, Update; ids, tokens; ports Repository, Clock
  internal/store/postgres/    Repository on pgx/v5 pgxpool; embedded SQL migrations
  internal/store/memory/      Repository fake for tests
  internal/httpapi/           handlers (net/http 1.22 patterns), limits, rate limiter, JSON errors
```
- **stdlib `net/http`** routing (`POST /api/scenarios`, `GET /api/scenarios/{id}`, `PUT /api/scenarios/{id}`, `GET /api/health`). No framework.
- **Interfaces are defined by the consumer** (service declares `Repository`), satisfied by `postgres` and `memory` stores.
- **Migrations**: plain `.sql` files embedded with `go:embed`, applied in order at startup inside a transaction, recorded in `schema_migrations`. Small hand-written runner (≈40 lines) instead of a migration library.
- *Alternatives:* chi/echo, sqlc, goose — reasonable later; not needed for four endpoints.

### D3. Shared schema as a Go module
`go:embed` cannot reach files outside the module, so `schema/` gets `go.mod` (`module github.com/BintangDwitama/minovsky-maps/schema`) and `schema.go` exposing `//go:embed scenario.v1.schema.json` as `ScenarioV1 []byte` plus an `Examples` `embed.FS` over `examples/`. `server/go.mod` requires it with `replace github.com/BintangDwitama/minovsky-maps/schema => ../schema`. Vercel builds with "Include files outside the root directory" enabled, so the relative replace resolves. The JSON Schema file itself does not change.

### D4. Validation parity
- JSON Schema: `github.com/santhosh-tekuri/jsonschema/v6` (draft 2020-12), compiled once at startup.
- Integrity: Go port of the 9 rules (duplicate-hex, elevation-off-board, duplicate-elevation, duplicate-component-id, component off board incl. carrier footprint, owner not allowed, label-required, duplicate-goal-id, …) with the same codes. Carrier footprint uses the same odd-q/axial direction table.
- **Conformance suite:** both test suites iterate `schema/examples/*.json` (must load) and `schema/examples/invalid/*.json` (must be rejected; same rule code where integrity applies). A future rule added on one side without the other fails CI.
- Migrations of older `schemaVersion`s stay client-side: the server accepts only the current version (`schemaVersion: 1`) and returns 422 otherwise. The editor always publishes the current version.

### D5. Data model
```sql
CREATE TABLE scenarios (
  id                text PRIMARY KEY,           -- 8 chars [A-Za-z0-9], crypto/rand
  edit_token_hash   bytea NOT NULL,             -- sha256(token)
  created_at        timestamptz NOT NULL DEFAULT now(),
  taken_down_at     timestamptz
);
CREATE TABLE scenario_versions (
  id              bigserial PRIMARY KEY,
  scenario_id     text NOT NULL REFERENCES scenarios(id),
  doc             jsonb NOT NULL,
  schema_version  int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON scenario_versions (scenario_id, id DESC);
```
Latest = highest version id. Publish inserts both rows in one transaction; id collisions retry (62^8 ≈ 2×10^14 ids). Tokens: 32 random bytes, base64url; compared via hash with `subtle.ConstantTimeCompare`. Takedown: set `taken_down_at` in the Neon SQL console (documented).

### D6. API contract
| Method & path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/scenarios` | `{ "scenario": <doc> }` | 201 `{ id, editToken, updatedAt }` | 400 bad JSON, 413, 422 `{ errors: [..] }`, 429 |
| `GET /api/scenarios/{id}` | — | 200 `{ id, scenario, updatedAt }` | 404 |
| `PUT /api/scenarios/{id}` | `Authorization: Bearer <token>`, `{ "scenario": <doc> }` | 200 `{ id, updatedAt }` | 401, 403, 404, 413, 422, 429 |
| `GET /api/health` | — | 200 (also wakes Neon) | 503 |
All errors are JSON `{ "errors": ["…"] }`. Body limit 64 KB via `http.MaxBytesReader`. Rate limit: token bucket per client IP (from `X-Forwarded-For` set by the proxy), e.g. 10 writes/min burst 5; reads unthrottled.

### D7. Web integration
- **Ports** (`application/ports.ts`): `ScenarioPublisher { publish(doc), update(id, token, doc), fetch(id) }` returning typed results incl. `asleep/timeout`; `PublicationStore { list, get(id), save({id, token, name}), remove(id) }`.
- **Adapters**: `HttpScenarioPublisher` (fetch to `/api`, 90 s timeout, reports "slow" after 3 s via a callback), `LocalStoragePublicationStore` (never throws).
- **Use cases**: `publishScenario` (refuses on `saveBlockers`), `updatePublished`, `openPublished(id)` → `loadScenario()` on the returned doc (same validation as files).
- **Session**: `EditorSession` gains `publication: { id } | null` (set by publish, by "Edit" from a published sheet; cleared by New/Open/Edit-a-copy). The autosave draft is stored as `{ scenario, publication }` (old drafts without the wrapper still load). Scenario files never contain publication data.
- **Routing**: path `/s/<id>` → `PublishedSheetPage`; `#edit=<token>` is read once, saved to the store, then removed with `history.replaceState`. Editor gets `#/edit-published/<id>` (hash route, like `#/edit/`).
- **UI**: Toolbar shows **Publish** or **Update** (frame variant); `PublishDialog` (organism) with short link, private edit link, visibility note, "keep this link private" hint; sheet `LoadingState` molecule with waking/not-found/retry variants. Sheet organisms are reused unchanged.

### D8. CI
`.github/workflows/ci.yml`: job `web` (npm ci, lint, typecheck, test, build) and job `server` (go vet, go test ./..., go build). Both run the conformance suite. Free GitHub Actions minutes cover a private repo at this size.

## Risks / Trade-offs

- [Cold starts on free hosting (short on Vercel, up to ~1 min on hosts that sleep)] → explicit waking state on the sheet and a "Publishing… the server may be waking up" state in the dialog; `/api/health` ping when the editor loads so the server is often awake by the time the user publishes.
- [Two implementations of integrity rules drift] → shared conformance suite in CI; same rule codes on both sides.
- [Lost edit token = scenario can't be edited] → shown once with clear wording; remembered in the browser; Slice 3 adds accounts and claiming.
- [Spam / abuse without a bot challenge] → size cap, per-IP rate limit, takedown flag; Turnstile is a ready follow-up.
- [Free-tier limits change] → server reads all config from env; moving to another host is a deploy change, not a code change.
- [Neon storage 1 GB] → ~64 KB max per version ⇒ well over 10,000 versions; acceptable for this phase.
- [Users publishing copies of official scenarios] → publish dialog note: share your own scenarios; refer to official ones by name.

## Migration Plan

1. Create Neon project (+ `dev` branch) and Vercel project (owner, one-time); set `DATABASE_URL` on Vercel, `API_ORIGIN` on Cloudflare Pages.
2. Merge: Vercel deploys `server/` (migrations run at startup); Pages deploys web + function.
3. Rollback: revert; published data stays in Neon and is unaffected. Slice 1 links never depend on the API.

## Open Questions

None blocking. Rate-limit numbers can be tuned after launch.
