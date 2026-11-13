## Why

All editor styling lives in one global stylesheet (`web/src/ui/styles/global.css`, ~430 lines, ~70 BEM classes) that is disconnected from the atomic components it styles. Nothing ties a component to its rules, class names can collide silently, and layout bugs are hard to trace — the goal editor's controls row currently overflows the 320px right panel, clipping the remove button and adding a horizontal scrollbar. Phase 2 adds several new pages (browse, profile, share), so the styling approach should be fixed before the UI grows.

## What Changes

- Adopt **Tailwind CSS v4** in `web/` via the official `@tailwindcss/vite` plugin (CSS-first config, no `tailwind.config.js` / PostCSS file).
- Keep the existing design tokens in `tokens.css` (`:root` custom properties, including the `prefers-color-scheme: dark` overrides) and expose them to Tailwind through `@theme`, so utilities like `bg-panel-2`, `text-side-a`, `border-border` resolve to the same values and dark mode keeps working without `dark:` variants.
- Port every UI component (atoms → molecules → organisms → template → page) from BEM classes to Tailwind utilities co-located in the component.
- Atoms own their variants through typed variant maps; class composition uses `clsx` + `tailwind-merge` so a `className` override from a parent reliably wins over an atom's defaults.
- Reduce global CSS to a small `@layer base` (body font/background, focus-visible ring, scrollbars, `color-scheme`). **Remove** `global.css` and all BEM class names.
- Fix the goal editor overflow: move the reorder/remove buttons into the goal card header and make the card unable to grow wider than its panel.
- Add `prettier-plugin-tailwindcss` for deterministic class ordering.
- Browser verification scripts select by role/label (or `data-testid` where no accessible name exists) instead of BEM class names.

Sides touched: **web only**. No schema or server changes.

## Capabilities

### New Capabilities
- `editor-layout`: The editor's panels fit their content at the default desktop layout — no editor panel shows horizontal overflow or clips controls, and the UI follows the system light/dark preference.

### Modified Capabilities
- `scenario-settings`: The "Edit goals" requirement gains the guarantee that each goal's text, VP, scoring and reorder/remove controls are fully visible within the panel.

## Non-goals

- No visual redesign: colours, spacing and layout proportions stay as they are today (apart from the goal card header rearrangement).
- No changes to the board SVG, glyphs or PNG export — they take colours from `theme.ts` as inline attributes and are not affected.
- No responsive/mobile layout, no theme switcher, no new components.
- No Phase 2 work (server, auth, sharing).
- No `schemaVersion` change; scenario files are untouched.

## Impact

- **Code:** every file under `web/src/ui/` that sets `className`; `web/src/ui/styles/` (global.css removed, tokens.css gains `@theme`); `web/src/main.tsx` (stylesheet import); `web/vite.config.ts` (plugin).
- **Dependencies (web dev/runtime):** `tailwindcss`, `@tailwindcss/vite`, `tailwind-merge`, `clsx`, `prettier-plugin-tailwindcss`.
- **Tooling:** Prettier config gains the Tailwind plugin; lint/typecheck/test/build scripts unchanged.
- **Tests:** domain/application unit tests unaffected (no class-name coupling); browser checks updated to role/label selectors.
- **Risk:** Tailwind's Preflight reset changes default element styles, so the UI looks partly wrong until the port is complete — mitigated by doing the migration in one change and comparing before/after screenshots.
