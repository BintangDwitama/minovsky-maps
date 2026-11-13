# Minovsky Maps

A scenario and map editor for the **Gundam Assemble** tabletop wargame. Design your own battlefields: board terrain, elevation, bases and carriers, garrisons, upgrades, objectives and goals. Then save them as files, export them as images, or share them as a link that opens a printable scenario sheet.

> **Unofficial fan project.** Not affiliated with or endorsed by Bandai, Bandai Namco, Sunrise or SUNRISE BEYOND. No official artwork, card scans or rulebook text are included. Game terms are used only to describe compatibility.

## Repository layout

| Path | What |
|---|---|
| `schema/` | Scenario JSON Schema: the shared contract for every app |
| `web/` | Browser editor (React + TypeScript + Vite) |
| `server/` | Go API for sharing scenarios (planned, Phase 2) |
| `openspec/` | Specs and change proposals |

## Running the editor

Requires Node.js 20+.

```sh
cd web
npm install
npm run dev        # start the editor at http://localhost:5173
npm test           # unit tests
npm run lint       # lint, including layer-boundary rules
npm run typecheck
npm run gen:types  # regenerate TS types from schema/
```

## Share links

**Share** in the editor copies a link like `https://<host>/#/view/1.<payload>`. The whole scenario is stored in the part after `#` (compressed), so nothing is uploaded and the host never receives it. Opening the link shows a read-only, printable scenario sheet with a setup checklist; **Edit a copy** opens it in the editor.

Links are permanent. The `1.` prefix is the link format version; never change how an existing version is decoded (`web/src/infrastructure/shareLinkGolden.test.ts` guards this).

## Deploying (Cloudflare Pages, free)

The web app is a static site. One-time setup by the repo owner:

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, and pick this repository.
2. Build settings:
   | Setting | Value |
   |---|---|
   | Framework preset | None |
   | Root directory | `web` |
   | Build command | `npm ci && npm run build` |
   | Build output directory | `dist` |
   | Production branch | `main` |

   Node is pinned by `web/.nvmrc`.
3. Name the project `minovsky-maps` to get `https://minovsky-maps.pages.dev`.

Every push to `main` deploys; other branches get their own preview address.

**Moving to a custom domain later:** keep the `pages.dev` project deployed with a one-page redirect that forwards the fragment, so links already shared keep working:

```html
<script>location.replace('https://<new-domain>/' + location.hash)</script>
```
