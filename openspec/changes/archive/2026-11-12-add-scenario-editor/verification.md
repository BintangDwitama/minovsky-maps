# Verification: add-scenario-editor

Date: 2026-11-12. Environment: Windows 11, Node 24.14, headless Microsoft Edge driven by playwright-core against `npm run dev`.

## Automated suite (`web/`)

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` (including layer-boundary rules; a deliberate `domain → ui` import was confirmed to fail) | pass |
| `npm test` (93 unit tests: hex math, model, integrity, operations, warnings, load/migrate pipeline, session/history, drafts, storage) | pass |
| `npm run check:types` (generated types match schema) | pass |
| `npm run build` | pass |

## Browser walkthrough (36 checks, all pass)

| Spec | Scenario | Result |
|---|---|---|
| board-editing | Default new scenario: 225 hexes, flat-top, odd-q (column 0 higher) | pass |
| board-editing | Hover coordinate shows "3, 7" | pass |
| board-editing | Paint water across 5 hexes in one drag | pass |
| board-editing | Drag starting on a painted hex removes the tag | pass |
| board-editing | Hex with water + minovsky shows both patterns | pass |
| board-editing | Raise twice → level 2 badge; lower at ground stays 0 | pass |
| board-editing | Size out of range (41) refused; custom 12×18 → 216 hexes | pass |
| edit-history | One undo reverts a whole drag stroke; redo restores it | pass |
| edit-history | Loading a file clears history | pass |
| component-placement | Base owner options exclude neutral | pass |
| component-placement | Place on impassable → placed, with a warning | pass |
| component-placement | Token without a label → prompt; placed with the label | pass |
| component-placement | Carrier overhanging the edge → refused with a message | pass |
| component-placement | R rotates the carrier clockwise (N → NE) | pass |
| component-placement | Drag moves a garrison; Delete removes the selection | pass |
| scenario-settings | Blank name shows an error | pass |
| scenario-settings | Add goal | pass |
| scenario-validation | Missing deployment point names side B; clears once both bases are placed | pass |
| scenario-validation | Deployment mismatch when a carrier is placed under "bases" | pass |
| scenario-validation | Clicking a warning highlights its hexes | pass |
| scenario-file-io | Save → `desert-mesa.scenario.json`; title loses the unsaved marker | pass |
| scenario-file-io | PNG export → `desert-mesa.png`, 1633×2000, no UI overlays | pass |
| scenario-file-io | Invalid file (off-board component) rejected, naming the component; scenario unchanged | pass |
| scenario-file-io | Saved file loads back (round trip) | pass |
| scenario-file-io | Unsaved-changes guard before New | pass |
| scenario-file-io | Draft restore offered after reload; restored draft is marked unsaved | pass |
| — | No console or page errors | pass |

Covered by unit tests instead of the browser: resize keeping and removing data (`operations.test.ts`), the resize confirmation count (`planResize`), future-version rejection, migration ordering, the 200-step history cap, and storage failures.

## Sample scenario

`schema/examples/sample-mesa.scenario.json` is modelled on the reference table photo: a stepped central mesa (levels 1–2), scattered pillars and 2-hex clusters, bases on the flanks, garrisons on high ground, upgrades, energy, and four objectives (one carryable "Data core" on the summit). It loads in the editor with **0 warnings** and a pillar count of **38** (level 1: 22 hexes, level 2: 8 hexes), matching the hand calculation (26 for the mesa + 12 for the pillars).

## Known limitations (follow-ups, not blockers)

- Token and structure labels are requested with the browser's native `prompt()` when the palette label is empty.
- There's no touch-specific interaction yet (desktop-first, per non-goals).
- Elevation is shown by shade, a bevel ring and a number badge. There is no pseudo-3D.
