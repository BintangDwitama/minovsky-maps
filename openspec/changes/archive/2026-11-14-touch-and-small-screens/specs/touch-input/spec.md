## ADDED Requirements

### Requirement: One finger runs the tool
On a touch screen, a single finger on the board SHALL act as the primary mouse button does: a tap applies the current tool to that hex, and a drag continues the tool's stroke across hexes as one undo step. The page SHALL NOT scroll or zoom while a finger is on the board.

#### Scenario: Paint with a finger
- **WHEN** the Paint terrain tool with Water is active and the user drags one finger across three ground hexes
- **THEN** the three hexes become water, the page does not scroll, and one Undo removes all three

### Requirement: Two fingers pan and zoom
Two fingers on the board SHALL pan by moving together and zoom by pinching, keeping the point between the fingers fixed on screen, within the same zoom limits as the zoom buttons. When a second finger touches down during a one-finger stroke, the stroke SHALL be cancelled. Its changes are undone, and it SHALL add no undo step.

#### Scenario: Pinch to zoom
- **WHEN** the user places two fingers on the board and spreads them to twice their distance
- **THEN** the board zoom doubles (within its limits) and the hex between the fingers stays under them

#### Scenario: Second finger cancels a stroke
- **WHEN** the user starts painting with one finger over two hexes and then puts down a second finger
- **THEN** the two hexes return to their previous terrain, the board starts panning or zooming, and Undo is unaffected

### Requirement: Select tool drag pans on empty space
With the Select tool, a one-finger drag that starts on a hex with no component SHALL pan the board. A drag that starts on a component SHALL move it as it does with a mouse.

#### Scenario: Drag empty space
- **WHEN** the Select tool is active and the user drags one finger from an empty hex
- **THEN** the board pans with the finger and no component is selected or moved

### Requirement: Last touched hex replaces hover
On touch, the hex readout (coordinates, level and terrain) SHALL show the last hex touched, and SHALL keep showing it after the finger lifts, until another hex is touched or the tool changes.

#### Scenario: Read a hex on a phone
- **WHEN** the user taps a level 2 water hex with the Select tool
- **THEN** the status shows that hex's coordinates, "level 2" and "Water" after the finger lifts

### Requirement: Hints match the input
The tool hints SHALL describe the input in use: touch wording (tap, drag, two fingers to pan or pinch) after the last board interaction was a touch, and mouse wording otherwise.

#### Scenario: Touch hint
- **WHEN** the user has touched the board with the Select tool active
- **THEN** the hint mentions tapping to select and two fingers to pan or zoom, and does not mention the wheel or Space

### Requirement: Touch-sized targets
When the primary pointer is coarse (a touch screen), every button, text field, select, toggle and tick box in the editor, dialogs and sheets SHALL have a hit area of at least 44 × 44 CSS pixels. When the primary pointer is fine, controls SHALL keep their current size.

#### Scenario: Phone controls
- **WHEN** the editor is opened on a 390 × 664 touch screen
- **THEN** every visible button, input and tick box has a hit area of at least 44 × 44 px

#### Scenario: Desktop unchanged
- **WHEN** the editor is opened at 1500 × 950 with a mouse
- **THEN** the toolbar and tool buttons have the same size as before this change
