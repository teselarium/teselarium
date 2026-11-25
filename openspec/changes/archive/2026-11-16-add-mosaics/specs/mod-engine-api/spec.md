# Spec Delta

## MODIFIED Requirements

### Requirement: Mount context
The mount context SHALL have `mod` (`source`, `name`, `title`, `version`, `description`), `mosaic` (`source`, `title`, `description` of the mosaic the mod was opened from, or `null`), `config` (the mod's config, merged with the mosaic's config when the mod was opened from a mosaic), `params` (the parameters of the link that opened the mod, other than `mod`, `collection`, `tile` and `mosaic`, as a mapping of strings), `tiles`, `issues` (the issues from loading and validating the collection or the tile) and `permissions` with `granted` and `denied` lists of `{ category, host, reason }`.

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

#### Scenario: Mod not opened from a mosaic
- **WHEN** a mod is opened from a run link with a `mod`
- **THEN** the context's `mosaic` is `null`

#### Scenario: Mod opened from a mosaic
- **WHEN** a mod is opened from the mosaic `https://example.org/fixtures/mosaics/nobel_map.yaml`, titled `Laureates on the map` with the description `Where each laureate was born.`
- **THEN** the context's `mosaic` is `{ "source": "https://example.org/fixtures/mosaics/nobel_map.yaml", "title": "Laureates on the map", "description": "Where each laureate was born." }`

### Requirement: References in requests resolve against the app's address
Relative mod references, collection references and mosaic references in `mods.inspect`, `mods.open`, `collections.inspect`, `mosaics.inspect` and `mosaics.open` SHALL be resolved against the app's address, so a reference means the same in a request, in the address bar and after a reload.

#### Scenario: Same reference from two mods
- **WHEN** the mod explorer and the mod viewer each inspect `./fixtures/mods/book_list`
- **THEN** both results have the source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`

#### Scenario: Same collection from two mods
- **WHEN** the collection explorer and the collection viewer each inspect `./fixtures/tiles/books_collection.yaml`
- **THEN** both results have the source `https://example.org/fixtures/tiles/books_collection.yaml`

#### Scenario: Collection folder
- **WHEN** a mod inspects the collection `./fixtures/tiles/books`
- **THEN** the result's source is `https://example.org/fixtures/tiles/books/collection.yaml`

#### Scenario: Same mosaic from two mods
- **WHEN** two mods each inspect the mosaic `./fixtures/mosaics/nobel_map`
- **THEN** both results have the source `https://example.org/fixtures/mosaics/nobel_map/mosaic.yaml`

### Requirement: Opened mods report their own failures
Loading and running the opened mod SHALL NOT change the `mods.open` response: its load failures and issues SHALL belong to the new sandbox. A request whose `mod` is not a non-empty string, whose `collection` or `tile` is neither absent, `null` nor a non-empty string, that has both a `collection` and a `tile`, whose `params` is present but not a mapping of strings or holds `mod`, `collection`, `tile` or `mosaic`, or whose `replace` is present but not a boolean SHALL be answered with error code `-32602`.

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

### Requirement: Only the tiles given to mods are resolved
Resolving relative paths SHALL change only the tiles the engine gives a mod. A loaded tile SHALL keep its metadata as written, the collection SHALL be validated against the metadata as written, after the mosaic's aliases when the mod was opened from a mosaic, and a tile's `body` SHALL stay exactly as written.

#### Scenario: Loaded tile keeps the path as written
- **WHEN** the tile `https://example.org/books/kallocain.md` with `image: "./cover.jpg"` is loaded
- **THEN** the loaded tile's `metadata.image` is `"./cover.jpg"`

#### Scenario: Body is not resolved
- **WHEN** a mod is opened with a collection whose tile has the body `![Cover](./cover.jpg)`
- **THEN** that tile's `body` in the context's `tiles` is `![Cover](./cover.jpg)`

## ADDED Requirements

### Requirement: A mosaic's config overrides the mod's config
For a mod opened from a mosaic, `context.config` SHALL be the mod's config merged with the mosaic's config. Where both have a mapping under the same key, the mappings SHALL be merged the same way, key by key. Any other mosaic value, a list, a string, a number, a boolean or `null`, SHALL replace the mod's value. Keys only the mod has SHALL keep the mod's values, and keys only the mosaic has SHALL be added. Neither file SHALL be changed.

