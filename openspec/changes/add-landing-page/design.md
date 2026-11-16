## Context

- **Routing:** `ui/router.ts` resolves a route from the pathname plus the hash.
  - Real paths: `/s/<id>`, `/browse`.
  - Hash routes at `/`: `#/view/…`, `#/edit/…`, `#/edit-published/…`, `#/privacy`.
  - Anything else is the editor.
  - Six places navigate to `'#/'` to mean "open the editor". The editor resets the hash to `'#/'` after imports.
- **Pages and headers:**
  - Pages: EditorPage, SheetPage, PublishedSheetPage, BrowsePage, PrivacyPage.
  - Sheets, Browse and privacy use `SheetLayout`, whose navy header has the brand plus page actions.
  - The editor has its own `Toolbar`, with the account menu, Browse and My scenarios.
- **My scenarios:** a dialog inside EditorPage (`MyScenariosDialog`), with account and browser modes.
- **Drafts:** `useCases.ts` stores `{draft: 2, scenario, publication}` through a `DraftStore`. The editor's mount effect offers to restore the draft, or restores it silently right after sign-in.
- **Cloudflare Pages** serves `index.html` for unknown paths, so `/editor` and `/my` need no server config.

## Goals / Non-Goals

**Goals:**
- A landing page at `/` that explains the product and leads into Browse and the editor.
- Every old link keeps working.
- One header across the non-editor pages.
- My scenarios as a page that includes the draft.
- Link previews.

**Non-Goals:**
- Server rendering.
- Per-scenario link previews.
- More than one draft per browser.
- Skipping the landing page for returning users.

## Decisions

### 1. Routes: real paths for pages, hash routes kept at `/`
```
pathname        hash                     → page
/s/<id>         (#edit=…)                → published sheet
/browse         —                        → browse
/editor         —                        → editor            (?resume=draft → restore without asking)
/my             —                        → my scenarios
/               #/view/<link>            → share-link sheet   (unchanged)
/               #/edit/<link>            → editor             (unchanged; after import → /editor)
/               #/edit-published/<id>    → editor             (unchanged; after load → /editor)
/               #/privacy                → privacy            (unchanged)
/               anything else            → landing
```
- `parseRoute` checks the hash routes first, so legacy links win over the landing page.
- **New helpers:**
  - `EDITOR_PATH = '/editor'` and `MY_PATH = '/my'`;
  - `openEditor()` = `goToPath(EDITOR_PATH)`, which replaces every `navigate('#/')`;
  - `replaceHashSilently('#/')` in the editor becomes `history.replaceState(…, EDITOR_PATH)`, so a reload stays in the editor.
- **Sign-in return path:** `signIn()` already returns to the current address, which is now `/editor` from the editor.
- *Alternative considered:* the editor at `/#/editor`. Rejected: real paths are clearer and consistent with `/browse` and `/s/<id>`.

### 2. SiteHeader and SiteLayout
**`organisms/SiteHeader`:**
- Brand link to `/`; links Browse, Create (to `/editor`), My scenarios (to `/my`); then Sign in or the account menu, reusing `useAccountMenu`.
- `current` prop sets `aria-current="page"`.
- Below 900 px (the existing `COMPACT_QUERY`) the links collapse into the existing `Menu` molecule, with the account entries included.
- Links are real `<a href>` elements with SPA navigation on plain clicks, the same pattern as ScenarioCard, so middle-click and "open in new tab" work.

**`templates/SiteLayout`:** SiteHeader, then `main`, then a footer with "Unofficial fan tool" and a link to "What we store".
- `SheetLayout` keeps its board and details grid and print rules.
- Its own navy brand header is replaced by SiteHeader plus a second, lighter actions bar: Edit, Copy link, Download, Export, Print, Report. Both bars are `print:hidden`.
- Browse, Privacy and My scenarios use SiteLayout directly.
- **Editor:** in `Toolbar`, the BrandMark and Brand become links to `/`. Leaving the editor is an in-app navigation, and the draft is already autosaved, so nothing is lost.

### 3. Landing page
`pages/LandingPage` uses SiteLayout:

