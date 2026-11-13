## MODIFIED Requirements

### Requirement: Published scenario sheet
Opening `<app address>/s/<id>` SHALL show the scenario sheet for the latest version of that published scenario, with the same content, setup checklist, actions and print layout as a sheet opened from a share link. Copy link SHALL copy the short link. For an owned scenario, the sheet SHALL show the owner's display name as the author, marked as verified, in place of the document's free-text author. For an unclaimed scenario, it SHALL show the free-text author as before. The sheet SHALL offer Edit, which opens the scenario in the editor as the published document so Update is available, when the signed-in account owns the scenario or this browser holds its legacy edit token.

#### Scenario: Open a short link
- **WHEN** a player opens `/s/k3x9mQ2a`
- **THEN** the sheet of the latest published version is shown and Copy link copies `/s/k3x9mQ2a`

#### Scenario: Verified author
- **WHEN** anyone opens the sheet of a scenario owned by an account named "Bintang"
- **THEN** the author line reads "by Bintang" with a verified mark, regardless of the document's Author field

#### Scenario: Owner sees Edit
- **WHEN** the owner, signed in on a different device, opens the short link
- **THEN** the sheet offers Edit, and other visitors do not see it
