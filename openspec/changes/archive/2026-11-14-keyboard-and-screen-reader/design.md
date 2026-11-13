## Context

After 2a, input reaches tools through one interface in `ui/tools/tools.ts`:

- `onDown`, `onMove`, `onUp`, `onCancel` and an optional `onTap`;
- `ToolContext.pointer`, which is `'mouse'` or `'touch'`.

`HexBoard` turns pointer events into those calls. Other pieces involved:

- `UiState` holds `hover`, which drives the readout and the Analyse sight line.
- `StatusBar` is `aria-live="polite"` and re-announces the hover readout on every mouse move.
- `DialogShell` focuses the first control and restores focus on close, but doesn't trap Tab.
- `domain/setupSummary.ts` already derives counts per side; positions aren't derived anywhere.
- Tokens live in `ui/styles/tokens.css`, with a dark block under `@media screen and (prefers-color-scheme: dark)`.

## Goals / Non-Goals

**Goals:**
- Every board action has a keyboard path that goes through the existing Tool interface, with no tool logic duplicated.
- A screen-reader user can explore and edit a map and hear the result.
- Anyone can understand a shared map as text.
- Accessibility regressions in contrast are caught by tests.

**Non-Goals:**
- Six-direction hex keys.
- Automated axe runs.
- Printing the board description.
- Voice or switch control.

## Decisions

### 1. The keyboard is a third input that behaves like the mouse
`PointerKind` becomes `'mouse' | 'touch' | 'keyboard'`. Tools only special-case `'touch'`, so the keyboard gets mouse semantics automatically:

- Place acts on down.
- Analyse places on Enter, and moving the cursor inspects.
- Select drags.

`useBoardKeyboard` (a ui hook) maps keys to tool calls:

| Key | Tool calls |
|---|---|
| Enter (no carry) | `onDown(cursor)` then `onUp()`. For Select on a component: `onDown` only, entering *carrying* |
| Arrow while carrying | move cursor, `onMove(cursor)` |
| Enter while carrying | `onUp()` |
| Escape while carrying or stroking | `onCancel()` |
| Shift+Arrow (no stroke) | `onDown(cursor)`, move, `onMove(cursor)`: *stroking* |
| Shift+Arrow while stroking | move, `onMove(cursor)` |
| Shift keyup while stroking | `onUp()` |
| Blur while stroking or carrying | `onCancel()`, so nothing is left half done |

Escape while idle keeps today's global meaning: clear the selection and switch to the Select tool. The board stops propagation only when Escape cancels something.

*Alternative:* separate keyboard implementations per tool. Rejected because the behaviour would drift.

### 2. The cursor is UI state; it acts as hover for the keyboard
`UiState.cursor: Axial | null`. Moving the cursor with the keyboard sets both `cursor` and `hover`, so the readout and the Analyse sight line work unchanged.

`BoardView` gets a `cursor` prop and draws a thick dark ring with a vent-yellow inner ring. It is drawn only while the svg has focus (`:focus-visible` state tracked in HexBoard).

Arrow movement is a pure function, `stepCursor(index, cursor, dir)`, in `domain/boardCursor.ts`:
- convert to offset coordinates;
- step col or row;
- skip over gaps until the next on-board hex or the bounding box;
- otherwise stay and report `edge`.

It is unit-tested, including boards with holes.

**Auto-pan:** after a move, if the cursor hex's screen box falls outside the svg's client rect (with a 1-hex margin), pan by the overflow. When zoom is 1 and the board fits, this does nothing.

### 3. The svg is the focusable control
The svg gets:
- `tabIndex={0}`;
- `role="application"`, so screen readers pass the arrow keys through;
- `aria-roledescription="hex board"`;
- `aria-label="Scenario board"`;
- `aria-describedby` pointing to a visually hidden paragraph with the key help.

*Alternative:* `role="grid"` with 225 gridcells. Rejected: hexes aren't a grid, it would be very verbose, and it's slow to render.

### 4. One announcer
`ui/atoms/LiveRegion.tsx` is a visually hidden `<div aria-live="polite" aria-atomic="true">`.

