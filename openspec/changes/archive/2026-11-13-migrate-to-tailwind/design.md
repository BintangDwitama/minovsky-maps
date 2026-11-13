## Context

The Phase 1 editor styles its UI with two plain stylesheets imported once from `web/src/main.tsx`:

- `web/src/ui/styles/tokens.css` — `:root` custom properties (side colours, terrain, elevation, chrome colours, radius, gap), with dark-mode overrides under `@media (prefers-color-scheme: dark)`.
- `web/src/ui/styles/global.css` — ~430 lines: a small reset/base, then ~70 BEM classes (`.btn`, `.btn--primary`, `.goal-row__meta`, `.layout__right`, …) for every atom through the template.

The board SVG (`HexBoard`, `HexCell`, glyph atoms) and the PNG exporter (`renderBoardSvg` → `renderToStaticMarkup` → canvas) take colours from `web/src/ui/theme.ts` as inline `fill`/`stroke` attributes. They do not depend on stylesheet classes; `global.css` only styles the `.board` wrapper and its zoom controls.

Measured defect: the goal card is a one-column grid with `1fr`, whose min-content width (355px) exceeds the ~279px available in the 320px right panel, so the textarea and controls overflow and the panel scrolls horizontally.

Toolchain: Vite 5.4, React 18, TypeScript strict, ESLint 9 flat config with layer-boundary rules, Prettier (`.prettierrc.json`).

## Goals / Non-Goals

**Goals:**
- Tailwind v4 is the only styling mechanism for editor chrome; styles live with the component they style.
- Design tokens remain the single source of colour/spacing truth and keep driving light/dark automatically.
- Atomic boundaries stay intact: atoms own their visual variants; higher levels compose atoms and add layout utilities only.
- Pixel-equivalent look to today (within a few px), except the deliberate goal-card rearrangement.
- Goal editor and all panels satisfy the new `editor-layout` overflow requirement.

**Non-Goals:**
- Visual redesign, responsive/mobile layout, theme toggle.
- Any change to board SVG rendering, `theme.ts`, or PNG export.
- Scenario format changes — `schemaVersion` stays 1 (no data model touched, nothing to migrate).

## Decisions

### D1. Tailwind v4 with `@tailwindcss/vite`
Install `tailwindcss` and `@tailwindcss/vite`, add the plugin in `vite.config.ts`, and replace the `global.css` import in `main.tsx` with a single `web/src/ui/styles/app.css` entry:

```css
@import "tailwindcss";
@import "./tokens.css";
@theme { … }          /* D2 */
@layer base { … }     /* D5 */
```

*Alternatives:* Tailwind v3 (needs `tailwind.config.js` + PostCSS, JS config duplicates tokens); CSS Modules (rejected by the user in favour of Tailwind). v4 supports Vite 5, keeps configuration in CSS next to the tokens, and needs no content globs (automatic source detection).

### D2. Tokens stay as `:root` variables; `@theme inline` maps them
`tokens.css` is unchanged in values. Tailwind theme entries reference the variables:

```css
@theme inline {
  --color-bg: var(--bg);
  --color-panel: var(--panel);
  --color-panel-2: var(--panel-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-accent: var(--accent);
  --color-danger: var(--danger);
  --color-warning-bg: var(--warning-bg);
  --color-warning-text: var(--warning-text);
  --color-board: var(--board-bg);
  --color-side-a: var(--side-a);  --color-side-b: var(--side-b);  --color-neutral: var(--neutral);
  --color-highlight: var(--highlight-select);
  --radius-ui: var(--radius);
  --font-ui: var(--font-ui);  --font-mono: var(--font-mono);
}
```

`inline` makes utilities emit `var(--panel)` directly, so the existing `prefers-color-scheme: dark` override in `tokens.css` re-themes every utility with no `dark:` variants. Only tokens actually used by chrome are mapped; terrain/elevation tokens stay CSS variables because the board reads `theme.ts`.

*Alternative:* move values into `@theme` and redefine for dark with `@variant dark` — more churn and duplicates the dark block for no gain.

