## ADDED Requirements

### Requirement: Enlarge the sheet board
The sheet SHALL offer an Enlarge board action that shows the board alone, filling the screen. The full-screen view SHALL support two-finger pinch-zoom and pan, one-finger drag to pan, wheel zoom, and zoom in, zoom out and fit buttons, and SHALL be closed with a Close button or Escape. The action SHALL NOT be printed.

#### Scenario: Read small labels on a phone
- **WHEN** a player opens a share link at 390 × 664 and taps Enlarge board
- **THEN** the board fills the screen, and pinching out makes the objective labels larger

#### Scenario: Close the enlarged board
- **WHEN** the enlarged board is open and the user presses Escape
- **THEN** the sheet is shown again at the same scroll position

### Requirement: Sheet on small screens
The sheet's actions and setup checklist tick boxes SHALL meet the touch-sized target rule of `touch-input`. On viewports narrower than 600 px, the sheet SHALL be readable without horizontal scrolling or zooming the page.

#### Scenario: Phone sheet
- **WHEN** a share link is opened at 390 × 664 on a touch screen
- **THEN** there is no horizontal scrolling and every action and tick box has a hit area of at least 44 × 44 px