#### Scenario: Nested override
- **WHEN** the mod's config is `{ map: { zoom: 2, center: [0, 0] }, markers: { color: "#3366cc" } }` and the mosaic's config is `{ map: { zoom: 3 } }`
- **THEN** `context.config` is `{ map: { zoom: 3, center: [0, 0] }, markers: { color: "#3366cc" } }`

#### Scenario: Lists are replaced
- **WHEN** the mod's config has `columns: [1, 2, 3]` and the mosaic's config has `columns: [4]`
- **THEN** `context.config.columns` is `[4]`

#### Scenario: Null replaces
- **WHEN** the mod's config has `legend: { show: true }` and the mosaic's config has `legend: null`
- **THEN** `context.config.legend` is `null`

#### Scenario: Inspecting the mod
- **WHEN** a mod that a mosaic overrides is inspected with `mods.inspect`
- **THEN** the result's `config` is the mod's own config

### Requirement: A mosaic's aliases rename tile fields
For a mod opened from a mosaic with `aliases`, the engine SHALL rename each tile's top-level metadata keys before validating the tiles against the mod's tile type. For each field of `aliases` that the metadata lacks, the first listed name the metadata has SHALL be renamed to the field, keeping its value and its place in the key order. A field the metadata already has SHALL be kept, and its listed names SHALL be left as written. The mod SHALL receive the renamed metadata, also in `tiles.changed`.

#### Scenario: Laureates become country tiles
- **WHEN** the country map is opened from a mosaic with `aliases: { title: ["name"], country: ["birth_country"] }` and a laureate tile has `name: "Bob Dylan"` and `birth_country: "United States"`
- **THEN** the mod receives that tile with `title: "Bob Dylan"` and `country: "United States"`, and without `name` or `birth_country`
- **AND** the tile is not left out as a tile of another type

#### Scenario: Field already present
- **WHEN** a tile has both `title: "Tarantula"` and `name: "Bob Dylan"`, and the aliases are `{ title: ["name"] }`
- **THEN** the mod receives `title: "Tarantula"` and `name: "Bob Dylan"`

#### Scenario: First listed name wins
- **WHEN** the aliases are `{ country: ["birth_country", "origin"] }` and a tile has both `origin: "Peru"` and `birth_country: "Peru"`
- **THEN** the mod receives `country: "Peru"` and `origin: "Peru"`, and no `birth_country`

#### Scenario: Tile body and source unchanged
- **WHEN** a tile is renamed by aliases
- **THEN** its `source` and its `body` are those of the loaded tile

