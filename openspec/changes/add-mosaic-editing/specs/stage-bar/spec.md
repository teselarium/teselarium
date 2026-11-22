# Spec Delta

## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold the sandbox's title, as capsules for a combination sandbox (see "Combination capsules") or as a plain title otherwise, then the sites chip when the sandbox has one (see "Sites chip"), then the edit button when the sandbox has one (see "Edit button"), then the "More actions" button. On a wide bar (see "The bar folds as it narrows"), its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. On a narrow bar, its right side SHALL hold the messages button and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** a mod opened from a run link runs with a collection
- **THEN** the stage bar shows, from left to right, the mod capsule, the collection capsule, the mosaic capsule, the edit button, the "More actions" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** the mod viewer, which the catalog does not list, runs from a run link without a collection
- **THEN** the stage bar shows the mod's name and version as a plain title, then the "More actions" button, and its other items keep their order

#### Scenario: Close button last
- **WHEN** a mod opened from a run link runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

#### Scenario: Home mod without a close button
- **WHEN** a home mod is shown at `#/`
- **THEN** the fullscreen button is the stage bar's rightmost item, and no separator follows it

#### Scenario: Phone
- **WHEN** a mod opened from a run link runs on a 360×740 viewport
- **THEN** the stage bar's right side holds the messages button, a separator and the close button, in that order
- **AND** the page cannot scroll sideways and the close button is fully inside the viewport

## ADDED Requirements

### Requirement: Edit button
A combination sandbox SHALL have an edit button with a pencil icon, whose accessible name and tooltip say what it does:
- "Edit mosaic", for a sandbox opened from a stored mosaic;
- "Edit a copy", for one opened from any other mosaic;
- "Edit as a new mosaic", for a sandbox not opened from a mosaic, with a collection or "None".

The button SHALL stay on the bar at every width, wide or narrow.

#### Scenario: Unsaved combination
- **WHEN** a run link opens Flashcards with the laureates' collection
- **THEN** the stage bar has a button named "Edit as a new mosaic" between the mosaic capsule and the "More actions" button

#### Scenario: Sample mosaic
- **WHEN** "Nobel laureates on the map" runs
- **THEN** the stage bar has a button named "Edit a copy"

### Requirement: Sandboxes without an edit button
A sandbox opened with a tile, and a sandbox shown with a plain title (see "Combination sandboxes"), SHALL have no edit button.

#### Scenario: Tile link
- **WHEN** a run link opens the tile viewer with a tile
- **THEN** the stage bar has no edit button

#### Scenario: Plain title
- **WHEN** the mod viewer runs from a run link without a collection
- **THEN** the stage bar has no edit button

### Requirement: Choosing the edit button
Choosing the edit button SHALL open the mosaic viewer in a new sandbox, in the mode its name says (see "Mosaic viewer modes from the link" in `default-mods`), and leave the current sandbox behind it, so back returns to it.

#### Scenario: Back to the mosaic
- **WHEN** "Nobel laureates on the map" runs and the user chooses "Edit a copy", then goes back
- **THEN** the country map runs "Nobel laureates on the map" again

### Requirement: Edit button links
The edit button SHALL open `#/run?mod=mosaic_viewer&target=<mosaic>&mode=edit` for "Edit mosaic", the same with `mode=copy` for "Edit a copy", and `#/run?mod=mosaic_viewer&mode=new&draft_mod=<mod>` for "Edit as a new mosaic", with `draft_collection=<collection>` when the sandbox has one and `draft_sites=<sites>` when it was opened with `sites`. Each address SHALL be the resolved one.

#### Scenario: Edit the combination
- **WHEN** the user chooses "Edit as a new mosaic" in the stage bar of Flashcards with the laureates' collection
- **THEN** the mosaic viewer runs in edit mode with `mode=new`, `draft_mod` the flashcards mod file's address and `draft_collection` the collection file's address, and nothing is stored until the user saves
- **AND** back returns to Flashcards

#### Scenario: Edit button on a phone
- **WHEN** an unsaved combination runs on a 360×740 viewport
- **THEN** the edit button is at least 32px, fully inside the stage bar, and the capsule is still at least 120px wide
- **AND** choosing the button with a tap opens the viewer
