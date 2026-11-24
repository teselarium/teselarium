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
- **THEN** the result's `mosaics` ends with an entry whose `source` starts with `teselarium-browser:///`, with `listedBy` `"user"`, `place` `"browser"`, `defaultOf` `null` and the provenance of that import

### Requirement: Save request
`userCatalog.save` with `{ content, mosaic?, copiedFrom? }` SHALL show the save confirmation (see `mosaic-editing`) without any permission, and answer the saved mosaic's address, or `null` when nothing was saved. `mosaic` is a stored entry's address, or absent for a new mosaic. `copiedFrom` is the address a copy came from. `content` SHALL be a non-empty string. A wrong param, or a `mosaic` that is not a stored entry, SHALL fail with `-32602`, naming the method and the param.

#### Scenario: New mosaic saved
- **WHEN** the visible mod sends `userCatalog.save` with a valid new draft and the user presses "Save"
- **THEN** the request resolves with a `teselarium-browser:` address, which the catalog lists as a user mosaic

#### Scenario: Missing content
- **WHEN** a mod sends `userCatalog.save` with `{ "mosaic": "teselarium-browser:///r1/a.yaml" }`
- **THEN** the response has an error with code `-32602` whose message is `userCatalog.save: "content" must be a non-empty string`
