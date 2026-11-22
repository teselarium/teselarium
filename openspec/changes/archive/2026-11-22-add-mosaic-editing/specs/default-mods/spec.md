# Spec Delta

## MODIFIED Requirements

### Requirement: Mosaic explorer and viewer cases
The cases of the mosaic explorer SHALL answer `catalog.list` with a catalog of fixture mosaics before mounting, and SHALL cover listing the catalog's mosaics, a mosaic that cannot be inspected, a default mosaic's mark, the place badges, the "Added by you" and "Unexported changes" marks, the card buttons, "Export" answering `userCatalog.export`, "Download" answering `files.save`, answering `mosaics.open` and `mods.open` with `null`, and "Import…" and "Add by URL…", answering their requests with `true` and `false`. The cases of the mosaic viewer SHALL cover the metadata, its mod and collection, a failing mod or collection, a missing, empty or failing `target`, the links to the mod and collection viewers, "Open mosaic", "Check mosaic", whose `mosaics.check` a case cannot answer and the check refuses with `-32002`, the provenance section of a stored and of a remote user mosaic, "Update from file…", "Export", "History…", "Export folder" and "Remove", answering their requests, "Download" answering `files.save`, and edit mode: each `mode`, the form, the YAML tab, the hints, the kept draft, and saving, answering `userCatalog.save`.

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

#### Scenario: Save in a viewer case
- **WHEN** a case mounts the viewer with `mode` `copy` and a fixture mosaic as `target`, changes the title in the form, answers `userCatalog.save` with a fixture address, and presses "Save"
- **THEN** the case's `requests` holds a `mosaics.edit` with the new title, and a `userCatalog.save` whose `copiedFrom` is the fixture mosaic's source

### Requirement: Mosaic viewer updates, exports and removes user mosaics
For a stored mosaic, the "Where it comes from" section SHALL have "Update from file…", "Export", "History…" and "Remove" buttons, which send `userCatalog.update`, `userCatalog.export`, `userCatalog.history` and `userCatalog.remove` with the target's source, and, when it came from a folder, "Export folder", which sends `userCatalog.exportFolder` with the folder's name. It SHALL say "Unexported changes" while the mosaic is changed since export (see "Changed since export" in `user-catalog`). "Export" SHALL be there whether or not the mosaic has unexported changes, so a copy of the file can always be downloaded. For a remote user mosaic it SHALL have "Remove" only. After a removal, the viewer SHALL say in a `role="status"` region that the mosaic was removed from your catalog, and SHALL hide these buttons. After an update or a restore, it SHALL show the mosaic again, inspected anew.

#### Scenario: Removed from the viewer
- **WHEN** the viewer shows a stored mosaic and the user presses "Remove" and confirms
- **THEN** the viewer says that the mosaic was removed from your catalog and shows no "Update from file…", "Export" or "Remove"

#### Scenario: Updated from the viewer
- **WHEN** the user presses "Update from file…", picks a changed file and presses "Update"
- **THEN** the viewer shows the mosaic's new title and its new update time

#### Scenario: Edited and not exported
- **WHEN** the viewer shows a stored mosaic of the folder `my-mosaics` that was saved after its import
- **THEN** its section says "Unexported changes" and has "Export" and "Export folder"

## ADDED Requirements

### Requirement: Mosaic viewer edits mosaics
The mosaic viewer SHALL show an "Edit" button for a stored mosaic, and an "Edit a copy" button for any other, next to "Open mosaic". Each SHALL open edit mode in place, for that mosaic or for a copy of it whose `mod` and `collection` are made absolute (see `mosaic-editing`).

#### Scenario: Edit a copy of a sample
- **WHEN** the viewer shows `nobel_laureates_map.yaml` and the user presses "Edit a copy"
- **THEN** the viewer is in edit mode with the copy's draft, whose `mod` and `collection` are absolute addresses

