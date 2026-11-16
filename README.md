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

Signing in locally uses the real Google client when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set (add `http://localhost:5173/api/auth/google/callback` as a redirect URI, see deploy step 6). For quick tests without Google, run the API with `DEV_FAKE_SIGNIN=1` and **no** `DATABASE_URL` (e.g. from a folder outside the repo, so `.env.local` isn't read): everyone signs in as a test user. It refuses to work with a database.

To run the API against a real database, use the Neon CLI from the repo root:

```sh
npm i -g neon@latest
neon login
neon init --org-id <org> --project-id <project>   # links the repo (.neon), writes .env.local
neon checkout dev --create                        # a dev branch; .env.local now points at it
```

The server reads unset variables from `.env.local` automatically when run locally, so `go run ./cmd/api` uses the dev branch. `.env.local`, `.neon` and Neon's root `package.json`/`neon.ts` are git-ignored. The dev branch expires after 7 days (see `neon.ts`); run `neon checkout dev --create` again to get a fresh one.

Postgres integration tests run only when `TEST_DATABASE_URL` is set; point it at the dev branch, never production.

CI (`.github/workflows/ci.yml`) runs all web and server checks on every push.

## Share links

The site opens on a **landing page** at `/`; the editor lives at `/editor`, Browse at `/browse` and My scenarios (your browser's draft plus your saved scenarios) at `/my`. Older `/#/…` links still work.

**Share** in the editor copies a link like `https://<host>/#/view/1.<payload>`. The whole scenario is stored in the part after `#` (compressed), so nothing is uploaded and the host never receives it. Opening the link shows a read-only, printable scenario sheet with a setup checklist; **Edit a copy** opens it in the editor.

Links are permanent. The `1.` prefix is the link format version; never change how an existing version is decoded (`web/src/infrastructure/shareLinkGolden.test.ts` guards this).

## Publishing

**Save online** sends the scenario to the API and gives it a short link, `https://<host>/s/<id>`, that always shows the latest version. **Update online** stores a new version behind the same link.

- Each saved scenario has a **visibility**, chosen when saving and changeable any time (in the save dialog, My scenarios, or the owner's banner on the sheet) without changing the link:
  | Visibility | Who can open the link | Listed in Browse |
  |---|---|---|
  | **Only me** (`private`, the default for new saves) | only the owner; everyone else gets "not found" (reports too) | no |
  | **Anyone with the link** (`link`; every scenario saved before visibility existed) | anyone | no |
  | **Everyone** (`public`) | anyone | yes |
- **Browse** (`/browse`) lists Everyone scenarios for anyone, signed in or not: search (name, description, author), filters (board size, deployment, squad size, elevation), newest or recently updated first, 24 per page. Filters live in the address, so a filtered view can be shared. Thumbnails are drawn in the browser from the scenario. The server stores a few searchable facts per scenario (`name`, `board_width`, `deployment`, …) on every save; older rows are filled in by a background backfill at startup.
- Saving online needs **Sign in with Google** (the only sign-in method). Saving files and share links never do. The scenario belongs to the account; its sheet shows the account's display name as a verified author. The email address is stored but never shown.
- The session is an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (`mm_session`, path `/api`, 30 days). Changes made with it must also carry the header `X-Minovsky-Client: web`.
- Scenarios published before accounts existed were updated with a secret **edit token** (private edit link `/s/<id>#edit=<token>`). Those links keep working until the scenario is claimed: signing in claims every scenario the browser holds a token for, after which the old token stops working.
- Every update is kept as a version; reads return the newest.
- The API validates with the same JSON Schema and integrity rules as the editor.
- **My scenarios** lists the account's scenarios on any device (Open, Edit, Copy link, Delete). Signed out, it lists the browser's pre-account scenarios instead.
- Users can rename themselves and delete their account (which takes their scenarios offline) from the account menu. `#/privacy` explains what is stored.
- Save online, Update online and **Report** are protected by Cloudflare Turnstile (a free, mostly invisible bot check). Reports from the **Report** button on a published sheet are stored and emailed to the site owner.

## Deploying (all free, no payment card)

```
browser ─▶ Cloudflare Pages (web/dist + Function /api/*) ─▶ Vercel (Go API, sin1) ─▶ Neon (Postgres, Singapore)
```

### 1. Database: Neon

1. Sign up at **neon.com** (free plan) and create a project. This project's database is in `aws-ap-southeast-1` (Singapore), so the API runs in Vercel's `sin1` region next to it (`server/vercel.json`).
2. Copy the **production** branch's **pooled** connection string (Dashboard → Connect → "Pooled connection"). It looks like `postgresql://…-pooler…/neondb?sslmode=require`. Don't use `.env.local`; locally that points at the `dev` branch.

The API creates its tables on startup.

### 2. API: Vercel (Hobby plan, free, no card)

1. Sign up at **vercel.com** with GitHub, then **Add New → Project** and import this repository.
2. Settings:
   | Setting | Value |
   |---|---|
   | Root Directory | `server` |
   | Include files outside the root directory in the Build Step | **on** (the server embeds `../schema`) |
   | Framework Preset | Go (from `server/vercel.json`) |
   | Build / Output settings | leave default (builds `cmd/api`, which listens on `$PORT`) |
3. Environment variable: `DATABASE_URL` = the Neon production pooled connection string.
4. Deploy, then open `https://<project>.vercel.app/api/health`; it should answer `{"status":"ok"}`.

Vercel's Go runtime is in beta; it runs our ordinary `net/http` server, so moving to another host later needs no code changes.

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
3. Environment variables: `NODE_VERSION` = `22`, and **`API_ORIGIN`** = your Vercel API address, e.g. `https://minovsky-maps-api.vercel.app` (no trailing slash).
4. Name the project `minovsky-maps` to get `https://minovsky-maps.pages.dev`.

Every push to `main` deploys; other branches get their own preview address, and publishing works there too.

### 4. Bot check: Cloudflare Turnstile (free)

1. Cloudflare dashboard → **Turnstile** → **Add widget**. Name it `minovsky-maps`, add the hostname `minovsky-maps.pages.dev` (and `localhost` if you want to test locally), widget mode **Managed**.
2. Copy the **Site key** → Cloudflare Pages → Settings → Variables: `VITE_TURNSTILE_SITE_KEY` (used at build time, so redeploy Pages afterwards).
3. Copy the **Secret key** → Vercel → Settings → Environment Variables: `TURNSTILE_SECRET` (then redeploy).

Without these, publishing still works but isn't bot-checked (the server logs a warning). For local testing, Cloudflare's documented test keys work: site key `1x00000000000000000000BB` (always passes, invisible) with secret `1x0000000000000000000000000000000AA`.

### 5. Report emails: Resend (free, no domain needed)

1. Sign up at **resend.com** (GitHub or Google sign-in is fine) using the email address that should receive reports.
2. **API Keys** → create a key with "Sending access".
3. Vercel → Environment Variables:
   | Variable | Value |
   |---|---|
   | `RESEND_API_KEY` | the key |
   | `REPORT_EMAIL` | the same address you signed up to Resend with (Resend's shared sender may only deliver to it) |
   | `PUBLIC_APP_URL` | `https://minovsky-maps.pages.dev` |
4. Redeploy Vercel. Optional Gmail filter: *Subject contains* `[Minovsky Maps] Report:` → apply a label such as "Minovsky reports".

Your address only lives in Vercel's settings; it never appears on the site. Without these settings, reports are still stored in the `reports` table but not emailed:

```sql
SELECT r.created_at, r.scenario_id, r.reason, r.details FROM reports r ORDER BY r.created_at DESC;
```

### 6. Sign in with Google (free, no card)

1. Go to **console.cloud.google.com**, create a project (e.g. `minovsky-maps`). No billing account is needed.
2. **APIs & Services → OAuth consent screen**: user type **External**; app name `Minovsky Maps`; your email as support and developer contact; app home page `https://minovsky-maps.pages.dev`; privacy policy `https://minovsky-maps.pages.dev/#/privacy`. Scopes: only `openid`, `email` and `profile` (the defaults), which need no Google review.
3. While the app is in **Testing**, only listed **test users** can sign in: add your own Google address there first.
4. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Authorized redirect URIs:
   - `https://minovsky-maps.pages.dev/api/auth/google/callback`
   - `http://localhost:5173/api/auth/google/callback` (local development)
5. Vercel → Environment Variables: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from that client (and keep `PUBLIC_APP_URL` = `https://minovsky-maps.pages.dev`; the redirect is built from it). Redeploy Vercel.
6. Try it on the site. When it works, go back to the consent screen and **Publish app** so anyone can sign in (for these basic scopes this needs no verification).

For local development put the same two variables in `.env.local` (git-ignored). Without them, the API logs a warning and nobody can publish.

### Taking a scenario down

In Neon's SQL editor:

```sql
UPDATE scenarios SET taken_down_at = now(), removed_reason = 'moderation' WHERE id = 'k3x9mQ2a';
```

It then reads as "not found" and can no longer be updated. Owners deleting their own scenarios are recorded with `removed_reason = 'owner'`, and deleted accounts with `'account-deleted'`.

### Moving to a custom domain later

Keep the `pages.dev` project deployed with a one-page redirect that forwards the path and fragment, so links already shared keep working:

```html
<script>location.replace('https://<new-domain>' + location.pathname + location.hash)</script>
```

Also update the link-preview tags in `web/index.html` (`og:url` and `og:image` hold the absolute `pages.dev` address) and the Google OAuth redirect URI. The preview image `web/public/og-image.png` is our own board rendering; regenerate it if the hero board changes.
