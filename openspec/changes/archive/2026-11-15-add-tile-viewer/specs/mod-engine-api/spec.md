# Spec Delta

## ADDED Requirements

### Requirement: Open a mod in place of the requester
`mods.open` with `replace: true` SHALL open the link as `mods.open` does, but in place of the requesting sandbox, which the stage then closes (see `mod-stage`). The requesting mod SHALL be stopped and SHALL get no answer. `replace` absent or `false` SHALL open a new sandbox as before. The home mod shown at `#/` SHALL be answered with error code `-32002`, and nothing SHALL be opened.

#### Scenario: Viewer replaces itself
- **WHEN** the visible tile viewer sends `mods.open` with `{ "mod": "tile_viewer", "tile": "https://example.org/fixtures/tiles/books/kallocain.md", "replace": true }`
- **THEN** a tile viewer showing that tile is visible, and the requesting tile viewer's frame is no longer in the page

#### Scenario: Home mod cannot be replaced
- **WHEN** the Home section's mod at `#/` sends `mods.open` with `replace: true`
- **THEN** the response has an error with code `-32002` whose message says that the home mod cannot be replaced
- **AND** the home mod stays visible

#### Scenario: Hidden mod cannot replace itself
- **WHEN** a hidden mod sends `mods.open` with `replace: true`
- **THEN** the response has an error with code `-32002` whose message says that only the visible mod can open mods

## MODIFIED Requirements