### D3. Class composition: `cn()` = `clsx` + `tailwind-merge`
Add `web/src/ui/cn.ts` exporting `cn(...inputs)` = `twMerge(clsx(inputs))`. It replaces the local `cls()` helpers. `tailwind-merge` resolves conflicts (`px-3` vs a parent's `px-1`) so a `className` passed by a parent always wins over an atom's defaults, which plain concatenation cannot guarantee (CSS order, not attribute order, decides). The custom theme names (`panel-2`, `side-a`, `rounded-ui`) are registered with `extendTailwindMerge` so they are recognised as colour/radius classes.

`cn.ts` is a UI-level utility with no React or application imports, so atoms may import it under the existing ESLint boundaries.

*Alternatives:* `class-variance-authority` — useful but an extra dependency for ~5 variant-bearing atoms; plain typed maps suffice (D4).

### D4. Atoms own variants via typed maps
Each variant-bearing atom keeps its current prop API and maps props to classes with `Record<Variant, string>` objects, e.g. `Button`'s `variant: 'default' | 'primary' | 'danger'`, `active`, `small`, and `IconButton`. Molecules/organisms do not restate an atom's look; they pass layout-only utilities (`ml-auto`, `w-16`, `min-w-0`) via `className`. Repeated chrome patterns at organism level (panel section heading, panel section box) become small molecules rather than copied class strings.

Prop APIs of atoms do not change, so organism call sites change only where they relied on BEM modifier classes.

### D5. Minimal global base layer
`@layer base` keeps only what cannot live on a component: `html, body, #root { height: 100% }`, body font/size/colour/background from tokens, `button/input/select/textarea { font: inherit; color: inherit }`, a token-coloured `:focus-visible` outline, and scrollbar colours. Preflight supplies `box-sizing` and margin resets. `global.css` is deleted.

### D6. Goal card layout
`GoalRow` becomes three stacked parts in a `flex flex-col gap-1.5 min-w-0` card:

```
┌ Goal 1 ───────────────── [↑][↓][🗑] ┐   header: flex justify-between
│ [ textarea, w-full, wraps          ] │
│ [3] VP  [End of each Phase      ▾]   │   meta: flex gap-1.5 min-w-0; select flex-1 min-w-0
└──────────────────────────────────────┘
```

Moving the three icon buttons to the header frees ~100px; `min-w-0` on the card and the select prevents min-content growth ever widening the panel again. Placed at molecule level (unchanged).

### D7. Layout template
`EditorLayout`'s three-column grid (`220px 1fr 320px`) becomes `grid grid-cols-[220px_minmax(0,1fr)_320px]` on the template, and side panels get `min-w-0 overflow-y-auto overflow-x-hidden`. Arbitrary values are allowed only in the template for these structural widths.

### D8. Class ordering and lint
Add `prettier-plugin-tailwindcss` to `.prettierrc.json` (with `tailwindStylesheet` pointing at `app.css`, and `tailwindFunctions: ["cn"]`). No ESLint Tailwind plugin in this change — the official one does not yet cover v4 well enough to be worth the dependency.

### D9. Verification selectors
Browser checks stop using BEM classes and select by role/label (`getByRole`, `getByLabel`). Where an element has no accessible name (pillar total, toolbar title), add a `data-testid`. Unit tests are unaffected (they don't reference classes).

## Risks / Trade-offs

- [Preflight resets headings, lists, buttons and inputs, so un-ported components look broken mid-migration] → Do the whole port in one change, bottom-up, and only judge visuals at the end; capture before/after screenshots at 1500×950 in light and dark to compare.
- [Subtle visual drift from rounding BEM px values to Tailwind's 4px spacing scale] → Use the nearest scale step; use arbitrary values only where a ≥2px difference is visible in the screenshot comparison.
- [Long class strings hurt readability in organisms] → D4: atoms/molecules own looks; organisms carry layout only; extract a molecule when a pattern repeats.
- [`tailwind-merge` doesn't know custom theme names and could drop a class] → Register them with `extendTailwindMerge` (D3) and cover with a small unit test of `cn()`.
- [Tailwind automatic source detection might scan `schema/` or `node_modules` via `fs.allow ..`] → v4 ignores `.gitignore`d paths; add `@source not` for anything unexpected if build output grows.
- [Bundle CSS size] → Tailwind emits only used utilities; expected to be smaller than or similar to today's `global.css`.

## Migration Plan

1. Install deps, add plugin and `app.css` alongside the old `global.css` (both imported briefly), map tokens, add `cn()`.
2. Port atoms → molecules → organisms → template → page, deleting each component's BEM rules from `global.css` as it is ported.
3. Delete `global.css`, remove its import, keep `tokens.css`.
4. Update browser checks to role/label/`data-testid`; run lint, typecheck, unit tests, build, and the screenshot comparison.

Rollback: revert the change's commits — no data or format is affected.

## Open Questions

- None blocking. If the screenshot comparison shows drift the user dislikes, adjust spacing in a follow-up rather than reintroducing global CSS.
