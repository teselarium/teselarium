# user-catalog Specification

## Purpose

Lets users keep mosaics of their own next to what the instance offers: mosaics imported from their files and stored in the browser, and remote mosaics added by URL, with where each came from, and the flows that bring them in, update them, export them and remove them.

## Requirements

### Requirement: User catalog entries
The user catalog SHALL hold mosaic entries in order of addition. Each entry SHALL be either stored, with the `opentesela-browser:` address of its file, or remote, with the `http:` or `https:` address of its mosaic file. Two entries SHALL NOT have the same address. The user catalog SHALL be kept in the browser with the browser files store, and restored when the app opens.

#### Scenario: Stored and remote entries
- **WHEN** the user imports `nobel_map.yaml` and then adds `https://mosaics.example.net/maps/laureates.yml` by URL
- **THEN** the user catalog holds the stored mosaic, then the remote one

#### Scenario: Kept after a reload
- **WHEN** the user added a mosaic by URL and reloads the app page
- **THEN** the mosaic is still in the catalog, marked as listed by the user and remote

### Requirement: Provenance
Each entry SHALL keep its provenance. A stored entry keeps the picked folder's name, or `null` for a single file, its path inside that folder or its file name, when it was first imported, and when it was last updated. A remote entry keeps when it was added. Times SHALL be ISO 8601 strings in UTC. Mods read it as `provenance` (see `mod-engine-api`).

#### Scenario: Imported from a folder
- **WHEN** the user imports the folder `my-mosaics`, which holds `maps/nobel_map.yaml`
- **THEN** the entry's provenance has the folder `my-mosaics`, the path `maps/nobel_map.yaml` and its import time, and no update time

#### Scenario: Updated
- **WHEN** the user updates that entry from a changed file
- **THEN** its provenance keeps the import time and has the update time

### Requirement: Only the visible mod opens user catalog dialogs
The `userCatalog.*` requests SHALL show action dialogs and follow their rules (see `mod-app-actions`): only the visible mod can send them, one dialog is shown at a time, and a mod that leaves gets `false`. Each SHALL resolve with `true` once the user confirmed and the change is done, and with `false` when the user cancels, closes the dialog with Escape, or nothing changes.

#### Scenario: Hidden mod
- **WHEN** the mosaic explorer opened the mosaic viewer, and the hidden explorer sends `userCatalog.import`
- **THEN** the response has an error with code `-32002` whose message names `userCatalog.import` and says that only the visible mod can ask the user, and no dialog is shown

#### Scenario: Cancelled
- **WHEN** the visible mod sends `userCatalog.import` and the user presses Cancel
- **THEN** nothing is stored and the request resolves with `false`

### Requirement: Import dialog
`userCatalog.import` SHALL show a dialog titled "Import mosaics" with "Choose files…", "Choose folder…" and a drop zone for files and folders. Of the picked files, those whose name ends in `.yaml` or `.yml` SHALL be read as mosaic files, and the others ignored. The dialog SHALL then show the review (see "Import review").

#### Scenario: Folder with other files
- **WHEN** the user chooses a folder that holds `nobel_map.yaml`, `notes.md` and `tiles/a.md`
- **THEN** the review lists `nobel_map.yaml` only, and says that 2 other files were ignored

#### Scenario: Dropped files
- **WHEN** the user drops `nobel_map.yaml` on the drop zone
- **THEN** the review lists `nobel_map.yaml` as a new mosaic

### Requirement: Import review
The review SHALL list each picked mosaic file with its path and a status: "New", "Changed", "Unchanged" or "Not a mosaic", the last with the error that says why. A file whose folder name and path match a stored entry SHALL be that entry's update. "New" and "Changed" files SHALL be checked, the others not checkable. The "Import" button SHALL apply the checked files, and SHALL be disabled when none is checked.

#### Scenario: Picked again after a change
- **WHEN** the user imported the folder `my-mosaics` before, changed `nobel_map.yaml` in it, added `poets.yaml`, and imports the folder again
- **THEN** the review lists `nobel_map.yaml` as "Changed", `poets.yaml` as "New", and the other files as "Unchanged"

#### Scenario: Invalid mosaic
- **WHEN** a picked file `broken.yaml` has no `title`
- **THEN** the review lists it as "Not a mosaic" with the message that `title` must be a non-empty string, and it cannot be checked

#### Scenario: Applied
- **WHEN** the user presses "Import" with `poets.yaml` and `nobel_map.yaml` checked
- **THEN** `poets.yaml` is stored as a new entry, `nobel_map.yaml` replaces its entry's file at the same address, and the request resolves with `true`

### Requirement: Entries missing from a picked folder
When the user picks a folder whose name matches stored entries, the review SHALL also list, as "Not in the folder", each of those entries whose path is not in the picked folder, unchecked. Applying SHALL remove only the checked ones (see "Remove an entry").

#### Scenario: File deleted from the folder
- **WHEN** the user deleted `old.yaml` from the folder `my-mosaics`, which was imported before, and imports the folder again
- **THEN** the review lists `old.yaml` as "Not in the folder", unchecked, and applying it unchecked keeps its entry

### Requirement: References that will not open
The review SHALL warn, under a file, for each relative `mod` or `collection` reference of the mosaic whose resolved `opentesela-browser:` address is not stored and is not in the picked files, naming the reference as written. The file SHALL still be importable.

