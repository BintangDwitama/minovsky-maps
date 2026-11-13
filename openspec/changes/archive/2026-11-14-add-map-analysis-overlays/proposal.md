## Why

Creators can build and share maps, but cannot test them before playing: whether a ridge actually blocks fire, whether a base is exposed, or how far a unit gets across water and stepped terrain. Answering that today means setting the map up on the table. An in-editor check of line of sight and movement reach, following the official rules, lets creators balance a map while designing it.

## What Changes

- New **Analyse** tool: click a hex to place a **probe**, a hypothetical unit of Side A or Side B standing there at that hex's elevation.
- **Line-of-sight overlay:** every hex is marked as visible or not from the probe, following the core rules (terrain height, enemy pieces at the relevant height, adjacency, and the edge case where the line runs along a hex edge). Hovering a hex draws the sight line and outlines the first thing blocking it.
- **Reach overlay:** the hexes the probe could end a move on, with the movement each costs. It accounts for climbing, free descent, jumping from high ground, water and debris start penalties, Engagement (detected from adjacent enemy garrisons, or set by hand), Speed upgrades, Hover, enemy pieces that can't be passed, and occupied hexes that can't be ended on.
- **Analysis panel** with probe side, mode (line of sight, reach or both), move allowance (Advance 3 by default), Speed, and the Engaged and Hover toggles, plus counts of visible and reachable hexes.
- Rules follow the core rulebook as written, described in our own words. Only **enemy** pieces (bases, garrisons, carriers, structures of the opposing side) block; neutral pieces never block, because the rulebook leaves them to each scenario's own rules.

Sides touched: **web only**. No schema, server or file format change.

## Capabilities

### New Capabilities
- `map-analysis`: the Analyse tool, the probe, line-of-sight and reach rules, and how the overlays and panel present the results.

### Modified Capabilities
- None. Overlays never change the scenario, saved files, PNG export, share links or published scenarios.

## Non-goals

- No coverage or heat-map view (visibility from every hex, or from a whole side); a possible follow-up.
- No carriers as the probe; carriers count only as blockers.
- No weapon specifics: ranges, Accuracy modifiers, area attacks, abilities that ignore line of sight, Push/Pull.
- No per-structure blocking rules for neutral or scenario-specific structures (would need a schema change).
- No units in scenarios; the probe is never saved.

## Impact

- **Domain (pure, tested):** `web/src/domain/analysis/` with hex line tracing, line of sight and reach.
- **Application:** UI state for the probe and analysis settings; a new `analyse` tool id.
- **UI:** Analyse tool button and shortcut, an `AnalysisOverlay` organism drawn by the interactive board only, an `AnalysisPanel` organism, and status-bar text for the hovered hex.
- **Rules accuracy:** interpretations of ambiguous points (jump height reference, stacked terrain penalties) are written down in the design and covered by tests.
