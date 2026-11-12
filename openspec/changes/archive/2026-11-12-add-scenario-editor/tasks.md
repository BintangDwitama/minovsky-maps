## 1. Repo and toolchain setup

- [x] 1.1 Scaffold `web/` with Vite + React 18 + TypeScript (strict), and create the `src/{domain,application,infrastructure,ui}` folders
- [x] 1.2 Add Vitest, ESLint, Prettier, and npm scripts (`dev`, `build`, `test`, `lint`, `typecheck`)
- [x] 1.3 Add an ESLint import-boundary rule: `domain` imports nothing from the other layers, `application` imports only `domain`, and `ui` atoms and molecules don't import `application`
- [x] 1.4 Extend the root `.gitignore` (node_modules, dist, coverage) and add a root README (what the project is, unofficial fan-project notice, how to run `web/`)

## 2. Scenario format v1 (schema/)

- [x] 2.1 Write `schema/scenario.v1.schema.json` (meta, inline board, tags, sparse elevation, components with per-kind fields as a discriminated union, rules, goals)
- [x] 2.2 Add fixtures to `schema/examples/`: `minimal.scenario.json`, `full.scenario.json` (every component kind), and `invalid/*.json` (unknown tag, neutral base, missing name, duplicate hex, off-board carrier)
- [x] 2.3 Add the `gen:types` script (json-schema-to-typescript) writing to `web/src/domain/generated/scenario.v1.ts`, commit the output, and add a `check:types` script that fails on diff

## 3. Domain: hex math

- [x] 3.1 Implement axial types, `hexKey`, neighbours, the six flat-top directions (0 = N, clockwise), and `opposite(d)`, with unit tests
- [x] 3.2 Implement the odd-q ↔ axial conversion and the rectangular board template generator (W×H), with tests (15×15 → 225 hexes; column 0 higher than column 1)
- [x] 3.3 Implement flat-top axial ↔ pixel conversion and hex rounding, with tests (round trips, known points)

## 4. Domain: model and integrity

- [x] 4.1 Implement the `ScenarioIndex` builder (hex set, tags by hex, elevation by hex, components by hex), with tests
- [x] 4.2 Implement the component kind registry (allowed owners, footprint, defaults) for all 8 kinds, including carrier footprint from middle hex + facing, with tests
- [x] 4.3 Implement `checkIntegrity(doc)` (unique hexes, elevation, tags and component footprints on the board, owner constraints, required labels), with tests against the fixtures
- [x] 4.4 Implement `createScenario({ width, height })` with the spec defaults, with tests

## 5. Domain: operations

- [x] 5.1 Implement pure operations: `paintTags` (add, remove or clear across hexes), `setElevation` / `raise` / `lower` (clamped 0–9), with tests
- [x] 5.2 Implement `placeComponent`, `moveComponent`, `rotateCarrier`, `updateComponent` and `removeComponent` (refusing off-board footprints and returning a result type), with tests
- [x] 5.3 Implement `resizeBoard` (keep data on surviving hexes, report the components that would be removed), with tests
- [x] 5.4 Implement metadata, rules and goals operations (add, update, reorder, remove goal), with tests

## 6. Domain: warnings and derived figures

- [x] 6.1 Implement the warning rule registry and `computeWarnings`, with tests
- [x] 6.2 Implement rules `component-on-impassable`, `stacked-components`, `carrier-uneven-elevation`, `deployment-mismatch` and `missing-deployment-point`, with one positive and one negative test each
- [x] 6.3 Implement `pillarCount` (total and per level), with tests

## 7. Domain: load pipeline and migrations

- [x] 7.1 Implement the migration registry and the `loadScenario(json)` pipeline (version detection → migrate → Ajv validate → integrity check → readable errors), with tests including a fake test-only v0→v1 migration and future-version rejection
- [x] 7.2 Implement `serializeScenario` and file-name slugify, with a round-trip test (save → load → equal)

## 8. Application layer

- [x] 8.1 Implement `EditorSession` (snapshot, subscribe, execute, undo, redo, 200-step cap, clear on new or load, dirty flag), with tests
- [x] 8.2 Implement transactions (`begin` / `update` / `commit` / `cancel`) so a stroke or text-field session is one history step, with tests
- [x] 8.3 Implement commands wrapping each domain operation, with labels
- [x] 8.4 Define ports (`ScenarioFileReader`, `ScenarioFileWriter`, `DraftStore`, `ImageExporter`) and use-cases (`newScenario`, `openFile`, `saveFile`, `exportPng`, `restoreDraft`)
- [x] 8.5 Implement `UiState` (active tool, palette selection, owner, hover, selection, zoom and pan), kept outside history

## 9. Infrastructure

- [x] 9.1 Implement `BrowserFileReader` (picker and drag-drop) and `DownloadFileWriter`
- [x] 9.2 Implement `LocalStorageDraftStore` with try/catch and a no-op fallback (debounced autosave), with tests using a throwing storage stub
- [x] 9.3 Implement `SvgPngExporter` (offscreen SVG → canvas at ≥ 2000 px long side → PNG blob)

## 10. UI atoms and molecules

- [x] 10.1 Atoms: `HexPolygon`, `TerrainPattern` defs (water, debris, impassable, minovsky), `ElevationBadge`, `ComponentGlyph` (original icons per kind, owner letter and colour), `Icon`, `Button`, `IconButton`, `NumberInput`, `TextInput`, `Select`, `Badge`, `Kbd`
- [x] 10.2 Molecules: `HexCell`, `ToolButton`, `OwnerToggle`, `TerrainTagPicker`, `ElevationTool`, `ComponentPaletteItem`, `GoalRow`, `WarningItem`, `FieldRow`
- [x] 10.3 Add design tokens (CSS variables) for side A / B / neutral and the terrain tints, checked for colour-blind safety

## 11. UI organisms, template and page

- [x] 11.1 `HexBoard`: SVG rendering, viewBox pan and zoom, a single pointer handler resolving pixel → hex, delegation to the active tool, hover readout (col, row), and highlight layers for selection and warnings
- [x] 11.2 Tool registry and tools: select/move, terrain paint, terrain erase, raise, lower, set level, and place component (including the carrier overhang message and the label prompt for token/structure)
- [x] 11.3 `ToolPalette`, `ComponentPalette` (owner options per kind), `ScenarioInspector` (edit and remove the selected component, rotate the carrier with R / Shift+R)
- [x] 11.4 `ScenarioSettingsPanel` (meta + rules, blank-name error), `GoalsEditor` (add, edit, reorder, remove)
- [x] 11.5 `WarningsPanel` (click to highlight) and `PillarCount`
- [x] 11.6 `Toolbar` (new, open, save, export PNG, undo, redo), `NewScenarioDialog` (size 1–40 with validation), `ConfirmDialog` (resize removal, unsaved changes)
- [x] 11.7 `EditorLayout` template and `EditorPage` composition root (wire session, registries and infrastructure), keyboard shortcuts (undo/redo, Delete, R / Shift+R), `beforeunload` guard, and the draft restore prompt

## 12. Verification

- [x] 12.1 Run the whole suite: `npm run typecheck`, `lint`, `test` and `check:types` all pass
- [x] 12.2 Manual check in the browser against every spec scenario (board, painting, placement, carrier rotation, warnings, undo/redo, save → load round trip, invalid file, PNG export), with results recorded in the change
- [x] 12.3 Build a sample scenario resembling the reference photo (central mesa, scattered pillars, bases, garrisons, upgrades, energy, objectives), save it to `schema/examples/sample-mesa.scenario.json`, and confirm that it loads and that the pillar count looks right
