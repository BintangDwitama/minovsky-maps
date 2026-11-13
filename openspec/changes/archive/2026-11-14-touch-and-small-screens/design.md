## Context

The editor was built for mouse and desktop.

- **`HexBoard`:**
  - Handles one pointer at a time. Pan is middle-drag or Space+drag, and zoom is the wheel or buttons.
  - It already sets `touch-none`, so the browser doesn't steal touches, but two fingers do nothing useful.
  - Tools receive `onDown/onMove/onUp` per stroke. Stroke tools use `session.begin/commit`, and `session.cancel()` exists and restores the transaction base.
  - The Place tool executes immediately on down, outside a transaction.
- **`EditorLayout`:** a CSS grid. Below 900 px it stacks every area into one tall column, which is the 2,789 px phone page.
- **`StatusBar`:** reads `ui.hover`, which only a mouse produces.
- **Sheet:** `SheetBoard` is a static `role="img"` SVG that can't be zoomed.
- **Buttons:** a 6 px vertical padding on a 1.2 line height, which gives about 29 px.

Constraints:
- Stay within the layering rules: domain and application untouched, apart from at most a UI-state field.
- No new runtime dependencies.
- Desktop look unchanged.

## Goals / Non-Goals

**Goals:**
- Phones can edit (workable), tablets edit comfortably, and anyone can read a sheet on a phone.
- Gestures that feel native: one finger works the tool, two fingers pan and zoom.
- Every hover-only piece of feedback has a tap equivalent.
- 44 px targets on touch, desktop density kept.

**Non-Goals:**
- Keyboard or screen-reader access to the board (change 2b).
- A phone-first redesign, installable app, offline use, or long-press and double-tap gestures.

## Decisions

### 1. A shared viewport: pure math plus a hook
`ui/viewport.ts` (pure, unit-tested) holds three functions:
- `zoomAround(view, factor, focus)`
- `pinch(view, before: [P, P], after: [P, P])`: the new zoom is the distance ratio, the midpoint stays fixed, and the midpoint's movement is added as pan;
- `clampZoom`.

`ui/hooks/useBoardViewport.ts` owns the active-pointer map and turns it into wheel, pinch and one-finger pan, given the SVG ref and board bounds. Both `HexBoard` and the new sheet zoom view use it.
*Alternative:* a gesture library (use-gesture, hammer). Rejected because it adds a dependency for about 100 lines of logic, and the existing pointer-capture code would have to be rewritten anyway.

### 2. Commit to one finger before a tool acts
On touch, a stroke does not start on `pointerdown`. It starts when the finger moves past 6 px, or after 120 ms with no second finger, whichever comes first. A second finger before that point means pan or pinch, and the tool never runs. A second finger after the stroke has started calls `session.cancel()`, which restores the transaction base and adds no history.

Tap-only tools act on lift:
- **Place:** the component appears when the finger lifts, so a pinch never leaves a stray component.
- **Analyse:** a tap is told apart from a drag of the probe on lift.

Mouse behaviour stays exactly as today: it acts on down.
*Alternative:* always act on lift. Rejected, because painting would feel laggy and the first hex of a drag would be lost.

### 3. Tools learn the pointer kind
`ToolContext` gains `pointer: 'mouse' | 'touch'`. Pen counts as mouse, because a pen can hover. Only two tools read it:
- **Select:** on touch, a drag from an empty hex pans. `onDown` returns a flag, `{ pan: true }`, that `HexBoard` then hands to the viewport.
- **Analyse:** on touch, a tap inspects once a probe exists, and a drag from the probe's hex moves the probe.

`UiState` gains `lastPointer`, which drives the wording of the hints. It is UI state only and never saved.

### 4. "Hover" doubles as the inspected hex
On touch, `HexBoard` sets `ui.hover` on down and ignores `pointerleave`, so the readout and sight line stay after the finger lifts. Changing tool or moving the probe clears it.
`StatusBar` and `AnalysisOverlay` need no new state. *Alternative:* a separate `inspected` field. Rejected because every consumer would then have to merge two sources.

