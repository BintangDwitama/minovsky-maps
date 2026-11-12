## Why

Gundam Assemble ships with a few fixed scenarios, so players who want new battlefields have to sketch them on paper and explain the layout by hand. A browser-based scenario editor gives them a fast way to design a board (terrain, elevation, components, goals), check it against the rules, and save or export it. It also defines the scenario format that the later sharing platform (Phase 2) will build on, so getting the format right now matters more than any single feature.

## What Changes

- Set up the monorepo with `web/` (React + TypeScript SPA) and `schema/` (shared scenario JSON Schema). `server/` is **not** created in this change.
- Define **scenario format v1**: an inline board (an explicit set of axial hexes with per-hex terrain tags), per-hex elevation (stacked pillars), placed components, scenario rules, and goals. It is versioned with `schemaVersion`.
- Build the board editor: start from the 15×15 flat-top odd-q template or a custom size, paint terrain tags (water, debris, impassable, minovsky), and paint elevation.
- Component placement: place, move, rotate (Carrier facing) and remove base, carrier, garrison, upgrade, energy, objective, token and structure, with owner A / B / neutral.
- Scenario settings: name, author, description, rules (deployment, squad size, mass-produced limit, terrain setup) and goals (text, VP, scoring timing).
- Soft validation: warnings that never block (component on impassable terrain, stacked components, Carrier at uneven elevation, deployment mismatches, a side with no deployment point) plus a derived pillar count.
- Undo/redo for every edit.
- File I/O: save and load scenario JSON files, with schema validation on load, and export the board as a PNG.

**Sides touched:** `web`, `schema`. No `server` changes.

## Non-goals

- Go backend, Postgres, authentication, publishing or share links (Phase 2).
- Browsing, search, likes, forks (Phase 3).
- Line-of-sight, movement-reach or balance analysis overlays (later change).
- Entering data for official printed boards, or a board-reference (`boardRef`) library.
- Custom image uploads for pieces, and any Bandai/Sunrise artwork.
- Mobile/touch-first editing (desktop browser first; mobile view-only is acceptable).
- Simulating gameplay (units, timeline, dice).

## Capabilities

### New Capabilities

- `scenario-format`: The versioned scenario document (v1): board shape and hex coordinates, terrain tags, elevation, components, rules, goals, and the JSON Schema that is the single source of truth.
- `board-editing`: Creating a board from a template or custom size, resizing, and painting terrain tags and elevation on hexes.
- `component-placement`: Placing, selecting, moving, rotating and removing scenario components, including multi-hex Carriers with facing.
- `scenario-settings`: Editing scenario metadata, rules and goals.
- `scenario-validation`: Non-blocking placement and setup warnings, and derived figures such as the pillar count.
- `edit-history`: Undo and redo of every scenario edit.
- `scenario-file-io`: Saving and loading scenario JSON files with validation and migration hooks, and exporting the board as a PNG.

### Modified Capabilities

_None. This is the first change in the project._

## Impact

- **New code:** `web/` (Vite + React + TS app with `domain/`, `application/`, `infrastructure/` and `ui/` layers) and `schema/scenario.v1.schema.json`.
- **New dependencies (web):** React, Vite, TypeScript, Vitest, a JSON Schema validator (Ajv), and a schema-to-TypeScript type generator. No runtime backend dependency.
- **Format contract:** scenario files written by this change must stay loadable by every later version, either directly or through a migration.
- **Repo:** root README and `.gitignore` gain entries for the `web/` toolchain.
