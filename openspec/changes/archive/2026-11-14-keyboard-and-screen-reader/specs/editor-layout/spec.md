## ADDED Requirements

### Requirement: Dialogs keep keyboard focus
An open dialog SHALL hold keyboard focus:
- keyboard focus SHALL move into it;
- Tab and Shift+Tab SHALL cycle through its controls without reaching the page behind it;
- Escape SHALL close it (for a busy dialog, Escape cancels the wait, like its Cancel button).
When the dialog closes, focus SHALL return to the control that opened it.

#### Scenario: Tab cycles in the dialog
- **WHEN** the Publish dialog is open and the user presses Tab past its last button
- **THEN** focus moves to the dialog's first control, not to the toolbar behind it

#### Scenario: Focus returns
- **WHEN** the user opens My scenarios from the toolbar and closes it with Escape
- **THEN** focus is back on the My scenarios button
