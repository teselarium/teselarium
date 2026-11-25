# Spec Delta

## MODIFIED Requirements

### Requirement: Mount context
The mount context SHALL have `mod` (`source`, `title`, `version`, `description`), `mosaic` (`source`, `title`, `description` of the mosaic the mod was opened from, or `null`), `collection` (`source`, `title`, `description` of the collection the mod's tiles were loaded from, or `null` when the mod was opened with a tile or without a collection), `config` (the mod's config, merged with the mosaic's config when the mod was opened from a mosaic), `params` (the parameters of the link that opened the mod, other than `mod`, `collection`, `tile` and `mosaic`, as a mapping of strings), `tiles`, `issues` (the issues from loading and validating the collection or the tile) and `permissions` with `granted` and `denied` lists of `{ category, host, reason }`.

#### Scenario: Sample mount context
- **WHEN** the fixture book list mod, which declares `show` for `https://upload.wikimedia.org`, is opened with its collection from the app's origin
- **THEN** the context's `mod` is `{ source, title: "Book List", version, description }` with no `name`, its `config` is the mod's config and it has three tiles
- **AND** `permissions.granted` holds the `show` permission for `https://upload.wikimedia.org` and `permissions.denied` is empty

#### Scenario: Foreign mod sees its denied permissions
- **WHEN** a mod from another origin that declares one `show` permission is opened
- **THEN** the context's `permissions.granted` is empty and `permissions.denied` holds that permission

#### Scenario: Link parameters
- **WHEN** a mod is opened with `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Ffixtures%2Fmods%2Fbook_list%2Fmod_conf.yaml`
- **THEN** the context's `params` is `{ "target": "https://example.org/fixtures/mods/book_list/mod_conf.yaml" }`

#### Scenario: Mount context of a tile
- **WHEN** a mod without a tile type is opened with `tile` `https://example.org/fixtures/tiles/books/kallocain.md`
- **THEN** the context's `tiles` holds that one tile, with `types` `[]`, `issues` is empty and `collection` is `null`

#### Scenario: Mod opened with a collection
- **WHEN** a mod is opened with `collection` `https://example.org/fixtures/collections/books.yaml`, whose file has the title `Laureates' books` and the description `One book by each laureate.`
- **THEN** the context's `collection` is `{ "source": "https://example.org/fixtures/collections/books.yaml", "title": "Laureates' books", "description": "One book by each laureate." }`

#### Scenario: Collection without a description
- **WHEN** a mod is opened with a collection whose file has no `description`
- **THEN** the context's `collection.description` is `""`

#### Scenario: Mod opened without a collection
- **WHEN** a mod is opened from a run link with a `mod` and no `collection` or `tile`
- **THEN** the context's `collection` is `null`

#### Scenario: Mod not opened from a mosaic
- **WHEN** a mod is opened from a run link with a `mod`
- **THEN** the context's `mosaic` is `null`

#### Scenario: Mod opened from a mosaic
- **WHEN** a mod is opened from the mosaic `https://example.org/fixtures/mosaics/nobel_map.yaml`, titled `Laureates on the map` with the description `Where each laureate was born.`
- **THEN** the context's `mosaic` is `{ "source": "https://example.org/fixtures/mosaics/nobel_map.yaml", "title": "Laureates on the map", "description": "Where each laureate was born." }`
- **AND** the context's `collection` holds the `source`, `title` and `description` of the mosaic's collection

#### Scenario: Reload keeps the collection
- **WHEN** a mod opened with a collection has its tiles reloaded
- **THEN** its `tiles.changed` params are `{ tiles, issues }`, with no `collection`
