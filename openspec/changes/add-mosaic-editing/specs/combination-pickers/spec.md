# Spec Delta

## ADDED Requirements

### Requirement: Edit row in the mosaic list
The mosaic list SHALL start with a pinned edit row, above the other pinned rows, with a pencil icon:
- "Edit mosaic", for a sandbox opened from a stored mosaic;
- "Edit a copy", for one opened from any other mosaic;
- "Save as mosaic", for a combination sandbox not opened from a mosaic, with a collection or "None".

A sandbox opened with a tile SHALL have no edit row. As a pinned row, it SHALL be kept by every filter and hidden while the search field has text.

#### Scenario: Unsaved combination
- **WHEN** a run link opens Flashcards with the laureates' collection and the user opens the mosaic list
- **THEN** the first row is "Save as mosaic", then the pinned "Unsaved combination" row

#### Scenario: Sample mosaic
- **WHEN** "Nobel laureates on the map" runs and the user opens the mosaic list
- **THEN** the first row is "Edit a copy"

#### Scenario: Tile link
- **WHEN** a run link opens the tile viewer with a tile and the user opens the mosaic list
- **THEN** the list has no edit row

### Requirement: Choosing the edit row
Choosing the edit row SHALL close the list and open the mosaic viewer in a new sandbox, in the mode its label says (see "Mosaic viewer modes from the link" in `default-mods`), and leave the current sandbox behind it, so back returns to it.

#### Scenario: Back to the mosaic
- **WHEN** "Nobel laureates on the map" runs and the user chooses "Edit a copy", then goes back
- **THEN** the country map runs "Nobel laureates on the map" again

### Requirement: Edit row links
The edit row SHALL open `#/run?mod=mosaic_viewer&target=<mosaic>&mode=edit` for "Edit mosaic", the same with `mode=copy` for "Edit a copy", and `#/run?mod=mosaic_viewer&mode=new&draft_mod=<mod>` for "Save as mosaic", with `draft_collection=<collection>` when the sandbox has one and `draft_sites=<sites>` when it was opened with `sites`. Each address SHALL be the resolved one.

#### Scenario: Save the combination
- **WHEN** the user chooses "Save as mosaic" in the mosaic list of Flashcards with the laureates' collection
- **THEN** the mosaic viewer runs with `mode=new`, `draft_mod` the flashcards mod file's address and `draft_collection` the collection file's address, and back returns to Flashcards

#### Scenario: Edit row on a phone
- **WHEN** the user opens the mosaic list on a 360×740 viewport
- **THEN** the edit row is as tall as the list's other rows and at least 32px, its label is not cut, and choosing it with a tap opens the viewer
