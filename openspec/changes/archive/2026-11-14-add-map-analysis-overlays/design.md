## Context

Scenarios store terrain tags, elevation and placed components, but no units. The core rulebook defines line of sight (centre-to-centre line, blocked by taller terrain and by enemy pieces at the relevant height) and movement (1 per hex, +1 per level climbed, free descent, jumping from high ground, water/debris and Engagement penalties, impassable terrain, enemy pieces not passable). This change lets creators probe those rules on their own maps. Rules are encoded from our reading of the rulebook and described in our own words (IP rule).

Existing pieces this builds on: hex math in `domain/hex.ts` (axial coords, flat-top, `axialToPixel`, directions), `buildIndex` (elevation and tags by hex), the component registry (`footprint`, owners), the tool registry (`ui/tools/tools.ts`), `UiStore`, and `BoardView` overlays drawn only by `HexBoard`.

## Goals / Non-Goals

**Goals:** rule-faithful line of sight and reach from a probe; explainable results (why a line is blocked); pure, tested domain code; zero impact on saved data.

**Non-Goals:** coverage maps, carrier probes, weapon-specific rules, scenario-specific structure rules, persistence.

## Decisions

### D1. Blocking pieces ("enemy" relative to the probe's side)
A piece blocks for a probe of side S when its owner is the other side (A↔B) and its kind is base, garrison, carrier (all three footprint hexes) or structure. Neutral pieces, allied pieces, objectives, energy, upgrades and tokens never block. This is the rulebook's general rule; scenario-specific structure rules are out of scope (D-non-goal). A piece's elevation is its hex's elevation.

### D2. Line tracing (`domain/analysis/hexLine.ts`)
Standard hex line drawing: N = hex distance; sample N+1 points by linearly interpolating cube coordinates and rounding. To handle lines that run exactly along hex edges, trace twice with a tiny nudge (ε = 1e-6 added to the start/end cube coordinates in opposite directions: `(+ε, +2ε, −3ε)` and `(−ε, −2ε, +3ε)`). Each trace yields the ordered hexes strictly between probe and target. A target is visible if **either** trace is clear (the rulebook lets the acting player choose the favourable hex). When both traces agree they produce the same answer, so ordinary lines cost nothing extra.

### D3. Line of sight (`domain/analysis/lineOfSight.ts`)
For probe elevation P, target elevation T, H = max(P, T), and each intermediate hex with terrain elevation e and optional enemy piece:
- blocked by terrain if e > max(P, T) — or, when P ≠ T, if e == H (combined: `e > H || (P !== T && e === H)`);
- blocked by an enemy piece if (P == T and e == P) or (P ≠ T and e == H).
Adjacent targets (distance 1) are always visible. The probe's own hex is not a target. API: `lineOfSight(index, probe, side) → Map<HexKey, { visible: boolean; blocker?: { hex, reason: 'terrain' | 'enemy', elevation } }>` plus `traceSightLine(index, probe, side, target)` returning the chosen trace and first blocker for the hover view. Pure; uses a prebuilt `AnalysisIndex` (elevation, tags, blocking pieces per hex for each side) built once per scenario.

### D4. Reach (`domain/analysis/reach.ts`)
Dijkstra over states `(hex, ref)`:
- start state `(probeHex, ref = startElevation)`; jumping iff `startElevation > 0`;
- step to neighbour n with elevation e: `ref' = jumping ? max(startElevation, e) : e`; cost `1 + max(0, e − ref)`; (for non-jumping, ref is the current hex's elevation, so this is "+1 per level climbed");
- forbidden to enter: off-board, impassable unless Hover, enemy-piece hexes unless `jumping && pieceElevation < ref` (passing over);
- a hex is a valid *end* if it is not impassable, holds no base/garrison/carrier/structure of any owner, and is not the start hex;
- allowance = max(0, move + speed − [water at start] − [debris at start] − [engaged]).
Result: `Map<HexKey, cost>` of valid end hexes with cost ≤ allowance (minimum over states). Board ≤ 1,600 hexes × few ref values ⇒ trivially fast.

**Interpretations (written into tests):**
- Jump reference: the rulebook says a jumping unit treats its starting elevation as its elevation for the move and only pays to go higher than that. We read "higher than that" as relative to the higher of the starting elevation and the hex it currently stands on, so a unit that climbs above its start pays for each new level once, and dropping into a gap does not make the climb back up to the starting level cost extra.
- Water and debris on the same start hex: both penalties apply (each is stated as its own −1).
- Hover: only lifts the impassable restriction (as the rulebook states); it does not change other costs.

### D5. Engagement
Auto-detected when any neighbour of the probe holds an enemy garrison at the probe's elevation (units are not in scenarios, bases/structures don't engage). The panel shows "Engaged (enemy garrison at …)" and offers a manual toggle; manual OR auto ⇒ −1.

### D6. State and tool
- `ToolId` gains `'analyse'` (shortcut **A**, icon `eye`). The tool's click sets `ui.analysis.probe`; it never touches the session (no undo entries).
- `UiState.analysis = { probe: Axial | null; side: 'A' | 'B'; mode: 'los' | 'reach' | 'both'; move: number; speed: 0..3; engaged: boolean; hover: boolean }` with defaults side A, mode both, move 3, speed 0. Leaving the tool clears the probe; Escape clears it.
- Results are derived with `useMemo` from `(scenario, analysis)`; hover inspection uses the existing `ui.hover`.

### D7. Presentation (atomic levels)
- **Organism `AnalysisOverlay`** (rendered inside `HexBoard`'s SVG overlay group, never by `BoardView`/export): not-visible hexes get a dark hatched fill (pattern, not just colour); reachable hexes a tinted fill with the cost number; the probe as a side-coloured ring with "A"/"B"; the hovered sight line as a solid (clear) or dashed red (blocked) line with the first blocker outlined.
- **Organism `AnalysisPanel`** in the right panel while the tool is active (above Selection): side toggle, mode segmented control, move number, Speed 0–3, Engaged (auto state + manual checkbox), Hover checkbox, counts, and a one-line rules note ("Only enemy pieces block; neutral pieces follow scenario rules and are ignored").
- **Status bar** while hovering: "Line of sight clear" / "Blocked by terrain at level 2 (5, 6)" / "Reach: 2 movement".
- No new colours outside the theme: reuse side colours for the probe, `--vent` for reach tint, a dark hatch for hidden.

## Risks / Trade-offs

- [Rule misreading] → each rule maps to a named test mirroring the rulebook's own situations in our words; interpretations listed in D4 and shown as a short note in the panel.
- [Edge-case line rounding differs from players' straightedges] → the two-nudge approach implements the "acting player chooses" rule; vertex-exact lines are covered by tests.
- [Overlays clutter the board] → mode switch (LoS / reach / both); overlays only while the tool is active.
- [Performance on 40×40 boards] → LoS is O(hexes × distance) ≈ 1,600 × 40; reach Dijkstra is tiny; both memoised per scenario+probe.

## Migration Plan

Additive, web only. No data changes; rollback by revert.

## Open Questions

None. Coverage maps and scenario-specific structure rules are candidates for later changes.
