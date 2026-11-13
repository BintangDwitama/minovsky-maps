## 1. Shared schema module

- [x] 1.1 Add `schema/go.mod` and `schema/schema.go` embedding `scenario.v1.schema.json` and the `examples/` tree; JSON Schema file unchanged
- [x] 1.2 Confirm the web build, type generation (`check:types`) and tests are unaffected

## 2. Server foundation

- [x] 2.1 Create the `server/` Go module (requires the schema module via `replace ../schema`), `cmd/api/main.go` with env config (`PORT`, `DATABASE_URL`), structured logging and graceful shutdown
- [x] 2.2 `internal/scenario`: JSON Schema validation with `santhosh-tekuri/jsonschema/v6`, compiled once
- [x] 2.3 `internal/scenario`: port the integrity rules (same codes and messages as `web/src/domain/integrity.ts`, incl. carrier footprint on odd-q/axial directions)
- [x] 2.4 Conformance tests in Go over `schema/examples` (valid load, every `invalid/*` rejected); add the matching TS test that iterates the same folders with rule codes

## 3. Publishing service and storage

- [x] 3.1 `internal/publishing`: service with Publish / Get / Update, id generator (8 chars `[A-Za-z0-9]`, crypto/rand, retry on collision), edit tokens (32 bytes, SHA-256 hash, constant-time compare), consumer-defined `Repository` and `Clock` interfaces
- [x] 3.2 `internal/store/memory` fake and service unit tests (publish, read latest, update with right/wrong/missing token, taken-down scenarios, invalid documents, unsupported schemaVersion)
- [x] 3.3 `internal/store/postgres`: pgxpool repository, embedded SQL migrations with a small ordered runner (`schema_migrations`), versions table; integration tests that run only when `TEST_DATABASE_URL` is set (a disposable Neon branch, never production)

## 4. HTTP API

- [x] 4.1 `internal/httpapi`: routes per the design's contract, JSON errors, 64 KB body limit, per-IP token-bucket rate limit for writes (IP from `X-Forwarded-For`), `/api/health` (pings the DB)
- [x] 4.2 Handler tests with `httptest` over the memory store (status codes 201/200/400/401/403/404/413/422/429)

## 5. Web: publishing

- [x] 5.1 Ports `ScenarioPublisher` and `PublicationStore`; adapters `HttpScenarioPublisher` (90 s timeout, slow callback after 3 s) and `LocalStoragePublicationStore` (never throws), with tests
- [x] 5.2 Use cases `publishScenario` (refuses on save blockers), `updatePublished`, `openPublished` (runs `loadScenario`), with tests using fakes
- [x] 5.3 `EditorSession.publication` (set on publish/edit-published, cleared on New/Open/Edit a copy); draft stored as `{ scenario, publication }` with backward-compatible loading
- [x] 5.4 Toolbar Publish/Update; `PublishDialog` (short link, private edit link, visibility and originality note, waking state); health ping on editor load

## 6. Web: published sheet

- [x] 6.1 Router: path `/s/<id>` → published sheet; consume `#edit=<token>` into the store and strip it from the address; hash route `#/edit-published/<id>` → editor
- [x] 6.2 `PublishedSheetPage` reusing the sheet organisms; Copy link copies the short link; Edit when a token is held; loading / waking-after-3 s / not-found / retry-after-90 s states via a shared `SheetMessage` panel (`pages/SheetView.tsx`, also used by the share-link sheet)
- [x] 6.3 Pages Function proxy `web/functions/api/[[path]].ts` (forwards method/path/query/body/Authorization, sets `X-Forwarded-For`, reads `API_ORIGIN`); Vite dev proxy `/api` → `localhost:8080` for local work; proxy unit test lives in `src/` (every file in `functions/` becomes a Pages route)

## 7. CI and deployment

- [x] 7.1 `.github/workflows/ci.yml`: web job (lint, typecheck, test, build) and server job (vet, test, build)
- [x] 7.2 README: running the server locally (Neon dev branch), Vercel and Neon setup (free, no card), `API_ORIGIN` on Pages, takedown via SQL

## 8. Verification

- [x] 8.1 All web and server checks pass locally (web lint/typecheck/189 tests/build; server gofmt/vet/tests incl. conformance/build)
- [x] 8.2 Local end-to-end (Go API with the in-memory store + Vite proxy, 24/24 checks): publish → short link in a fresh browser → update → same link shows the change; wrong-token update refused; private edit link on a fresh browser enables Update
- [x] 8.3 Cold-start check: with the API stopped then started late, the sheet shows the waking state and then the scenario
- [x] 8.4 Re-run the Phase 1 and share-link walkthroughs (no regressions)
- [ ] 8.5 CI green on GitHub after pushing (needs a push)
- [x] 8.6 Postgres integration tests against the Neon `dev` branch (`TEST_DATABASE_URL`) and a local publish/read through the real database (server loads `.env.local`)
- [ ] 8.7 Production smoke test on Vercel + Pages (needs the owner's Vercel project and `API_ORIGIN` on Pages); `server/vercel.json` added for the Go preset and `sin1` region
