## ADDED Requirements

### Requirement: Compact layout on small screens
When the viewport is narrower than 900 px, the editor SHALL use a compact layout that fills exactly the visible height without page scrolling, and contains:
- a single-row top bar with the brand mark, Undo, Redo, Share and a Menu holding New, Open, Save, Publish or Update, My scenarios and Export PNG;
- the board, filling the remaining height;
- the status (hex readout and hint, which may wrap rather than be cut off);
- a bottom tab bar with Tools and Scenario.
Choosing a tab SHALL open a drawer over the lower part of the screen, with the board still visible above it:
- **Tools** holds the tool palette and component palette;
- **Scenario** holds the analysis panel (when the Analyse tool is active), selection, warnings, pillar count and scenario settings.
Picking a tool or a component kind SHALL close the drawer. The board's size SHALL NOT change while editing (status text, selection and the drawer never resize it), so a hex stays under the finger. The tab bar SHALL show the current tool's name. The layout SHALL work from 360 px wide without horizontal scrolling. At 900 px and wider, the three-column layout SHALL be unchanged.

#### Scenario: Phone editor
- **WHEN** the editor is opened at 390 × 664
- **THEN** the page does not scroll, the top bar is one row, the board is at least 390 px wide and at least 400 px tall, and the Tools and Scenario tabs are at the bottom

#### Scenario: Switch tool on a phone
- **WHEN** the user opens the Tools tab and taps Raise +1
- **THEN** the drawer closes, the tab bar shows "Raise +1", and tapping a hex raises it

#### Scenario: Desktop unchanged
- **WHEN** the editor is opened at 1500 × 950
- **THEN** the tools, board and panels are shown in three columns as before

### Requirement: Selection bar on small screens
In the compact layout, while a component is selected, a selection bar SHALL appear over the top edge of the board, without resizing the board. It SHALL name the component and offer Rotate (carriers only), Remove, and Details, which opens the Scenario drawer at the selection.

#### Scenario: Remove on a phone
- **WHEN** the user selects a garrison in the compact layout and taps Remove in the selection bar
- **THEN** the garrison is removed and the selection bar disappears

### Requirement: Dialogs fit narrow screens
Every dialog SHALL fit within a 360 px wide viewport: no horizontal scrolling, and all actions reachable by scrolling the dialog vertically.

#### Scenario: Publish dialog on a phone
- **WHEN** the Publish dialog is opened at 360 × 640
- **THEN** the dialog's width is at most the viewport width and its action buttons can be reached
