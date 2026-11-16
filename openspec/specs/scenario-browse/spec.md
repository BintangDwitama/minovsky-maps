# scenario-browse Specification

## Purpose
Finding scenarios players chose to share with everyone: the Browse page and API, with search, filters, sorting and paging.
## Requirements
### Requirement: Browse page
The app SHALL have a Browse page at `<app address>/browse`, open to everyone without signing in, that lists scenarios whose visibility is Everyone, and only those. Each scenario SHALL be shown as a card with a thumbnail of its board (drawn from the scenario, without editing overlays), its name, the owner's display name marked as verified, its board size (for example "15 × 15", or the number of hexes for other shapes) and its deployment. Choosing a card SHALL open the scenario's sheet. The toolbar (including the phone Menu) and the published sheet SHALL link to Browse.

#### Scenario: Find a public scenario
- **WHEN** an owner sets "Desert Mesa" to Everyone and a signed-out visitor opens `/browse`
- **THEN** a card for "Desert Mesa" shows its thumbnail, "by" the owner's name with a verified mark, "15 × 15" and "Bases", and choosing it opens `/s/<id>`

#### Scenario: Not listed
- **WHEN** a scenario's visibility is Only me or Anyone with the link
- **THEN** it does not appear on the Browse page or in browse API results

### Requirement: Search, filters and sorting
Browse SHALL offer:
- a text search matching the name, the description or the owner's display name, case-insensitive;
- a board-size filter: any, standard (15 × 15), smaller (fewer hexes than 225), larger (more than 225);
- a deployment filter: any, Bases, Carriers;
- a squad-size filter: any, or a number from 1 to 10;
- a "has elevation" filter.

Results SHALL be sorted newest listed first by default, or by most recently updated. Search text, filters and sort SHALL be kept in the page address, so a filtered view can be shared and survives a reload.

#### Scenario: Filter by deployment
- **WHEN** a visitor chooses Carriers
- **THEN** only public scenarios with Carriers deployment are listed

#### Scenario: Search by author
- **WHEN** a visitor searches "bintang"
- **THEN** public scenarios owned by an account named "Bintang" are listed, along with any whose name or description contains "bintang"

#### Scenario: Shareable view
- **WHEN** a visitor filters by Carriers and reloads the page
- **THEN** the Carriers filter is still applied

### Requirement: Paging
Browse SHALL show results in pages of 24, with "Load more" adding the next page. Paging SHALL be stable: a scenario listed while someone is paging SHALL NOT make another scenario appear twice. An empty result SHALL say that nothing matches and offer to clear the filters.

#### Scenario: Load more
- **WHEN** 30 public scenarios match and the visitor chooses Load more
- **THEN** the remaining 6 are added below the first 24, with no duplicates

#### Scenario: Nothing matches
- **WHEN** no public scenario matches the search
- **THEN** the page says no scenarios match and offers "Clear filters"

### Requirement: Browse API
`GET /api/browse` SHALL return public scenarios matching optional parameters `q` (at most 60 characters), `size`, `deployment`, `squad`, `elevation` and `sort`, plus an opaque `cursor` for the next page. Each item SHALL include the id, name, owner display name, board size, deployment, squad size, whether it has elevation, the times it was listed and last updated, and the scenario document (for the thumbnail). Items SHALL NOT include email addresses or account ids. Invalid parameters SHALL be rejected with HTTP 400 and a readable message. The endpoint SHALL be rate-limited per client IP.

#### Scenario: Invalid filter
- **WHEN** a client requests `/api/browse?size=huge`
- **THEN** the API responds 400 naming the invalid parameter

