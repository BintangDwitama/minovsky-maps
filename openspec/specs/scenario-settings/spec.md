# scenario-settings Specification

## Purpose
How users edit scenario metadata, rules and goals.
## Requirements
### Requirement: Edit metadata
The editor SHALL provide fields for scenario name (required), author, and description (multi-line). A blank name SHALL be shown as an error on the field, and the scenario SHALL NOT be saved while the name is blank.

#### Scenario: Blank name blocks save
- **WHEN** the user clears the name field and tries to save
- **THEN** the save is refused, and the name field is highlighted with an explanation

### Requirement: Edit rules
The editor SHALL provide controls for deployment (bases or carriers), squad size (integer ≥ 1), mass-produced limit (integer ≥ 0, or blank to leave it unspecified), and terrain setup (fixed or free).

#### Scenario: Switch to carriers
- **WHEN** the user changes deployment from bases to carriers
- **THEN** `rules.deployment` becomes `carriers`, and placed components are not changed automatically

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