- **Hero:** two columns on desktop, stacked on phones.
  - Left: the headline (condensed Saira, large), one sentence, and the two primary actions.
  - Right: the sample scenario rendered with `BoardView` on the deck background. The sample is imported as JSON from `schema/examples/sample-mesa.scenario.json` (Vite already allows `..`) and run through `loadScenario`.
  - The board picture is `role="img"` with a short label. No animation; reduced motion is respected by construction.
- **Steps:** three items with an icon (brush, eye, link), a short title and one sentence each.
- **Latest scenarios:** `organisms/LatestScenarios` calls `ScenarioBrowser.browse(EMPTY_QUERY, null)` and shows the first three as `ScenarioCard`s, plus "See all", linking to `/browse`.
  - It renders nothing while loading, on errors and when empty, so the page never shows a broken or empty section.
  - Free hosting can be slow to wake, so the section simply appears when ready.
- **Footer:** from SiteLayout.
- **Copy:** in our own words, sentence case, no rulebook text. Only "Gundam Assemble" by name, alongside the unofficial-fan-tool note.
- **Title:** `document.title = 'Minovsky Maps – scenario maker for Gundam Assemble'`.

### 4. My scenarios page and drafts
- **List component:** `MyScenariosDialog`'s list becomes `organisms/MyScenariosList` with two modes, account and browser, as today but without the DialogShell.
- **Page:** `pages/MyScenariosPage` renders three sections:
  1. "On this browser": `DraftCard`, from `findDraft` plus its metadata;
  2. "Saved online": the account list, or a sign-in invitation when signed out;
  3. "Saved before accounts": the legacy list, omitted when empty.
- **Services:** the page builds its own adapters, a `HttpScenarioPublisher` for delete and visibility and the `LocalStorageDraftStore`, as other pages do.
- **Draft metadata:**
  - `serializeDraft` adds `savedAt` (ISO time).
  - `findDraft` returns `{ scenario, publication, savedAt: string | null }`, with null for older drafts.
  - New `discardDraft(drafts)` clears it.
  - The card shows the name and "edited 2 hours ago" (a small relative-time helper; "edited earlier" when unknown).
- **Continue editing:** `goToPath('/editor?resume=draft')`.
  - The editor's mount effect reads the flag once, strips it from the address, and calls `restoreDraft` instead of opening the "restore?" dialog.
  - "Create a scenario" (`/editor` without the flag) keeps today's question.
- **Editor:** the "My scenarios" button (toolbar and Menu) navigates to `/my`. The dialog and its state are removed from EditorPage.

### 5. Link previews
- **`web/index.html`:**
  - `<title>` and `<meta name="description">`;
  - `og:title`, `og:description`, `og:type=website`, `og:image` (absolute, `https://minovsky-maps.pages.dev/og-image.png`), `og:image:width` and `og:image:height` (1200×630), `og:image:alt`;
  - `twitter:card=summary_large_image`.
- **`web/public/og-image.png`:** generated once by a small Playwright script, kept in the scratchpad, not in the repo. The script renders the landing hero board (our own rendering) at 1200×630 with the name and tagline in our type. It is committed as a static asset.
- The absolute URL is the current production address. If the domain changes, the tag changes with it; this is noted in the README's custom-domain section.

## Risks / Trade-offs

- **[Risk] Old bookmarks of `/` expecting the editor.** → The landing page puts "Create a scenario" first. Drafts are still restored from there, or from My scenarios.
- **[Risk] Hash reset paths missed,** so a reload lands on the landing page instead of the editor. → Every `navigate('#/')` and `replaceHashSilently('#/')` is replaced, with router tests for every row of the table and an end-to-end reload check after "Edit a copy" and after "Edit" on a published sheet.
- **[Risk] Sheet print layout regressions** from the new header. → Both bars are `print:hidden`, and the print emulation check from the scenario-sheet change is re-run.
- **[Trade-off] The landing hero imports the sample scenario,** about 6 KB of JSON, into the bundle. Accepted; it is also the onboarding example.
- **[Trade-off] The Open Graph image URL is absolute** and tied to the pages.dev address. → Documented.

## Migration Plan

Web only; deploy with Pages. No data changes. Roll back by redeploying the previous build, which only moves the editor back to `/`.

## Open Questions

- The final headline and step wording, to be reviewed by you on the running page before archive.
