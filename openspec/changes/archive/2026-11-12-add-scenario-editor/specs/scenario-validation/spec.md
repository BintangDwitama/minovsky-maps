## ADDED Requirements

### Requirement: Non-blocking warnings
The editor SHALL compute a list of warnings from the current scenario after every edit and show them in a warnings panel. Each warning SHALL have a stable code, a human-readable message, and the hexes or component ids it concerns. Selecting a warning SHALL highlight those hexes on the board. Warnings SHALL NEVER prevent editing, saving or exporting. Each warning rule SHALL be its own unit, so a new rule can be added without changing existing ones.

#### Scenario: Warnings don't block save
- **WHEN** the scenario has three warnings and the user saves
- **THEN** the file is saved, warnings included

#### Scenario: Locate a warning
- **WHEN** the user clicks a warning in the panel
- **THEN** the hexes it concerns are highlighted on the board

### Requirement: Warning rules in v1
The editor SHALL implement at least these warning rules:
- `component-on-impassable`: a component occupies a hex tagged `impassable`.
- `stacked-components`: two or more components occupy the same hex. Every hex of a carrier counts.
- `carrier-uneven-elevation`: a carrier's three hexes are not all at the same elevation.
- `deployment-mismatch`: `rules.deployment` is `bases` and a carrier is placed, or it is `carriers` and a base is placed.
- `missing-deployment-point`: side A or side B has no deployment point of the kind `rules.deployment` requires.

#### Scenario: Uneven carrier
- **WHEN** a carrier's middle hex is at elevation 1 and its front hex at elevation 0
- **THEN** a `carrier-uneven-elevation` warning lists that carrier

#### Scenario: Missing base for side B
- **WHEN** deployment is bases, side A has a base and side B has none
- **THEN** a `missing-deployment-point` warning names side B

#### Scenario: Clean scenario
- **WHEN** each side has one base, deployment is bases, and no hex has more than one component or impassable terrain under a component
- **THEN** the warnings list is empty

### Requirement: Derived pillar count
The editor SHALL display the total number of height-1 pillars the scenario needs, equal to the sum of all hex elevation levels, along with the count of hexes at each level. This figure SHALL be derived and SHALL NOT be stored in the document.

#### Scenario: Count pillars
- **WHEN** the scenario has four hexes at level 1 and two at level 2
- **THEN** the editor shows a pillar total of 8, with a breakdown of "level 1: 4, level 2: 2"
