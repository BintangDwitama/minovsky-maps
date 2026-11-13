## Context

**Today:**
- The Go API is `net/http` 1.22 routing on Vercel, with `pgx` and Neon. It exposes publish, get, update (with an edit token in `Authorization`) and report.
- Publishing is `internal/publishing.Service` over a `Repository` interface, with memory and Postgres stores.
- Each scenario row is an id plus `edit_token_hash`.
- The SPA reaches the API only through the Cloudflare Pages Function at `/api/*`. That function strips all cookies today.
- The web layers use ports: `ScenarioPublisher` and `PublicationStore` (localStorage tokens).
- Turnstile guards writes, and per-IP token buckets limit them.

**Constraints:**
- Free hosting with no card.
- No email sending to users, since there is no domain.
- Secrets live only in Vercel.
- The personal GitHub identity is used for commits.

## Goals / Non-Goals

**Goals:**
- Google sign-in that a security review would accept: PKCE, state, nonce, and a verified ID token.
- Revocable server-side sessions.
- Ownership-based publishing.
- Moving existing token holders over without anything breaking.
- My scenarios on every device.
- Owners can delete their own scenarios and their account.

**Non-Goals:**
- Other sign-in providers.
- Email.
- Profiles.
- Cloud drafts.
- An admin UI.

## Decisions

### 1. Sign-in is built in Go with OpenID Connect, not a hosted service
- **Libraries:** `golang.org/x/oauth2` for the code exchange with PKCE (S256), and `github.com/coreos/go-oidc/v3` to verify Google's ID token (JWKS signature, `iss`, `aud`, `exp`, `nonce`). We require `email_verified`.
- **Scopes:** `openid email profile` only. These basic scopes need no Google app review.
- **Alternatives considered:**
  - Clerk, Auth0 or Neon Auth would each add a vendor account, which the user wanted to avoid.
  - Parsing the JWT by hand was rejected because of the risk of getting the verification subtly wrong.

### 2. The login flow, and where its state lives
```
GET /api/auth/google/start?return=/%23/
   → state, nonce, PKCE verifier (random) saved in login_states (hashed state as key, 10 min,
     single use) + cookie mm_login=<state> (HttpOnly, Secure, Lax, Path=/api, 10 min)
   → 302 to Google (state, nonce, code_challenge)
GET /api/auth/google/callback?code&state
   → state == cookie mm_login AND row exists, not expired, not used → mark used
   → exchange code (+verifier) → verify ID token (+nonce) → email_verified
   → upsert account by google_sub → create session → Set-Cookie mm_session
   → clear mm_login → 302 to the saved return path
```
- The return path must be a relative app path: it starts with `/` and not `//`, which prevents redirects to other sites.
- On failure, the callback redirects to `/#/?signin=failed` and the editor shows a message.
- Login state lives in the database rather than in a signed cookie, so no extra signing secret is needed and replays are impossible.

### 3. Sessions and protection against cross-site requests
- **Session token:** 32 random bytes in base64url, stored as a SHA-256 hash in `sessions(token_hash, account_id, created_at, expires_at)`, with a 30-day lifetime.
- **Cookie:** `mm_session` with `HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=2592000`.
- **Cross-site protection:**
  - `SameSite=Lax` already keeps the cookie off cross-site POST, PUT and DELETE requests.
  - In addition, every write authenticated by cookie must carry `X-Minovsky-Client: web`. A custom header can't be sent cross-site without a preflight, and we answer no CORS.
- **Middleware:** `withAccount` resolves the cookie into the request context, using an indexed lookup on the hash and treating expired sessions as signed out. Expired rows are deleted lazily on sign-in.
- **Local development:** `Secure` cookies work on `http://localhost`, which browsers treat as secure. The Vite dev proxy already forwards `/api` together with cookies.

### 4. Proxy forwards only our cookies
- `web/functions/api/[[path]].ts` keeps dropping every cookie except `mm_session` and `mm_login`: it rebuilds the `Cookie` header from those two only.
- Response headers already pass through. Several `Set-Cookie` headers are kept by copying `res.headers` with `getSetCookie()` support; this gets a test in `pagesProxy.test.ts`.
- Redirect responses (302) must reach the browser unchanged, so the proxy fetch uses `redirect: 'manual'`. That gets a test too.

### 5. Data model (migration 0003_accounts)
```sql
accounts(id bigserial PK, google_sub text UNIQUE NOT NULL, email text NOT NULL,
         display_name text NOT NULL, created_at timestamptz)
sessions(token_hash bytea PK, account_id bigint REFERENCES accounts ON DELETE CASCADE,
         created_at, expires_at)   -- index on account_id
login_states(state_hash bytea PK, nonce text, verifier text, return_to text,
             expires_at timestamptz, used_at timestamptz)
ALTER TABLE scenarios
  ADD owner_id bigint REFERENCES accounts ON DELETE SET NULL,
  ALTER edit_token_hash DROP NOT NULL,
  ADD removed_reason text CHECK (removed_reason IN ('moderation','owner','account-deleted'));
CREATE INDEX scenarios_owner ON scenarios (owner_id) WHERE taken_down_at IS NULL;
```
- **Account deletion:** in one transaction, set `taken_down_at` and `removed_reason='account-deleted'` on the account's scenarios, then delete the account. Sessions cascade, and `owner_id` becomes NULL. The emptied scenarios stay taken down, and their versions remain only for the moderation record.
- **Moderation takedown:** the existing README SQL sets `removed_reason='moderation'`. The README is updated accordingly.
- **Claiming:** set `owner_id` and clear `edit_token_hash`, so old private links stop working.

