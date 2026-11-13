## ADDED Requirements

### Requirement: Bot check on publishing
When the server is configured with a Turnstile secret, `POST /api/scenarios` and `PUT /api/scenarios/{id}` SHALL require a Cloudflare Turnstile token and SHALL verify it with Cloudflare before storing anything; a missing or rejected token SHALL return HTTP 403 with a readable message and store nothing. The editor SHALL obtain the token when the user publishes or updates, without extra steps for most people. When no secret is configured, the server SHALL skip the check and log a warning at startup.

#### Scenario: Script without a token
- **WHEN** a client posts a valid scenario without a Turnstile token to a server configured with a secret
- **THEN** the API responds 403 and nothing is stored

#### Scenario: Person publishing
- **WHEN** a person clicks Publish in the editor
- **THEN** the bot check runs in the background and the scenario is published as before

### Requirement: My published scenarios
The editor SHALL offer a "My published scenarios" list of every scenario this browser holds an edit token for, newest first, each with its name, short link, and actions Open (its sheet), Edit (open in the editor with Update available), Copy link, and Forget (remove the edit token from this browser after confirming that it cannot be recovered without the private edit link). The list SHALL state that it is stored in this browser only, and SHALL say so plainly when it is empty.

#### Scenario: Find a scenario again
- **WHEN** the creator opens My published scenarios after publishing two scenarios
- **THEN** both are listed with their names and short links, and Edit opens the chosen one with Update available

#### Scenario: Forget a scenario
- **WHEN** the creator chooses Forget on a scenario and confirms
- **THEN** it disappears from the list and the editor no longer offers Update for it in this browser, while the published scenario itself stays online
