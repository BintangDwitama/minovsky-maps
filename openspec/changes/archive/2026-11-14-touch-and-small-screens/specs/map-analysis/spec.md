## MODIFIED Requirements

### Requirement: Probe placement
The editor SHALL provide an Analyse tool. Clicking a board hex with it SHALL place a probe: a hypothetical single-hex unit belonging to the chosen side (Side A or Side B) at that hex, at the hex's elevation. With a mouse, clicking another hex SHALL move the probe. On touch, tapping a hex while no probe is placed SHALL place it. While a probe is placed, tapping SHALL inspect (see Inspect a sight line), and dragging the probe with one finger SHALL move it to the hex where the finger lifts. Pressing Escape or leaving the tool SHALL clear the probe. The probe and all analysis settings SHALL NOT be stored in the scenario, saved files, PNG export, share links or published scenarios, and SHALL NOT create undo history.

#### Scenario: Place a probe
- **WHEN** the user picks the Analyse tool, chooses Side A and clicks hex (7, 4) at elevation 2
- **THEN** a Side A probe is shown on (7, 4) at elevation 2 and the overlays are computed from it

#### Scenario: Move the probe by touch
- **WHEN** a probe is on (7, 4) and the user drags it with one finger to (5, 6)
- **THEN** the probe stands on (5, 6) and the overlays are recomputed from there

#### Scenario: Nothing is saved
- **WHEN** the user places a probe and then saves the scenario
- **THEN** the saved file is identical to one saved without using the Analyse tool

### Requirement: Inspect a sight line
While a probe is placed, hovering a hex with a mouse, or tapping a hex other than the probe's on touch, SHALL draw the sight line from the probe to that hex and state whether it is clear. A tapped hex SHALL stay inspected after the finger lifts until another hex is tapped or the probe moves. When blocked, the first blocking hex along the line SHALL be outlined and the reason given (terrain at a stated elevation, or an enemy piece).

#### Scenario: Blocked by terrain
- **WHEN** the user hovers a hex hidden behind a level 2 ridge
- **THEN** the sight line is drawn as blocked, the ridge hex is outlined, and the status reads that the line is blocked by terrain at level 2

#### Scenario: Inspect by tapping
- **WHEN** a probe is placed and the user taps a hex hidden behind a level 2 ridge on a touch screen
- **THEN** the probe stays where it was, the blocked sight line and outlined ridge stay shown after the finger lifts, and the status reads that the line is blocked by terrain at level 2
