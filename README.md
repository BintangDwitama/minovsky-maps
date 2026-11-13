# Minovsky Maps

A scenario and map editor for the **Gundam Assemble** tabletop wargame. Design your own battlefields: board terrain, elevation, bases and carriers, garrisons, upgrades, objectives and goals. Then save them as files, export them as images, share them as a link that opens a printable scenario sheet, or publish them to get a short link you can keep updating.

> **Unofficial fan project.** Not affiliated with or endorsed by Bandai, Bandai Namco, Sunrise or SUNRISE BEYOND. No official artwork, card scans or rulebook text are included. Game terms are used only to describe compatibility.

## Repository layout

| Path | What |
|---|---|
| `schema/` | Scenario JSON Schema: the shared contract. Also a tiny Go module that embeds it, plus `examples/` and `conformance.json`, which both test suites run |
| `web/` | Browser editor (React + TypeScript + Vite), plus the Cloudflare Pages Function that proxies `/api` |
| `server/` | Go publishing API (Postgres) |
| `openspec/` | Specs and change proposals |

## Running locally

Requires Node.js 20+ and Go 1.25+.

```sh
# editor
cd web
npm install
npm run dev        # http://localhost:5173 (proxies /api to localhost:8080)
npm test           # unit tests
npm run lint       # lint, including layer-boundary rules
npm run typecheck
npm run gen:types  # regenerate TS types from schema/

# publishing API (in another terminal)
cd server
go run ./cmd/api   # :8080; without DATABASE_URL it uses an in-memory store
go test ./...      # unit tests + the shared conformance suite
```

To run the API against a real database, create a `dev` branch in your Neon project and set `DATABASE_URL` to its connection string. Postgres integration tests run only when `TEST_DATABASE_URL` is set; point it at a throwaway branch, never production.

CI (`.github/workflows/ci.yml`) runs all web and server checks on every push.

## Share links

**Share** in the editor copies a link like `https://<host>/#/view/1.<payload>`. The whole scenario is stored in the part after `#` (compressed), so nothing is uploaded and the host never receives it. Opening the link shows a read-only, printable scenario sheet with a setup checklist; **Edit a copy** opens it in the editor.

Links are permanent. The `1.` prefix is the link format version; never change how an existing version is decoded (`web/src/infrastructure/shareLinkGolden.test.ts` guards this).

## Publishing

**Publish** sends the scenario to the API and gives a short link, `https://<host>/s/<id>`, that always shows the latest version. **Update** stores a new version behind the same link.

- There are no accounts. Publishing returns a secret edit token. The server stores only its hash; this browser remembers it, and a **private edit link** (`/s/<id>#edit=<token>`) is shown once so you can edit from another device. Anyone with that link can update the scenario.
- Every update is kept as a version; reads return the newest.
- The API validates with the same JSON Schema and integrity rules as the editor.

## Deploying (all free, no payment card)

```
browser ─▶ Cloudflare Pages (web/dist + Function /api/*) ─▶ Render (Go API) ─▶ Neon (Postgres)
```

### 1. Database: Neon

1. Sign up at **neon.com** (free plan) and create a project, e.g. `minovsky-maps`, in a region close to Render's (e.g. both in the US East or both in Frankfurt).
2. Copy the **pooled** connection string (Dashboard → Connect → "Pooled connection"). It looks like `postgresql://…-pooler…/neondb?sslmode=require`.
3. Optional: create a `dev` branch for local work.

The API creates its tables on startup.

### 2. API: Render

1. Sign up at **render.com** with GitHub (free; no card), then **New → Web Service** and pick this repository.
2. Settings:
   | Setting | Value |
   |---|---|
   | Language | Go |
   | Root directory | `server` |
   | Build command | `go build -o bin/api ./cmd/api` |
   | Start command | `./bin/api` |
   | Instance type | Free |
   | Health check path | `/api/health` |
3. Environment variable: `DATABASE_URL` = the Neon connection string.
4. Deploy, then open `https://<service>.onrender.com/api/health`; it should answer `{"status":"ok"}`.

Free Render services sleep after 15 minutes without traffic and take up to about a minute to wake. The app shows a "waking up" message meanwhile.

### 3. Web: Cloudflare Pages

1. **Workers & Pages → Create → Pages → Import an existing Git repository**, pick this repository. (Choose **Pages**, not Workers.)
2. Build settings:
   | Setting | Value |
   |---|---|
   | Framework preset | None |
   | Root directory | `web` |
   | Build command | `npm ci && npm run build` |
   | Build output directory | `dist` |
   | Production branch | `main` |
3. Environment variables: `NODE_VERSION` = `22`, and **`API_ORIGIN`** = your Render address, e.g. `https://minovsky-maps-api.onrender.com` (no trailing slash).
4. Name the project `minovsky-maps` to get `https://minovsky-maps.pages.dev`.

Every push to `main` deploys; other branches get their own preview address, and publishing works there too.

### Taking a scenario down

In Neon's SQL editor:

```sql
UPDATE scenarios SET taken_down_at = now() WHERE id = 'k3x9mQ2a';
```

It then reads as "not found" and can no longer be updated.

### Moving to a custom domain later

Keep the `pages.dev` project deployed with a one-page redirect that forwards the path and fragment, so links already shared keep working:

```html
<script>location.replace('https://<new-domain>' + location.pathname + location.hash)</script>
```
