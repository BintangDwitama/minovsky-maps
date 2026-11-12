## ADDED Requirements

### Requirement: Save scenario file
The user SHALL be able to save the current scenario as a JSON file named `<slugified-name>.scenario.json`. The file SHALL conform to the scenario schema for its `schemaVersion`. Saving SHALL leave the editor state and history unchanged.

#### Scenario: Save
- **WHEN** the scenario is named "Desert Mesa" and the user saves
- **THEN** a file `desert-mesa.scenario.json` is downloaded, and it passes schema validation

### Requirement: Load scenario file
The user SHALL be able to load a scenario file by file picker or by dropping it onto the editor. Before loading, the editor SHALL check the file's `schemaVersion`. If it is older than the current version, the editor SHALL run the registered migrations in order. If it is newer than the current version, the editor SHALL reject the file and explain that a newer version of the app is needed. After any migration, the document SHALL be validated against the current schema and the format's cross-field rules (unique hexes, everything on the board, owner constraints). An invalid file SHALL be rejected with a readable list of problems, and the current scenario SHALL be left unchanged.

#### Scenario: Round trip
- **WHEN** a scenario is saved and then loaded
- **THEN** the loaded scenario is equal to the saved one

#### Scenario: Invalid file
- **WHEN** the user loads a JSON file with a component on a hex that isn't on the board
- **THEN** the load is rejected, the error names the component and hex, and the current scenario is unchanged

#### Scenario: Future version
- **WHEN** the user loads a file with `schemaVersion: 2` in an app that supports only version 1
- **THEN** the load is rejected with a message saying the file needs a newer version

### Requirement: Unsaved changes guard
The editor SHALL track whether the scenario has changes since it was last saved, created or loaded, and SHALL ask for confirmation before creating a new scenario, loading a file, or closing or reloading the browser tab while there are unsaved changes. The editor SHALL also autosave a draft to browser storage. On next launch it SHALL offer to restore the draft, and it SHALL work normally if browser storage is unavailable.

#### Scenario: Restore draft
- **WHEN** the user edits a scenario, closes the tab without saving, and reopens the editor
- **THEN** the editor offers to restore the unsaved draft

### Requirement: PNG export
The user SHALL be able to export the board as a PNG image showing the hexes, terrain tags, elevation badges, components (with owner and kind distinguishable) and the scenario name. Selection highlights, hover state and warning highlights SHALL NOT appear in the export. The export SHALL be at least 2000 pixels on its longest side.

#### Scenario: Export
- **WHEN** the user exports a 15×15 scenario named "Desert Mesa"
- **THEN** a PNG file `desert-mesa.png` is downloaded, at least 2000 px on its longest side, showing the board without UI overlays
