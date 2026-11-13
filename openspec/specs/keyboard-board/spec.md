# keyboard-board Specification

## Purpose
Using the board without a pointer: keyboard focus, a cursor moved by column and row, tool actions from the keyboard, and spoken feedback.
## Requirements
### Requirement: Board takes keyboard focus
The board SHALL be reachable with Tab and SHALL have an accessible name and a description of its keys. When it receives focus, a cursor hex SHALL be shown: the selected component's hex if there is one, else the last cursor position, else the hex nearest the board's centre. The cursor SHALL be drawn only while the board has focus, distinguishable without relying on colour alone. The cursor SHALL never be saved, exported or shared.

#### Scenario: Tab to the board
- **WHEN** the user presses Tab from the last tool button until the board is focused
- **THEN** a cursor ring is drawn on the centre hex, and the board's name and key help are exposed to assistive technology

### Requirement: Arrow keys move the cursor
While the board has focus, the arrow keys SHALL move the cursor one column left or right, or one row up or down, using the same column and row numbers shown in the hex readout. On boards with gaps, the cursor SHALL skip to the next board hex in that direction, and SHALL stay put at the board's edge. When the view is zoomed so the cursor would leave the visible area, the view SHALL pan to keep it visible.

#### Scenario: Move right
- **WHEN** the cursor is on 7, 8 and the user presses Right
- **THEN** the cursor is on 8, 8

#### Scenario: Edge of the board
- **WHEN** the cursor is on the top row and the user presses Up
- **THEN** the cursor stays where it is and the announcement says it is the edge of the board

### Requirement: Keyboard applies tools
While the board has focus, keys SHALL drive the current tool:
- **Enter** SHALL apply the current tool to the cursor hex exactly as a single click does.
- **Shift + an arrow key** SHALL start or continue a stroke: it applies the tool to the hexes the cursor passes over. Releasing Shift ends the stroke as one undo step, and Escape during the stroke cancels it with no change and no history.
- **Select tool:** Enter on a hex with a component SHALL select it and pick it up. Arrow keys then move it, Enter drops it as one undo step, and Escape puts it back.
- **Analyse tool:** Enter SHALL place or move the probe, and moving the cursor SHALL inspect the sight line to the cursor hex, as hovering does.

#### Scenario: Paint a line with Shift
- **WHEN** Paint terrain with Water is active, the cursor is on a ground hex, and the user holds Shift and presses Right twice, then releases Shift
- **THEN** three hexes become water and one Undo removes all three

#### Scenario: Carry a component
- **WHEN** the Select tool is active, the cursor is on a garrison, and the user presses Enter, Right, Right, Enter
- **THEN** the garrison is two columns to the right and one Undo puts it back

#### Scenario: Put it back
- **WHEN** a component is picked up and moved with the arrows and the user presses Escape
- **THEN** the component is on its original hex and no undo step was added

### Requirement: Spoken cursor and edits
The editor SHALL have one polite live region for announcements:
- When the keyboard moves the cursor, it SHALL announce the hex: its column and row, its level if above ground, its terrain, and the components on it with their side and label.
- With the Analyse tool and a probe placed, it SHALL also announce whether the sight line is clear or what blocks it, and the movement cost if reachable.
- After a keyboard action, undo or redo, it SHALL announce the result, such as the new level, what was placed or moved, or "Undid Paint terrain".
- Refusal messages, such as a blocked placement, SHALL be announced.

The pointer-driven hex readout in the status bar SHALL NOT be a live region.

#### Scenario: Announce a hex
- **WHEN** the cursor moves onto a level 2 water hex holding a Side A garrison
- **THEN** the live region reads "7, 8. Level 2. Water. Garrison, Side A."

#### Scenario: Mouse movement is silent
- **WHEN** the user moves the mouse across the board
- **THEN** nothing is announced

### Requirement: Keyboard hints
After the board was last used with the keyboard, the tool hints SHALL describe the keyboard controls (arrows, Shift + arrows, Enter, Escape).

#### Scenario: Keyboard hint
- **WHEN** the user moves the cursor with the arrow keys while Raise +1 is active
- **THEN** the hint mentions Enter to raise the cursor hex and Shift + arrows to raise a line

