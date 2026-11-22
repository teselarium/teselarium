# Spec Delta

## MODIFIED Requirements

### Requirement: Provenance in the catalog
A user mosaic entry's `provenance` SHALL be `{ folder, path, addedAt, updatedAt, changedSinceExport, copiedFrom }`. For a stored entry, `folder` is the picked folder's name or `null` for a single file, `path` its path inside the folder or its file name, `addedAt` when it was first imported or saved, `updatedAt` when it was last updated, or `null`, `changedSinceExport` a boolean (see `user-catalog`), and `copiedFrom` the address it was copied from, or `null`. For a remote entry, `folder`, `path`, `updatedAt` and `copiedFrom` are `null`, `addedAt` is when it was added, and `changedSinceExport` is `false`.

#### Scenario: Remote entry
- **WHEN** the user added `https://mosaics.example.net/maps/laureates.yml` by URL and a mod sends `catalog.list`
- **THEN** that entry's `provenance` has `folder` `null`, `path` `null`, an `addedAt` time, `updatedAt` `null`, `changedSinceExport` `false` and `copiedFrom` `null`

#### Scenario: Saved copy
- **WHEN** the user saved a copy of a sample mosaic and a mod sends `catalog.list`
- **THEN** the copy's `provenance` has `changedSinceExport` `true` and `copiedFrom` the sample mosaic's address

