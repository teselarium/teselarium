# Spec Delta

## MODIFIED Requirements

### Requirement: Opened mods report their own failures
Loading and running the opened mod SHALL NOT change the `mods.open` response: its load failures and issues SHALL belong to the new sandbox. A request whose `mod` is not a non-empty string, whose `collection` or `tile` is neither absent, `null` nor a non-empty string, that has both a `collection` and a `tile`, whose `params` is present but not a mapping of strings or holds `mod`, `collection`, `tile`, `mosaic` or `sites`, or whose `replace` is present but not a boolean SHALL be answered with error code `-32602`.

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

#### Scenario: Mosaic is a reserved parameter
- **WHEN** a mod sends `mods.open` with `{ "mod": "tile_viewer", "params": { "mosaic": "./m.yaml" } }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `params.mosaic` is reserved

#### Scenario: Replace that is not a boolean
- **WHEN** a mod sends `mods.open` with `{ "mod": "tile_viewer", "replace": "yes" }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `replace` must be a boolean

#### Scenario: Opened tile is missing
- **WHEN** the visible collection viewer sends `mods.open` with a `tile` that answers HTTP 404
- **THEN** the response's result is `null`, and the new sandbox shows an error that names the tile's address and `404`

#### Scenario: Sites is a reserved parameter
- **WHEN** a mod sends `mods.open` with `{ "mod": "tile_viewer", "params": { "sites": "./m.yaml" } }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `params.sites` is reserved

### Requirement: Mosaic open params are checked
A `mosaics.open` request whose `mosaic` is not a non-empty string, whose `params` is present but not a mapping of strings or holds `mod`, `collection`, `tile`, `mosaic` or `sites`, or whose `replace` is present but not a boolean SHALL be answered with error code `-32602`, and nothing SHALL open.

#### Scenario: Reserved parameter
- **WHEN** a mod sends `mosaics.open` with `{ "mosaic": "./m.yaml", "params": { "mod": "x" } }`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.open` and says that `params.mod` is reserved

#### Scenario: Missing reference
- **WHEN** a mod sends `mosaics.open` with `{ "params": {} }`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.open` and says that `mosaic` must be a non-empty string

#### Scenario: Sites is a reserved parameter
- **WHEN** a mod sends `mosaics.open` with `{ "mosaic": "./m.yaml", "params": { "sites": "./n.yaml" } }`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.open` and says that `params.sites` is reserved
