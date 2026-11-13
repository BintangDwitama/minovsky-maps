## MODIFIED Requirements

### Requirement: Edit goals
The editor SHALL let the user add, edit, reorder and remove goals. Each goal has text (required), VP (integer ≥ 0) and scoring timing (phase 1, phase 2 or each phase). Each goal's text box, VP field, scoring selector, and move-up / move-down / remove controls SHALL be fully visible within the scenario panel without horizontal scrolling.

#### Scenario: Add a goal
- **WHEN** the user adds a goal with text "Hold the central objective", 3 VP, scoring each phase
- **THEN** the goal appears in the goals list and is stored in `goals` with `scoring: "each-phase"`

#### Scenario: Reorder goals
- **WHEN** the user moves the second goal above the first
- **THEN** the stored `goals` order matches the new order

#### Scenario: Goal controls fit the panel
- **WHEN** a goal uses scoring "End of each Phase" in the default desktop layout
- **THEN** its text box, VP field, scoring selector and move-up / move-down / remove buttons are all inside the scenario panel, and the remove button is not clipped
