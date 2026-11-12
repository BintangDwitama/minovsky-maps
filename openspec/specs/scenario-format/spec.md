# scenario-format Specification

## Purpose
Defines the versioned scenario document (board, terrain, elevation, components, rules, goals) and its JSON Schema, the shared contract for every Minovsky Maps app.
## Requirements
### Requirement: Versioned scenario document
A scenario document SHALL be a JSON object with a required integer `schemaVersion` field. This change defines `schemaVersion` 1. The JSON Schema at `schema/scenario.v1.schema.json` SHALL be the single source of truth for the document shape, and the web app's TypeScript types SHALL be generated from it, not hand-written.

#### Scenario: Version present
- **WHEN** the editor creates a new scenario
- **THEN** the document contains `"schemaVersion": 1`

#### Scenario: Types stay in sync with schema
- **WHEN** the schema file changes and the type generation script is run
- **THEN** the generated TypeScript types reflect the change, and a type check fails anywhere the code no longer matches

### Requirement: Board as explicit hex set
The board SHALL be stored inline as `board: { kind: "inline", orientation: "flat", hexes: [...] }`. Each entry in `hexes` SHALL identify a hex by axial coordinates `q` and `r` (integers). The set of entries SHALL define the board's shape exactly. No hex outside the set is part of the board, and duplicate coordinates SHALL be invalid.

#### Scenario: 15x15 template shape
- **WHEN** a board is created from the default template
- **THEN** `hexes` contains exactly 225 entries, matching a 15-column by 15-row flat-top grid with odd-q offset (column 0 sits higher than column 1)

#### Scenario: Duplicate hex rejected
- **WHEN** a document lists the same `{q, r}` twice in `board.hexes`
- **THEN** validation fails, naming the duplicate coordinate

### Requirement: Terrain tags per hex
Each board hex MAY carry `tags`, a set of terrain tags drawn from `water`, `debris`, `impassable` and `minovsky`. Tags SHALL be unique within a hex, and any combination SHALL be allowed. A hex with no tags is open ground.

#### Scenario: Overlapping terrain
- **WHEN** a hex has tags `["water", "minovsky"]`
- **THEN** the document is valid and both tags are kept

#### Scenario: Unknown tag rejected
- **WHEN** a hex has tag `"lava"`
- **THEN** validation fails

### Requirement: Elevation per hex
The scenario SHALL store elevation as a sparse list `elevation: [{ q, r, level }]`, where `level` is an integer ≥ 1 equal to the number of stacked height-1 pillars on that hex. Hexes not listed SHALL be at ground level (0). Every listed hex SHALL exist on the board.

#### Scenario: Stacked pillars
- **WHEN** a hex has two pillars stacked on it
- **THEN** its elevation entry is `{ q, r, level: 2 }`

#### Scenario: Elevation off board rejected
- **WHEN** an elevation entry references a hex not in `board.hexes`
- **THEN** validation fails

### Requirement: Components
The scenario SHALL store `components`, a list where each entry has a unique `id` (string), a `kind`, an `owner` (`A`, `B` or `neutral`) and a `hex` (`{q, r}`). Kinds and their extra fields SHALL be:
- `base`: owner A or B.
- `carrier`: owner A or B, plus `facing` (integer 0–5, one of the six flat-top hex directions). `hex` is the middle hex, and the front and back hexes are the neighbours in the `facing` direction and in the opposite direction.
- `garrison`: owner A or B.
- `upgrade`: owner neutral, plus `upgradeType` (`shield`, `speed` or `strength`).
- `energy`: owner neutral.
- `objective`: owner neutral, plus `objectiveType` (`controllable` or `carryable`), and an optional `label`.
- `token`: any owner, plus a required `label` and an optional `note`.
- `structure`: any owner, plus a required `label` and an optional `note`.
Every hex a component occupies SHALL be on the board.

#### Scenario: Carrier occupies three hexes
- **WHEN** a carrier has `hex` {q:5, r:5} and `facing` 0
- **THEN** it occupies {5,5}, the neighbour of {5,5} in direction 0, and the neighbour in direction 3

#### Scenario: Owner constraint
- **WHEN** a `base` has owner `neutral`
- **THEN** validation fails

#### Scenario: Off-board carrier rejected
- **WHEN** a carrier's front hex is not on the board
- **THEN** validation fails

### Requirement: Scenario metadata, rules and goals
The scenario SHALL include:
- `meta`: `name` (required, non-empty), `author` (optional) and `description` (optional).
- `rules`: `deployment` (`bases` or `carriers`), `squadSize` (integer ≥ 1), `massProducedLimit` (integer ≥ 0, optional) and `terrainSetup` (`fixed` or `free`).
- `goals`: a list of `{ id, text, vp, scoring }`, where `vp` is an integer ≥ 0 and `scoring` is `phase1`, `phase2` or `each-phase`.

#### Scenario: Default rules on new scenario
- **WHEN** the editor creates a new scenario
- **THEN** `rules` is `{ deployment: "bases", squadSize: 3, terrainSetup: "fixed" }` and `goals` is empty

#### Scenario: Missing name rejected
- **WHEN** `meta.name` is an empty string
- **THEN** validation fails

