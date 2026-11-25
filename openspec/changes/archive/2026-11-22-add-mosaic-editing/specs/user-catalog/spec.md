# Spec Delta

## MODIFIED Requirements

### Requirement: Import review
The review SHALL list each picked mosaic file with its path and a status: "New", "Changed", "Unchanged", "Changed here only", "Changed here and in the file" or "Not a mosaic", with the error for the last. A file whose folder name and path match a stored entry SHALL be that entry's update (see "Status of a matching file"). "New" and "Changed" SHALL be checked, a conflict SHALL offer its choices (see "Conflict choices"), and the rest SHALL NOT be checkable. "Import" SHALL apply them, and SHALL be disabled when there is nothing to apply.

#### Scenario: Picked again after a change
- **WHEN** the user imported the folder `my-mosaics` before, changed `nobel_map.yaml` in it, added `poets.yaml`, and imports the folder again
- **THEN** the review lists `nobel_map.yaml` as "Changed", `poets.yaml` as "New", and the other files as "Unchanged"

#### Scenario: Invalid mosaic
- **WHEN** a picked file `broken.yaml` has no `title`
- **THEN** the review lists it as "Not a mosaic" with the message that `title` must be a non-empty string, and it cannot be checked

#### Scenario: Applied
- **WHEN** the user presses "Import" with `poets.yaml` and `nobel_map.yaml` checked
- **THEN** `poets.yaml` is stored as a new entry, `nobel_map.yaml` replaces its entry's file at the same address, and the request resolves with `true`

#### Scenario: Edited here, file untouched
- **WHEN** the user edited the stored `nobel_map.yaml` in the app, did not change the file, and imports the folder again
- **THEN** the review lists `nobel_map.yaml` as "Changed here only", it cannot be checked, and importing keeps the edited text

#### Scenario: Edited on both sides
- **WHEN** the user edited the stored `nobel_map.yaml` in the app, also changed the file, and imports the folder again
- **THEN** the review lists `nobel_map.yaml` as "Changed here and in the file", with its choices

### Requirement: Provenance
Each entry SHALL keep its provenance. A stored entry keeps the picked folder's name, or `null` for a single file, its path inside that folder or its file name, when it was first imported or saved, when it was last updated, whether it changed since export (see "Changed since export"), and, for a copy, the address it was copied from. A remote entry keeps when it was added. Times SHALL be ISO 8601 strings in UTC. Mods read it as `provenance` (see `mod-engine-api`).

#### Scenario: Imported from a folder
- **WHEN** the user imports the folder `my-mosaics`, which holds `maps/nobel_map.yaml`
- **THEN** the entry's provenance has the folder `my-mosaics`, the path `maps/nobel_map.yaml` and its import time, no update time, not changed since export, and no copy address

#### Scenario: Updated
- **WHEN** the user updates that entry from a changed file
- **THEN** its provenance keeps the import time and has the update time

#### Scenario: Copy
- **WHEN** the user saves a copy of `https://example.org/samples/mosaics/nobel_laureates_map.yaml`
- **THEN** the new entry's provenance has no folder, its file name as path, changed since export, and that address as the copy address

### Requirement: User catalog dialog colors
The statuses of the review SHALL be badges of the theme: "New" the success variant, "Changed" and "Changed here and in the file" the warning variant, "Unchanged", "Changed here only" and "Not in the folder" the outline variant, and "Not a mosaic" the destructive variant. Their text SHALL have a contrast of at least 4.5:1 with their fill, in the light and in the dark color scheme.

#### Scenario: Statuses in both schemes
- **WHEN** the review lists a file of each status, in the light color scheme and then in the dark one
- **THEN** each status badge has its variant, and its text has a contrast of at least 4.5:1 with its fill

## ADDED Requirements

### Requirement: Status of a matching file
A picked file that matches a stored entry SHALL be compared with the entry's stored text and with the text it was last imported, updated from a file or exported with. It SHALL be "Unchanged" when the file and the stored text are equal, "Changed" when only the file differs from that last text, "Changed here only" when only the stored text does, and "Changed here and in the file" when both do and differ from each other.

#### Scenario: Both changed the same way
- **WHEN** the user made the same edit in the app and in the file, and imports the folder again
- **THEN** the review lists the file as "Unchanged"

### Requirement: Changed since export
A stored entry SHALL be changed since export when its text differs from the text it was last imported, updated from a file or exported with. An entry saved in the app and never exported SHALL be changed since export. Exporting it, alone or with its folder, SHALL make it unchanged. The app and the default mods SHALL show this status as "Unexported changes", which holds whether or not the entry was ever exported.

#### Scenario: Saved, then exported
- **WHEN** the user saves an edited mosaic, and then exports it
- **THEN** the mosaic is changed since export after the save, and not after the export

### Requirement: Conflict choices
A file listed as "Changed here and in the file" SHALL offer three choices, none chosen at first: "Keep mine", which keeps the stored text; "Take the file", which replaces it with the file's text; and "Keep both", which keeps the stored entry and imports the file as a new single-file entry named `<name> (from file).yaml`. A replaced text SHALL stay in the entry's history.

#### Scenario: Take the file
- **WHEN** the user chooses "Take the file" for a conflict and presses "Import"
- **THEN** the entry has the file's text, and its history holds the replaced text as a version

#### Scenario: Keep both
- **WHEN** the user chooses "Keep both" for `nobel_map.yaml`
- **THEN** the entry keeps its text, and the catalog also lists a new stored mosaic from `nobel_map (from file).yaml`

### Requirement: Updating keeps local changes in history
When `userCatalog.update` replaces an entry that is changed since export, the review SHALL say that the changes made here are replaced, and kept in the history. Applying SHALL keep the replaced text as a version.

#### Scenario: Update over local edits
- **WHEN** the user edited a stored mosaic and updates it from a file
- **THEN** the review says the changes made here are replaced and kept in the history, and after "Update" the history holds the edited text

### Requirement: Export a folder
`userCatalog.exportFolder` with `{ folder }`, the name of an imported folder, SHALL show the save dialog of `files.save` for `<folder>.zip`, of type `application/zip`, holding each stored entry of that folder at its path, with its stored text. Every exported entry SHALL then be unchanged since export. A `folder` that no stored entry has SHALL be refused with error code `-32602` and no dialog.

#### Scenario: Exported folder
- **WHEN** the folder `my-mosaics` was imported with `maps/nobel_map.yaml` and `poets.yaml`, one of them edited, and the user exports the folder
- **THEN** the browser downloads `my-mosaics.zip` holding `maps/nobel_map.yaml` and `poets.yaml` with their stored texts, and neither is changed since export