### Requirement: Mosaic viewer modes from the link
The mosaic viewer SHALL start in edit mode from its `mode` parameter: `edit` for the stored `target`, `copy` for a copy of `target`, and `new` for a new draft from `draft_mod`, `draft_collection` and `draft_sites` (see `stage-bar`, "Edit button links"). A `mode` it cannot use, such as `edit` for a remote mosaic, SHALL show an alert that says why, and the mosaic in view mode.

#### Scenario: New from a combination
- **WHEN** the viewer opens with `mode=new` and `draft_mod` and `draft_collection` set
- **THEN** it is in edit mode with a draft titled `<mod> + <collection>` with the titles of that mod and collection, which names that mod and collection

#### Scenario: Edit mode for a remote mosaic
- **WHEN** the viewer opens with `mode=edit` and a sample mosaic as `target`
- **THEN** it shows an alert that says only mosaics stored in this browser can be edited, offers "Edit a copy", and shows the mosaic

### Requirement: Edit form
The edit mode's "Form" tab SHALL have fields for the title, the description, the mod's address, the collection's address or none, one row per field of the mod's tile type with the names that rename to it, and one row per `show` line with its host and reason, with "Add" and "Remove" for the lines. It SHALL show the draft's `config` read-only, with the mod's default config beside it, and say that config is edited in the YAML tab. Each change SHALL go to the draft through `mosaics.edit`.

#### Scenario: Alias from a suggestion
- **WHEN** the draft pairs the country map with the laureates, and the user picks `birth_country` among the collection's field names in the `country` row
- **THEN** the draft's YAML has `country: ["birth_country"]` under `aliases`, and the match count rises

### Requirement: YAML tab
The edit mode's "YAML" tab SHALL be a monospace textarea with the draft's text, and SHALL list the draft's errors and warnings under it, each with "Line <n>" when it has a line. While the text has an error that keeps it from being read, the "Form" tab SHALL be disabled and say why.

#### Scenario: Broken YAML
- **WHEN** the user types a tab at the start of line 4 in the YAML tab
- **THEN** the list shows an error with "Line 4", and the "Form" tab is disabled with that reason

### Requirement: Hints while editing
While editing, the viewer SHALL validate the draft with `mosaics.validate` after the user stops typing for half a second, and show the errors, the warnings, and "<matching> of <total> tiles match". A newer validation SHALL replace an older one whose answer arrives later.

#### Scenario: Count after an alias
- **WHEN** the user adds the alias `title ← name` to a draft of the country map with the laureates
- **THEN** after the pause, the viewer shows a higher count of matching tiles than before

### Requirement: The draft is kept
The viewer SHALL keep an unsaved draft in its storage slot, one per target, or per `draft_mod` and `draft_collection` for a new one, and offer it again with "Restore draft" and "Discard" when edit mode opens for the same mosaic. Saving or discarding SHALL drop it. "Cancel" with unsaved changes SHALL ask with `ui.confirm` before leaving edit mode.

#### Scenario: Back and forth
- **WHEN** the user changes the title, goes back to the explorer without saving, and opens edit mode for the same mosaic again
- **THEN** the viewer offers "Restore draft", and restoring it shows the changed title

### Requirement: Saving from the viewer
"Save", and Ctrl+S or Cmd+S in edit mode, SHALL send `userCatalog.save` with the draft's text, the target for a stored mosaic, and `copiedFrom` for a copy. For a new mosaic or a copy, a saved address SHALL make the viewer show that mosaic, replacing its own sandbox with `mods.open` and `replace: true`. For a stored mosaic, it SHALL return to view mode, showing the saved mosaic. `null` SHALL keep edit mode and the draft.

#### Scenario: Save a copy
- **WHEN** the user edits a copy and presses "Save", then "Save" in the confirmation
- **THEN** the viewer shows the new stored mosaic in view mode, and back leads to what was before the copy

