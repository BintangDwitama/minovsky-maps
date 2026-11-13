## 1. Domain: link codec

- [x] 1.1 Add base64url encode/decode helpers (pure) with unit tests (padding-free, URL-safe alphabet, invalid input rejected)
- [x] 1.2 Add the per-kind component field table next to the component registry and `domain/linkCodec.ts` with `toCompact` / `fromCompact` (rectangle vs explicit boards, index-based hex references, terrain/elevation lists, tuple components and goals, deterministic ids)
- [x] 1.3 Unit tests: round trip (modulo ids) on every valid fixture and on generated scenarios; irregular `full` fixture uses the explicit hex list; expanded documents pass `loadScenario()`
- [x] 1.4 Golden test: commit one v1 link for the sample scenario and assert it keeps decoding to the same scenario

## 2. Domain: setup summary

- [x] 2.1 Add `domain/setupSummary.ts` (pillars by level, components per side and kind, labelled components) using the registry for kind labels
- [x] 2.2 Unit tests on the sample, full and minimal fixtures (flat board says no pillars)

## 3. Application and infrastructure

- [x] 3.1 Add `Compressor` and `Clipboard` ports; implement the fflate adapter (deflate level 9, streaming inflate with a 1 MB cap) and the clipboard adapter (never throws)
- [x] 3.2 Add `createShareLink` (refuses on `saveBlockers`) and `openScenarioLink` (unknown version, damaged payload, oversize, invalid scenario → clear errors; never throws) with unit tests, including a decompression-bomb case
- [x] 3.3 Add `editSharedCopy` (reset session, empty history, marked unsaved) with tests
- [x] 3.4 Verify the sample scenario's link is under 1,500 characters in a test

## 4. Routing and editor

- [x] 4.1 Add the minimal hash router and route `#/` → editor, `#/view/<link>` → sheet in `main.tsx`
- [x] 4.2 Toolbar Share button: copies the link and confirms; shows save blockers when refused; long-link (>1,900) notice; fallback dialog with a selectable link when the clipboard fails
- [x] 4.3 Editor handles "Edit a copy": confirm before replacing unsaved work; cancel leaves the draft untouched

## 5. Sheet UI

- [x] 5.1 `ChecklistItem` molecule; `SheetHeader`, `SheetBoard` (reuses `BoardView`, no overlays), `RulesSummary`, `GoalsList`, `SetupChecklist` organisms
- [x] 5.2 `SheetLayout` template (frame header with actions; board + details columns, stacked below 900px) and `SheetPage` (error page for bad links with a link to the editor)
- [x] 5.3 Sheet actions: Edit a copy, Copy link, Download `.json`, Export PNG, Print

## 6. Print

- [x] 6.1 Print styles: A4 portrait, light tokens forced, buttons hidden, board not split and on page 1, white board backdrop

## 7. Hosting

- [x] 7.1 Add `web/.nvmrc`; confirm `npm ci && npm run build` works from a clean checkout
- [x] 7.2 README: Deploy section (Cloudflare Pages settings, preview deploys, and the fragment-preserving redirect plan for a future custom domain)

## 8. Verification

- [x] 8.1 Lint, typecheck, unit tests and build pass
- [x] 8.2 Browser walkthrough: share from the editor → open link in a fresh context → sheet content and checklist correct → Edit a copy (with and without unsaved work) → damaged link and future-version link error pages
- [x] 8.3 Print preview check (PDF via the browser) in light and dark system schemes: one A4 page for the sample, no buttons, light colours
- [x] 8.4 Re-run the Phase 1 walkthrough and the panel overflow check (no regressions)
