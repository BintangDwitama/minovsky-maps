## Why

The board is the heart of the editor, and today it only works with a pointer. Tab skips it, it has no keyboard controls, and to a screen reader it is an unnamed "application". Other gaps:
- The status bar re-announces the hex readout on every mouse move, which is noise to screen-reader users.
- Tab can leave an open dialog.
- People who receive a shared link have no way to understand a map without seeing it.

This is part 2b of "accessible everywhere"; part 2a (touch and small screens) is done.

## What Changes

Touches **web** only (no server or schema change).

- **Keyboard board cursor:**
  - The board takes focus with Tab and shows a cursor hex.
  - Arrow keys move the cursor by column and row, matching the coordinates shown everywhere. On custom-shaped boards it skips gaps and stops at the edge.
  - **Enter** applies the current tool to the cursor hex, as a click does.
  - **Shift + arrows** applies the tool while moving, as a drag stroke does, and is one undo step.
  - **Select:** Enter picks up the component under the cursor, arrows carry it, Enter drops it and Escape puts it back. One undo step.
  - **Sight & reach:** Enter places the probe, and moving the cursor inspects, as hover does.
  - The view pans to keep the cursor visible when zoomed in.
  - Keyboard-worded hints.
- **Spoken feedback:** one polite live region announces:
  - the cursor hex ("7, 8. Level 2. Water. Garrison, Side A.");
  - the result of keyboard actions;
  - undo/redo;
  - refusal messages.
  The status bar's hex readout is no longer a live region.
- **Board in words:** a text description of the whole map, listing elevation levels, terrain and every component by side with its hex and level. It appears as a collapsible section on the sheet (not printed) and in the editor's Scenario panel.
- **Dialogs keep focus:** Tab and Shift+Tab cycle inside an open dialog; focus returns when it closes. This already partly works.
- **Contrast and motion:**
  - A unit test checks token contrast pairs in both colour schemes, guarding the existing `editor-theme` contrast requirement.
  - The reduce-motion preference turns off transitions and animations.

## Capabilities

### New Capabilities
- `keyboard-board`: keyboard focus, cursor movement and tool actions on the board, plus spoken cursor and edit announcements.
- `board-in-words`: the text description of a scenario's board, in the editor and on the sheet.

### Modified Capabilities
- `editor-layout`: adds the requirement that dialogs keep keyboard focus inside them and return it on close.
- `editor-theme`: adds the reduced-motion requirement and an automated check of the existing contrast rule.

## Non-goals

- Six-direction hex keys (Q/W/E/A/S/D). Arrows by column and row only.
- Keyboard resizing or reshaping of the board beyond the existing dialog.
- Full WCAG certification or an automated axe run in CI.
- Voice control, switch access or custom screen-reader verbosity settings.
- Describing the board on the printed sheet. The printout keeps its current layout.

## Impact

- **New:**
  - `domain/boardDescription.ts`: pure `describeHex` and `describeBoard`, with tests.
  - `ui/atoms/LiveRegion.tsx` and the `ui/hooks/useAnnouncer.ts` context.
  - `ui/organisms/BoardInWords.tsx`.
  - `ui/hooks/useBoardKeyboard.ts`: key handling into the existing Tool interface.
  - A token contrast test.
- **Changed:**
  - `application/uiState.ts`: `cursor`, and `lastPointer` gains `'keyboard'`.
  - `ui/organisms/HexBoard.tsx` (focus, cursor, keys).
  - `ui/organisms/BoardView.tsx` (cursor ring).
  - `ui/organisms/StatusBar.tsx` (no live readout; keyboard hints).
  - `ui/organisms/dialogs.tsx` (focus cycling).
  - `ui/pages/EditorPage.tsx`, `ui/pages/SheetView.tsx` (Board in words, announcer).
  - `ui/styles/app.css` (reduced motion).
- No new dependencies. No changes to the scenario format, server or schema.
