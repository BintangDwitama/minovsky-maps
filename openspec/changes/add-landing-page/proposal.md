## Why

The site opens straight into an empty editor. Someone arriving from a link posted in a group chat doesn't learn what Minovsky Maps is, can't see what other players made, and has no obvious way to find Browse or their own scenarios. Now that scenarios can be shared and browsed, the site needs a front door. Each page also needs a common way around (Browse, Create, My scenarios, account) instead of an "Open the editor" button.

## What Changes

Touches **web** only (no server, API or schema change).

- **Landing page at `/`**, shown to everyone, including returning users:
  - **Hero:** what the site is, with a live board rendered from the sample scenario (our own artwork), "Create a scenario" and "Browse scenarios".
  - **Three steps:** Make it, Test it, Share it.
  - **Latest scenarios:** the three newest Everyone scenarios, hidden when there are none.
  - **Footer:** "Unofficial fan tool" and the privacy note.
- **The editor moves to `/editor`.**
  - Links already shared keep working: `/#/view/…`, `/#/edit/…`, `/#/edit-published/…`, `/#/privacy` and `/s/<id>`.
  - `/browse` is unchanged.
  - Only the bare root address changes, from the editor to the landing page.
- **One site header** on the landing, Browse, My scenarios, sheet and privacy pages:
  - Brand (home), Browse, Create, My scenarios, and Sign in or the account menu;
  - collapses into a Menu on phones.
  - The editor keeps its own toolbar; its brand mark now links home.
- **My scenarios becomes a page at `/my`**, replacing the editor's dialog. It is reachable from the header and from the editor and has three sections:
  - **On this browser:** the unsaved draft, with Continue editing (opens it in the editor without the restore question) and Discard (asks first);
  - **Saved online:** the account's scenarios, with visibility, Open, Edit, Copy link and Delete, as today; signed out, an invitation to sign in;
  - **Saved before accounts:** legacy scenarios with edit tokens, if any.
- **Drafts record when they were saved** ("edited 2 hours ago"), and older drafts still load. "Create a scenario" with a draft present still asks before starting fresh.
- **Link previews:** a title, description and preview image in `index.html`, so links posted in chat apps show a card. The image is a static picture of our own board rendering.

## Capabilities

### New Capabilities
- `site-navigation`: the landing page, the site's addresses (including keeping old links working), the shared site header, and link previews.

### Modified Capabilities
- `scenario-publishing`: My scenarios becomes the `/my` page with draft, saved-online and pre-account sections.
- `scenario-file-io`: the unsaved-draft restore can also be started from My scenarios (Continue editing, no question), and drafts record when they were saved.
- `scenario-browse`: Browse is linked from the site header and the editor, not only the toolbar and sheets.

## Non-goals

- Per-scenario link previews, which would need server rendering.
- A blog, news, a changelog or tutorials on the landing page.
- Several drafts per browser (still one autosaved draft).
- Skipping the landing page for returning users (by decision, `/` always shows it).
- Any change to the API or the scenario format.

## Impact

- **Routing:**
  - `ui/router.ts` gains `/` (landing), `/editor` and `/my` as real paths; hash routes still resolve at `/`.
  - Every "Open the editor" button, and the hash resets after imports, point to `/editor`.
- **New UI:**
  - `pages/LandingPage`, `pages/MyScenariosPage`;
  - `organisms/SiteHeader`, `organisms/LatestScenarios`, `organisms/MyScenariosList` (from MyScenariosDialog), `organisms/DraftCard`;
  - `templates/SiteLayout`, a header and footer wrapping page content. SheetLayout uses it, and its print rules are unchanged.
- **Application:** draft metadata (`savedAt`, name); a `discardDraft` use case; a resume flag, so the editor opens the draft without asking.
- **Static:** `web/index.html` meta tags and `web/public/og-image.png`, generated once from the sample board with our renderer.
- **Removed:** the MyScenariosDialog dialog wiring in EditorPage. Its list moves to the page.
