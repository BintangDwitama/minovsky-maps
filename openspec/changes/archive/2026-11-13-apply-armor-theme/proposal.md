## Why

After the Tailwind migration the editor works but looks like a generic grey tool. Players come to it because they love the Gundam setting; the chrome should feel like it belongs to that world without copying any official artwork, logos, typefaces or anime UI.

## What Changes

- Apply an original "armor plating" theme to the editor chrome (web only):
  - off-white armour plates (gunmetal in dark mode) with engraved panel lines between sections;
  - a deep-navy frame for the toolbar and status bar;
  - chamfered (cut) corners on plates such as goal cards, warnings, dialogs and buttons;
  - a yellow "vent" marker for the active tool, mirroring the board's yellow selection outline;
  - hazard striping on warnings, the only place it appears;
  - the board sits on a gunmetal hangar deck with faint deck-plate seams and a stencil marking that states the board size.
- Typography: self-hosted Saira variable font (SIL OFL) — regular width for body text, condensed width for headings and the brand.
- Panel headings change from tracked ALL CAPS to sentence-case condensed headings.
- New `frame` button variant for buttons on the navy toolbar.
- Interactive accent (focus ring, primary buttons, selected segments) moves from the Side A blue to navy, so chrome colour never reads as a side.

Sides touched: **web only**.

## Capabilities

### New Capabilities
- `editor-theme`: The editor chrome's visual identity — original Gundam-inspired armour theme in light and dark, readable contrast, side colours reserved for sides, and no official IP.

### Modified Capabilities
- None. Layout, behaviour and the `editor-layout` overflow guarantees are unchanged.

## Non-goals

- No change to the board's hex tiles, terrain patterns, component glyphs or side colours.
- No change to the PNG export.
- No official names, logos, art, typefaces or screen recreations from the Gundam franchise.
- No theme switcher; the theme follows the system light/dark preference as before.
- No new behaviour, layout or components beyond styling.

## Impact

- `web/src/ui/styles/tokens.css`, `app.css`; atoms (Button, inputs, Badge), molecules (PanelSection, controls, GoalRow, WarningItem), organisms (Toolbar, StatusBar, dialogs, HexBoard backdrop), template (EditorLayout).
- New runtime dependency: `@fontsource-variable/saira` (fonts bundled by Vite, no external requests).
- `schemaVersion` unchanged; scenario files untouched.
