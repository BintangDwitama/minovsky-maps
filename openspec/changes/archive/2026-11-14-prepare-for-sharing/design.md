## Context

Publishing is live: Cloudflare Pages (SPA + `/api/*` proxy Function) → Vercel (Go `net/http` API, region sin1) → Neon Postgres. The API has a per-IP token bucket (per instance), a 64 KB body cap and an edit-token model. Edit tokens live in the browser's `PublicationStore` (localStorage). There is no way to report a scenario or to list what this browser published. Hosting must stay free and card-free; the owner doesn't want to create a new email account.

## Goals / Non-Goals

**Goals:** stop scripted abuse of write endpoints; let anyone report a published scenario; notify the owner by email without exposing their address; let creators find their scenarios again; keep local development and previews working with nothing configured.

**Non-Goals:** accounts, moderation UI, automatic takedown, protecting reads, touch/keyboard accessibility (separate change).

## Decisions

### D1. Cloudflare Turnstile
- **Server:** interface `BotCheck { Verify(ctx, token, ip) error }` (consumer-defined in `httpapi`). Implementation `turnstile.Verifier` POSTs `secret`, `response`, `remoteip` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` (5 s timeout) and requires `success: true`. With no `TURNSTILE_SECRET`, `main` wires a no-op check and logs a warning.
- **Transport:** the token travels in the JSON body as `turnstileToken` (alongside `scenario`), so the proxy needs no changes. Missing/invalid → 403 `"Could not confirm you're a person. Please try again."`; Cloudflare unreachable → 503 (fail closed: no write without a check when one is configured).
- **Web:** site key from `VITE_TURNSTILE_SITE_KEY` (public, baked in at build). A small adapter `TurnstileBotCheck` (port `HumanCheck { token(): Promise<string | null> }`) loads `https://challenges.cloudflare.com/turnstile/v0/api.js` on first use and renders an **invisible/managed** widget in a hidden container with `execution: 'execute'`; `token()` executes it and resolves with a fresh token (Turnstile tokens are single-use). If Cloudflare shows an interactive challenge, the widget container becomes visible inside the dialog. With no site key, `token()` resolves null and nothing is sent.
- **Testing:** Cloudflare's documented test keys (always-pass / always-fail site keys and secrets) for local runs and e2e; unit tests use a fake `BotCheck`.

### D2. Reports
- **API:** `POST /api/reports` `{ scenarioId, reason, details?, turnstileToken? }`. `reason ∈ {official-copy, offensive, spam, broken, other}`; `details` ≤ 1,000 chars (trimmed). Order: rate limit (same limiter as writes, separate bucket key prefix `report:`), body cap, bot check, validation, scenario must exist and not be taken down (404 otherwise), store, then notify.
- **Storage:** migration `0002_reports.sql`:
  ```sql
  CREATE TABLE reports (
    id          bigserial PRIMARY KEY,
    scenario_id text NOT NULL REFERENCES scenarios (id),
    reason      text NOT NULL,
    details     text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    emailed_at  timestamptz
  );
  ```
  No IP or personal data stored.
- **Service:** new `internal/reports` package (`Service.Report(ctx, input) error`) depending on `Repository` (`ScenarioName(ctx, id)`, `AddReport`, `MarkEmailed`) and `Notifier` interfaces. Store first, then notify; notification failure is logged and `emailed_at` stays null.
- **Email:** `Notifier` implementation `resend.Notifier` POSTs to `https://api.resend.com/emails` with `Authorization: Bearer $RESEND_API_KEY`, `from: "Minovsky Maps <onboarding@resend.dev>"`, `to: $REPORT_EMAIL`, subject `[Minovsky Maps] Report: <reason> — <scenario name>`, plain-text body with short link, reason, details, report time and the takedown SQL. Resend's shared sender only delivers to the account owner's own address, which is exactly the use case, so no domain is needed. Missing key or address → no-op notifier with a startup warning. Short-link base from `PUBLIC_APP_URL` (e.g. `https://minovsky-maps.pages.dev`).
- **Privacy:** `REPORT_EMAIL` exists only in Vercel's environment; never in code, docs or responses.

### D3. Web: Report dialog
- Organism `ReportDialog`: reason radio group (required), details textarea with live count (max 1,000), hidden Turnstile container, Send / Cancel; success state "Thanks — the creator of Minovsky Maps has been notified."; error states mapped like publishing failures.
- `PublishedSheetPage` adds a **Report** frame button (flag icon) for `/s/<id>` only; `SheetPage` (share links) does not.
- Port `ScenarioPublisher` gains `report(input, opts)`; `HttpScenarioPublisher` implements it. Publish/update requests carry `turnstileToken` from `HumanCheck`.

### D4. Web: My published scenarios
- `PublicationStore` gains `remove(id)` (never throws).
- Organism `MyScenariosDialog` opened from a toolbar button ("My scenarios", list icon): rows from `PublicationStore.list()` (newest first, as stored), each with name (or "Untitled" when the name is unknown), short link, **Open** (`/s/<id>`), **Edit** (`#/edit-published/<id>`, guarded by the editor's unsaved-work prompt via the existing route), **Copy link**, **Forget** (confirm: "You'll lose the ability to update it from this browser unless you saved its private edit link. The scenario stays online.").
- Empty state: "Scenarios you publish from this browser appear here."

### D5. Owner setup (documented in README)
1. Cloudflare dashboard → Turnstile → Add widget: hostnames `minovsky-maps.pages.dev` (+ `localhost` for testing), mode Managed. Site key → Pages build env `VITE_TURNSTILE_SITE_KEY`; secret → Vercel `TURNSTILE_SECRET`.
2. Resend: sign up (GitHub/Google), create an API key → Vercel `RESEND_API_KEY`; Vercel `REPORT_EMAIL` = the Resend account's email; Vercel `PUBLIC_APP_URL`.
3. Gmail filter: subject contains `[Minovsky Maps] Report:` → label "Minovsky reports".

## Risks / Trade-offs

- [Turnstile script blocked by an ad-blocker or offline] → publishing then fails with a clear message ("the bot check couldn't load"); reading and editing are unaffected.
- [Cloudflare siteverify outage] → writes fail closed with 503 (no unchecked writes); reads unaffected.
- [Resend free-tier or shared-sender terms change] → reports are always stored; switching provider is one notifier implementation.
- [Report spam] → Turnstile + per-IP limit; reports never take anything down automatically.
- [Rate limit is per Vercel instance] → Turnstile carries most of the protection; acceptable.

## Migration Plan

Deploy order: server first (migration 0002 runs at startup; with no settings it behaves as today), then web. Configure Turnstile and Resend in the dashboards, set env vars, redeploy both. Rollback: revert; the `reports` table is harmless if left.

## Open Questions

None.
