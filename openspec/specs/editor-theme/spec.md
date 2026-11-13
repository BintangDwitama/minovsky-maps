# editor-theme Specification

## Purpose
The visual identity of the editor chrome: an original, Gundam-inspired armour theme that stays readable and keeps side colours meaningful.
## Requirements
### Requirement: Armour theme
The editor chrome (toolbar, side panels, status bar, dialogs, buttons and inputs) SHALL use the armour theme: armour-plate panels separated by engraved panel lines, a navy frame for the toolbar and status bar, chamfered corners on plate elements, a yellow marker on the active tool, and a hangar-deck backdrop behind the board. It SHALL apply in both light (off-white plates) and dark (gunmetal plates) colour schemes, following the system preference.

#### Scenario: Active tool is marked
- **WHEN** the user picks the Paint terrain tool
- **THEN** that tool's button shows the yellow active marker and no other tool button does

#### Scenario: Dark preference
- **WHEN** the editor is opened with `prefers-color-scheme: dark`
- **THEN** panels use the gunmetal plate colours and text remains readable

### Requirement: Readable contrast
Body text and control labels in the chrome SHALL have a contrast ratio of at least 4.5:1 against their background, and muted helper text at least 4.5:1, in both colour schemes. Keyboard focus SHALL remain visible on every interactive control.

#### Scenario: Toolbar text on navy frame
- **WHEN** the toolbar is rendered in either colour scheme
- **THEN** its button labels have at least 4.5:1 contrast against the frame colour

### Requirement: Side colours reserved for sides
Chrome accents (focus ring, primary buttons, selected segments, active tool marker) SHALL NOT use the Side A or Side B colours, so that blue and vermilion on screen always mean a side.

#### Scenario: Primary button colour
- **WHEN** a dialog shows its primary action
- **THEN** the button is navy (light) or the dark-scheme accent, not the Side A blue

### Requirement: Original artwork only
The theme SHALL be built from original shapes, colours and openly licensed fonts. It SHALL NOT include official Gundam logos, artwork, typefaces, mecha designs or recreations of anime screen UI.

#### Scenario: Font licence
- **WHEN** the web build is inspected
- **THEN** the only bundled typeface is Saira (SIL Open Font License)

