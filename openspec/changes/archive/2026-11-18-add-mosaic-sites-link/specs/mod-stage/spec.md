# Spec Delta

## MODIFIED Requirements

### Requirement: A mosaic link has no mod, collection or tile
A run link with a non-empty `mosaic` SHALL NOT also have a non-empty `mod`, `collection`, `tile` or `sites`. Such a link SHALL open a sandbox that shows an error saying that a link to a mosaic cannot also have a mod, a collection, a tile or sites. It SHALL request no file and SHALL NOT start a mod frame.

#### Scenario: Mosaic and mod
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_map.yaml&mod=mod_viewer`
- **THEN** the stage shows an error that says a link to a mosaic cannot also have a mod, a collection, a tile or sites
- **AND** no file is requested and no mod frame is shown

#### Scenario: Mosaic and collection
- **WHEN** the app is opened at a run link with both a `mosaic` and a `collection`
- **THEN** the stage shows the same error and requests no file

#### Scenario: Mosaic and sites
- **WHEN** the app is opened at a run link with both a `mosaic` and a `sites`
- **THEN** the stage shows the same error and requests no file

## ADDED Requirements

### Requirement: Sites of a mosaic in a run link
The app SHALL accept `sites` in a run link with `mod`: a mosaic reference, resolved against the app's address. Before the mod's frame starts, the app SHALL load that mosaic file and grant its `show` lines to the sandbox (see `mod-sandbox`), and nothing else of it: its mod, collection, config and aliases SHALL NOT be used, and the mount context's `mosaic` SHALL be `null`. `sites` SHALL NOT be in the mod's `params`.

#### Scenario: Covers kept for another mod
- **WHEN** the app is opened at `#/run?mod=./samples/mods/flashcards&collection=./samples/tiles/literature_nobel_laureates_books/collection.yaml&sites=./samples/mosaics/nobel_books_list.yaml`
- **THEN** Flashcards runs with the books, images from `https://covers.openlibrary.org` load, the mount context's `mosaic` is `null`, and its `params` is `{}`

#### Scenario: Shared link after a reload
- **WHEN** the user copies the link of a sandbox with `sites` and opens it in a new page
- **THEN** the mod runs with the same collection and the same granted lines

### Requirement: A sites mosaic that cannot be loaded
When the mosaic file named by `sites` cannot be loaded or does not follow the mosaic file format, the mod SHALL still start, without its lines. The sandbox SHALL get a `warning` message from the app whose source is the mosaic file's address and whose text gives the reason and says that its sites were not granted.

#### Scenario: Missing sites mosaic
- **WHEN** a run link's `sites` names a mosaic file that answers HTTP 404
- **THEN** the mod runs, and the warnings popover lists an item labeled "App" that names the mosaic file's address and `404`