### Requirement: Inspect a mosaic
`mosaics.inspect` with `{ mosaic }`, where `mosaic` is a mosaic reference, SHALL read the mosaic file without requesting its mod, its collection or any tile, and return `source`, `title`, `description`, `mod` (the resolved address of the mod file), `collection` (the resolved address of the collection file, or `null`), `config` (the mosaic's own config), `aliases`, `permissions`, with the `granted` and `denied` lists the mosaic's `show` lines would get if it were opened without asking, and `content`, the mosaic file's text as read.

#### Scenario: Inspect the laureates' map
- **WHEN** a mod with `open` granted for `"*"` sends `mosaics.inspect` with `{ "mosaic": "./fixtures/mosaics/nobel_map" }`
- **THEN** the result's `source` is `https://example.org/fixtures/mosaics/nobel_map/mosaic.yaml`, and its `mod` and `collection` are resolved addresses
- **AND** only the mosaic file is requested

#### Scenario: Show lines of a mosaic from the app's origin
- **WHEN** a mosaic from the app's origin declares `show` for `https://covers.openlibrary.org` and is inspected
- **THEN** the result's `permissions.granted` holds that line and `permissions.denied` is empty

#### Scenario: Text of the file
- **WHEN** a mod inspects a mosaic file whose text has a comment line
- **THEN** the result's `content` is exactly the file's text, comment included

## ADDED Requirements

### Requirement: Validate a mosaic draft
`mosaics.validate` with `{ content, mosaic? }` SHALL validate `content`, the text of a mosaic file, as `mosaic-editing` says, with relative references resolved against `mosaic`, the address it will be saved at. It SHALL need the requester's `open` permission for the origins of the mod and the collection, as `mods.inspect` and `collections.inspect` do, and SHALL ask the user nothing. `content` SHALL be a non-empty string, otherwise `-32602`.

#### Scenario: Not allowed to open the mod's site
- **WHEN** a mod without an `open` permission for `https://mods.example.net` validates a draft whose mod is there
- **THEN** the response has an error with code `-32002` that says which `open` permission is missing

### Requirement: Validation result
`mosaics.validate` SHALL answer `{ errors, warnings, typeFields, collectionFields, tiles, draft }`: `errors` and `warnings` lists of `{ message, line }`, with `line` a 1-based number or `null`; `typeFields` a list of `{ name, required }`; `collectionFields` a sorted list of names; `tiles` `{ matching, total }`, or `null` without a collection or with errors; and `draft` (see "Draft fields in the validation").

#### Scenario: Valid draft
- **WHEN** the mosaic viewer sends `mosaics.validate` with the text of `nobel_laureates_map.yaml` and its address
- **THEN** the result has no errors, `typeFields` holding `{ "name": "title", "required": true }`, and `tiles` with `matching` equal to `total`
- **AND** its `draft` has the file's `title`, and its `mod` as written, `"../mods/country_map"`

### Requirement: Draft fields in the validation
The `draft` of `mosaics.validate`'s answer SHALL be the fields the draft holds as written, `{ title, description, mod, collection, config, aliases, show }`, each text `null` when it is missing or not a string, `config` the draft's own config or `{}`, `aliases` the fields that have a list of names, and `show` the lines with a string `host` and `reason`. It SHALL be `null` when the text cannot be read: a YAML error, or no `mosaic` mapping.

#### Scenario: Fields of a draft without a title
- **WHEN** a mod validates a draft whose `mosaic` mapping has a `mod` and no `title`
- **THEN** the result has an error for `title`, and its `draft` has `title` `null` and that `mod`

#### Scenario: Fields of a draft that does not parse
- **WHEN** a mod validates a draft with a YAML error
- **THEN** the result's `draft` is `null`

### Requirement: Edit a mosaic draft
`mosaics.edit` with `{ content, edits }` SHALL apply `edits` to `content` as `mosaic-editing`'s "Form edits keep the YAML" says, and answer `{ content }`, the new text. It SHALL need no permission and request no file. A draft that does not parse SHALL fail with `-32602` and the parse error.

#### Scenario: Title edit
- **WHEN** a mod sends `mosaics.edit` with a draft and `{ "edits": { "title": "Laureates, my way" } }`
- **THEN** the result's `content` differs from the draft only on the `title` line

### Requirement: Draft edits
`edits` SHALL be a mapping whose optional keys are `title` (a string), `description` (a string, or `null` to remove it), `mod` (a string), `collection` (a string, or `null` for none), `aliases` (a mapping of field names to lists of names) and `show` (a list of `{ host, reason }`). Any other key or value SHALL fail with `-32602`, naming `mosaics.edit` and the key.

#### Scenario: Unknown edit
- **WHEN** a mod sends `mosaics.edit` with `{ "edits": { "colour": "red" } }`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.edit` and `edits.colour`

### Requirement: Save request
`userCatalog.save` with `{ content, mosaic?, copiedFrom? }` SHALL show the save confirmation (see `mosaic-editing`) without any permission, and answer the saved mosaic's address, or `null` when nothing was saved. `mosaic` is a stored entry's address, or absent for a new mosaic. `copiedFrom` is the address a copy came from. `content` SHALL be a non-empty string. A wrong param, or a `mosaic` that is not a stored entry, SHALL fail with `-32602`, naming the method and the param.

#### Scenario: New mosaic saved
- **WHEN** the visible mod sends `userCatalog.save` with a valid new draft and the user presses "Save"
- **THEN** the request resolves with an `opentesela-browser:` address, which the catalog lists as a user mosaic

#### Scenario: Missing content
- **WHEN** a mod sends `userCatalog.save` with `{ "mosaic": "opentesela-browser:///r1/a.yaml" }`
- **THEN** the response has an error with code `-32602` whose message is `userCatalog.save: "content" must be a non-empty string`

### Requirement: History and folder export requests
`userCatalog.history` with `{ mosaic }`, a stored entry's address, SHALL show the history dialog and answer `true` once a version was restored, or `false`. `userCatalog.exportFolder` with `{ folder }` SHALL export the folder (see `user-catalog`) and answer `true` once the `.zip` was saved, or `false`. Neither SHALL need a permission. A missing or wrong param SHALL fail with `-32602`, naming the method and the param.

#### Scenario: Unknown folder
- **WHEN** a mod sends `userCatalog.exportFolder` with `{ "folder": "nowhere" }`
- **THEN** the response has an error with code `-32602` whose message names `userCatalog.exportFolder` and says no stored mosaic comes from that folder
