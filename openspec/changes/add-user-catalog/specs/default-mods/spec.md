# Spec Delta

## MODIFIED Requirements

### Requirement: Mosaic explorer and viewer cases
The cases of the mosaic explorer SHALL answer `catalog.list` with a catalog of fixture mosaics before mounting, and SHALL cover listing the catalog's mosaics, a mosaic that cannot be inspected, a default mosaic's mark, the place badges and the "Added by you" mark, both card buttons, answering `mosaics.open` and `mods.open` with `null`, and "Import…" and "Add by URL…", answering their requests with `true` and `false`. The cases of the mosaic viewer SHALL cover the metadata, its mod and collection, a failing mod or collection, a missing, empty or failing `target`, the links to the mod and collection viewers, "Open mosaic", "Check mosaic", whose `mosaics.check` a case cannot answer and the check refuses with `-32002`, the provenance section of a stored and of a remote user mosaic, and "Update from file…", "Export" and "Remove", answering their requests.

#### Scenario: Open in an explorer case
- **WHEN** a case answers `catalog.list` with a catalog whose `mosaics` holds a fixture mosaic, mounts the explorer, answers `mosaics.open` with `null`, and presses "Open"
- **THEN** the case's `requests` holds a `mosaics.open` whose `mosaic` is the fixture mosaic's source

#### Scenario: Default mosaic in an explorer case
- **WHEN** a case answers `catalog.list` with a fixture mosaic whose `defaultOf` has the title `Listed mod`, and mounts the explorer
- **THEN** that mosaic's card says `Default mosaic of Listed mod`

#### Scenario: Check in a viewer case
- **WHEN** a case mounts the viewer with a fixture mosaic as `params.target` and presses "Check mosaic"
- **THEN** the case's `requests` holds a `mosaics.check` whose `mosaic` is the fixture mosaic's source, with an error with code `-32002`
- **AND** the frame shows the error as an alert, and "Check mosaic" is enabled again

#### Scenario: Stored mosaic in an explorer case
- **WHEN** a case answers `catalog.list` with a fixture mosaic marked `place` `"browser"` and with a `provenance`, and mounts the explorer
- **THEN** that mosaic's card shows the "Browser" badge and says `Added by you`

#### Scenario: Remove in a viewer case
- **WHEN** a case answers `catalog.list` with the viewer's fixture mosaic as a stored user mosaic, mounts the viewer with it as `params.target`, answers `userCatalog.remove` with `true`, and presses "Remove"
- **THEN** the case's `requests` holds a `userCatalog.remove` whose `mosaic` is the fixture mosaic's source

## ADDED Requirements

### Requirement: Mosaic explorer shows where mosaics live
Each card of the mosaic explorer SHALL show, after its title, a badge for where the mosaic's file lives: "Browser" (secondary) for `place` `"browser"`, or "Remote" (outline) for `"remote"`. A card of a mosaic listed by the user SHALL say `Added by you` under its title, where a default mosaic says `Default mosaic of <title>`.

#### Scenario: Imported and sample mosaics
- **WHEN** the user imported a mosaic and the mosaic explorer runs in the vanilla app
- **THEN** the imported mosaic's card shows "Browser" and says `Added by you`, and each sample mosaic's card shows "Remote" and no such line

#### Scenario: Badges on a phone
- **WHEN** the mosaic explorer lists an imported mosaic with a long title on a 360×740 viewport
- **THEN** the title wraps, the badge stays beside it or under it without overlapping, and the card does not scroll sideways

### Requirement: Mosaic explorer imports and adds mosaics
The mosaic explorer SHALL have, above its list, an "Import…" button that sends `userCatalog.import` and an "Add by URL…" button that sends `userCatalog.add`, both outline buttons. A refusal SHALL be shown in its `role="status"` region. The explorer SHALL list the new catalog when it receives `catalog.changed`, as it already does.

#### Scenario: Import from the explorer
- **WHEN** the user presses "Import…" in the mosaic explorer, picks `nobel_map.yaml` and presses "Import" in the review
- **THEN** the explorer lists the new mosaic with the "Browser" badge, and its frame was not reloaded

#### Scenario: Buttons on a phone
- **WHEN** the mosaic explorer runs on a 360×740 viewport
- **THEN** "Import…" and "Add by URL…" fit on the width, on one row or wrapped, each at least 32px tall

### Requirement: Mosaic viewer shows where a user mosaic comes from
When the viewer's target is a user mosaic of the catalog, read with `catalog.list`, the viewer SHALL show a "Where it comes from" section after "Permissions":
- for a stored mosaic: the folder and the path, or the file name, the import time and the last update time, and a note that it is kept only in this browser and can be exported as a backup;
- for a remote mosaic: that it was added by URL, and when.

A mosaic that is not a user mosaic SHALL have no such section.

#### Scenario: Stored mosaic
- **WHEN** the viewer shows a mosaic imported from `my-mosaics/maps/nobel_map.yaml`
- **THEN** its "Where it comes from" section shows `my-mosaics`, `maps/nobel_map.yaml`, the import time, and the note that it is kept only in this browser

#### Scenario: Sample mosaic
- **WHEN** the viewer shows `nobel_laureates_map.yaml`
- **THEN** it has no "Where it comes from" section

#### Scenario: Section on a phone
- **WHEN** the viewer shows a stored mosaic with a long path on a 360×740 viewport
- **THEN** the path wraps and the section does not scroll sideways

### Requirement: Mosaic viewer updates, exports and removes user mosaics
For a stored mosaic, the "Where it comes from" section SHALL have "Update from file…", "Export" and "Remove" buttons, which send `userCatalog.update`, `userCatalog.export` and `userCatalog.remove` with the target's source. For a remote user mosaic it SHALL have "Remove" only. After a removal, the viewer SHALL say in a `role="status"` region that the mosaic was removed from your catalog, and SHALL hide these buttons. After an update, it SHALL show the mosaic again, inspected anew.

#### Scenario: Removed from the viewer
- **WHEN** the viewer shows a stored mosaic and the user presses "Remove" and confirms
- **THEN** the viewer says that the mosaic was removed from your catalog and shows no "Update from file…", "Export" or "Remove"

#### Scenario: Updated from the viewer
- **WHEN** the user presses "Update from file…", picks a changed file and presses "Update"
- **THEN** the viewer shows the mosaic's new title and its new update time
