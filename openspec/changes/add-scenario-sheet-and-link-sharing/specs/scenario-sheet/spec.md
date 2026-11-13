## ADDED Requirements

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
