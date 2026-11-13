## 1. Domain

- [x] 1.1 `domain/boardCursor.ts`: `stepCursor(index, cursor, dir)` and `startCursor(index, preferred)` (selection hex, then the centre-most hex), with tests covering a rectangle, a board with gaps, and the edges
- [x] 1.2 `domain/boardDescription.ts`: `describeHex` and `describeBoard`, with tests: the Desert Mesa counts and labels, carrier middle and facing, the empty and flat board, ordering by column then row
- [x] 1.3 Decide where terrain labels live (domain or passed in); keep `domain` free of UI imports

## 2. Announcer

- [x] 2.1 `ui/atoms/LiveRegion.tsx` (visually hidden, polite, atomic) and the `ui/hooks/useAnnouncer.ts` context, mounted in EditorPage; repeated text is still re-read
- [x] 2.2 Move the sight-line and reach text into `ui/analysisText.ts`, used by both StatusBar and the announcer
- [x] 2.3 StatusBar: remove `aria-live`, add `role="status"` on the message span, mirror `ui.flash` messages to the announcer
- [x] 2.4 Undo and redo from the toolbar or shortcuts announce "Undid …" and "Redid …"

## 3. Keyboard board

- [x] 3.1 `UiState.cursor` and `PointerKind` `'keyboard'`; tools still treat only `'touch'` specially (check the existing tests)
- [x] 3.2 HexBoard svg: `tabIndex`, `role="application"`, `aria-roledescription`, a label and hidden key help; track focus; place the cursor with `startCursor` on focus
- [x] 3.3 BoardView `cursor` prop: a two-tone ring drawn only while the board is focused
- [x] 3.4 `useBoardKeyboard`: arrows, Enter, Shift+arrow strokes (Shift keyup commits), carry mode for Select, Escape cancels, blur cancels; the cursor also sets `hover`
- [x] 3.5 Announce the cursor hex, edges, Analyse results and action results
- [x] 3.6 Auto-pan to keep the cursor visible when zoomed
- [x] 3.7 Keyboard hint set in StatusBar, used when `lastPointer` is `'keyboard'`

## 4. Board in words

- [x] 4.1 `BoardInWords` organism: headings and lists from `describeBoard`
- [x] 4.2 Editor: a collapsible "Board in words" PanelSection in the Scenario panels, collapsed by default
- [x] 4.3 Sheet: a `<details>` section after the setup checklist, `print:hidden`

## 5. Dialogs, contrast, motion

- [x] 5.1 DialogShell: Tab and Shift+Tab cycle inside; Escape on the busy dialog cancels the wait (as its Cancel does); focus returns to the opener (including from Menu items)
- [x] 5.2 `ui/styles/contrast.test.ts`: parse tokens.css (light and dark) and assert the listed pairs are at least 4.5:1; fix any pair that fails
- [x] 5.3 Reduced-motion block in app.css

## 6. Verification

- [x] 6.1 `npm run lint`, `typecheck`, `test` and `build` in `web/` pass
- [x] 6.2 Keyboard probe (playwright-core): Tab reaches the board; arrows move (readout matches); Enter raises; Shift+Right×2 paints three hexes with one undo; carry and Escape restore; Analyse Enter and move inspect; the live region text matches the spec examples; mouse movement announces nothing
- [x] 6.3 Dialog probe: Tab cycles inside Publish; Escape on My scenarios returns focus to its button
- [x] 6.4 Sheet probe: Board in words is listed after the checklist and is absent from print emulation; reduced-motion emulation gives durations of at most 0.01 s
- [x] 6.5 Hand check with NVDA (or Windows Narrator) on the editor and a sheet