### Requirement: Mount context
The mount context SHALL have `mod` (`source`, `name`, `title`, `version`, `description`), `config` (the mod's config), `params` (the parameters of the link that opened the mod, other than `mod`, `collection` and `tile`, as a mapping of strings), `tiles`, `issues` (the issues from loading and validating the collection or the tile) and `permissions` with `granted` and `denied` lists of `{ category, host, reason }`.

#### Scenario: Sample mount context
- **WHEN** the sample book list mod is opened with the sample collection from the app's origin
- **THEN** the context's `mod.name` is `"book_list"`, its `config` is the mod's config and it has three tiles
- **AND** `permissions.granted` holds the `show` permission for `https://upload.wikimedia.org` and `permissions.denied` is empty

#### Scenario: Foreign mod sees its denied permissions
- **WHEN** a mod from another origin that declares one `show` permission is opened
- **THEN** the context's `permissions.granted` is empty and `permissions.denied` holds that permission

#### Scenario: Link parameters
- **WHEN** a mod is opened with `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Ffixtures%2Fmods%2Fbook_list%2Fmod_conf.yaml`
- **THEN** the context's `params` is `{ "target": "https://example.org/fixtures/mods/book_list/mod_conf.yaml" }`

#### Scenario: Mount context of a tile
- **WHEN** a mod without a tile type is opened with `tile` `https://example.org/fixtures/tiles/books/kallocain.md`
- **THEN** the context's `tiles` holds that one tile, with `types` `[]`, and `issues` is empty

### Requirement: A collection is optional
When a mod is opened without a collection or a tile, the context's `tiles` and `issues` SHALL be empty lists and no collection or tile file SHALL be requested.

#### Scenario: Mod opened without a collection
- **WHEN** the sample book list mod is opened without a `collection`
- **THEN** the context's `tiles` and `issues` are empty and no collection file is requested

### Requirement: Mods receive only tiles of their type
When the mod has a tile type, the engine SHALL validate the collection or the tile with it and give the mod only the tiles that match, with the type name in their `types`. Tiles that do not match SHALL be left out of `tiles` and appear as warnings in `issues`. Without a tile type, the mod SHALL receive every tile.

#### Scenario: Sample tiles are books
- **WHEN** the sample book list mod is opened with the sample collection
- **THEN** each of the three tiles has `types` `["book"]` and `issues` is empty

#### Scenario: Tile of another type is left out
- **WHEN** the collection has a fourth tile without `country`
- **THEN** the context has three tiles, and `issues` has one warning whose source is the fourth tile's source

#### Scenario: Mod without a tile type
- **WHEN** a mod without `type_path` is opened with the sample collection
- **THEN** the context has the three tiles, each with `types` `[]`

#### Scenario: Single tile of another type
- **WHEN** the sample book list mod is opened with a `tile` that does not match the book tile type
- **THEN** the context's `tiles` is empty, and `issues` has one warning whose source is that tile's source

### Requirement: Open a mod in a new sandbox
`mods.open` with `{ mod, collection, tile, params, replace }`, where `mod` is a mod reference, `collection` an optional collection location, `tile` an optional tile location, `params` an optional mapping of strings and `replace` an optional boolean, SHALL open the mod as if the user had followed its run link: in a new sandbox that becomes the visible one, with a new history entry whose address is that run link, and with the requesting sandbox recorded as its opener, unless `replace` is `true` (see "Open a mod in place of the requester"). It SHALL return `null` once the new sandbox is created. Mods SHALL NOT need to know the app's address format.

#### Scenario: Explorer opens the viewer
- **WHEN** the visible mod explorer sends `mods.open` with `{ "mod": "mod_viewer", "params": { "target": "https://example.org/fixtures/mods/book_list/mod_conf.yaml" } }`
- **THEN** the response's result is `null`, the mod viewer is the visible mod and the explorer is hidden
- **AND** the app's address is `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Ffixtures%2Fmods%2Fbook_list%2Fmod_conf.yaml`

#### Scenario: Collection viewer opens a tile
- **WHEN** the visible collection viewer sends `mods.open` with `{ "mod": "tile_viewer", "tile": "https://example.org/fixtures/tiles/books/kallocain.md", "params": { "from": "https://example.org/fixtures/tiles/books_collection.yaml" } }`
- **THEN** the response's result is `null` and the tile viewer is the visible mod, with that tile
- **AND** the app's address is a run link with `mod=tile_viewer`, the tile's address as `tile` and the collection's address as `from`

### Requirement: Opened mods report their own failures
Loading and running the opened mod SHALL NOT change the `mods.open` response: its load failures and issues SHALL belong to the new sandbox. A request whose `mod` is not a non-empty string, whose `collection` or `tile` is neither absent, `null` nor a non-empty string, that has both a `collection` and a `tile`, whose `params` is present but not a mapping of strings or holds `mod`, `collection` or `tile`, or whose `replace` is present but not a boolean SHALL be answered with error code `-32602`.

#### Scenario: Opened mod is missing
- **WHEN** the visible mod explorer sends `mods.open` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the response's result is `null`, and the new sandbox shows an error that names `404`

#### Scenario: Missing mod reference
- **WHEN** a mod sends `mods.open` with `{ "collection": "./fixtures/tiles/books_collection.yaml" }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `mod` must be a non-empty string

#### Scenario: Parameter that is not a string
- **WHEN** a mod sends `mods.open` with `{ "mod": "mod_viewer", "params": { "target": 3 } }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `params.target` must be a string

#### Scenario: Collection and tile
- **WHEN** a mod sends `mods.open` with both a `collection` and a `tile`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that a link cannot have both

#### Scenario: Reserved parameter
- **WHEN** a mod sends `mods.open` with `{ "mod": "tile_viewer", "params": { "tile": "./a.md" } }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `params.tile` is reserved

#### Scenario: Replace that is not a boolean
- **WHEN** a mod sends `mods.open` with `{ "mod": "tile_viewer", "replace": "yes" }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `replace` must be a boolean

#### Scenario: Opened tile is missing
- **WHEN** the visible collection viewer sends `mods.open` with a `tile` that answers HTTP 404
- **THEN** the response's result is `null`, and the new sandbox shows an error that names the tile's address and `404`

### Requirement: Tiles changed event
When the tiles of a running mod that was opened with a collection or a tile are reloaded, the engine SHALL push `tiles.changed` with `{ tiles, issues }`, following the same rules as the mount context.

#### Scenario: Reloaded tiles are pushed
- **WHEN** the sample collection is reloaded for a running sample book list mod and now lists two books
- **THEN** the mod's `tiles.changed` handlers receive two tiles

#### Scenario: Reloaded tiles have their relative paths resolved
- **WHEN** the collection of a running mod is reloaded and its tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** the mod's `tiles.changed` handlers receive that tile with `metadata.image` `"https://example.org/books/cover.jpg"`

#### Scenario: Reloaded tile is pushed
- **WHEN** a running mod opened with a `tile` has its tile reloaded
- **THEN** the mod's `tiles.changed` handlers receive one tile with the file's current metadata
