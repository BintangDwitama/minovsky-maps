## ADDED Requirements

### Requirement: Landing page
`<app address>/` SHALL show a landing page to every visitor, signed in or not, every time. It SHALL contain, in this order:
- **Hero:** a short statement that Minovsky Maps is for designing Gundam Assemble scenarios; a board rendered by the app from the sample scenario (no official artwork); and the actions "Create a scenario" (opens the editor) and "Browse scenarios" (opens Browse).
- **Steps:** three short sections: making a scenario (terrain, elevation, pieces, goals), testing it (line of sight and movement reach), and sharing it (link, printable sheet, listing in Browse).
- **Latest scenarios:** the three most recently listed Everyone scenarios as Browse cards, with a link to Browse. The section SHALL be omitted when there are none, or when they cannot be loaded.
- **Footer:** "Unofficial fan tool" and a link to the privacy note.

The page SHALL work on phones without horizontal scrolling and SHALL follow the app's colour schemes.

#### Scenario: First visit
- **WHEN** a visitor opens `https://minovsky-maps.pages.dev/`
- **THEN** the landing page shows the hero with a board picture, "Create a scenario" and "Browse scenarios", the three steps and the footer

#### Scenario: Nothing listed yet
- **WHEN** no scenario has visibility Everyone
- **THEN** the landing page shows no "Latest scenarios" section and no empty grid

#### Scenario: Returning user
- **WHEN** a signed-in user with a draft opens `/`
- **THEN** the landing page is shown, as for any visitor

### Requirement: Site addresses
The app SHALL serve these pages:
- the landing page at `/`;
- the editor at `/editor`;
- Browse at `/browse`;
- My scenarios at `/my`;
- published sheets at `/s/<id>`.

Addresses created before this change SHALL keep working:
- `/#/view/<link>` (share-link sheet);
- `/#/edit/<link>` (editor with a copy);
- `/#/edit-published/<id>` (editor with a published scenario);
- `/#/privacy`.

Every action that opens the editor SHALL go to `/editor` (or to one of the hash routes above). After the editor imports a link, the address SHALL become `/editor`, so a reload stays in the editor.

#### Scenario: Old share link
- **WHEN** someone opens a share link `https://minovsky-maps.pages.dev/#/view/1.<payload>` created before this change
- **THEN** the share-link sheet is shown, not the landing page

#### Scenario: Reload after Edit a copy
- **WHEN** a user chooses "Edit a copy" on a sheet and then reloads the page
- **THEN** the editor is shown again, not the landing page

### Requirement: Site header
The landing, Browse, My scenarios, privacy and sheet pages SHALL share one header with:
- the brand, linking to `/`;
- Browse;
- "Create", which opens the editor;
- My scenarios;
- "Sign in", or the account menu when signed in.

The current page SHALL be marked for assistive technology (`aria-current`). On narrow screens the links SHALL collapse into a Menu with touch-sized targets. Sheet pages SHALL keep their scenario actions, and printouts SHALL not include the header. The editor SHALL keep its own toolbar, in which the brand mark links to `/`.

#### Scenario: From a sheet to Browse
- **WHEN** a visitor on a published sheet chooses Browse in the header
- **THEN** the Browse page opens and Browse is marked as the current page

#### Scenario: Phone header
- **WHEN** the landing page is opened at 390 × 664
- **THEN** the header fits on one row, with the brand and a Menu holding Browse, Create, My scenarios and sign-in

### Requirement: Link previews
The app's HTML SHALL include a page title, a description, and Open Graph and Twitter card tags. The tags SHALL carry a title, a description and a 1200 × 630 preview image of a board rendered by the app, so links posted in chat apps show a preview card. The preview image SHALL contain no official artwork or logos.

#### Scenario: Posting the site link
- **WHEN** the site's address is pasted into a chat app that reads Open Graph tags
- **THEN** the preview shows "Minovsky Maps", the description and the board image
