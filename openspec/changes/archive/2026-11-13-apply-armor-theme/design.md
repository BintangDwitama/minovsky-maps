## Context

`migrate-to-tailwind` moved all chrome styling into Tailwind utilities driven by CSS variables in `tokens.css` (mapped in `app.css` `@theme inline`). Atoms own their looks, so a theme is mostly a token change plus a handful of atom/molecule tweaks. The board SVG and PNG export read `theme.ts` and are out of scope.

The user chose the "armor plating" direction: the chrome should feel like a built mobile-suit model — plates, panel lines, cut corners, vent yellow — in an original way.

## Goals / Non-Goals

**Goals:** a distinctive, Gundam-flavoured chrome in light and dark; readable (≥4.5:1 text contrast); side colours left meaningful; small, token-driven diff.

**Non-Goals:** board/glyph/export changes; layout or behaviour changes; any official IP.

## Decisions

### D1. Palette (tokens)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` / `--panel` (plate) | `#eef1f5` | `#232933` | armour plate |
| `--panel-2` (recessed plate) | `#dfe4eb` | `#1b2028` | wells, inputs' surroundings, buttons |
| `--border` (panel line) | `#bcc5d1` | `#38414e` | engraved line (dark half) |
| `--plate-hi` | `#ffffff` | `#2d3440` | engraved line (light half) |
| `--frame` | `#1b2846` | `#0e1420` | toolbar/status frame |
| `--frame-ink` | `#ffffff` | `#e7ecf3` | text on frame |
| `--text` | `#161d2b` | `#e7ecf3` | ink |
| `--text-muted` | `#4f5a6b` | `#a3adbb` | helper text (≥4.5:1 on plate) |
| `--accent` | `#24407a` | `#8fb0ee` | focus, primary, selected segment |
| `--accent-ink` | `#ffffff` | `#0e1420` | text on accent |
| `--vent` | `#f2b705` | `#f2b705` | active tool marker (mirrors board selection yellow) |
| `--board-bg` (deck) | `#2b3139` | `#14181e` | hangar deck |

Navy rather than blue keeps chrome distinct from Side A (`#0072b2`); red is used only for danger text.

### D2. Type
Saira variable (`@fontsource-variable/saira`, OFL), self-hosted via Vite. Body: Saira at 100% width, 14px. Headings and brand: Saira at ~80% width (`font-stretch`), semibold, sentence case — replacing the ALL-CAPS tracked headings. Warning codes use the condensed width at 11px instead of monospace.

### D3. Plates, panel lines, chamfers
- **Panel lines:** sections separate with a 1px `--border` line plus a 1px `--plate-hi` line under it (engraved look) via `shadow-[0_1px_0_var(--plate-hi)]`.
- **Chamfers:** a `chamfer` / `chamfer-sm` utility (`@utility` in `app.css`) clips the top-left and bottom-right corners with `clip-path: polygon(...)`. Chamfered elements carry no border (a clip would cut it); they are separated by fill and a 2px bottom "plate edge" inset shadow. Applied to buttons, segmented controls, goal cards, warnings and dialogs. Inputs stay square with a border — they read as screens/wells, not plates.
- **Vent marker:** the active button shows a 4px yellow bar on its left edge (`shadow-[inset_4px_0_0_var(--vent)]`) and the recessed fill.

### D4. Frame
Toolbar and status bar are navy `--frame` bands. Toolbar buttons use a new `frame` Button variant: transparent, `--frame-ink` text, lighter-navy hover, and the vent marker when active. The brand pairs the existing hex mark (as an inline SVG) with condensed bold "Minovsky Maps".

### D5. Hangar deck and stencil
The board area background is the deck colour with faint 96px deck-plate seams (two `linear-gradient` layers). A stencil marking in the bottom-left corner states the board size ("Deck 15 × 15") — information, not decoration. It is `aria-hidden` (the size is already in the settings panel) and `pointer-events-none`.

### D6. Hazard striping on warnings
Warnings get a 6px yellow/black diagonal stripe on their left edge (`repeating-linear-gradient`). It is the only hazard stripe in the UI, so it keeps its meaning.

## Risks / Trade-offs

- [Chamfer clip removes borders and focus outlines on corners] → focus uses `outline` with `outline-offset: 2px`; clip-path clips outlines too, so chamfered controls show focus via an inset ring (`focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]`) instead.
- [Condensed headings reduce legibility at small sizes] → only ≥13px headings use the condensed width; body text stays normal width.
- [Font weight/width change shifts layout widths] → re-run the overflow measurement from `editor-layout` after theming.
- [Visual IP risk] → only generic shapes (plates, chamfers, stripes), our own colours and an OFL font; no franchise names in the UI beyond the existing "unofficial fan tool" note.

## Migration Plan
Token and utility changes first, then atoms → molecules → organisms → template; verify contrast, overflow and Phase 1 flows; screenshots in both schemes. Rollback = revert the commit.

## Open Questions
None.