#### Scenario: Single file with a relative collection
- **WHEN** the user imports the single file `nobel_map.yaml`, whose `collection` is `../tiles/laureates`
- **THEN** the review warns that `../tiles/laureates` is not in this browser, so the mosaic will not open until it is, and the file is checked

### Requirement: Update one entry
`userCatalog.update` with `{ mosaic }`, the address of a stored entry, SHALL show a dialog with "Choose file…" and a drop zone. The picked file SHALL be reviewed as that entry's update, whatever its name, as "Changed", "Unchanged" or "Not a mosaic". "Update" SHALL replace the entry's file at the same address and record the update time. A `mosaic` that is not a stored entry SHALL be refused with error code `-32602` and no dialog.

#### Scenario: Update from a file
- **WHEN** the visible mod sends `userCatalog.update` for a stored entry and the user picks `nobel_map (2).yaml`, whose content differs
- **THEN** the review lists it as "Changed", and "Update" replaces the entry's file at the same address

#### Scenario: Not a stored entry
- **WHEN** a mod sends `userCatalog.update` with `{ "mosaic": "https://example.org/samples/mosaics/nobel_books_list.yaml" }`
- **THEN** the response has an error with code `-32602` whose message says that the mosaic is not stored in this browser

### Requirement: Add by URL
`userCatalog.add` SHALL show a dialog titled "Add a mosaic" with a field for the mosaic's address and an "Add" button. The app SHALL read the mosaic file, without its mod or collection, and add it as a remote entry. When the address is not `http:` or `https:`, the file cannot be read, it is not a mosaic, or the catalog already lists it, the dialog SHALL say why and add nothing.

#### Scenario: Added
- **WHEN** the user types `https://mosaics.example.net/maps/laureates.yml` and presses "Add"
- **THEN** the mosaic is in the catalog, listed by the user and remote, and the request resolves with `true`

#### Scenario: Already listed
- **WHEN** the user types the address of a sample mosaic of the instance catalog
- **THEN** the dialog says that the catalog already lists this mosaic, and nothing is added

#### Scenario: Missing file
- **WHEN** the typed address answers HTTP 404
- **THEN** the dialog shows the error naming the address and `404`, and nothing is added

### Requirement: Export an entry
`userCatalog.export` with `{ mosaic }`, the address of a stored entry, SHALL show the save dialog of `files.save` for a file named after the entry's provenance file name, with type `application/yaml` and exactly the stored text. A `mosaic` that is not a stored entry SHALL be refused with error code `-32602` and no dialog.

#### Scenario: Exported
- **WHEN** the visible mod sends `userCatalog.export` for the entry imported from `my-mosaics/maps/nobel_map.yaml`, and the user presses Save
- **THEN** the browser downloads `nobel_map.yaml` with exactly the stored text, and the request resolves with `true`

### Requirement: Remove an entry
`userCatalog.remove` with `{ mosaic }`, the address of a user entry, SHALL show a confirmation that names the mosaic's title and says whether its file is deleted from this browser. Confirming SHALL remove the entry and, for a stored one, its file. A `mosaic` that is not a user entry SHALL be refused with error code `-32602` and no dialog.

#### Scenario: Stored entry removed
- **WHEN** the visible mod sends `userCatalog.remove` for a stored entry and the user confirms
- **THEN** the entry is no longer in the catalog, opening its address fails as not stored in this browser, and the request resolves with `true`

#### Scenario: Instance mosaic
- **WHEN** a mod sends `userCatalog.remove` for a mosaic of the instance catalog
- **THEN** the response has an error with code `-32602` whose message says that the mosaic is not in the user catalog

### Requirement: Remove all
Settings' "Remove all" (see `app-settings`) SHALL remove every user entry and every stored file at once, after a confirmation that gives their number.

#### Scenario: All removed
- **WHEN** the user has two stored and one remote entry, presses "Remove all" in Settings and confirms
- **THEN** the catalog lists no user entry, and the store holds no file

### Requirement: Running mods follow the user catalog
After any change to the user catalog, every running mod, visible or hidden, SHALL receive `catalog.changed` once with the new catalog (see `mod-engine-api`), and no frame SHALL be reloaded.

#### Scenario: Explorer open behind an import
- **WHEN** the mosaic explorer is open and the user imports a mosaic through it
- **THEN** the explorer lists the new mosaic without reloading its frame

### Requirement: User catalog dialogs on a phone
On a 360×740 viewport, each user catalog dialog SHALL fit the viewport's width without scrolling sideways, its list SHALL scroll inside the dialog, and its buttons and checkboxes SHALL be at least 32px wide and tall.

#### Scenario: Review on a phone
- **WHEN** the review lists twelve files on a 360×740 viewport
- **THEN** the dialog is no wider than the viewport, its list scrolls inside it, and "Import" and "Cancel" stay visible

### Requirement: User catalog dialog colors
The statuses of the review SHALL be badges of the theme: "New" the success variant, "Changed" the warning variant, "Unchanged" and "Not in the folder" the outline variant, and "Not a mosaic" the destructive variant. Their text SHALL have a contrast of at least 4.5:1 with their fill, in the light and in the dark color scheme.

#### Scenario: Statuses in both schemes
- **WHEN** the review lists a file of each status, in the light color scheme and then in the dark one
- **THEN** each status badge has its variant, and its text has a contrast of at least 4.5:1 with its fill
