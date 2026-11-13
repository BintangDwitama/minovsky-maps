# scenario-reports Specification

## Purpose
Letting players report a published scenario, storing reports, and notifying the site owner by email without exposing their address.
## Requirements
### Requirement: Report a published scenario
The sheet of a published scenario (`/s/<id>`) SHALL offer a Report action that opens a form with a required reason (copies official material, offensive or inappropriate, spam, broken or unplayable, other) and optional details of up to 1,000 characters. Submitting SHALL send the report to `POST /api/reports` with the scenario id and, when configured, a Turnstile token, and SHALL confirm to the reporter that the report was received. Share links (`#/view/…`) SHALL NOT offer Report, as nothing is stored for them.

#### Scenario: Report a copied scenario
- **WHEN** a player reports `/s/k3x9mQ2a` with reason "copies official material" and details "This is the rulebook's starter scenario"
- **THEN** the form confirms the report was sent and closes

#### Scenario: Reason required
- **WHEN** a player submits the form without choosing a reason
- **THEN** the form asks for a reason and nothing is sent

### Requirement: Store and notify
The API SHALL store each accepted report (scenario id, reason, details, time) for an existing scenario and SHALL email the owner at the configured address with the scenario's short link, name, reason, details and the SQL line that takes the scenario down. Reports for unknown scenarios SHALL return 404. Email failures SHALL NOT lose the report: it SHALL stay stored and the failure SHALL be logged. When email is not configured, reports SHALL be stored without sending. The owner's address SHALL exist only in server configuration.

#### Scenario: Email sent
- **WHEN** a valid report arrives and email is configured
- **THEN** the report is stored and the owner receives an email whose subject starts with "[Minovsky Maps] Report:"

#### Scenario: Email service down
- **WHEN** a valid report arrives but the email service fails
- **THEN** the report is still stored, the reporter still sees success, and the server logs the failure

### Requirement: Report limits
Reports SHALL be subject to the bot check when configured, a per-IP rate limit, a 1,000-character limit on details, and the API's body size limit. Rejected reports SHALL return readable errors (400, 403, 413 or 429) and SHALL NOT be stored or emailed.

#### Scenario: Flood of reports
- **WHEN** one client sends more reports than the limit allows within a minute
- **THEN** further reports receive 429 until the window passes
