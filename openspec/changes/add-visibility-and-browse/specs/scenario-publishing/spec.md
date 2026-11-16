## MODIFIED Requirements

### Requirement: Publish a scenario
The editor SHALL provide a "Save online" action.
- **Signed out:** Save online SHALL show a prompt to sign in with Google instead of saving. The editor's draft SHALL be kept, and after signing in the user SHALL return to the editor.
- **Signed in:** Save online SHALL ask who can see the scenario: Only me, Anyone with the link, or Everyone (listed in Browse), with Only me selected by default. It SHALL then send the scenario and the chosen visibility to the API.
- **On success:** it SHALL show the scenario's link (`<app address>/s/<id>`) and its visibility, which the owner can change there. For Only me, it SHALL state that only the owner can open the link.
- **Refused:** Save online SHALL be refused, with the same explanations as Save, while the scenario has save blockers.

The API:
- SHALL refuse `POST /api/scenarios` without a valid session (HTTP 401);
- SHALL assign an id of 8 random characters from `[A-Za-z0-9]`;
- SHALL record the signed-in account as the owner and the requested visibility, defaulting to Only me when none is given;
- SHALL NOT create an edit token.

#### Scenario: First save online
- **WHEN** a signed-in user saves a valid scenario named "Desert Mesa" online without changing the choice
- **THEN** it is stored as Only me, the dialog shows a link like `https://minovsky-maps.pages.dev/s/k3x9mQ2a` with "Only you can open this link", no private edit link is shown, and the editor's action changes from "Save online" to "Update online"

#### Scenario: Save and share at once
- **WHEN** the user chooses "Anyone with the link" before saving
- **THEN** the scenario is stored with that visibility and the link opens for anyone

#### Scenario: Save while signed out
- **WHEN** a user who is not signed in clicks Save online
- **THEN** nothing is sent to the save endpoint, a prompt offers "Sign in with Google", and after signing in the editor shows the same scenario

#### Scenario: Save blocked
- **WHEN** the user clicks Save online while a goal has no text
- **THEN** nothing is sent to the API and the editor lists the problem

### Requirement: Update a published scenario
When the open document is a published scenario that the signed-in account owns, or that this browser holds a legacy edit token for, the editor SHALL offer "Update online" instead of "Save online". Update online SHALL store a new version on the server without changing the scenario's visibility, and the link SHALL then show the new version. The API SHALL accept an update only from the owner's session, or with the correct legacy token for an unclaimed scenario. Other requests SHALL be rejected (HTTP 401 without credentials, 403 otherwise) without changing anything.

#### Scenario: Fix a typo after sharing
- **WHEN** the owner corrects a goal text and clicks Update online
- **THEN** opening the same short link shows the corrected goal

#### Scenario: Someone else's scenario
- **WHEN** a signed-in user who is not the owner sends an update for a scenario
- **THEN** the API responds 403 and the latest version is unchanged

#### Scenario: Wrong token
- **WHEN** an update request for an unclaimed scenario carries a token that does not match it
- **THEN** the API responds 403 and the latest version is unchanged

### Requirement: Read a published scenario
`GET /api/scenarios/{id}` SHALL return the latest version of the scenario document with its id and the time it was last updated.
- For an owned scenario, the response SHALL also give the owner's display name and say whether the requesting session is the owner.
- For the owner only, it SHALL give the visibility.
- It SHALL NOT include any email address or account id.
- Unknown ids, taken-down scenarios and Only me scenarios requested by anyone but their owner SHALL return 404.

#### Scenario: Unknown id
- **WHEN** a client requests `/api/scenarios/zzzzzzzz`
- **THEN** the API responds 404

#### Scenario: Owned scenario
- **WHEN** anyone requests an owned scenario whose visibility is Anyone with the link
- **THEN** the response includes the owner's display name and no email address

#### Scenario: Private scenario
- **WHEN** someone other than the owner requests an Only me scenario
- **THEN** the API responds 404, exactly as for an unknown id

### Requirement: My published scenarios
The editor SHALL offer a "My scenarios" list.
- **Signed in:** it SHALL list every scenario the account owns, from the server and so the same on every device, newest first. Each SHALL show its name, its visibility, its short link and actions:
  - Open (its sheet);
  - Edit (open in the editor with Update online available);
  - Copy link;
  - change visibility;
  - Delete.
- **Changing visibility** SHALL take effect immediately.
- **Delete** SHALL ask for confirmation and then take the scenario down, so its short link shows "Scenario not found".
- **Signed out:** it SHALL list the legacy scenarios this browser holds edit tokens for, with Open, Edit, Copy link and Forget, state that the list is stored in this browser only, and invite the user to sign in to keep their scenarios on every device.
- The list SHALL say so plainly when it is empty.

#### Scenario: Same list on another device
- **WHEN** a user saves two scenarios online on one computer and signs in on a phone
- **THEN** My scenarios on the phone lists both, with their visibility

#### Scenario: Share a private scenario later
- **WHEN** the owner changes a scenario from Only me to Anyone with the link in My scenarios
- **THEN** its existing link now opens for anyone, without a new link being made

#### Scenario: Delete a scenario
- **WHEN** the owner chooses Delete on a scenario and confirms
- **THEN** it disappears from the list and its short link shows "Scenario not found"

## ADDED Requirements

### Requirement: Visibility
Every published scenario SHALL have one visibility:
- **Only me** (`private`): only the owner's session can read it. For everyone else it SHALL behave as if it did not exist: reads, sheets, reports, copies and Browse.
- **Anyone with the link** (`link`): anyone can read it by its id, and it is not listed.
- **Everyone** (`public`): anyone can read it, and it is listed in Browse.

`PATCH /api/scenarios/{id}` with a visibility SHALL change it for the owner's session only (HTTP 401/403 otherwise) and SHALL never change the scenario's id. The time a scenario first becomes Everyone, and each later time, SHALL be recorded as its listing time. Scenarios that existed before visibility, including legacy scenarios claimed later, SHALL be Anyone with the link.

#### Scenario: Existing scenarios keep working
- **WHEN** visibility is introduced
- **THEN** every scenario published before it is Anyone with the link, and its short link still opens for anyone

#### Scenario: Report a private scenario
- **WHEN** someone sends a report for an Only me scenario they do not own
- **THEN** the API responds 404 and no report is stored

#### Scenario: Not the owner
- **WHEN** a signed-in user who does not own a scenario tries to change its visibility
- **THEN** the API responds 403 and the visibility is unchanged
