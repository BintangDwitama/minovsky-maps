## Context

Phase 1 delivered a browser-only editor: scenarios are saved as `.json` files and exported as PNG. Loading goes through `loadScenario()` (domain/serialization.ts), which accepts any value and runs version detection → migrations → JSON Schema → integrity checks. `pillarCount()` (domain/warnings.ts) already derives pillars per level. Ports (application/ports.ts) isolate file I/O, drafts and PNG rendering; the UI is a single `EditorPage` mounted from `main.tsx` with no router.

This change is Slice 1 of Phase 2: share by link without a backend, plus a read-only, printable sheet. The app is currently only run locally, so it also needs public hosting.

Measured on our fixtures (deflate + base64url): plain JSON links for the 15 × 15 sample are 1,791 characters of payload, compact-form links 747 (≈ 790 with the address) — the 225 explicit hexes dominate the plain form.

## Goals / Non-Goals

**Goals:**
- One link carries a whole scenario; opening it shows a readable, printable sheet.
- Links are permanent: they survive future format versions and a future host move.
- Domain stays pure and tested; new I/O stays behind ports.

**Non-Goals:** backend, accounts, short links, chat previews, editing on the sheet, custom domain, `schemaVersion` change.

## Decisions

### D1. Link anatomy and routing
`<origin>/#/view/<codec>.<payload>` — e.g. `https://minovsky-maps.pages.dev/#/view/1.7Vrbbts4…`.
- Everything after `#` stays in the browser: the host never receives or logs scenarios, and static hosting needs no rewrite rules.
- A minimal hash router (`ui/router.ts`, ~30 lines over `hashchange`) maps `#/` (and empty) → `EditorPage`, `#/view/<link>` → `SheetPage`, anything else → editor. No router library for two routes.
- *Alternative:* query string `?s=` — sent to the server and logged; rejected.

### D2. Compact form (domain, pure)
`domain/linkCodec.ts` converts `Scenario` ⇄ `CompactScenarioV1` (plain JSON value):
- `v`: schemaVersion; `m`: meta (unchanged keys).
- `b`: `[width, height]` when the board is an exact rectangle from `createScenario`; otherwise `{ x: [[q, r], …] }` (explicit hex list).
- Hex references are **indices** into the board's canonical order (row-major over odd-q offset for rectangles; list order for explicit boards).
- `t`: `{ tag: [index…] }` per terrain tag; `e`: `{ level: [index…] }`.
- `c`: components as tuples `[kind, index, ...kind-specific fields]`; each registry entry declares its `compactFields` (append-only; open/closed: a new kind declares its own). Kinds with one allowed owner omit `owner`. Component ids are not stored; decoding assigns deterministic ids `c1, c2, …` (no `IdGenerator` needed — ids only have to be unique within the document).
- `r`: rules; `g`: goals as `[text, vp, scoring]` (ids `g1, g2, …`).
- Round trip equality is semantic: `canonicalize()` compares with ids by position and board hexes, tags and elevation in canonical order (the board is a set).

Expansion produces a normal v1 document that is then passed to `loadScenario()`, so the full validation pipeline (including migrations once v2 exists) applies to links exactly as to files. Round-trip equality is defined modulo component and goal ids.

*Alternative:* deflate the full JSON only — simpler, but 2.3× longer links that exceed chat limits for busy maps.

### D3. Byte pipeline and versioning (application + infrastructure)
`share`: `Scenario` → compact → `JSON.stringify` → UTF-8 → deflate (raw, level 9) → base64url → prefix `1.`.
`open`: split prefix → unknown version ⇒ "made by a newer version" error → base64url decode → inflate with a **1 MB output cap** (guards against decompression bombs) → `JSON.parse` → expand → `loadScenario()`.
- Port `Compressor { deflate(bytes): Uint8Array; inflate(bytes, maxBytes): Uint8Array }`, adapter on **fflate** (sync, ~8 kB, runs in Node so codec tests need no browser). The cap uses fflate's streaming `Inflate` and aborts once the limit is passed.
- base64url helpers are pure (domain).
- The codec version (`1`) is independent of `schemaVersion`: the codec changes only when the compact form changes; schema migrations are handled after expansion.