### Requirement: Edit mode on a phone
On a 360×740 viewport, edit mode SHALL be one column: the tabs on one row, the form's rows stacking their label above their field, the textarea at full width, and "Save" and "Cancel" at least 32px tall, without scrolling sideways.

#### Scenario: Form on a phone
- **WHEN** the viewer edits a draft with three alias rows and two `show` lines on a 360×740 viewport
- **THEN** every row fits the width, labels sit above their fields, and the page does not scroll sideways

### Requirement: Mosaic explorer marks changed mosaics
A card of the mosaic explorer for a stored mosaic that is changed since export (see "Changed since export" in `user-catalog`) SHALL say "Unexported changes" after `Added by you`, as a warning badge, whose text has a contrast of at least 4.5:1 with its fill in the light and in the dark color scheme.

#### Scenario: Saved mosaic in both schemes
- **WHEN** the explorer lists a mosaic saved in the app and never exported, in the light color scheme and then in the dark one
- **THEN** its card shows "Unexported changes" as a warning badge, with text at a contrast of at least 4.5:1

### Requirement: Mosaic explorer exports stored mosaics
A card of the mosaic explorer for a stored mosaic SHALL have an "Export" outline button after "Open" and "View", whether or not the mosaic has unexported changes. It SHALL send `userCatalog.export` with the mosaic's source. A card of a remote, instance or default mosaic SHALL have no "Export". Once the export is confirmed, the card SHALL follow the catalog's change (see "Explorers follow catalog changes"), so its "Unexported changes" badge goes away.

#### Scenario: Export from the list
- **WHEN** the explorer lists a mosaic saved in the app and never exported, and the user presses its card's "Export" and confirms the download
- **THEN** the browser downloads the mosaic's file, and its card no longer says "Unexported changes"

#### Scenario: Remote mosaic
- **WHEN** the explorer lists a sample mosaic
- **THEN** its card has "Open" and "View", and no "Export"

#### Scenario: Card buttons on a phone
- **WHEN** the explorer lists a stored mosaic on a 360×740 viewport
- **THEN** its card's "Open", "View" and "Export" are inside the card, at least 32px tall, and the page does not scroll sideways

### Requirement: Mosaics that are not stored can be downloaded
A card of the mosaic explorer for a remote, instance or default mosaic SHALL have a "Download" outline button after "Open" and "View", and the mosaic viewer SHALL have "Download" after "Edit a copy" and "Check mosaic" for any mosaic not stored in this browser. A stored mosaic SHALL have "Export" instead.

#### Scenario: Stored mosaics export
- **WHEN** the explorer lists a mosaic stored in this browser, and the viewer shows it
- **THEN** its card and the viewer have "Export" and no "Download"

#### Scenario: Download on a phone
- **WHEN** the explorer lists a sample mosaic on a 360×740 viewport
- **THEN** its card's "Open", "View" and "Download" are inside the card, at least 32px tall, and the page does not scroll sideways

### Requirement: What "Download" saves
"Download" SHALL send `files.save` with the text `mosaics.inspect` answered as `content`, unchanged, typed `application/yaml`, named after the last segment of the mosaic's address, decoded, or `mosaic.yaml` when that segment is not a file name. A refusal SHALL be shown in the mod's status region; "Cancel" SHALL show nothing.

#### Scenario: Download a sample from the explorer
- **WHEN** the explorer lists "Nobel laureates on the map", and the user presses its card's "Download" and presses "Save"
- **THEN** the browser downloads `nobel_laureates_map.yaml`, with exactly the text the sample's address serves

#### Scenario: Download from the viewer
- **WHEN** the viewer shows "Nobel laureates on the map" and the user presses "Download" and presses "Save"
- **THEN** the browser downloads `nobel_laureates_map.yaml`

#### Scenario: No file name in the address
- **WHEN** the user downloads a mosaic whose address ends with `/`
- **THEN** the save confirmation names the file `mosaic.yaml`