`ui/hooks/useAnnouncer.ts` provides `announce(text)` through context, mounted once in `EditorPage`. Repeating the same text appends a zero-width space so it is re-read.

Messages:
- **Cursor:** `describeHex(index, hex)` (domain, pure), for example "7, 8. Level 2. Water. Garrison, Side A." Edge moves say "Edge of the board."
- **Analyse:** the same text the StatusBar builds for the sight line and reach, moved into a shared pure helper (`ui/analysisText.ts`) so both use it.
- **After a keyboard action:** the cursor hex is described again, with the action's undo label first ("Raise. 7, 8. Level 3."). Picking up and dropping say "Picked up Garrison" and "Moved Garrison to 9, 8".
- **Undo and redo:** the toolbar buttons and the Ctrl+Z / Ctrl+Y shortcuts announce "Undid …" and "Redid …" using the history labels.
- **Refusals:** `ui.flash` messages are mirrored to the announcer by an effect in `StatusBar`.

`StatusBar` drops `aria-live`. Its message span keeps `role="status"` for sighted keyboard users, and the announcer carries the speech.

### 5. Board in words is a pure derivation
`domain/boardDescription.ts`:

```ts
describeBoard(s): {
  size: string;                                 // "15 × 15 hexes" or "120 hexes"
  levels: { level: number; hexes: string[] }[];  // "7, 8", sorted by col then row
  terrain: { tag: TerrainTag; hexes: string[] }[];
  sides: { side: 'A' | 'B' | 'neutral'; items: { text: string }[] }[];
  // e.g. "Objective “Data core” on 7, 8, level 2"; "Carrier facing NE, middle 3, 4"
  flat: boolean;
}
```

It uses the registry's kind labels and the theme's terrain labels are passed in, so the domain stays free of UI imports. The domain gets a plain label map argument, or uses the terrain label map moved into the domain. Decided in apply: the labels move to `domain` if they aren't UI-styled.

`ui/organisms/BoardInWords.tsx` renders it as headings and `<ul>` lists inside:
- a `PanelSection` that is collapsible, collapsed by default, in the editor;
- a `<details>` element on the sheet, with `print:hidden`.

### 6. Dialog focus cycling
`DialogShell`'s keydown handler wraps Tab and Shift+Tab between the first and last focusable elements inside the dialog. The selector matches `button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`, excluding disabled ones. Escape is ignored while the busy dialog runs; the busy dialog already passes a no-op `onClose`.

The existing focus restore stays. Menu items close the menu before opening the dialog, so focus returns to the Menu button.

### 7. Contrast test and reduced motion
- **Contrast:** `ui/styles/contrast.test.ts` reads `tokens.css` as text and parses the `:root` block and the dark block. It computes WCAG relative luminance for the listed pairs and asserts at least 4.5:1, naming the pair on failure. Only hex colours are needed for these pairs.
- **Reduced motion:** `app.css` adds a `@media (prefers-reduced-motion: reduce)` block that sets `animation-duration` and `transition-duration` to `0.01ms !important`, iteration count to 1, and `scroll-behavior: auto`.

## Risks / Trade-offs

- **[Risk] Screen readers in browse mode intercept arrow keys.** Mitigation: `role="application"` switches NVDA/JAWS to focus mode on the board. The key help says so. Check with NVDA (free) during verification.
- **[Risk] Announcements on every arrow press are chatty.** Mitigation: polite and atomic, so a new message replaces a pending one; the text is short.
- **[Trade-off] Shift+arrow strokes end on Shift keyup.** If the window loses focus mid-stroke, blur cancels the stroke rather than committing it. Accepted: losing a half stroke is safer than committing one by accident.
- **[Risk] The Space-to-pan global listener.** Unchanged. The keyboard path uses Enter, not Space, so the two don't conflict.
- **[Trade-off] Board in words can be long on busy maps.** Accepted: it is collapsed by default and grouped with headings, so screen readers can jump between groups.

## Migration Plan

UI only; deploys with the next Pages build. Nothing is stored. Roll back by redeploying.

## Open Questions

- Where the terrain labels live (domain vs theme) is settled during apply. It has no effect on behaviour.
