## 1. Domain: analysis index and line tracing

- [x] 1.1 `domain/analysis/analysisIndex.ts`: per-scenario index of elevation, tags and blocking pieces per hex for each side (enemy = opposing side's base/garrison/carrier hexes/structure), with tests
- [x] 1.2 `domain/analysis/hexLine.ts`: cube-lerp hex line with the two opposite nudges; returns the intermediate hexes of each trace; tests for straight lines, diagonals and edge-running lines

## 2. Domain: line of sight

- [x] 2.1 `lineOfSight` and `traceSightLine` per design D3 (terrain rule, different-elevation rule, enemy pieces, adjacency, favourable edge choice, first blocker with reason)
- [x] 2.2 Tests mirroring the rulebook situations in our own words: ridge between ground units, plateau, shooting down past a ledge, enemy between at same level, shooting over a lower enemy, ally/neutral never blocks, edge-running line, adjacency

## 3. Domain: reach and engagement

- [x] 3.1 `reach` per design D4 (climb cost, free descent, jumping reference, water/debris/engaged penalties, Speed, Hover, enemy pieces not passable except jumped-over lower ones, no ending on occupied/impassable hexes)
- [x] 3.2 `isEngaged` (adjacent enemy garrison at the probe's elevation)
- [x] 3.3 Tests for each rule and interpretation listed in D4/D5

## 4. State and tool

- [x] 4.1 `ToolId` `'analyse'` with shortcut A and `eye` icon; `UiState.analysis` with defaults; probe set by clicking, cleared by Escape and when leaving the tool; never touches the session (test: no undo entry)

## 5. UI

- [x] 5.1 `AnalysisOverlay` organism in `HexBoard` only: hidden hatch, reach tint with costs, probe marker, hovered sight line with first blocker outlined
- [x] 5.2 `AnalysisPanel` organism: side, mode, move, Speed, Engaged (auto + manual), Hover, counts, rules note
- [x] 5.3 Status bar text for the hovered hex (clear / blocked by … / reach cost)

## 6. Verification

- [x] 6.1 Lint, typecheck, unit tests and build pass
- [x] 6.2 Browser check on the sample scenario: place probes at ground and on the mesa, verify visible/hidden and reach counts against hand-worked expectations; mode switching; overlays absent from PNG export and saved file
- [x] 6.3 Re-run the Phase 1, share and publishing walkthroughs (no regressions)
