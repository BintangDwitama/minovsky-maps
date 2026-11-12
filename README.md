# Minovsky Maps

A scenario and map editor for the **Gundam Assemble** tabletop wargame. Design your own battlefields: board terrain, elevation, bases and carriers, garrisons, upgrades, objectives and goals. Then save them as files or export them as images.

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