### Requirement: Inspect a mosaic
`mosaics.inspect` with `{ mosaic }`, where `mosaic` is a mosaic reference, SHALL read the mosaic file without requesting its mod, its collection or any tile, and return `source`, `title`, `description`, `mod` (the resolved address of the mod file), `collection` (the resolved address of the collection file, or `null`), `config` (the mosaic's own config), `aliases` and `permissions`, with the `granted` and `denied` lists the mosaic's `show` lines would get if it were opened without asking.

#### Scenario: Inspect the laureates' map
- **WHEN** a mod with `open` granted for `"*"` sends `mosaics.inspect` with `{ "mosaic": "./fixtures/mosaics/nobel_map" }`
- **THEN** the result's `source` is `https://example.org/fixtures/mosaics/nobel_map/mosaic.yaml`, and its `mod` and `collection` are resolved addresses
- **AND** only the mosaic file is requested

#### Scenario: Show lines of a mosaic from the app's origin
- **WHEN** a mosaic from the app's origin declares `show` for `https://covers.openlibrary.org` and is inspected
- **THEN** the result's `permissions.granted` holds that line and `permissions.denied` is empty

### Requirement: Mosaic inspection failures
When the mosaic file cannot be fetched or read, is not plain YAML or does not follow the mosaic file format, the engine SHALL answer `mosaics.inspect` with error code `-32001` and the load error's message. A request whose `mosaic` is not a non-empty string SHALL be answered with error code `-32602`.

#### Scenario: Missing mosaic
- **WHEN** a mod sends `mosaics.inspect` for a mosaic file that answers HTTP 404
- **THEN** the response has an error with code `-32001` whose message names the file's address and `404`

#### Scenario: Missing reference
- **WHEN** a mod sends `mosaics.inspect` with `{}`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.inspect` and says that `mosaic` must be a non-empty string

### Requirement: Inspecting and opening mosaics need the open permission
The engine SHALL answer `mosaics.inspect` and `mosaics.open` with error code `-32002`, without requesting any file, unless the requesting mod has a granted `open` permission whose host is `"*"` or the origin of the mosaic file. The message SHALL name the origin and say to add it to `permissions.open` in `mod_conf.yaml`, or that the declared permission was not granted.

#### Scenario: Mod without the open permission
- **WHEN** a mod without a granted `open` permission sends `mosaics.inspect` with `{ "mosaic": "https://mosaics.example.net/maps/" }`
- **THEN** the response has an error with code `-32002` whose message names `https://mosaics.example.net` and `permissions.open`
- **AND** nothing is requested from `https://mosaics.example.net`

#### Scenario: The mosaic's mod is on another site
- **WHEN** a mod with `open` granted for `https://example.org` only sends `mosaics.open` for a mosaic at `https://example.org/m.yaml` whose mod is at `https://mods.example.net/clock/`
- **THEN** the response's result is `null` and the new sandbox opens that mod

### Requirement: Open a mosaic in a new sandbox
`mosaics.open` with `{ mosaic, params, replace }`, where `mosaic` is a mosaic reference, `params` an optional mapping of strings and `replace` an optional boolean, SHALL open the mosaic as if the user had followed its run link, with the requesting sandbox as its opener, and return `null` once the new sandbox is created. Its load failures SHALL belong to the new sandbox. Only the visible mod SHALL open mosaics.

#### Scenario: Open the laureates' map
- **WHEN** the visible mod sends `mosaics.open` with `{ "mosaic": "./fixtures/mosaics/nobel_map.yaml" }`
- **THEN** the response's result is `null`, the mosaic's mod is the visible mod, and the requester is hidden
- **AND** the app's address is a run link whose `mosaic` is `https://example.org/fixtures/mosaics/nobel_map.yaml`

#### Scenario: Missing mosaic file
- **WHEN** the visible mod sends `mosaics.open` for a mosaic file that answers HTTP 404
- **THEN** the response's result is `null`, and the new sandbox shows an error that names the file's address and `404`

#### Scenario: Hidden mod
- **WHEN** a mod whose sandbox is not the visible one sends `mosaics.open`
- **THEN** the response has an error with code `-32002` and nothing opens

### Requirement: Mosaic open params are checked
A `mosaics.open` request whose `mosaic` is not a non-empty string, whose `params` is present but not a mapping of strings or holds `mod`, `collection`, `tile` or `mosaic`, or whose `replace` is present but not a boolean SHALL be answered with error code `-32602`, and nothing SHALL open.

#### Scenario: Reserved parameter
- **WHEN** a mod sends `mosaics.open` with `{ "mosaic": "./m.yaml", "params": { "mod": "x" } }`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.open` and says that `params.mod` is reserved

#### Scenario: Missing reference
- **WHEN** a mod sends `mosaics.open` with `{ "params": {} }`
- **THEN** the response has an error with code `-32602` whose message names `mosaics.open` and says that `mosaic` must be a non-empty string

### Requirement: Open a mosaic in place of the requester
`mosaics.open` with `replace: true` SHALL open the mosaic as `mods.open` with `replace: true` opens a mod: in place of the requesting sandbox, which the stage then closes, and with no answer to the requester. The Home mod shown at `#/` SHALL NOT be replaced.

#### Scenario: Replace the requester
- **WHEN** the visible mod sends `mosaics.open` with `{ "mosaic": "./fixtures/mosaics/nobel_map.yaml", "replace": true }`
- **THEN** the mosaic's mod is visible in the requester's history entry, and the requester is closed

#### Scenario: Home mod replacing itself
- **WHEN** the Home mod shown at `#/` sends `mosaics.open` with `replace: true`
- **THEN** the response has an error with code `-32002` whose message says that the home mod cannot be replaced, and nothing opens
