## MODIFIED Requirements

### Requirement: My published scenarios
The app SHALL have a My scenarios page at `<app address>/my`, reached from the site header and from the editor's "My scenarios" button. It SHALL have three sections.
- **On this browser:** the editor's unsaved draft, if there is one, with its name and when it was last saved. It SHALL offer:
  - **Continue editing**, which opens it in the editor without asking whether to restore it;
  - **Discard**, which asks for confirmation and then deletes the draft.
- **Saved online:**
  - **Signed in:** every scenario the account owns, from the server and so the same on every device, newest first. Each SHALL show its name, its visibility, its short link and actions:
    - Open (its sheet);
    - Edit (open in the editor with Update online available);
    - Copy link;
    - change visibility, which SHALL take effect immediately;
    - Delete, which SHALL ask for confirmation and then take the scenario down, so its short link shows "Scenario not found".
  - **Signed out:** an invitation to sign in with Google to see saved scenarios on any device.
- **Saved before accounts:** the legacy scenarios this browser holds edit tokens for, with Open, Edit, Copy link and Forget, stating that this list is stored in this browser only. The section SHALL be omitted when there are none.

Each section SHALL say so plainly when it is empty.

#### Scenario: Same list on another device
- **WHEN** a user saves two scenarios online on one computer and signs in on a phone
- **THEN** My scenarios on the phone lists both, with their visibility

#### Scenario: Continue a draft
- **WHEN** a user with an unsaved draft named "Desert Mesa" opens `/my` and chooses Continue editing
- **THEN** the editor opens with "Desert Mesa" as it was, without asking whether to restore it

#### Scenario: Discard a draft
- **WHEN** the user chooses Discard on the draft and confirms
- **THEN** the draft disappears from the page, and the editor opens empty next time without offering to restore anything

#### Scenario: Share a private scenario later
- **WHEN** the owner changes a scenario from Only me to Anyone with the link on My scenarios
- **THEN** its existing link now opens for anyone, without a new link being made

#### Scenario: Delete a scenario
- **WHEN** the owner chooses Delete on a scenario and confirms
- **THEN** it disappears from the list and its short link shows "Scenario not found"