### 6. Service layer
- `internal/accounts.Service` handles `StartLogin`, `FinishLogin`, `SessionAccount`, `SignOut`, `Rename` and `Delete`, over a `Store` interface, with memory and Postgres implementations as for publishing.
- Google is behind an `IdentityProvider` interface, so tests use a fake provider and never contact Google.
- `publishing.Service` changes:
  - `Publish(ctx, ownerID, doc)`;
  - `Update(ctx, id, Credential{OwnerID | Token}, doc)`;
  - `Delete(ctx, id, ownerID)`;
  - `Claim(ctx, ownerID, []TokenClaim) []string`;
  - `ListOwned(ctx, ownerID)` returns id, name and updated time. The name comes from `doc->'meta'->>'name'` of the latest version.
- `Get` returns `OwnerName *string`, and an `IsOwner` flag computed in the handler from the session.

### 7. HTTP surface

| Method and path | Auth | Notes |
|---|---|---|
| `GET /api/auth/google/start` | none | rate-limited bucket "auth" |
| `GET /api/auth/google/callback` | `mm_login` cookie | |
| `POST /api/auth/signout` | session + header | always clears the cookie |
| `GET /api/me` | optional | `{signedIn, account?: {id, displayName}}` |
| `PATCH /api/me` | session + header | `{displayName}` |
| `DELETE /api/me` | session + header | account deletion |
| `GET /api/me/scenarios` | session | newest first |
| `POST /api/me/claim` | session + header | `{items: [{id, token}]}`, at most 100 |
| `POST /api/scenarios` | session + header + Turnstile | owner = session |
| `PUT /api/scenarios/{id}` | owner session + header, **or** legacy token (unclaimed only); Turnstile | |
| `DELETE /api/scenarios/{id}` | owner session + header | |

- Status codes are 401 when not signed in and 403 for the wrong owner or a missing header. Errors keep the existing JSON `{error, code, errors}` shape with codes `signed-out` and `not-owner`.

### 8. Web
- **Port** `AccountService`: `me()`, `signInUrl(returnPath)`, `signOut()`, `rename(name)`, `deleteAccount()`, `listOwned()`, `claim(items)`, `deleteScenario(id)`. The HTTP adapter sends the `X-Minovsky-Client` header on writes and uses `credentials: 'same-origin'`. `HttpScenarioPublisher` sends the header too.
- **Account state:** a small `useAccount()` context loads `/api/me` once, and again after sign-in, sign-out and rename. While it loads, the toolbar shows nothing extra.
- **Toolbar:**
  - Desktop: a "Sign in" button, or a menu named after the account with My scenarios, Rename, Sign out, Delete account and Privacy.
  - Compact: the same entries go into the existing Menu.
- **Publish flow:** when signed out, `SignInDialog` explains and offers "Sign in with Google" plus "What we store". It sets `location.href = signInUrl(currentHash)`. Autosave already keeps the draft.
- **Messages:**
  - After the return, `?signin=failed` shows an error.
  - After a successful sign-in, a status message says "Signed in as X", then the claim result follows if there was one.
- **Claim:** once per page load, when signed in and the `PublicationStore` has entries, call `claim`. Claimed ids are removed locally and the rest are kept, for example someone else's legacy link this browser opened.
- **My scenarios:**
  - Signed in: `listOwned()` with Delete.
  - Signed out: the current local list plus a sign-in invitation.
- **Sheet:**
  - Uses `ownerName` and `isOwner` from the read response.
  - `SheetHeader` shows "by {ownerName}" with a verified icon and an accessible label "verified owner".
  - Edit is shown when `isOwner` is true or a legacy token exists.
- **Privacy page:** a `#/privacy` route renders a static `PrivacyPage` in our own words, linked from the sign-in dialog and the account menu.

### 9. Rate limits, Turnstile, logging
- **"auth" bucket:** 10 requests per minute per IP across start, callback, signout and /me writes.
- **Turnstile:** stays on publish and update as specified. Sign-in relies on Google.
- **Logging:** never log tokens, codes or emails. Log account ids only.

## Risks / Trade-offs

- **[Risk] The proxy loses `Set-Cookie` or follows the 302 itself.** → Proxy unit tests for both cases. The end-to-end check covers it on a preview deploy before merging.
- **[Risk] Google consent screen in "testing" mode** lets only listed test users sign in. → The README tells you to add yourself as a test user first, then publish the app (basic scopes need no review) before sharing.
- **[Risk] Existing links break.** → Legacy tokens keep working until claimed. Reads are unchanged. Only new publishes need sign-in.
- **[Trade-off] Sign-in is required to publish,** which adds friction to sharing. This is accepted by product choice. Share links stay open to everyone.
- **[Risk] Account deletion takes down scenarios other people bookmarked.** → Deletion is explicit, with a confirmation that says so.
- **[Risk] Session theft through XSS.** → The cookie is HttpOnly, the SPA renders no HTML from users, and our CSP is unchanged. Sessions are revocable by signing out, and account deletion clears all of them.

## Migration Plan

1. Deploy the server with migration `0003`. It is additive: existing rows get `owner_id NULL` and keep their token hashes, and old clients keep working.
2. Create the Google OAuth client:
   - redirect URIs `https://minovsky-maps.pages.dev/api/auth/google/callback` and `http://localhost:5173/api/auth/google/callback`;
   - set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel and in `.env.local` for development.
3. Deploy the proxy and web together through Pages.
4. **Rollback:** redeploy the previous Pages and Vercel builds. The migration can stay, because its columns are nullable and old code ignores them.

## Open Questions

- The exact wording of the privacy note will be reviewed by you before archive.
- Whether to add GitHub sign-in later. It doesn't affect this design.
