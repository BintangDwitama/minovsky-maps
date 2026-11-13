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

### Requirement: Reduced motion
When the system asks for reduced motion (`prefers-reduced-motion: reduce`), the editor and sheets SHALL show no animations or transitions, and any scrolling they trigger SHALL be instant.

#### Scenario: Reduced motion preference
- **WHEN** the editor is opened with `prefers-reduced-motion: reduce`
- **THEN** every element's computed transition and animation duration is at most 0.01 s

### Requirement: Contrast is checked automatically
The token pairs used for chrome text SHALL be checked by an automated test in both colour schemes: text, muted text and danger text on the panel and recessed panel, frame text on the frame, accent text on the accent, and warning text on the warning background. The test SHALL fail when any pair falls below 4.5:1.

#### Scenario: A token change breaks contrast
- **WHEN** a change sets the dark scheme's muted text colour so it falls below 4.5:1 against the dark panel
- **THEN** the contrast test fails and names the pair

