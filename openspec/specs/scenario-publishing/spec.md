# scenario-publishing Specification

## Purpose
Publishing scenarios to the server without accounts: short links that always show the latest version, edit tokens for updating in place, server-side validation identical to the editor, versions, and abuse limits.
## Requirements
### Requirement: Publish a scenario
The editor SHALL provide a Publish action that sends the current scenario to the API and, on success, shows the scenario's short link (`<app address>/s/<id>`) and a private edit link (`<app address>/s/<id>#edit=<token>`), with a note that anyone with the short link can see the scenario including its author name. Publish SHALL be refused, with the same explanations as Save, while the scenario has save blockers. The API SHALL assign an id of 8 random characters from `[A-Za-z0-9]` and a random edit token with at least 128 bits of entropy, and SHALL store only a SHA-256 hash of the token.

#### Scenario: First publish
- **WHEN** the user publishes a valid scenario named "Desert Mesa"
- **THEN** the dialog shows a link like `https://minovsky-maps.pages.dev/s/k3x9mQ2a` and a private edit link containing `#edit=`, and the editor's action changes from Publish to Update

#### Scenario: Publish blocked
- **WHEN** the user clicks Publish while a goal has no text
- **THEN** nothing is sent to the API and the editor lists the problem

### Requirement: Edit tokens in the browser
The browser SHALL remember the id, edit token and name of every scenario it publishes, and of every scenario opened through a private edit link, in local storage. Edit tokens SHALL travel only in the URL fragment and in the `Authorization` header of update requests, never in a URL path or query string.

#### Scenario: Open a private edit link on another computer
- **WHEN** the creator opens `/s/k3x9mQ2a#edit=<token>` in a different browser
- **THEN** the token is stored in that browser, removed from the address bar, and the sheet offers "Edit"

### Requirement: Update a published scenario
When the open document is a published scenario that this browser holds an edit token for, the editor SHALL offer Update instead of Publish. Update SHALL store a new version on the server; the short link SHALL then show the new version. The API SHALL reject updates with a missing or wrong token (HTTP 401/403) without changing anything.

#### Scenario: Fix a typo after sharing
- **WHEN** the creator corrects a goal text and clicks Update
- **THEN** opening the same short link shows the corrected goal

#### Scenario: Wrong token
- **WHEN** an update request carries a token that does not match the scenario
- **THEN** the API responds 403 and the latest version is unchanged

### Requirement: Read a published scenario
`GET /api/scenarios/{id}` SHALL return the latest version of the scenario document with its id and the time it was last updated. Unknown ids and taken-down scenarios SHALL return 404.

#### Scenario: Unknown id
- **WHEN** a client requests `/api/scenarios/zzzzzzzz`
- **THEN** the API responds 404

### Requirement: Server-side validation
The API SHALL accept a scenario only if it passes the JSON Schema in `schema/` and the same integrity rules as the editor. Rejections SHALL return HTTP 422 with readable error messages. Valid and invalid example files in `schema/examples/` SHALL be accepted and rejected identically by the editor and the API.

#### Scenario: Off-board carrier
- **WHEN** a client publishes `schema/examples/invalid/off-board-carrier.json`
- **THEN** the API responds 422 with a message naming the carrier and the off-board hexes, and nothing is stored

### Requirement: Versions
Every successful publish or update SHALL store an immutable version (document, schema version, creation time). Reads SHALL return the most recent version. Earlier versions SHALL be kept.

#### Scenario: Two updates
- **WHEN** a scenario is published and then updated twice
- **THEN** the database holds three versions and reads return the third

### Requirement: Limits and takedown
The API SHALL reject request bodies larger than 64 KB (HTTP 413) and SHALL rate-limit publishes and updates per client IP (HTTP 429 with a retry hint). A scenario marked as taken down SHALL no longer be readable or updatable.

#### Scenario: Too many publishes
- **WHEN** one client sends more publish requests than the limit allows within a minute
- **THEN** further requests receive 429 until the window passes

### Requirement: Single origin API
The web app SHALL reach the API only at `/api/*` on its own origin; the hosting layer forwards these requests to the Go service. The API's own address SHALL be configuration, not code.

#### Scenario: Preview deployment
- **WHEN** the app runs on a branch preview address
- **THEN** publishing works without any cross-origin configuration
