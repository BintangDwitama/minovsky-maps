# scenario-sheet Specification

## Purpose
The read-only, printable scenario sheet a receiving player sees when opening a share link.
## Requirements
### Requirement: Scenario sheet content
Opening a valid share link SHALL show a read-only scenario sheet with: the scenario name, author (if any) and description (if any); the board rendered exactly as in the editor and PNG export, without editing overlays; the rules (deployment, squad size, mass-produced limit if set, terrain setup); and the goals with their VP and scoring timing, in order. The sheet SHALL NOT allow editing.

#### Scenario: Sheet for the sample scenario
- **WHEN** the user opens a share link of "Desert Mesa"
- **THEN** the sheet shows the title "Desert Mesa", the board with its terrain, elevation badges and components, the rules, and both goals with their VP

### Requirement: Setup checklist
The sheet SHALL include a setup checklist derived from the scenario: the total number of pillars and the number of hexes at each elevation level; the components grouped by side (Side A, Side B, Neutral) with a count per kind; and the labels of labelled components (tokens, structures, and objectives that have a label). Each checklist line SHALL have a tick box usable on screen and on paper.

#### Scenario: Pillars and components
- **WHEN** the sheet shows a scenario with 22 hexes at level 1, 8 hexes at level 2, two Side A bases and four neutral objectives
- **THEN** the checklist lists "38 pillars" with "level 1: 22 hexes" and "level 2: 8 hexes", "Side A: 2 bases", and "Neutral: 4 objectives"

#### Scenario: Flat board
- **WHEN** the scenario has no elevation
- **THEN** the checklist states that no pillars are needed

### Requirement: Sheet actions
The sheet SHALL offer: Edit a copy; Copy link; Download `.json` (same file name rule as Save); Export PNG (same image as the editor's export); and Print.

#### Scenario: Download from the sheet
- **WHEN** the user clicks Download on the sheet of "Desert Mesa"
- **THEN** a file `desert-mesa.scenario.json` is downloaded that opens in the editor to the same scenario

### Requirement: Print layout
Printing the sheet SHALL produce an A4 portrait layout in the light colour scheme regardless of the screen's colour scheme, with the title and board first, then rules, goals and the setup checklist. Navigation and action buttons SHALL NOT be printed, and the board SHALL NOT be split across pages.

#### Scenario: Print in dark mode
- **WHEN** the user prints the sheet while the system is in dark mode
- **THEN** the printout uses the light colour scheme and contains no buttons

### Requirement: Published scenario sheet
Opening `<app address>/s/<id>` SHALL show the scenario sheet for the latest version of that published scenario, with the same content, setup checklist, actions and print layout as a sheet opened from a share link. Copy link SHALL copy the short link. For an owned scenario, the sheet SHALL show the owner's display name as the author, marked as verified, in place of the document's free-text author. For an unclaimed scenario, it SHALL show the free-text author as before. The sheet SHALL offer Edit, which opens the scenario in the editor as the published document so Update is available, when the signed-in account owns the scenario or this browser holds its legacy edit token.

#### Scenario: Open a short link
- **WHEN** a player opens `/s/k3x9mQ2a`
- **THEN** the sheet of the latest published version is shown and Copy link copies `/s/k3x9mQ2a`

#### Scenario: Verified author
- **WHEN** anyone opens the sheet of a scenario owned by an account named "Bintang"
- **THEN** the author line reads "by Bintang" with a verified mark, regardless of the document's Author field

#### Scenario: Owner sees Edit
- **WHEN** the owner, signed in on a different device, opens the short link
- **THEN** the sheet offers Edit, and other visitors do not see it

### Requirement: Waking and unavailable states
While the API has not answered within 3 seconds, the sheet SHALL show that the server is waking up and that this can take up to a minute. If the scenario does not exist or was taken down, the sheet SHALL say so and offer to open the editor. If the API cannot be reached after 90 seconds, the sheet SHALL show a retry action.

#### Scenario: Cold server
- **WHEN** a player opens a short link while the API is asleep
- **THEN** after 3 seconds the page shows a waking-up message, and the sheet appears once the API answers

#### Scenario: Unknown scenario
- **WHEN** a player opens `/s/zzzzzzzz`
- **THEN** the page says the scenario was not found and offers to open the editor

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