### 5. Compact layout is a second arrangement of the same slots
`ui/hooks/useMediaQuery.ts` with a `COMPACT_QUERY = '(max-width: 899.98px)'` constant. The compact layout and the CSS breakpoint use the same number.

Below it, `EditorLayout` renders:
```
┌──────────────────────────┐
│ ⬡  ↶ ↷  Share   ☰ Menu   │  Toolbar compact variant
├──────────────────────────┤
│                          │
│          board           │  flex-1, h-dvh layout, no page scroll
│                          │
│ [Garrison A] ⟳ ✕ Details │  SelectionBar (only when something is selected)
├──────────────────────────┤
│ status line              │
├──────────────────────────┤
│  Tools: Raise +1 │ Scenario│  tab bar; a tab opens the drawer (max 65dvh, scrolls)
└──────────────────────────┘
```
- The existing `left` and `right` slots become the drawer contents, so the panels mount only once and nothing is duplicated.
- The drawer is EditorLayout state, closed by a `drawerCloseKey` prop (`tool + palette kind`) that changes when the user picks one.
- New pieces:
  - `templates/EditorLayout` (compact branch);
  - `molecules/TabBar`;
  - `organisms/SelectionBar`, which reuses the inspector's rotate and remove commands;
  - `molecules/Menu`: a disclosure button with a list of actions that closes on pick, Escape or outside tap.

### 6. Touch sizing through a `coarse:` variant
In `app.css`: `@custom-variant coarse (@media (pointer: coarse));`.
- `Button`: `coarse:min-h-11 coarse:min-w-11`, with `small` buttons included.
- Text inputs and selects: `coarse:min-h-11`.
- Checkbox and toggle: the hit area grows through the wrapping label's padding (`coarse:py-3`), and the visible box gets slightly larger.

The media query decides, not screen width: a narrow desktop window keeps mouse density, and a touch laptop gets big targets.

### 7. Sheet: a full-screen zoom view
`organisms/BoardZoomView`: a fixed full-screen overlay with `BoardView`, `useBoardViewport`, zoom buttons and Close (Escape too). `SheetBoard` gains an Enlarge board button, hidden in print. A one-finger drag pans here, because there is no tool. The overlay doesn't touch the page's scroll position.

### 8. Dialogs
`DialogShell` gets `max-w-[calc(100vw-16px)]`, `max-h-[calc(100dvh-16px)]` with an internal scroll on the body, and actions that wrap.

## Risks / Trade-offs

- **[Risk] The 120 ms commit delay feels slow when painting.** Mitigation: movement past 6 px starts the stroke at once, so only a stationary tap waits, and a tap on a stroke tool still paints when the finger lifts. If it still feels slow, tune the constant.
- **[Risk] Pinch emulation in automated probes.** Playwright's touch emulation taps but doesn't pinch. Mitigation: unit-test the pinch math in `viewport.ts`; drive two-finger gestures in the probe through CDP `Input.dispatchTouchEvent`; check by hand on a real phone before archive.
- **[Risk] The compact branch drifts from desktop.** Mitigation: both arrangements render the same slot components, and only the arrangement differs.
- **[Trade-off] Behaviour differs by pointer type** (Analyse tap inspects on touch and moves the probe with a mouse). Accepted: hovering doesn't exist on touch, and the mouse flow is already specified and liked.
- **[Risk] `window.prompt` for labels on mobile** (Place, for tokens and structures). It works on iOS and Android, so it stays for now. It's a candidate for the 2b pass.
- **[Trade-off] The iPad in portrait (810 px) gets the compact layout.** Accepted: three columns don't fit there.

## Migration Plan

UI-only and deployed with the next Pages build. Nothing is stored, so rollback is a redeploy of the previous build.

## Open Questions

- None blocking. Tune the 120 ms and 6 px constants after trying it on a real phone.
