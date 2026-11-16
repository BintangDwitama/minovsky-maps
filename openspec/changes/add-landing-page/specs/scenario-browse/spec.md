## MODIFIED Requirements

### Requirement: Browse page
The app SHALL have a Browse page at `<app address>/browse`, open to everyone without signing in, that lists scenarios whose visibility is Everyone, and only those.
- **Cards:** each scenario SHALL be shown as a card with:
  - a thumbnail of its board, drawn from the scenario without editing overlays;
  - its name;
  - the owner's display name, marked as verified;
  - its board size (for example "15 × 15", or the number of hexes for other shapes);
  - its deployment.
- **Opening:** choosing a card SHALL open the scenario's sheet.
- **Links to Browse:** the site header, the landing page and the editor's toolbar (including the phone Menu) SHALL link to Browse.

#### Scenario: Find a public scenario
- **WHEN** an owner sets "Desert Mesa" to Everyone and a signed-out visitor opens `/browse`
- **THEN** a card for "Desert Mesa" shows its thumbnail, "by" the owner's name with a verified mark, "15 × 15" and "Bases", and choosing it opens `/s/<id>`

#### Scenario: Not listed
- **WHEN** a scenario's visibility is Only me or Anyone with the link
- **THEN** it does not appear on the Browse page or in browse API results
