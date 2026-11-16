## MODIFIED Requirements

### Requirement: Unsaved changes guard
The editor SHALL track whether the scenario has changes since it was last saved, created or loaded. It SHALL ask for confirmation before creating a new scenario, loading a file, or closing or reloading the browser tab while there are unsaved changes.
- **Autosave:** the editor SHALL autosave a draft to browser storage, recording when it was saved.
- **Restore:** when the editor opens and a draft exists, it SHALL offer to restore the draft. When it was opened with "Continue editing" from My scenarios, it SHALL restore the draft without asking.
- **Older drafts:** drafts saved before the save time was recorded SHALL still load.
- **No storage:** the editor SHALL work normally if browser storage is unavailable.

#### Scenario: Restore draft
- **WHEN** the user edits a scenario, closes the tab without saving, and opens the editor again through "Create a scenario"
- **THEN** the editor offers to restore the unsaved draft

#### Scenario: Continue without asking
- **WHEN** the user chooses Continue editing on the draft in My scenarios
- **THEN** the editor shows the draft directly, still marked as unsaved
