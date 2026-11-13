## Why

Share links and short links are about to be spread to players, and most people who open one will be on a phone or tablet. A probe of the current build (iPhone 13 and iPad landscape, Desert Mesa sample) shows:

- 50 of 54 editor controls are below a 44 px touch target (median height 29 px). On the sheet, all 18 controls are (checklist boxes about 20 px).
- On a phone the editor stacks into a 2,789 px page. The tools sit about 1,400 px below the board, so switching tool means scrolling past the whole board. The toolbar wraps onto three rows.
- Touch has no pan or pinch-zoom on the board. Hover-only feedback does nothing on touch: the status-bar hex readout and the sight-line inspection of the Analyse tool. Hints talk about wheel and Space+drag.
- The sheet stacks well on a phone, but its board labels can only be read by zooming the whole page.

This is part 2a of "accessible everywhere". Keyboard and screen-reader access to the board follows as its own change (2b).

## What Changes

Touches **web** only (no server or schema change).

- **Compact editor layout** below 900 px wide:
  - The board fills the screen between a one-row top bar and a bottom tab bar.
  - The top bar keeps Undo, Redo and Share; the other file actions move into a menu.
  - The tab bar opens a drawer with **Tools** (tools and component palette) or **Scenario** (selection, analysis, warnings, pillars, settings).
  - Picking a tool or component closes the drawer so the board is free.
  - A small selection bar gives quick actions on the selected component.
  - The desktop three-column layout is unchanged.
- **Touch gestures on the board:**
  - One finger runs the current tool, as the mouse does.
  - Two fingers pan and pinch-zoom. A second finger landing mid-stroke cancels that stroke, so nothing is half-painted and no undo step is created.
  - With the Select tool, one-finger drag on empty space pans.
- **Tap instead of hover:**
  - On touch, the hex readout shows the last touched hex.
  - With the Analyse tool, tapping a hex inspects the sight line to it, and dragging the probe moves it. Mouse behaviour is unchanged.
  - Hints are worded for the input in use.
- **Touch-sized targets:** on coarse pointers (`pointer: coarse`), buttons, inputs, tick boxes and toggles get at least a 44 × 44 px hit area. Mouse users keep today's compact look.
- **Sheet on phones:** an Enlarge board action opens the board full screen with pinch-zoom, pan and zoom buttons. The sheet's actions and checklist get touch-sized targets.
- **Dialogs** fit a 360 px wide screen without sideways scrolling.

## Capabilities

### New Capabilities
- `touch-input`: board gestures (one finger runs the tool, two fingers pan and zoom, stroke cancel), tap replacements for hover feedback, input-specific hints, and the 44 px touch-target rule.

### Modified Capabilities
- `editor-layout`: adds the compact layout for viewports narrower than 900 px (top bar with menu, full-height board, tab bar and drawer, selection bar) and the rule that dialogs fit 360 px.
- `map-analysis`: probe placement and sight-line inspection gain touch behaviour (tap inspects, drag the probe to move it), since hovering is impossible on touch.
- `scenario-sheet`: adds the full-screen zoomable board view and touch-sized sheet controls.

## Non-goals

- Keyboard-only board editing, screen-reader descriptions of the board, and the contrast and focus audit. These are change 2b.
- A phone-first redesign of the editor. On phones, editing must be workable; tablets get the polish.
- An installable app, offline use, native apps, haptics.
- Changing the desktop density or the print layout.
- Custom gestures beyond pan and pinch (no long-press menus, rotate gestures or double-tap zoom).

## Impact

- **New:**
  - `web/src/ui/hooks/useBoardViewport.ts`: zoom, pan and pinch state, shared by editor and sheet. The pure gesture math lives in `ui/viewport.ts` with unit tests.
  - Tailwind `coarse:` custom variant for touch-target sizing.
- **Changed:**
  - `ui/organisms/HexBoard.tsx`: multi-pointer handling and touch hover; it uses the existing `session.cancel()`.
  - `ui/templates/EditorLayout.tsx`: compact layout, drawer and tab bar.
  - `ui/organisms/Toolbar.tsx`: compact top bar and menu.
  - `ui/organisms/StatusBar.tsx`: touch hints and last-touched hex.
  - Analyse tool in `ui/tools/tools.ts`.
  - `ui/organisms/SheetBoard.tsx` and `ui/pages/SheetView.tsx`: Enlarge board.
  - `atoms/Button.tsx` and `atoms/inputs.tsx`, `molecules/ChecklistItem.tsx`: touch sizing.
  - `organisms/dialogs.tsx`: narrow-screen fit.
- No new runtime dependencies. No domain, application, server or schema changes, except possibly a `pointerKind` field in UI state.
- **Verification:** the existing Vitest suites plus a phone/tablet probe (playwright-core with device emulation) re-run against the targets above.
