## ADDED Requirements

### Requirement: New scenario from board template
The editor SHALL let the user start a new scenario from the default board template (15×15, flat-top, odd-q) or from a custom rectangular size of W columns × H rows, where 1 ≤ W, H ≤ 40.

#### Scenario: Default new scenario
- **WHEN** the user creates a new scenario without changing the size
- **THEN** the board shows 225 hexes in a 15×15 flat-top odd-q layout with no terrain, elevation or components

#### Scenario: Custom size
- **WHEN** the user creates a new scenario with size 12×18
- **THEN** the board contains exactly 216 hexes in 12 columns and 18 rows

#### Scenario: Size out of range
- **WHEN** the user enters a width of 0 or 41
- **THEN** the editor refuses to create the board and shows the allowed range

### Requirement: Resize board
The user SHALL be able to resize an existing rectangular board. Hexes that are kept SHALL keep their tags and elevation. Hexes that are removed SHALL lose their tags and elevation, and components occupying any removed hex SHALL be removed. If any component would be removed, the editor SHALL ask for confirmation first.

#### Scenario: Shrink with components outside
- **WHEN** the user shrinks the board and a garrison sits on a hex that would be removed
- **THEN** the editor asks for confirmation, names how many components will be removed, and only applies the resize if the user confirms

### Requirement: Paint terrain tags
The user SHALL be able to select a terrain tag tool and toggle that tag on hexes by clicking, or by click-dragging across several hexes. One drag stroke SHALL either add or remove the tag on every hex it touches, based on whether the first hex had the tag. An eraser tool SHALL clear all tags from the hexes it touches.

#### Scenario: Paint water across hexes
- **WHEN** the water tool is active and the user drags across five hexes, none of which has water
- **THEN** all five hexes gain the `water` tag, and other tags on them are unchanged

#### Scenario: Drag removes consistently
- **WHEN** the water tool is active and the user starts a drag on a hex that already has water
- **THEN** every hex touched by that stroke loses `water`

### Requirement: Paint elevation
The user SHALL be able to raise or lower a hex's elevation by one level per click (raise and lower tools), or set it to an exact level with a "set level N" tool, and these tools SHALL work with click-drag. Elevation SHALL never go below 0, and the editor SHALL cap it at 9.

#### Scenario: Raise twice
- **WHEN** the raise tool is used twice on a ground-level hex
- **THEN** the hex's elevation is 2, and the board shows it visually higher than level 1 hexes

#### Scenario: Lower at ground
- **WHEN** the lower tool is used on a hex at elevation 0
- **THEN** the elevation stays 0

### Requirement: Board rendering
The board SHALL be drawn as flat-top hexes in odd-q layout, scaled to fit the viewport, with pan and zoom. Each hex SHALL make its terrain tags visible with distinct, colour-blind-safe patterns or icons (not colour alone) and SHALL show its elevation level as a number badge when it is above 0. Hovering a hex SHALL show its offset coordinate (column, row), as on the physical board.

#### Scenario: Hex with multiple tags
- **WHEN** a hex has `water` and `minovsky`
- **THEN** both are visually identifiable on that hex at the default zoom

#### Scenario: Hover coordinate
- **WHEN** the user hovers the hex at column 3, row 7
- **THEN** the status area shows "3, 7"
