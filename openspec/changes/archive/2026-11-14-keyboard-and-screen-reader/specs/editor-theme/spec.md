## ADDED Requirements

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
