## ADDED Requirements

### Requirement: Panels fit their content
At a desktop viewport of at least 1280×800, the editor's tool palette, board area and scenario panels SHALL keep all of their content and controls within their own width. No editor panel SHALL scroll horizontally or clip a control; long content SHALL wrap or scroll vertically instead.

#### Scenario: Right panel has no horizontal overflow
- **WHEN** the editor is open at 1500×950 with two goals added, each using the longest scoring option
- **THEN** the scenario panels' scroll width equals their client width, and every goal control is fully inside the panel

#### Scenario: Long text wraps inside its field
- **WHEN** the user types a 300-character goal text without line breaks
- **THEN** the text wraps inside the goal's text box and the panel does not widen

### Requirement: Follows system colour scheme
The editor chrome (panels, inputs, buttons, text) SHALL use the light palette when the operating system prefers a light colour scheme and the dark palette when it prefers dark, using the same design token values for both schemes as before the migration. The board and PNG export SHALL keep their existing colours in both schemes.

#### Scenario: Dark preference
- **WHEN** the editor is opened with `prefers-color-scheme: dark`
- **THEN** panel backgrounds use the dark panel token and text uses the dark text token, and the board colours are unchanged
