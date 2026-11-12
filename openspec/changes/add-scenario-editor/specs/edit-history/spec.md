## ADDED Requirements

### Requirement: Undo and redo
Every change to the scenario document SHALL be undoable and redoable. This covers terrain painting, elevation painting, board resize, component placement, moves, rotation, edits and removal, and edits to metadata, rules and goals. Undo SHALL be triggered by Ctrl+Z (Cmd+Z on macOS) and toolbar buttons. Redo SHALL be triggered by Ctrl+Y or Ctrl+Shift+Z (Cmd+Shift+Z on macOS) and toolbar buttons. Making a new edit after undoing SHALL discard the redo stack.

#### Scenario: Undo a placement
- **WHEN** the user places a garrison and then presses Ctrl+Z
- **THEN** the garrison is gone, and Ctrl+Y brings it back

#### Scenario: New edit clears redo
- **WHEN** the user undoes an edit and then paints a hex
- **THEN** redo is unavailable

### Requirement: Strokes are single steps
One click-drag stroke of a painting tool SHALL be recorded as one history step, however many hexes it touches. Dragging a component SHALL be one history step. Typing in a text field SHALL be grouped into one step per field focus session.

#### Scenario: Undo a drag stroke
- **WHEN** the user paints water across ten hexes in one drag and presses Ctrl+Z once
- **THEN** all ten hexes return to their previous tags

### Requirement: Bounded history
The history SHALL keep at least the 200 most recent steps. Loading a file or creating a new scenario SHALL clear the history.

#### Scenario: History cleared on load
- **WHEN** the user loads a scenario file
- **THEN** undo is unavailable until the next edit
