## Why

The owner plans to spread published links beyond their playgroup. Today the only protection on the API is a per-instance rate limit and a size cap, players have no way to flag a bad scenario, and creators can only find their published scenarios again if they kept every link. These need to exist before links travel widely.

## What Changes

- **Bot check (Cloudflare Turnstile):** Publish, Update and Report require a Turnstile token, verified by the API with Cloudflare. Turnstile is free, usually invisible to people, and designed to be accessible (no picture puzzles).
- **Report a scenario:** published sheets get a **Report** action: a short form (reason, optional details) sent to the API, which stores it and emails the owner through Resend. The owner's address lives only in server settings; it never appears on the site.
- **My published scenarios:** a list, opened from the editor, of every scenario this browser can edit (name, short link, Open, Edit, Copy link, Forget), clearly labelled as stored in this browser only.
- **Safe defaults when not configured:** without Turnstile or email settings (local development, previews), the app keeps working: the check is skipped with a server warning and reports are stored without an email.

Sides touched: **web, server**. No scenario format change.

## Capabilities

### New Capabilities
- `scenario-reports`: reporting a published scenario, storing reports and notifying the owner by email.

### Modified Capabilities
- `scenario-publishing`: adds the bot check on publish and update, and the "My published scenarios" list. Existing requirements are unchanged.

## Non-goals

- No accounts, admin dashboard or in-app moderation queue (takedown stays a one-line SQL update).
- No automatic takedown from reports.
- No email to reporters; no reporter accounts or tracking.
- No Turnstile on reading scenarios (reads stay open and fast).
- Touch, mobile and keyboard accessibility are a separate change ("accessible everywhere").

## Impact

- **Server:** Turnstile verifier and email notifier behind small interfaces; `POST /api/reports`; migration `0002_reports.sql`; new env settings `TURNSTILE_SECRET`, `RESEND_API_KEY`, `REPORT_EMAIL`.
- **Web:** Turnstile widget loader (site key from the build setting `VITE_TURNSTILE_SITE_KEY`), Report dialog, My published scenarios dialog, `PublicationStore.remove`.
- **Owner setup (free, no card):** a Turnstile widget in the Cloudflare dashboard, a Resend account (sign in with GitHub or Google), environment variables on Vercel and Cloudflare Pages, and a Gmail filter on the report subject.
