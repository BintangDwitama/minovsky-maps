## Context

The repo contains only OpenSpec scaffolding. This change creates the first application code: a browser-only scenario editor in `web/`, plus the shared scenario format in `schema/`. A Go backend (`server/`) will follow in Phase 2 and must read and write the same format, so the format and its schema are the long-lived contract. The editor UI can be iterated on freely later.

Constraints from the project context: monorepo with independently built `web/` and `server/`; SOLID; atomic design for UI; domain logic outside React; flat-top odd-q boards stored in axial coordinates; the format describes game state, not physical props; no Bandai/Sunrise assets.

## Goals / Non-Goals

**Goals:**
- A stable, versioned scenario format (v1) with a JSON Schema that both the web app and the future Go server can use.
- A pure, unit-tested domain layer (hex math, model operations, warning rules) with no React or DOM dependency.
- A usable desktop editor covering board, terrain, elevation, components, settings, warnings, undo/redo, save/load and PNG export.
- An architecture where new component kinds, warning rules, tools and storage backends are additions, not edits.

**Non-Goals:**
- Server, auth, sharing, browsing, analysis overlays, official board data, uploads, touch-first UX (see proposal).
- Pixel-perfect visual design. v1 uses a clean, functional style with original icons.

## Decisions

### D1. Repo layout and toolchain
```
minovsky-maps/
├── schema/
│   ├── scenario.v1.schema.json
│   └── examples/*.scenario.json          ← valid + invalid fixtures, used by both sides' tests
├── web/
│   ├── package.json  vite.config.ts  tsconfig.json
│   └── src/{domain,application,infrastructure,ui}/
└── openspec/
```
- **Vite + React 18 + TypeScript (strict)**, **Vitest** for tests, **ESLint + Prettier**, **npm**. No monorepo tooling (Turborepo/Nx) yet: `schema/` is plain files, and `web/` reads it through a relative path.
- *Alternatives:* pnpm workspaces or Nx. Rejected for now because there's only one JS package, so the overhead isn't worth it. Revisit if a second JS package appears.

### D2. Schema as the source of truth, plus generated types
- `schema/scenario.v1.schema.json` (JSON Schema 2020-12) defines structure, enums and simple constraints.
- `web` runs `json-schema-to-typescript` (npm script `gen:types`) to emit `web/src/domain/generated/scenario.v1.ts`. The output is committed, and a CI check (later) ensures regenerating produces no diff.
- Runtime validation on load uses **Ajv**. Cross-field rules that JSON Schema can't express well (unique hex coordinates, everything on the board, carrier geometry) live in the domain layer as `checkIntegrity(doc)`. Those are hard errors, distinct from warnings.
- *Alternative:* define types in TS with Zod and generate JSON Schema from them. Rejected because the Go side would then depend on a TS-generated artifact. A schema-first approach keeps both languages equal consumers.

### D3. Document shape choices
- **Lists, not string-keyed maps**, for hexes, elevation and components (`[{q, r, ...}]`, not `{"q,r": ...}`). They're easier to express in JSON Schema and to decode in Go, with no parsing of compound keys. The domain layer builds `Map<HexKey, ...>` indexes in memory for speed.
- **Board is inline with `kind: "inline"`.** The discriminator leaves room to add `kind: "ref"` later (official board library) as a schema version bump with a trivial migration.
- **Elevation is sparse** (only levels ≥ 1). **Tags are optional** per hex (absent means none). This keeps files small; a 15×15 empty board is about 225 short entries.
- **Carrier = middle hex + facing.** The front and back hexes are derived, so the three hexes can never contradict each other.
- **Component ids are random strings** (`crypto.randomUUID()`), so selection, history and future comments or forks can refer to them stably.
- Example (abridged):
  ```json
  { "schemaVersion": 1,
    "meta": { "name": "Desert Mesa", "author": "someone" },
    "board": { "kind": "inline", "orientation": "flat",
               "hexes": [{ "q": 0, "r": 0 }, { "q": 1, "r": 0, "tags": ["water"] }] },
    "elevation": [{ "q": 7, "r": 3, "level": 2 }],
    "components": [{ "id": "c1", "kind": "carrier", "owner": "A", "hex": { "q": 2, "r": 6 }, "facing": 0 }],
    "rules": { "deployment": "carriers", "squadSize": 3, "terrainSetup": "fixed" },
    "goals": [{ "id": "g1", "text": "Hold the mesa", "vp": 3, "scoring": "each-phase" }] }
  ```

