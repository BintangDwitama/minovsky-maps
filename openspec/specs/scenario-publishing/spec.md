# scenario-publishing Specification

## Purpose
Publishing scenarios to the server as a signed-in account: short links that always show the latest version, updating and deleting by the owner, legacy edit tokens and claiming, server-side validation identical to the editor, versions, and abuse limits.
## Requirements
### Requirement: Publish a scenario
The editor SHALL provide a Publish action. When the user is not signed in, Publish SHALL show a prompt to sign in with Google instead of publishing; the editor's draft SHALL be kept, and after signing in the user SHALL return to the editor. When signed in, Publish SHALL send the current scenario to the API and, on success, show the scenario's short link (`<app address>/s/<id>`), with a note that anyone with the link can see the scenario and the owner's display name. The API SHALL refuse `POST /api/scenarios` without a valid session (HTTP 401). Publish SHALL be refused, with the same explanations as Save, while the scenario has save blockers. The API SHALL assign an id of 8 random characters from `[A-Za-z0-9]`, SHALL record the signed-in account as the owner, and SHALL NOT create an edit token.

#### Scenario: First publish
- **WHEN** a signed-in user publishes a valid scenario named "Desert Mesa"
- **THEN** the dialog shows a link like `https://minovsky-maps.pages.dev/s/k3x9mQ2a`, no private edit link is shown, and the editor's action changes from Publish to Update

#### Scenario: Publish while signed out
- **WHEN** a user who is not signed in clicks Publish
- **THEN** nothing is sent to the publish endpoint, a prompt offers "Sign in with Google", and after signing in the editor shows the same scenario

#### Scenario: Publish blocked
- **WHEN** the user clicks Publish while a goal has no text
- **THEN** nothing is sent to the API and the editor lists the problem

### Requirement: Edit tokens in the browser
Edit tokens SHALL be legacy: they exist only for scenarios published before accounts. The browser SHALL keep remembering the id, edit token and name of such scenarios, including those opened through a private edit link, until they are claimed. Edit tokens SHALL travel only in the URL fragment and in the `Authorization` header of update and claim requests, never in a URL path or query string.

#### Scenario: Open a private edit link on another computer
- **WHEN** the creator opens `/s/k3x9mQ2a#edit=<token>` for a legacy scenario in a different browser
- **THEN** the token is stored in that browser, removed from the address bar, and the sheet offers "Edit"

### Requirement: Update a published scenario
When the open document is a published scenario that the signed-in account owns, or that this browser holds a legacy edit token for, the editor SHALL offer Update instead of Publish. Update SHALL store a new version on the server; the short link SHALL then show the new version. The API SHALL accept an update only from the owner's session, or with the correct legacy token for an unclaimed scenario. Other requests SHALL be rejected (HTTP 401 without credentials, 403 otherwise) without changing anything.

#### Scenario: Fix a typo after sharing
- **WHEN** the owner corrects a goal text and clicks Update
- **THEN** opening the same short link shows the corrected goal

#### Scenario: Someone else's scenario
- **WHEN** a signed-in user who is not the owner sends an update for a scenario
- **THEN** the API responds 403 and the latest version is unchanged

#### Scenario: Wrong token
- **WHEN** an update request for an unclaimed scenario carries a token that does not match it
- **THEN** the API responds 403 and the latest version is unchanged

### Requirement: Read a published scenario
`GET /api/scenarios/{id}` SHALL return the latest version of the scenario document with its id and the time it was last updated. For an owned scenario, the response SHALL also give the owner's display name, and SHALL say whether the requesting session is the owner. It SHALL NOT include any email address or account id. Unknown ids and taken-down scenarios SHALL return 404.

#### Scenario: Unknown id
- **WHEN** a client requests `/api/scenarios/zzzzzzzz`
- **THEN** the API responds 404

#### Scenario: Owned scenario
- **WHEN** anyone requests an owned scenario
- **THEN** the response includes the owner's display name and no email address

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

### Requirement: Bot check on publishing
When the server is configured with a Turnstile secret, `POST /api/scenarios` and `PUT /api/scenarios/{id}` SHALL require a Cloudflare Turnstile token and SHALL verify it with Cloudflare before storing anything; a missing or rejected token SHALL return HTTP 403 with a readable message and store nothing. The editor SHALL obtain the token when the user publishes or updates, without extra steps for most people. When no secret is configured, the server SHALL skip the check and log a warning at startup.

#### Scenario: Script without a token
- **WHEN** a client posts a valid scenario without a Turnstile token to a server configured with a secret
- **THEN** the API responds 403 and nothing is stored

#### Scenario: Person publishing
- **WHEN** a person clicks Publish in the editor
- **THEN** the bot check runs in the background and the scenario is published as before

### Requirement: My published scenarios
The editor SHALL offer a "My published scenarios" list.
- **Signed in:** it SHALL list every scenario the account owns, from the server and so the same on every device, newest first. Each SHALL show its name, short link and actions Open (its sheet), Edit (open in the editor with Update available), Copy link and Delete.
- **Delete** SHALL ask for confirmation and then take the scenario down, so its short link shows "Scenario not found".
- **Signed out:** it SHALL list the legacy scenarios this browser holds edit tokens for, with Open, Edit, Copy link and Forget, state that the list is stored in this browser only, and invite the user to sign in to keep their scenarios on every device.
- The list SHALL say so plainly when it is empty.

#### Scenario: Same list on another device
- **WHEN** a user publishes two scenarios on one computer and signs in on a phone
- **THEN** My published scenarios on the phone lists both

#### Scenario: Delete a scenario
- **WHEN** the owner chooses Delete on a scenario and confirms
- **THEN** it disappears from the list and its short link shows "Scenario not found"

### Requirement: Claim legacy scenarios
When a user is signed in and this browser holds legacy edit tokens, the editor SHALL send them to the API to claim the scenarios. The API SHALL make the account the owner of every unclaimed scenario whose token matches, ignore the others, and report which were claimed. After claiming, the browser SHALL remove the claimed tokens and say how many scenarios were added ("3 scenarios added to your account"). A claimed scenario SHALL no longer accept its edit token.

#### Scenario: Claim after first sign-in
- **WHEN** a browser holding tokens for three legacy scenarios signs in
- **THEN** all three appear in My published scenarios on every device, the browser no longer stores their tokens, and the editor shows "3 scenarios added to your account"

#### Scenario: Token after claiming
- **WHEN** someone uses the old private edit link of a claimed scenario to update it
- **THEN** the API responds 403 and the scenario is unchanged

### Requirement: Owner delete
`DELETE /api/scenarios/{id}` SHALL take down a scenario when requested by its owner's session, after which reads return 404 and the scenario no longer appears in the owner's list. The API SHALL record that the owner removed it, as distinct from a moderation takedown. Requests from anyone else SHALL be refused (HTTP 401/403).

#### Scenario: Not the owner
- **WHEN** a signed-in user who does not own a scenario sends a delete request for it
- **THEN** the API responds 403 and the scenario stays readable

