## ADDED Requirements

### Requirement: Sign in with Google
The app SHALL offer "Sign in with Google" as its only sign-in method. Signing in SHALL use OpenID Connect with a fresh state, nonce and PKCE verifier per attempt, and the API SHALL verify the ID token's signature, issuer, audience, expiry and nonce. Only accounts whose Google email is verified SHALL be accepted. The first sign-in SHALL create an account holding the Google subject id, the email address and a display name (Google's name, shortened to 40 characters). Later sign-ins SHALL find the account by Google subject id. After signing in, the user SHALL return to the page they started from.

#### Scenario: First sign-in
- **WHEN** a person with a verified Google account signs in for the first time from the editor
- **THEN** an account is created with their Google name as display name, they return to the editor, and the toolbar shows that they are signed in

#### Scenario: Forged callback
- **WHEN** the callback arrives with a state that does not match the one stored for this browser
- **THEN** no account or session is created and the user sees that sign-in failed and can try again

#### Scenario: Unverified email
- **WHEN** Google reports the account's email as not verified
- **THEN** sign-in is refused with a readable message

### Requirement: Sessions
A successful sign-in SHALL create a session identified by a random token with at least 256 bits of entropy, of which the server stores only a SHA-256 hash. The token SHALL be sent only in a cookie that is `HttpOnly`, `Secure` and `SameSite=Lax`, limited to the `/api` path. Sessions SHALL expire after 30 days. Requests that change data using the session SHALL also carry the header `X-Minovsky-Client: web`, and SHALL be refused (HTTP 403) without it. The app SHALL reach the API on its own address, so no cross-origin access is allowed.

#### Scenario: Sign out
- **WHEN** a signed-in user chooses Sign out
- **THEN** the session is deleted on the server, the cookie is cleared, and the toolbar shows "Sign in"

#### Scenario: Expired session
- **WHEN** a request carries a session cookie older than 30 days
- **THEN** the API treats the request as signed out

#### Scenario: Cross-site request
- **WHEN** another site makes the browser send a publish request without the client header
- **THEN** the API responds 403 and nothing changes

### Requirement: Account details
`GET /api/me` SHALL return whether the request is signed in and, if so, the account's id and display name. A signed-in user SHALL be able to change their display name (1–40 characters after trimming). The email address SHALL never be returned by any endpoint other than to its owner, and SHALL never appear on sheets or in published data.

#### Scenario: Rename
- **WHEN** a signed-in user changes their display name to "Bintang"
- **THEN** sheets of their scenarios show "Bintang" as the verified author

### Requirement: Delete account
A signed-in user SHALL be able to delete their account after confirming. Deleting SHALL remove the account, its email address and all its sessions, and SHALL take down every scenario it owns.

#### Scenario: Delete account
- **WHEN** a user with two published scenarios deletes their account and confirms
- **THEN** both short links show "Scenario not found", and signing in with the same Google account later creates a new, empty account

### Requirement: Sign-in limits
Sign-in and account endpoints SHALL be rate-limited per client IP (HTTP 429 with a retry hint). Pending sign-in attempts SHALL expire after 10 minutes and SHALL be usable once.

#### Scenario: Replayed callback
- **WHEN** a completed sign-in callback URL is opened again
- **THEN** it is refused and no new session is created

### Requirement: Privacy note
The app SHALL have a privacy note page (`#/privacy`) stating what is stored (Google subject id, email, display name, published scenarios, sessions), that the email is never shown or shared, how to delete the account, and that reports store no personal data. The sign-in prompt SHALL link to it.

#### Scenario: Read before signing in
- **WHEN** a user opens the sign-in prompt and follows "What we store"
- **THEN** the privacy note is shown and the editor's draft is unaffected
