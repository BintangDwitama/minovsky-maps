# component-placement Specification

## Purpose
How users place, select, move, rotate, edit and remove scenario components on the board.
## Requirements
### Requirement: Place components
The editor SHALL provide a palette containing every component kind defined by the scenario format, with each kind's sub-options: owner, upgrade type, objective type, and label for tokens and structures. When a palette entry is active, clicking a board hex SHALL place a new component of that kind with a newly generated unique id. The editor SHALL NOT refuse a placement because of terrain, elevation or other components on that hex; those cases produce warnings (see `scenario-validation`). The editor SHALL refuse only placements where an occupied hex would be off the board.

#### Scenario: Place a garrison for side B
- **WHEN** the garrison entry is active with owner B and the user clicks hex (4, 6)
- **THEN** a garrison owned by B appears on that hex

#### Scenario: Place on impassable terrain
- **WHEN** the user places an objective on a hex tagged `impassable`
- **THEN** the objective is placed and a warning appears

#### Scenario: Carrier would overhang the edge
- **WHEN** the user tries to place a carrier whose front or back hex would be off the board
- **THEN** no carrier is placed, and the editor shows a short message explaining why

### Requirement: Kinds that require owners
When the active palette entry is `base`, `carrier` or `garrison`, the owner selector SHALL offer only A and B. For `upgrade`, `energy` and `objective`, it SHALL offer only neutral. For `token` and `structure`, it SHALL offer A, B and neutral.

#### Scenario: Base owner options
- **WHEN** the user selects the base entry
- **THEN** the owner selector shows A and B, and neutral is not available

### Requirement: Labels for tokens and structures
Placing a `token` or `structure` SHALL require a non-empty label, entered before placement or prompted for on placement. The label SHALL be shown on or next to the component on the board.

#### Scenario: Token without label
- **WHEN** the user places a token with an empty label field
- **THEN** the editor prompts for a label and doesn't place the token until one is given or the placement is cancelled

### Requirement: Select, move and remove components
With the select tool, clicking a component SHALL select it and show its properties in the inspector, where every property can be edited. Dragging a selected component to another hex SHALL move it, subject to the same on-board rule as placement. Pressing Delete or using the inspector's remove action SHALL remove the selected component.

#### Scenario: Move a base
- **WHEN** the user drags side A's base from (1, 7) to (2, 7)
- **THEN** the base is now on (2, 7), and nothing is left on (1, 7)

#### Scenario: Edit upgrade type
- **WHEN** an upgrade is selected and the user changes its type from shield to speed in the inspector
- **THEN** the board shows a speed upgrade on the same hex

### Requirement: Rotate carriers
A selected carrier SHALL be rotatable clockwise and counter-clockwise by one hex direction (60°), using inspector buttons and the keyboard shortcuts R and Shift+R. The front of the carrier SHALL be visually distinguishable from the back. A rotation that would put any carrier hex off the board SHALL be refused.

#### Scenario: Rotate clockwise
- **WHEN** a carrier with facing 0 is selected and the user presses R
- **THEN** its facing becomes 1 and the board redraws its three hexes accordingly

#### Scenario: Rotation blocked at edge
- **WHEN** rotating a carrier would put its front hex off the board
- **THEN** the facing doesn't change and the editor shows a short message

