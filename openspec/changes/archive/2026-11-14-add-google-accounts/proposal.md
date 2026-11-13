## Why

Publishing works without accounts, but edit rights live in one browser:
- if the private edit link is lost, the scenario can't be changed again;
- "Author" is free text anyone can type;
- only the site owner can delete a published scenario, by running SQL.

Publishing is the social part of Minovsky Maps (short links shown to other players), so a published scenario should have a real owner. Later features (browse, likes, forks) also need to know who is who.

## What Changes

Touches **server**, **web** and the **Cloudflare proxy**; no change to the scenario format (`schema/`).

- **Sign in with Google** (the only sign-in method for now):
  - OpenID Connect with PKCE, state and nonce checks.
  - Only Google-verified email addresses are accepted.
  - The account stores the Google subject id, email (never shown publicly) and an editable display name.
  - Sessions are a secure HttpOnly cookie on the app's own address, 30-day expiry, revocable by signing out.
  - Users can rename themselves and delete their account.
- **Publishing requires sign-in:**
  - Publish, Update and Delete need a signed-in owner. When signed out, Publish prompts "Sign in with Google to publish" and returns to the editor afterwards; the draft is kept by autosave.
  - Save/Open file, Export PNG, Print, share links (`#/view/…`) and reports stay open to everyone.
- **Ownership replaces edit tokens for new scenarios** (**BREAKING** for the publish flow):
  - New publishes are owned by the account and get no private edit link.
  - Existing token-based scenarios keep working with their tokens until claimed.
- **Claiming:** after sign-in, scenarios this browser holds edit tokens for are claimed automatically ("3 scenarios added to your account"), and their local tokens are removed.
- **My scenarios:**
  - When signed in, the list comes from the server, so it is the same on every device.
  - Each scenario has Open, Edit, Copy link and **Delete** (confirmed; the scenario is taken down).
  - When signed out, the browser's legacy list is still shown, with a prompt to sign in.
- **Verified author:** sheets of owned scenarios show the owner's display name marked as verified. The free-text Author field is kept for unclaimed scenarios.
- **Privacy note page** (`#/privacy`): what we store and why. Google asks for one, and it is linked from the sign-in prompt.

## Capabilities

### New Capabilities
- `accounts`: Google sign-in, sessions, sign-out, display name, account deletion, privacy note.

### Modified Capabilities
- `scenario-publishing`:
  - publish requires sign-in and creates an owned scenario;
  - updates are by the owner, or with a legacy token;
  - edit tokens become legacy;
  - claiming;
  - owner delete;
  - My scenarios from the account.
- `scenario-sheet`: verified author on owned scenarios; Edit offered to the owner.

## Non-goals

- Email and password sign-in, or other providers such as GitHub or Discord. Both are possible later; email needs a sending domain first.
- Public profile pages, browsing, likes, forks, following.
- Cloud drafts ("save to my account"). Save stays a local file.
- An admin or moderation UI. Takedown by SQL stays as documented.
- Transferring ownership or co-editing.

## Impact

- **Server (Go):**
  - new `internal/accounts` (service and Google OIDC) and session middleware;
  - routes `/api/auth/google/start`, `/api/auth/google/callback`, `/api/auth/signout`, `/api/me` (GET/PATCH/DELETE), `/api/me/scenarios`, `/api/me/claim` and `DELETE /api/scenarios/{id}`;
  - `publishing` gains an owner;
  - migration `0003_accounts` (accounts, sessions, login states, `scenarios.owner_id`, nullable token hash, removal reason);
  - new dependencies `golang.org/x/oauth2` and `github.com/coreos/go-oidc/v3`;
  - new environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, set in Vercel only.
- **Proxy** (`web/functions/api/[[path]].ts`): forwards only our own cookies (`mm_session`, `mm_login`) and passes `Set-Cookie` back.
- **Web:**
  - an `AccountService` port and adapter;
  - a sign-in prompt and an account menu in the toolbar (in the Menu on phones);
  - publish flow changes and claim-on-sign-in;
  - My scenarios in two modes;
  - verified author on the sheet;
  - the privacy page.
- **Ops:** create the Google OAuth client (free, no card); README deploy section 6.
