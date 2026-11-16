## 1. Routes

- [x] 1.1 Router: `/` landing (when no hash route), `/editor`, `/my`; hash routes keep priority at `/`; `EDITOR_PATH`, `MY_PATH`, `openEditor()`; router tests for every row of the design table
- [x] 1.2 Replace every `navigate('#/')` with `openEditor()`; the editor's hash resets after imports or loads become a silent replace to `/editor`

## 2. Drafts

- [x] 2.1 Draft metadata: `savedAt` in serialized drafts; `findDraft` returns it (null for older drafts); `discardDraft`; a relative-time helper; tests, including that older drafts still load
- [x] 2.2 Editor: `?resume=draft` restores the draft without asking (flag read once, then stripped); plain `/editor` keeps the restore question

## 3. Site header and layout

- [x] 3.1 `SiteHeader` organism: brand (home), Browse, Create, My scenarios, sign-in or account menu; `aria-current`; real links with in-app navigation; compact Menu below 900 px with 44 px targets
- [x] 3.2 `SiteLayout` template (header, main, footer with "Unofficial fan tool" and "What we store")
- [x] 3.3 SheetLayout: SiteHeader plus an actions bar (both `print:hidden`); sheet, published sheet, Browse and Privacy use the new header; the editor Toolbar's brand links to `/`

## 4. My scenarios page

- [x] 4.1 Extract `MyScenariosList` organism from MyScenariosDialog (account and browser modes, no dialog shell)
- [x] 4.2 `DraftCard` (name, "edited …", Continue editing, Discard with confirmation)
- [x] 4.3 `MyScenariosPage` at `/my`: On this browser, Saved online (or sign-in invitation), Saved before accounts (omitted when empty); empty states
- [x] 4.4 Editor: the My scenarios button and Menu item go to `/my`; remove the dialog wiring from EditorPage

## 5. Landing page

- [x] 5.1 `LandingPage`: hero (headline, sentence, Create and Browse actions, sample board via BoardView), three steps, document title
- [x] 5.2 `LatestScenarios` organism: first three public scenarios as cards plus "See all"; renders nothing while loading, on error or when empty
- [x] 5.3 Phone layout check: no horizontal scroll, touch-sized targets, stacked hero

## 6. Link previews

- [x] 6.1 `index.html` title, description, Open Graph and Twitter tags
- [x] 6.2 Generate `public/og-image.png` (1200×630, our own board rendering) with a scratchpad script and commit it; README note under the custom domain section

## 7. Verification

- [x] 7.1 Web lint, typecheck, test, check:types and build pass
- [x] 7.2 End to end: `/` shows the landing page (with and without listed scenarios); Create opens `/editor`; old `/#/view/…`, `/#/edit/…`, `/#/edit-published/…` and `/#/privacy` links work; a reload after Edit a copy stays in the editor; the header links and `aria-current` work; on `/my`, Continue editing opens the draft without the question and Discard clears it; signing in from the editor returns to `/editor`; sheet print has no header
- [x] 7.3 Phone check of the landing page, header Menu and `/my`
- [ ] 7.4 After deploy: the same on pages.dev, and a link preview check (for example pasting the link into a chat app)
