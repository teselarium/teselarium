# Spec Delta

## MODIFIED Requirements

### Requirement: Read the catalog
`catalog.list` SHALL answer the catalog (see `catalog`) as `{ mods, collections, mosaics }`, each a list in catalog order. Each mod and collection entry SHALL be `{ source }`, the resolved address of its file. Each mosaic entry SHALL be `{ source, defaultOf }`, where `defaultOf` is `{ source, title }` of the mod whose default mosaic it is, or `null`. Params SHALL be ignored.

#### Scenario: Vanilla catalog
- **WHEN** a mod of the vanilla app at `https://example.org/` sends `catalog.list`
- **THEN** the result's `mods` starts with `{ "source": "https://example.org/samples/mods/book_list/mod_conf.yaml" }`, and its `mosaics` are the two sample mosaics, each with `defaultOf` `null`

#### Scenario: Default mosaic entry
- **WHEN** "List the default mosaics of mods" is on and a mod sends `catalog.list`
- **THEN** the result's `mosaics` holds `{ "source": "https://example.org/samples/mods/book_list/mosaic.yaml", "defaultOf": { "source": "https://example.org/samples/mods/book_list/mod_conf.yaml", "title": "Book List" } }`
