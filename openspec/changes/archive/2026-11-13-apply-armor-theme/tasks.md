## 1. Foundations

- [x] 1.1 Add `@fontsource-variable/saira` and load it from `app.css`; set `--font-sans` to Saira
- [x] 1.2 Replace light/dark chrome tokens in `tokens.css` with the D1 palette (plate, recessed plate, panel line, plate highlight, frame, frame ink, accent, accent ink, vent, deck); map new ones in `@theme inline` and register them in `cn.ts`
- [x] 1.3 Add `chamfer` / `chamfer-sm` , `panel-line`, `hazard` and `deck` utilities in `app.css` (condensed headings use Tailwind's built-in `font-stretch-condensed`, so no custom utility was needed)

## 2. Atoms

- [x] 2.1 Button: chamfered recessed plates, vent marker for `active`, navy `primary`, new `frame` variant, inset focus ring
- [x] 2.2 Inputs: square wells on the plate, navy focus; Badge/Kbd recoloured to the new tokens
- [x] 2.3 Brand mark atom (original hex mark, inline SVG)

## 3. Molecules

- [x] 3.1 PanelSection: sentence-case condensed heading, engraved panel line
- [x] 3.2 Segmented: chamfered group, navy selected segment; ToolGroup headings in condensed sentence case
- [x] 3.3 GoalRow: chamfered plate card; WarningItem: chamfered plate with hazard stripe and condensed code

## 4. Organisms and template

- [x] 4.1 Toolbar on the navy frame with the brand mark and `frame` buttons; StatusBar on the frame
- [x] 4.2 Dialogs: chamfered plate, condensed title
- [x] 4.3 EditorLayout: hangar-deck board backdrop with deck seams and the "Deck W × H" stencil (from the scenario's board size)

## 5. Verification

- [x] 5.1 Lint, typecheck, unit tests and build pass
- [x] 5.2 Contrast check: compute ratios for text/muted/frame/accent pairs in both schemes (≥4.5:1)
- [x] 5.3 Re-run the overflow measurement (scrollWidth = clientWidth, no controls outside) and the Phase 1 browser walkthrough
- [x] 5.4 Screenshots in light and dark; self-critique and remove anything that doesn't earn its place
