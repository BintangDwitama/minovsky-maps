## ADDED Requirements

### Requirement: Published scenario sheet
Opening `<app address>/s/<id>` SHALL show the scenario sheet for the latest version of that published scenario, with the same content, setup checklist, actions and print layout as a sheet opened from a share link. Copy link SHALL copy the short link. When this browser holds the scenario's edit token, the sheet SHALL also offer Edit, which opens the scenario in the editor as the published document (so Update is available).

#### Scenario: Open a short link
- **WHEN** a player opens `/s/k3x9mQ2a`
- **THEN** the sheet of the latest published version is shown and Copy link copies `/s/k3x9mQ2a`

### Requirement: Waking and unavailable states
While the API has not answered within 3 seconds, the sheet SHALL show that the server is waking up and that this can take up to a minute. If the scenario does not exist or was taken down, the sheet SHALL say so and offer to open the editor. If the API cannot be reached after 90 seconds, the sheet SHALL show a retry action.

#### Scenario: Cold server
- **WHEN** a player opens a short link while the API is asleep
- **THEN** after 3 seconds the page shows a waking-up message, and the sheet appears once the API answers

#### Scenario: Unknown scenario
- **WHEN** a player opens `/s/zzzzzzzz`
- **THEN** the page says the scenario was not found and offers to open the editor
