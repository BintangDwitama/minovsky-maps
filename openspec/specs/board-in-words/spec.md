# board-in-words Specification

## Purpose
The board described as text: elevation, terrain and every component with its position, for screen readers and for reading a map without seeing it.
## Requirements
### Requirement: Text description of the board
A board description SHALL be derived from the scenario (never stored) and list:
- the board size;
- each elevation level above ground with its hexes;
- each terrain type with its hexes;
- every component grouped by Side A, Side B and Neutral, with its kind, label (if any), hex and level (if above ground).
For a carrier, the hex SHALL be its middle hex and its facing SHALL be given.

Hexes SHALL be written as column, row, as in the hex readout, ordered by column then row. Groups with nothing in them SHALL be omitted, and a flat board with no terrain SHALL say so.

#### Scenario: Describe the sample
- **WHEN** the description of "Desert Mesa" is produced
- **THEN** it lists 22 hexes at level 1 and 8 at level 2, the Side A base and garrisons with their hexes, and the four labelled objectives such as "Data core" with its hex and level 2

#### Scenario: Empty board
- **WHEN** the scenario has no elevation, terrain or components
- **THEN** the description gives the board size and says the board is flat, with no terrain and no components

### Requirement: Board in words in the editor and on the sheet
The editor's Scenario panels SHALL include a "Board in words" section, collapsed by default, that updates as the scenario changes. The scenario sheet (from a share link or a short link) SHALL include the same description as a collapsible section after the setup checklist. The section SHALL NOT be printed.

#### Scenario: Read the board on a sheet
- **WHEN** a player opens a shared scenario and expands "Board in words"
- **THEN** the description is shown as text lists that a screen reader reads in order

#### Scenario: Not printed
- **WHEN** the sheet is printed
- **THEN** the printout does not contain the board description

