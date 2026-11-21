# Spec Delta

## MODIFIED Requirements

### Requirement: Mosaic explorer and viewer cases
The cases of the mosaic explorer SHALL answer `catalog.list` with a catalog of fixture mosaics before mounting, and SHALL cover listing the catalog's mosaics, a mosaic that cannot be inspected, a default mosaic's mark, the place badges, the "Added by you" and "Changed since export" marks, both card buttons, answering `mosaics.open` and `mods.open` with `null`, and "Import…" and "Add by URL…", answering their requests with `true` and `false`. The cases of the mosaic viewer SHALL cover what it shows, its links, "Open mosaic" and "Check mosaic", the provenance section and its buttons, and edit mode: each `mode`, the form, the YAML mode, the hints, the kept draft, and saving, answering `userCatalog.save`.

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
For a stored mosaic, the "Where it comes from" section SHALL have "Update from file…", "Export", "History…" and "Remove" buttons, which send `userCatalog.update`, `userCatalog.export`, `userCatalog.history` and `userCatalog.remove` with the target's source, and, when it came from a folder, "Export folder", which sends `userCatalog.exportFolder` with the folder's name. It SHALL say "Changed since export" while the mosaic is. For a remote user mosaic it SHALL have "Remove" only. After a removal, the viewer SHALL say in a `role="status"` region that the mosaic was removed from your catalog, and SHALL hide these buttons. After an update or a restore, it SHALL show the mosaic again, inspected anew.

#### Scenario: Removed from the viewer
- **WHEN** the viewer shows a stored mosaic and the user presses "Remove" and confirms
- **THEN** the viewer says that the mosaic was removed from your catalog and shows no "Update from file…", "Export" or "Remove"

#### Scenario: Updated from the viewer
- **WHEN** the user presses "Update from file…", picks a changed file and presses "Update"
- **THEN** the viewer shows the mosaic's new title and its new update time

#### Scenario: Edited and not exported
- **WHEN** the viewer shows a stored mosaic of the folder `my-mosaics` that was saved after its import
- **THEN** its section says "Changed since export" and has "Export folder"

## ADDED Requirements

### Requirement: Mosaic viewer edits mosaics
The mosaic viewer SHALL show an "Edit" button for a stored mosaic, and an "Edit a copy" button for any other, next to "Open mosaic". Each SHALL open edit mode in place, for that mosaic or for a copy of it whose `mod` and `collection` are made absolute (see `mosaic-editing`).

#### Scenario: Edit a copy of a sample
- **WHEN** the viewer shows `nobel_laureates_map.yaml` and the user presses "Edit a copy"
- **THEN** the viewer is in edit mode with the copy's draft, whose `mod` and `collection` are absolute addresses

### Requirement: Mosaic viewer modes from the link
The mosaic viewer SHALL start in edit mode from its `mode` parameter: `edit` for the stored `target`, `copy` for a copy of `target`, and `new` for a new draft from `draft_mod`, `draft_collection` and `draft_sites` (see `combination-pickers`). A `mode` it cannot use, such as `edit` for a remote mosaic, SHALL show an alert that says why, and the mosaic in view mode.

#### Scenario: New from a combination
- **WHEN** the viewer opens with `mode=new` and `draft_mod` and `draft_collection` set
- **THEN** it is in edit mode with a draft titled "Untitled mosaic" that names that mod and collection

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
A card of the mosaic explorer for a stored mosaic that is changed since export SHALL say "Changed since export" after `Added by you`, as a warning badge, whose text has a contrast of at least 4.5:1 with its fill in the light and in the dark color scheme.

#### Scenario: Saved mosaic in both schemes
- **WHEN** the explorer lists a mosaic saved in the app and never exported, in the light color scheme and then in the dark one
- **THEN** its card shows "Changed since export" as a warning badge, with text at a contrast of at least 4.5:1
