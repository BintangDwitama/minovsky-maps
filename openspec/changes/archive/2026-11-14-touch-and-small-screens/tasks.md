## 1. Viewport and gestures

- [x] 1.1 Add `ui/viewport.ts` with `zoomAround`, `pinch` and `clampZoom` (pure), with unit tests: midpoint stays fixed, distance ratio sets zoom, clamped at 0.3 and 5, parallel move pans
- [x] 1.2 Add `ui/hooks/useBoardViewport.ts`: active-pointer map, wheel zoom, two-pointer pinch and pan, one-pointer pan on request, zoom and fit actions
- [x] 1.3 Move HexBoard's wheel, zoom-button and middle/Space-drag pan onto `useBoardViewport` with no behaviour change on desktop (existing tests stay green)

## 2. Touch on the editor board

- [x] 2.1 Add `lastPointer: 'mouse' | 'touch'` to UI state (not saved) and `pointer` to `ToolContext`; pen counts as mouse
- [x] 2.2 HexBoard touch strokes: commit to one finger after 6 px of movement or 120 ms; a second finger before that pans or pinches; a second finger after calls `session.cancel()`; test that a cancelled stroke leaves no history
- [x] 2.3 Place tool acts on lift for touch; mouse unchanged
- [x] 2.4 Select tool on touch: a drag from an empty hex pans; a drag from a component moves it
- [x] 2.5 Touch hover: set `ui.hover` on down, ignore `pointerleave` for touch, clear on tool change
- [x] 2.6 Analyse tool on touch: tap places the probe when there is none; a tap elsewhere inspects; a drag from the probe moves it; tests for the tool with the `pointer: 'touch'` context
- [x] 2.7 StatusBar: touch versions of the tool hints, chosen by `lastPointer`

## 3. Touch-sized targets

- [x] 3.1 Add the `@custom-variant coarse` to `app.css`
- [x] 3.2 Button and IconButton (including `small`): `coarse:` 44 px minimum
- [x] 3.3 Text inputs, selects, the Checkbox, toggles and ChecklistItem: 44 px hit areas on coarse pointers
- [x] 3.4 Check that desktop (fine pointer) sizes are unchanged, by comparing a 1500 × 950 screenshot before and after

## 4. Compact editor layout

- [x] 4.1 Add `ui/hooks/useMediaQuery.ts` and a shared `COMPACT_QUERY` constant (900 px)
- [x] 4.2 Menu molecule: a disclosure button with a list of actions; closes on pick, Escape or outside tap
- [x] 4.3 Compact Toolbar variant: brand mark, Undo, Redo, Share, and a Menu (New, Open, Save, Publish or Update, My scenarios, Export PNG)
- [x] 4.4 TabBar molecule and the EditorLayout compact branch: full-height (`dvh`) board, status line, a drawer with Tools and Scenario using the existing `left` and `right` slots; it closes when `drawerCloseKey` changes; the tab bar shows the current tool name
- [x] 4.5 SelectionBar organism: component name, Rotate (carriers only), Remove, and Details (opens Scenario)
- [x] 4.6 DialogShell fits 360 px: max width and height, scrolling body, wrapping actions; check every dialog at 360 × 640

## 5. Sheet on phones

- [x] 5.1 BoardZoomView organism: full-screen board with `useBoardViewport` (one-finger pan, pinch, wheel), zoom and fit buttons, Close and Escape; keeps the page's scroll position
- [x] 5.2 Enlarge board button on SheetBoard, hidden in print
- [x] 5.3 Sheet actions and checklist at 44 px on coarse pointers; no horizontal scrolling at 390 px

## 6. Verification

- [x] 6.1 `npm run lint`, `typecheck`, `test` and `build` in `web/` pass
- [x] 6.2 Re-run the phone/tablet probe: page doesn't scroll at 390 × 664, board at least 400 px tall, all visible controls at least 44 px on touch, dialogs fit 360 px, desktop unchanged
- [x] 6.3 Probe gestures with CDP touch events: one-finger paint is one undo step; a second finger cancels a stroke; pinch zooms around the midpoint; Analyse tap inspects and drag moves the probe; the sheet's Enlarge board pinches
- [x] 6.4 Hand check on a real phone after deploy (constants feel right, no accidental placements)
