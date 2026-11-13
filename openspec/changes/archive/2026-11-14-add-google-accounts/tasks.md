## 1. Database and stores

- [x] 1.1 Migration `0003_accounts.sql`: accounts, sessions, login_states, `scenarios.owner_id`, nullable `edit_token_hash`, `removed_reason`, owner index
- [x] 1.2 `accounts.Store` interface with memory and Postgres implementations: accounts (upsert by google_sub, rename, delete with a scenario takedown in one transaction), sessions (create, lookup unexpired, delete, delete expired), login states (create, use once)
- [x] 1.3 Publishing repository: create with owner, owner lookup, list owned with name and updated time, claim (match token hash, set owner, clear hash), owner delete with `removed_reason`; memory and Postgres, with tests against both

## 2. Accounts service and Google

- [x] 2.1 `IdentityProvider` interface; Google implementation with `x/oauth2` (PKCE S256) and `go-oidc` (signature, iss, aud, exp, nonce), requiring email_verified
- [x] 2.2 `accounts.Service`: StartLogin, FinishLogin (state single use, 10 minutes, return-path check), SessionAccount, SignOut, Rename (1–40 characters), Delete; tests with a fake provider (forged state, replayed callback, unverified email, expired session)
- [x] 2.3 Wire `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in main.go (sign-in endpoints answer 503 "sign-in not configured" when missing) and add them to devenv and `.env.local` docs

## 3. HTTP API

- [x] 3.1 `withAccount` middleware (`mm_session` cookie) and a `requireClient` header check for cookie-authenticated writes
- [x] 3.2 Auth routes: google start and callback (cookies, redirects), signout, GET/PATCH/DELETE /api/me; "auth" rate-limit bucket
- [x] 3.3 Publishing routes: POST needs a session (401 `signed-out`); PUT allows the owner or a legacy token on unclaimed scenarios (403 `not-owner`); DELETE by owner; GET adds ownerName and isOwner; /api/me/scenarios; /api/me/claim (at most 100 items)
- [x] 3.4 Handler tests: whole flows with a fake provider, the missing header, 401/403 paths, claim, delete, account deletion taking scenarios down, no email in any public response

## 4. Proxy

- [x] 4.1 Forward only the `mm_session` and `mm_login` cookies; keep several `Set-Cookie` headers; `redirect: 'manual'`, so 302s reach the browser
- [x] 4.2 Proxy tests for cookie filtering, Set-Cookie passthrough and redirects

## 5. Web: accounts

- [x] 5.1 `AccountService` port and HTTP adapter (client header, same-origin credentials); the publisher sends the client header and maps 401/403 to `signed-out` and `not-owner` failures
- [x] 5.2 `useAccount` context; toolbar "Sign in" button and account menu (My scenarios, Rename, Sign out, Delete account with confirmation, Privacy); compact Menu entries
- [x] 5.3 SignInDialog (from Publish when signed out) with "Sign in with Google" and "What we store"; `?signin=failed` message; "Signed in as X" message
- [x] 5.4 PrivacyPage at `#/privacy` (router and page), in our own words
- [x] 5.5 Claim on sign-in: send local tokens, remove the claimed ones, announce "N scenarios added to your account"; application-layer tests with fakes

## 6. Web: publishing and sheets

- [x] 6.1 Publish dialog: no private edit link for new publishes; owner note; Update for owned scenarios (`publication` carries `owned` instead of a token)
- [x] 6.2 My scenarios: signed-in mode from the server with Delete (confirmed); signed-out legacy mode with a sign-in invitation; tests
- [x] 6.3 Sheet: "by {ownerName}" with a verified mark (accessible label); Edit for the owner or a legacy token holder
- [x] 6.4 Update application tests (publishing.ts) for owner and legacy paths; the golden and conformance tests stay green

## 7. Docs and verification

- [x] 7.1 README: deploy section 6 (Google OAuth client, test users, publishing the consent screen, env vars, redirect URIs); takedown SQL sets `removed_reason`
- [x] 7.2 `go test ./...`, `go vet`, and web lint, typecheck, test and build pass; CI green
- [x] 7.3 Local end-to-end with the real Google client on localhost: sign in, claim, publish, update, delete, sign out, delete account
- [x] 7.4 After deploy: the same on pages.dev, plus a phone check (sign-in returns to the editor with the draft intact)
