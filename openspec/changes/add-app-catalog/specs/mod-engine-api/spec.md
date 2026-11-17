# Spec Delta

## ADDED Requirements

### Requirement: Read the catalog
`catalog.list` SHALL answer the app's catalog (see `app-catalog`) as `{ mods, collections, mosaics }`, each a list in catalog order. Each mod and collection entry SHALL be `{ source }`, the resolved address of its file. Each mosaic entry SHALL be `{ source, defaultOf }`, where `defaultOf` is `{ source, title }` of the mod whose default mosaic it is, or `null`. Params SHALL be ignored.

#### Scenario: Vanilla catalog
- **WHEN** a mod of the vanilla app at `https://example.org/` sends `catalog.list`
- **THEN** the result's `mods` starts with `{ "source": "https://example.org/samples/mods/book_list/mod_conf.yaml" }`, and its `mosaics` are the two sample mosaics, each with `defaultOf` `null`

#### Scenario: Default mosaic entry
- **WHEN** "List the default mosaics of mods" is on and a mod sends `catalog.list`
- **THEN** the result's `mosaics` holds `{ "source": "https://example.org/samples/mods/book_list/mosaic.yaml", "defaultOf": { "source": "https://example.org/samples/mods/book_list/mod_conf.yaml", "title": "Book List" } }`

### Requirement: Reading the catalog needs no permission
Any mod, visible or hidden, SHALL be answered `catalog.list` without any permission. Answering it SHALL request no file while "List the default mosaics of mods" is off, and only the catalog mods' mod files while it is on: no entrypoint, library, collection or mosaic file.

#### Scenario: Mod without permissions
- **WHEN** a mod that declares no permission sends `catalog.list`
- **THEN** the request resolves with the catalog and no file is requested

#### Scenario: Default mosaics need the mod files
- **WHEN** the switch is on and a mod sends `catalog.list`
- **THEN** each catalog mod's mod file is requested, and no `main.js` and no `mosaic.yaml` is requested

### Requirement: Catalog changed event
When "List the default mosaics of mods" changes, the engine SHALL push `catalog.changed` to every running mod, visible or hidden, once, with the new catalog as its params, in the same form as the result of `catalog.list`. Each `catalog.list` answered after the change SHALL give the new catalog. No frame SHALL be reloaded.

#### Scenario: Switched on while a mod runs
- **WHEN** a mod runs and the user switches "List the default mosaics of mods" on
- **THEN** the mod receives `catalog.changed` once, whose `mosaics` hold the default mosaics, and no frame was reloaded
- **AND** a `catalog.list` the mod sends afterwards gives the same catalog

#### Scenario: Hidden mod
- **WHEN** the mosaic explorer is hidden behind a mosaic it opened, and the user switches the setting
- **THEN** the hidden explorer receives `catalog.changed` too