### D4. Hex math
- Axial `{q, r}` everywhere in the domain. Offset (col, row) appears only for template generation and the hover readout.
- **Odd-q conversion** (flat-top, odd columns shifted down): `q = col`, `r = row - (col - (col & 1)) / 2`.
- Flat-top direction indices 0–5: **0 = north (top), then clockwise** N, NE, SE, S, SW, NW = `(0,-1), (1,-1), (1,0), (0,1), (-1,1), (-1,0)`. Direction 0 points straight up for a flat-top hex, which matches how a player reads "facing" on the table. Opposite direction = `(d + 3) % 6`.
- Pixel layout for flat-top: `x = size * 3/2 * q`, `y = size * √3 * (r + q/2)`. Pure functions, unit tested against known coordinates (Red Blob Games' formulas).

### D5. Domain model is immutable; the application layer uses the command pattern
```
 ui ──calls──▶ application (EditorSession)
                 │  execute(command) / undo() / redo()
                 │  subscribe(listener) / getSnapshot()
                 ▼
               domain (pure): Scenario value + operations
                 placeComponent(s, …) → s'
                 paintTags(s, hexes, tag, mode) → s'
                 computeWarnings(s, rules[]) → Warning[]
```
- Domain operations are pure functions that return new `Scenario` values (structural sharing, no mutation).
- **Commands** (`application/commands/*`) each implement `{ label, apply(s): s }`. Because the model is immutable, history stores **snapshots** (previous `Scenario` references), not inverse operations. That's cheap thanks to structural sharing, and it makes undo correct by construction. History is capped at 200 entries (spec allows ≥ 200).
- **Strokes**: tools call `session.beginTransaction()` / `commit()`. Intermediate updates during a drag replace the working snapshot without pushing history, and `commit` pushes one entry. Text fields use the same mechanism, keyed on focus and blur.
- *Alternative:* inverse-operation command pattern. Rejected because every command would need a correct `undo`, which is a bug magnet. Snapshots are simpler, and memory is trivial at this scale.

### D6. State binding to React: no state library
- `EditorSession` is a plain TS class exposing `subscribe` / `getSnapshot`. React binds through `useSyncExternalStore` in a single hook `useEditor(selector)`.
- *Alternatives:* Zustand or Redux Toolkit. Both work, but the session already *is* the store, and avoiding the dependency keeps the application layer framework-free (a dependency-inversion win, and it's testable without React).
- Ephemeral UI state (active tool, hover hex, zoom, selection) lives in a separate small `UiState` store using the same pattern, not inside the scenario document. Selection is excluded from history.

### D7. Extensibility registries (open/closed)
- **Component kind registry** (`domain/components/registry.ts`): each kind registers `{ kind, allowedOwners, footprint(component) → Hex[], defaults, validate }`. A matching UI registry (`ui/components/renderers.ts`) maps kind to an icon renderer and inspector fields. Adding a kind means one entry in each registry plus a schema update.
- **Warning rule registry**: each rule is `{ code, check(scenario, index) → Warning[] }`. `computeWarnings` iterates the registered rules.
- **Tool registry**: each editor tool implements `{ id, cursor, onPointerDown/Move/Up(ctx) }` and uses the session's transaction API. HexBoard knows nothing about specific tools.
- **Storage ports** (`application/ports.ts`): `ScenarioFileReader`, `ScenarioFileWriter`, `DraftStore`, `ImageExporter`. Infrastructure provides `BrowserFileReader`, `DownloadFileWriter`, `LocalStorageDraftStore` (try/catch, no-op fallback) and `SvgPngExporter`. Phase 2 adds `ApiScenarioStore` without touching the UI.

### D8. Migrations
- `domain/migrations/index.ts` holds an ordered list `[{ from: n, to: n+1, migrate(doc) }]`. v1 has no migrations, but the loader pipeline (`detect version → migrate → Ajv validate → integrity check`) is built and tested now, using a fake v0→v1 migration in tests only.
- Files with `schemaVersion` greater than the app supports are rejected (spec).

### D9. Rendering: SVG
- The board is one `<svg>`. Each hex is a `<g>` with a polygon, tag patterns (SVG `<pattern>` defs: wave hatching = water, dots = debris, cross-hatch = impassable, a speckle overlay = minovsky), an elevation badge, and component glyphs. 225 to 1600 hexes is well within SVG performance.
- Elevation is shown by fill shade plus a number badge. Fake 3D is deferred.
- Pan and zoom go through a `viewBox` transform. Pointer events are resolved to a hex by pixel → axial rounding (domain function), not per-polygon listeners. That means one listener, and drag strokes work across hexes.
- **PNG export**: render a dedicated `<BoardExport>` (same atoms, no overlays) to an offscreen SVG string, draw it into a `<canvas>` at a scale giving ≥ 2000 px on the long side, and call `toBlob('image/png')`. Fonts are system fonts, so canvas rasterisation won't hit cross-origin issues.
- *Alternative:* Canvas or PixiJS rendering. Faster for huge maps, but it loses DOM accessibility and simple hit styling. Not needed at ≤ 40×40.

### D10. Atomic UI inventory
| Level | Pieces |
|---|---|
| atoms | `HexPolygon`, `TerrainPattern`, `ElevationBadge`, `ComponentGlyph`, `Icon`, `Button`, `IconButton`, `NumberInput`, `TextInput`, `Select`, `Badge`, `Kbd` |
| molecules | `HexCell` (polygon + patterns + badge + glyphs), `ToolButton`, `OwnerToggle`, `TerrainTagPicker`, `ElevationTool`, `ComponentPaletteItem`, `GoalRow`, `WarningItem`, `FieldRow` |
| organisms | `HexBoard`, `ToolPalette`, `ComponentPalette`, `ScenarioInspector` (selected component), `ScenarioSettingsPanel` (meta + rules), `GoalsEditor`, `WarningsPanel`, `PillarCount`, `Toolbar` (new/open/save/export/undo/redo), `NewScenarioDialog`, `ConfirmDialog` |
| templates | `EditorLayout` (toolbar top, palette left, board centre, panels right, status bar bottom) |
| pages | `EditorPage` (wires the session, registries and infrastructure into the template) |

Rule: atoms and molecules receive only props (no `useEditor`). Organisms may read the session through hooks. Pages do the wiring (composition root).

### D11. Owners, colours and accessibility
- Side A and side B use two colour-blind-safe hues, plus a letter mark ("A" / "B") on owned glyphs. Neutral is grey. Terrain uses patterns as well as tint, so no meaning relies on colour alone.
- All tools and actions are reachable through toolbar buttons with tooltips, and shortcuts are shown with `Kbd`.

## Risks / Trade-offs

- [The format turns out wrong once real players use it] → It's versioned from day one, with a migration pipeline built and tested now. Keep v1 minimal and add fields optionally.
- [Generated TS types drift from the schema] → Generated file committed, plus a regeneration check script (`npm run gen:types && git diff --exit-code`).
- [Snapshot history memory] → Structural sharing plus a 200-step cap. A 40×40 board is ~1600 small objects, a negligible size.
- [Physical board hex numbering doesn't match odd-q for some printed mats] → Axial storage means the mapping is only in template generation and the hover readout. A future "column 0 down" template is an additive option.
- [Ajv bundle size] → Acceptable (~120 KB). Ajv's standalone compiled validators can be used later if needed.
- [Fan-made name or IP concerns] → Original icons and wording only. The README states it's an unofficial fan project.

## Migration Plan

No existing data. Deployment is a static build (`web/dist`) that can be served from any static host. Hosting is not part of this change; local `npm run dev` / `npm run build` is sufficient. Rollback is not applicable.

## Open Questions

- Visual identity (palette, typography, logo) for Minovsky Maps. A functional default is used in v1.
- Whether goals need structured references to objectives (e.g. "control objective X") for future analysis. v1 keeps goals as free text.
- Exact hex numbering on official printed boards (whether rows count from 0 or 1). It only affects the hover readout. v1 shows 0-based column and row, and can be switched to 1-based later without a format change.