### D4. Use cases
- `createShareLink(scenario, origin, compressor)` → `{ ok, link, length } | { ok: false, errors }`; refuses with `saveBlockers()`.
- `openSharedScenario(linkPart, compressor, ids)` → `LoadResult`-like, never throws.
- `editSharedCopy(session, scenario)` → `session.reset(scenario, { dirty: true })`: unsaved, empty history.
- "Edit a copy" navigates to a third route, `#/edit/<link>`, which renders the editor with an `importLink`. The editor decodes the link itself, resets the address to `#/`, and — if it holds unsaved work or a stored draft — asks first; "Keep my work" returns to `#/view/<link>`. No state is handed between pages, and the draft-restore prompt is skipped for imports.
- Port `Clipboard { writeText(text): Promise<boolean> }`; adapter wraps `navigator.clipboard`, returning false instead of throwing; UI falls back to showing the link in a dialog with a selectable field.

### D5. Setup summary (domain, pure)
`domain/setupSummary.ts`: `setupSummary(s)` → `{ pillars: PillarCount, sides: { A | B | neutral: { kind, count }[] }, labelled: { kind, label, owner }[] }`, built from `pillarCount()` and the component registry (labels from kind definitions, so new kinds appear automatically). Unit-tested on fixtures.

### D6. Sheet UI (atomic levels)
- **Page** `ui/pages/SheetPage.tsx`: decodes the link via the use case, renders error or sheet. Not wrapped in the editor's `EditorProvider`; gets a read-only scenario.
- **Template** `ui/templates/SheetLayout.tsx`: navy frame header with actions; body = board column + details column (stacked below 900px).
- **Organisms:** `SheetHeader` (title, author, description), `SheetBoard` (reuses `BoardView` in an `<svg>`, no overlays — same component as the PNG export), `RulesSummary`, `GoalsList`, `SetupChecklist`.
- **Molecules:** `ChecklistItem` (native checkbox + label, so ticks work with keyboard and print as boxes).
- Editor `Toolbar` gains a Share button (between Save and Export PNG); long-link and fallback notices use existing dialogs/status messages.

### D7. Print
Tailwind `print:` variants plus an `@media print` block in `app.css` that re-declares the light token values on `:root` (dark scheme never prints). `@page { size: A4 portrait; margin: 12mm }`. Actions/header buttons `print:hidden`; board container `break-inside: avoid`, max height so board + title fit page 1; checklist and goals flow after it. Theme chrome (chamfers, deck) is simplified in print to save ink: the board prints on white.

### D8. Hosting: Cloudflare Pages (free)
- Project connected to the GitHub repo; root directory `web`, build command `npm ci && npm run build`, output `dist`; Node pinned with `web/.nvmrc` (22). Preview deploys per branch come for free.
- `vite.config.ts` keeps `base: '/'`; hash routing needs no `_redirects`.
- **Link stability on a free subdomain:** if a custom domain is added later, the `pages.dev` project stays deployed with a one-file redirect that forwards `location.hash` to the new origin, so every old link keeps working at no cost. The future Go API can then sit behind the same origin under `/api` (Pages proxy) or a subdomain — out of scope here.
- The one-time Cloudflare setup is done by the repo owner; the README documents it.

## Risks / Trade-offs

- [Links are permanent and a codec bug would be frozen into shared links] → codec version prefix; decoder for every released version is kept forever; round-trip tests on every fixture; golden test: a committed v1 link must keep decoding to the same scenario.
- [Malicious or huge links] → 1 MB inflate cap, full schema + integrity validation, the sheet renders only validated data (React escapes text; no HTML from links).
- [Chat apps can't preview the map] → accepted for Slice 1; server-side previews arrive with the backend.
- [Clipboard API blocked (insecure context, permissions)] → fallback dialog with a selectable link.
- [Edit a copy could discard the receiver's own unsaved draft] → explicit confirm, cancel leaves both untouched.
- [Rectangle detection mismatch on custom boards] → anything not exactly a `createScenario` rectangle uses the explicit hex list; covered by tests with the irregular `full` fixture.

## Migration Plan

Additive: no existing data changes. Deploy = merge to `main` once Cloudflare Pages is connected. Rollback = revert; already-shared links only depend on the decoder, which stays.

## Open Questions

- None blocking. The Pages project name (and so the `*.pages.dev` address) is chosen when the owner connects the repo; `minovsky-maps` is assumed in docs.
