# Spec Delta

## MODIFIED Requirements

### Requirement: Read the catalog
`catalog.list` SHALL answer the catalog (see `catalog`) as `{ mods, collections, mosaics }`, each a list in catalog order. Each mod and collection entry SHALL be `{ source, listedBy, place }`, where `source` is the resolved address of its file. Each mosaic entry SHALL be `{ source, listedBy, place, defaultOf, provenance }`, where `defaultOf` is `{ source, title }` of the mod whose default mosaic it is, or `null`. `listedBy` and `place` are as "Who listed an entry and where it lives" in `catalog` says. `provenance` is `null` unless `listedBy` is `"user"` (see "Provenance in the catalog"). Params SHALL be ignored.

#### Scenario: Vanilla catalog
- **WHEN** a mod of the vanilla app at `https://example.org/` sends `catalog.list`, with an empty user catalog
- **THEN** the result's `mods` starts with `{ "source": "https://example.org/samples/mods/book_list/mod_conf.yaml", "listedBy": "instance", "place": "remote" }`, and its `mosaics` are the two sample mosaics, each with `listedBy` `"instance"`, `place` `"remote"`, `defaultOf` `null` and `provenance` `null`

#### Scenario: Default mosaic entry
- **WHEN** "List the default mosaics of mods" is on and a mod sends `catalog.list`
- **THEN** the result's `mosaics` holds `{ "source": "https://example.org/samples/mods/book_list/mosaic.yaml", "listedBy": "default", "place": "remote", "defaultOf": { "source": "https://example.org/samples/mods/book_list/mod_conf.yaml", "title": "Book List" }, "provenance": null }`

#### Scenario: Stored user mosaic entry
- **WHEN** the user imported `maps/nobel_map.yaml` from the folder `my-mosaics` and a mod sends `catalog.list`
- **THEN** the result's `mosaics` ends with an entry whose `source` starts with `opentesela-browser:///`, with `listedBy` `"user"`, `place` `"browser"`, `defaultOf` `null` and the provenance of that import

### Requirement: Catalog changed event
When "List the default mosaics of mods" changes, or the user catalog changes, the engine SHALL push `catalog.changed` to every running mod, visible or hidden, once, with the new catalog as its params, in the same form as the result of `catalog.list`. Each `catalog.list` answered after the change SHALL give the new catalog. No frame SHALL be reloaded.

#### Scenario: Switched on while a mod runs
- **WHEN** a mod runs and the user switches "List the default mosaics of mods" on
- **THEN** the mod receives `catalog.changed` once, whose `mosaics` hold the default mosaics, and no frame was reloaded
- **AND** a `catalog.list` the mod sends afterwards gives the same catalog

#### Scenario: Hidden mod
- **WHEN** the mosaic explorer is hidden behind a mosaic it opened, and the user switches the setting
- **THEN** the hidden explorer receives `catalog.changed` too

#### Scenario: Mosaic removed while a mod runs
- **WHEN** a mod runs hidden and the user removes a user mosaic through the mosaic viewer
- **THEN** the hidden mod receives `catalog.changed` once, whose `mosaics` no longer hold it

## ADDED Requirements

### Requirement: Provenance in the catalog
A user mosaic entry's `provenance` SHALL be `{ folder, path, addedAt, updatedAt }`. For a stored entry, `folder` is the picked folder's name or `null` for a single file, `path` its path inside the folder or its file name, `addedAt` when it was first imported, and `updatedAt` when it was last updated, or `null`. For a remote entry, `folder` and `path` are `null`, `addedAt` is when it was added, and `updatedAt` is `null`.

#### Scenario: Remote entry
- **WHEN** the user added `https://mosaics.example.net/maps/laureates.yml` by URL and a mod sends `catalog.list`
- **THEN** that entry's `provenance` has `folder` `null`, `path` `null`, an `addedAt` time and `updatedAt` `null`

### Requirement: User catalog requests
The engine SHALL answer `userCatalog.import`, `userCatalog.update`, `userCatalog.add`, `userCatalog.export` and `userCatalog.remove` as `user-catalog` says, with `true` or `false`, and without any permission.

#### Scenario: Mod without permissions
- **WHEN** the visible mod declares no permission and sends `userCatalog.import`, and the user cancels
- **THEN** the import dialog was shown, and the request resolves with `false`

### Requirement: User catalog request params
`userCatalog.import` SHALL ignore its params. `userCatalog.update`, `userCatalog.export` and `userCatalog.remove` SHALL need `mosaic` as a non-empty string. `userCatalog.add` SHALL take an optional `mosaic` string that fills the dialog's field. Each `mosaic` SHALL be resolved against the app's address as a mosaic reference. Any other params SHALL fail with `-32602`, naming the method and the param.

#### Scenario: Missing mosaic
- **WHEN** a mod sends `userCatalog.export` with no params
- **THEN** the response has an error with code `-32602` whose message is `userCatalog.export: "mosaic" must be a non-empty string`

#### Scenario: Add with a suggested address
- **WHEN** the visible mod sends `userCatalog.add` with `{ "mosaic": "https://mosaics.example.net/maps/laureates.yml" }`
- **THEN** the "Add a mosaic" dialog opens with that address in its field, and nothing is added until the user presses "Add"
