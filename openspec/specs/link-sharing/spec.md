# link-sharing Specification

## Purpose
How a scenario is shared as a self-contained link, how links are encoded and validated, and how a shared scenario is opened for editing.
## Requirements
### Requirement: Share a scenario as a link
The editor SHALL provide a Share action that encodes the current scenario into a link of the form `<app address>#/view/<codec version>.<payload>` and copies it to the clipboard. The scenario SHALL be carried only in the URL fragment. Share SHALL be refused, with the same explanations as Save, while the scenario has save blockers (blank name, empty goal text, schema or integrity errors). If the clipboard is unavailable, the editor SHALL show the link so the user can copy it manually.

#### Scenario: Copy a share link
- **WHEN** the user clicks Share on a valid scenario named "Desert Mesa"
- **THEN** a link starting with the app address and `#/view/1.` is copied to the clipboard and the editor confirms "Link copied"

#### Scenario: Share blocked by a blank name
- **WHEN** the user clicks Share while the scenario name is blank
- **THEN** no link is created and the editor explains that the scenario needs a name

### Requirement: Compact versioned link format
The link payload SHALL be a compact form of the scenario (a rectangular board stored as its width and height; terrain and elevation listed only for hexes that have them), compressed with deflate and encoded as base64url. Every link SHALL start with a codec version number followed by a dot. Decoding a link SHALL reproduce a scenario equal to the one that was shared.

#### Scenario: Round trip
- **WHEN** any valid scenario is encoded into a link and the link is decoded
- **THEN** the decoded scenario equals the original

#### Scenario: Realistic map fits in a chat message
- **WHEN** the sample "Desert Mesa" scenario (15 × 15, 38 pillars, 18 components, 2 goals) is shared
- **THEN** the full link is shorter than 1,500 characters

### Requirement: Long link notice
When a share link is longer than 1,900 characters, the editor SHALL still copy it and SHALL tell the user that it may not fit in a single chat message and that saving the `.json` file is an alternative.

#### Scenario: Very large scenario
- **WHEN** the user shares a scenario whose link is 2,400 characters long
- **THEN** the link is copied and the notice about chat message length is shown

### Requirement: Opening a link validates it
Opening a share link SHALL decode the payload and pass the result through the same migrate, schema and integrity checks as opening a file. A link with an unknown codec version, a corrupted payload, a decompressed size over 1 MB, or a scenario that fails validation SHALL show an error page explaining that the link cannot be opened, and SHALL NOT change the user's editor draft.

#### Scenario: Corrupted link
- **WHEN** the user opens a share link whose payload was truncated when pasted
- **THEN** an error page says the link is damaged or incomplete and offers to open the editor

#### Scenario: Link from a newer app version
- **WHEN** the user opens a link with codec version 9
- **THEN** an error page says the link was made by a newer version of Minovsky Maps

### Requirement: Edit a shared scenario as a copy
From a shared scenario, the user SHALL be able to open it in the editor as a new, unsaved scenario with an empty undo history. If the editor has unsaved work, the user SHALL be asked to confirm before it is replaced.

#### Scenario: Edit a copy with no unsaved work
- **WHEN** the user clicks "Edit a copy" on a shared scenario and there is no unsaved draft
- **THEN** the editor opens with the shared scenario, marked as unsaved, and undo is disabled

#### Scenario: Edit a copy with unsaved work
- **WHEN** the user clicks "Edit a copy" while the editor holds unsaved changes
- **THEN** the user is asked whether to discard them, and cancelling keeps both the draft and the sheet unchanged
