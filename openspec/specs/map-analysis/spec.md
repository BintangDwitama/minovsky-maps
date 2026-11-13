# map-analysis Specification

## Purpose
Testing a map in the editor: line of sight and movement reach from a hypothetical unit (the probe), following the core rules, shown as overlays that never change the scenario.
## Requirements
### Requirement: Probe placement
The editor SHALL provide an Analyse tool. Clicking a board hex with it SHALL place a probe: a hypothetical single-hex unit belonging to the chosen side (Side A or Side B) at that hex, at the hex's elevation. Clicking another hex SHALL move the probe; pressing Escape or leaving the tool SHALL clear it. The probe and all analysis settings SHALL NOT be stored in the scenario, saved files, PNG export, share links or published scenarios, and SHALL NOT create undo history.

#### Scenario: Place a probe
- **WHEN** the user picks the Analyse tool, chooses Side A and clicks hex (7, 4) at elevation 2
- **THEN** a Side A probe is shown on (7, 4) at elevation 2 and the overlays are computed from it

#### Scenario: Nothing is saved
- **WHEN** the user places a probe and then saves the scenario
- **THEN** the saved file is identical to one saved without using the Analyse tool

### Requirement: Line of sight
The line-of-sight overlay SHALL mark each board hex as visible or not visible from the probe, using a straight line from the centre of the probe's hex to the centre of the target hex, where the target is a hypothetical unit at the target hex's elevation. Let the probe's elevation be P, the target's T, and the higher of the two H. Considering only the hexes the line passes through (excluding the probe's and target's hexes):
- terrain SHALL block when its elevation is greater than both P and T;
- when P and T differ, terrain SHALL also block when its elevation equals H;
- an enemy piece (opposing side's base, garrison, carrier hex or structure) SHALL block when P equals T and the piece's elevation equals them, or when P and T differ and the piece's elevation equals H;
- allied and neutral pieces SHALL NOT block.
Hexes adjacent to the probe SHALL always be visible. When the line passes exactly along the edge between two hexes, the hex that keeps the line clear SHALL be used.

#### Scenario: Ridge between two units at ground level
- **WHEN** the probe is at elevation 0 and a hex at elevation 1 lies on the line to a target at elevation 0
- **THEN** the target hex is not visible

#### Scenario: Plateau at the same level
- **WHEN** the probe and the target are both at elevation 2 and the line crosses only hexes at elevation 2 or lower
- **THEN** the target hex is visible

#### Scenario: Shooting down past a ledge
- **WHEN** the probe is at elevation 2, the target at elevation 0, and the line crosses a hex at elevation 2
- **THEN** the target hex is not visible

#### Scenario: Enemy piece between
- **WHEN** a Side A probe and a target are both at elevation 0 with a Side B garrison at elevation 0 on the line between them
- **THEN** the target hex is not visible to the Side A probe, but would be visible to a Side B probe in the same place

#### Scenario: Shooting over a lower enemy
- **WHEN** the probe is at elevation 1, the target at elevation 1, and an enemy base at elevation 0 lies on the line
- **THEN** the target hex is visible

#### Scenario: Line along a hex edge
- **WHEN** the line runs exactly between two hexes and only one of them blocks
- **THEN** the target hex is visible

### Requirement: Inspect a sight line
While a probe is placed, hovering a hex SHALL draw the sight line from the probe to that hex and state whether it is clear. When blocked, the first blocking hex along the line SHALL be outlined and the reason given (terrain at a stated elevation, or an enemy piece).

#### Scenario: Blocked by terrain
- **WHEN** the user hovers a hex hidden behind a level 2 ridge
- **THEN** the sight line is drawn as blocked, the ridge hex is outlined, and the status reads that the line is blocked by terrain at level 2

### Requirement: Movement reach
The reach overlay SHALL mark every hex the probe could end a move on within its movement allowance, with the movement it costs. Allowance SHALL be the chosen move value (default 3, the Advance action) plus Speed, minus 1 when the probe starts in water, minus 1 when it starts in a debris field, and minus 1 when Engaged; never below 0. Each step into an adjacent hex SHALL cost 1 plus 1 per level climbed above the reference elevation; descending SHALL be free. The reference elevation SHALL be the current hex's elevation, except when the probe starts above ground level (jumping), when it SHALL be the higher of the starting elevation and the current hex's elevation. The probe SHALL NOT enter impassable hexes unless Hover is on, SHALL NOT pass through hexes with enemy pieces (except, when jumping, enemy pieces below the reference elevation), MAY pass through allied pieces, and SHALL NOT end on any hex holding a base, garrison, carrier or structure, or an impassable hex. The probe's own hex SHALL NOT count as reachable.

#### Scenario: Climbing costs extra
- **WHEN** a probe at elevation 0 with move 3 is next to a hex at elevation 1
- **THEN** that hex is reachable at cost 2, and a further elevation 1 hex beyond it at cost 3

#### Scenario: Starting in water
- **WHEN** the probe starts on a water hex with move 3 and no Speed
- **THEN** no hex costing more than 2 is reachable

#### Scenario: Jumping across a gap
- **WHEN** the probe starts at elevation 1, the next hex is at elevation 0 and the one after is at elevation 1
- **THEN** the far elevation 1 hex is reachable at cost 2 (no climbing cost)

#### Scenario: Enemy blocks the way
- **WHEN** a Side A probe at ground level faces a corridor whose only hex holds a Side B base
- **THEN** hexes beyond the base are not reachable through it, and the base hex itself is not reachable

### Requirement: Engagement
The probe SHALL be treated as Engaged when any adjacent hex holds an enemy garrison at the probe's elevation, and the panel SHALL say so. The user SHALL be able to mark the probe as Engaged by hand (standing in for enemy units, which scenarios do not contain).

#### Scenario: Next to an enemy garrison
- **WHEN** a Side A probe at elevation 0 is placed next to a Side B garrison at elevation 0
- **THEN** the panel shows Engaged and the reach allowance is reduced by 1

### Requirement: Analysis panel and display
While the Analyse tool is active, the right panel SHALL show the probe's side and hex, a mode choice (line of sight, reach, or both), the move value, Speed (0–3), Engaged and Hover toggles, and the number of visible and reachable hexes. Overlays SHALL be drawn only on the interactive board, distinguishable without relying on colour alone (pattern or label), and SHALL disappear when the tool is left.

#### Scenario: Reach mode
- **WHEN** the user switches the mode to reach
- **THEN** reachable hexes are tinted and labelled with their cost, the line-of-sight shading is hidden, and the panel shows the reachable count
