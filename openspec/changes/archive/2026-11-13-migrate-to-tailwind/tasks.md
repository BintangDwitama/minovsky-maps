## 1. Baseline

- [x] 1.1 Capture "before" screenshots of the editor at 1500×950 in light and dark colour schemes (empty scenario, and sample-mesa loaded with two goals) into the scratchpad for later comparison
- [x] 1.2 Record the current right-panel overflow measurement (scrollWidth vs clientWidth) as the failing baseline for the `editor-layout` requirement

## 2. Setup

- [x] 2.1 Add `tailwindcss`, `@tailwindcss/vite`, `tailwind-merge`, `clsx` and `prettier-plugin-tailwindcss` to `web/package.json`; register the Vite plugin in `web/vite.config.ts`
- [x] 2.2 Create `web/src/ui/styles/app.css` with `@import "tailwindcss"`, `@import "./tokens.css"`, the `@theme inline` token mapping (D2) and the minimal `@layer base` (D5); import it from `main.tsx` (switched over directly instead of running both stylesheets side by side, since the port was done in one pass)
- [x] 2.3 Add `web/src/ui/cn.ts` (`clsx` + `extendTailwindMerge` with the custom theme names) and a unit test proving a parent `className` overrides an atom default (e.g. `cn('bg-panel px-3', 'bg-panel-2 px-1')` → `bg-panel-2 px-1`), plus a font-size/line-height override so `text-xs` does not drop an explicit `leading-*`
- [x] 2.4 Add the Tailwind Prettier plugin to `.prettierrc.json` (`tailwindStylesheet`, `tailwindFunctions: ["cn"]`); confirm `npm run lint` still passes the layer-boundary rules with `cn.ts` imported from atoms

## 3. Atoms

- [x] 3.1 Port `Button` / `IconButton` to typed variant maps (default/primary/danger, active, small, icon) using `cn()`; remove `.btn*` rules
- [x] 3.2 Port `inputs.tsx` (TextInput, TextArea, NumberInput, Select, invalid state); remove `.input*` rules
- [x] 3.3 Port `Badge`, `Kbd`, `Swatch`, `Icon` and the non-SVG parts of `ElevationBadge`; remove their rules
- [x] 3.4 Confirm `HexPolygon`, `TerrainPattern`, `ComponentGlyph` need no change (inline SVG attributes only)

## 4. Molecules

- [x] 4.1 Port `controls.tsx` (ToolButton, Segmented, OwnerToggle, TerrainTagPicker, ElevationLevelPicker, FieldRow)
- [x] 4.2 Port `ComponentPaletteItem` and `WarningItem` (including hover/selected states)
- [x] 4.3 Rebuild `GoalRow` per D6: header with "Goal N" and move-up / move-down / remove buttons, full-width wrapping textarea, meta row with VP field, "VP" label and a shrinkable scoring select (`min-w-0`)
- [x] 4.4 Extract a panel-section molecule (heading + body box) if the same chrome pattern appears in two or more organisms

## 5. Organisms, template, page

- [x] 5.1 Port `ToolPalette`, `ComponentPalette`, `ScenarioInspector`
- [x] 5.2 Port `ScenarioSettingsPanel`, `GoalsEditor`, `WarningsPanel` / `PillarCount`
- [x] 5.3 Port `Toolbar`, `StatusBar`, `dialogs` (overlay, dialog box, actions)
- [x] 5.4 Port `BoardView` wrapper and zoom controls (board SVG untouched)
- [x] 5.5 Port `EditorLayout` per D7 (`grid-cols-[220px_minmax(0,1fr)_320px]`, side panels `min-w-0 overflow-y-auto overflow-x-hidden`) and `EditorPage`

## 6. Cleanup

- [x] 6.1 Delete `web/src/ui/styles/global.css` and its import; verify no BEM class names remain (`grep` for `__` / `--` class tokens in `web/src/ui`)
- [x] 6.2 Add `data-testid` only where an element used by browser checks has no accessible name (toolbar title, pillar total)
- [x] 6.3 Run Prettier over the UI files touched by this change so classes are sorted (the rest of `web/src` was never Prettier-formatted; reformatting it is left out to avoid unrelated churn)

## 7. Verification

- [x] 7.1 `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass
- [x] 7.2 Update the browser check scripts to role/label/`data-testid` selectors and re-run the Phase 1 flows (paint, elevation, place/rotate carrier, goals, save/load, PNG export)
- [x] 7.3 Verify `editor-layout`: at 1500×950 with two goals using "End of each Phase", the scenario panels' scrollWidth equals clientWidth and all goal controls are inside the panel; a 300-character unbroken goal text wraps without widening the panel
- [x] 7.4 Verify dark mode: with `prefers-color-scheme: dark`, chrome uses dark tokens and the board/PNG export colours are unchanged
- [x] 7.5 Capture "after" screenshots matching 1.1 and compare; fix any visible drift ≥2px or colour mismatch
