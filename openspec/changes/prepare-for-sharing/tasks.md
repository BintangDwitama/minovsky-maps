## 1. Server: bot check

- [x] 1.1 `BotCheck` interface in `httpapi`; `turnstile.Verifier` (siteverify, 5 s timeout, `remoteip`) with tests against a fake HTTP server; no-op check + startup warning when `TURNSTILE_SECRET` is unset
- [x] 1.2 Publish and update read `turnstileToken` from the body and verify it before validation/storage (403 on missing/invalid, 503 when Cloudflare is unreachable); handler tests

## 2. Server: reports

- [x] 2.1 Migration `0002_reports.sql`; Postgres repository methods (scenario name lookup, add report, mark emailed) with integration tests (run with `TEST_DATABASE_URL`)
- [x] 2.2 `internal/reports` service (validate reason/details, scenario must exist and not be taken down, store, then notify; notification failure logged, report kept) with memory-store tests
- [x] 2.3 `resend.Notifier` (Resend HTTP API, subject `[Minovsky Maps] Report: …`, plain-text body with short link and takedown SQL) with tests against a fake server; no-op notifier + warning when not configured
- [x] 2.4 `POST /api/reports` handler (rate limit, body cap, bot check, 400/403/404/413/429) with handler tests; wire everything in `main.go` (`TURNSTILE_SECRET`, `RESEND_API_KEY`, `REPORT_EMAIL`, `PUBLIC_APP_URL`)

## 3. Web: bot check

- [x] 3.1 `HumanCheck` port and `TurnstileBotCheck` adapter (lazy script load, invisible managed widget, fresh token per call, null without a site key); publish/update send `turnstileToken`; failure messages for blocked/unavailable checks

## 4. Web: reports

- [x] 4.1 `ScenarioPublisher.report` and HTTP adapter; `reportScenario` use case with tests
- [x] 4.2 `ReportDialog` organism (required reason, details with counter, Turnstile container, success/error states) and a Report button on published sheets only

## 5. Web: my published scenarios

- [x] 5.1 `PublicationStore.remove` (never throws) with tests
- [x] 5.2 `MyScenariosDialog` organism with Open / Edit / Copy link / Forget (confirm) and empty state; toolbar button

## 6. Docs and verification

- [x] 6.1 README: Turnstile, Resend and Gmail-filter setup; env variables for Vercel and Pages; local testing with Cloudflare's test keys
- [x] 6.2 Lint, typecheck, web and server tests, build pass
- [x] 6.3 Local end-to-end with Cloudflare test keys and a fake email endpoint: publish/update with token, scripted publish without token rejected, report stored and "emailed", My scenarios list (open, edit, forget)
- [x] 6.4 Re-run the Phase 1, share, publishing and analysis walkthroughs (no regressions)
- [ ] 6.5 Production check after the owner configures Turnstile and Resend: publish on the live site and receive a test report email
