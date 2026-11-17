# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Storage slots are separate per mod source`
- TO: `### Requirement: Storage slots are separate per mod and context`

## MODIFIED Requirements

### Requirement: Mount context
The mount context SHALL have `mod` (`source`, `title`, `version`, `description`), `mosaic` (`source`, `title`, `description` of the mosaic the mod was opened from, or `null`), `config` (the mod's config, merged with the mosaic's config when the mod was opened from a mosaic), `params` (the parameters of the link that opened the mod, other than `mod`, `collection`, `tile` and `mosaic`, as a mapping of strings), `tiles`, `issues` (the issues from loading and validating the collection or the tile) and `permissions` with `granted` and `denied` lists of `{ category, host, reason }`.

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
- **THEN** the context's `tiles` holds that one tile, with `types` `[]`, and `issues` is empty

#### Scenario: Mod not opened from a mosaic
- **WHEN** a mod is opened from a run link with a `mod`
- **THEN** the context's `mosaic` is `null`

#### Scenario: Mod opened from a mosaic
- **WHEN** a mod is opened from the mosaic `https://example.org/fixtures/mosaics/nobel_map.yaml`, titled `Laureates on the map` with the description `Where each laureate was born.`
- **THEN** the context's `mosaic` is `{ "source": "https://example.org/fixtures/mosaics/nobel_map.yaml", "title": "Laureates on the map", "description": "Where each laureate was born." }`

### Requirement: Storage slots are separate per mod and context
Each mod SHALL have one storage slot per context, identified by the mod's source and the context: the mosaic file's address when the mod was opened from a mosaic, otherwise the collection's source, otherwise the tile's source, otherwise no context. Two slots that differ in mod or context SHALL NOT read each other's values. A slot SHALL keep its values when the app is reloaded. Values stored before slots had a context SHALL NOT be read.

#### Scenario: Same name, different sources
- **WHEN** a mod titled `Book List` at one source stores key `selected`, and a mod titled `Book List` at another source gets key `selected` with the same collection
- **THEN** the second mod receives `null`

#### Scenario: Value kept after a reload
- **WHEN** a mod stores key `selected` and the app page is reloaded and the same mod is opened again with the same collection
- **THEN** getting key `selected` returns the stored value

#### Scenario: Two collections
- **WHEN** `flashcards` stores key `study_fields` while opened with one collection, and is then opened with another collection
- **THEN** getting key `study_fields` returns `null`

#### Scenario: Two mosaics with the same mod and collection
- **WHEN** a mod stores key `selected` while opened from one mosaic, and is then opened from another mosaic file that names the same mod and collection
- **THEN** getting key `selected` returns `null`

#### Scenario: A mosaic and a run link
- **WHEN** a mod stores key `selected` while opened from a mosaic, and is then opened from a run link with the mosaic's mod and collection
- **THEN** getting key `selected` returns `null`

#### Scenario: No tiles
- **WHEN** a mod opened without a collection or a tile stores key `selected`, and is opened again the same way
- **THEN** getting key `selected` returns the stored value

#### Scenario: Value stored before contexts
- **WHEN** the app's storage holds a value under a mod's former per-mod key, and the mod is opened and gets that key
- **THEN** the result is `null`

### Requirement: Inspect a mod
`mods.inspect` with `{ mod }`, where `mod` is a mod reference, SHALL load the mod file without fetching its entrypoint and return `source`, `title`, `version`, `description`, `typeSource`, `defaultMosaic`, `config`, `libraries`, the mod's declared libraries as the loaded mod carries them, and `permissions`, with the `granted` and `denied` lists that mod would get if it were opened. Inspecting SHALL NOT fetch any library file or the default mosaic. When the mod file cannot be loaded, the engine SHALL answer with error code `-32001` and the load error's message.

#### Scenario: Inspect the sample mod
- **WHEN** a mod with `open` granted for the app's origin sends `mods.inspect` with `{ "mod": "./fixtures/mods/book_list" }`
- **THEN** the result has source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`, title `"Book List"`, `defaultMosaic` `https://example.org/fixtures/mods/book_list/mosaic.yaml`, no `name`, and the `show` permission in `permissions.granted`
- **AND** neither `main.js` nor `mosaic.yaml` is requested

#### Scenario: Inspect a mod with a library
- **WHEN** a mod with `open` granted for the app's origin inspects a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/leaflet.js"]`
- **THEN** the result's `libraries` has one entry with name `"leaflet"`, package `"leaflet"`, version `"1.9.4"` and the file whose source is `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js`
- **AND** that file is not requested

#### Scenario: Inspect a missing mod
- **WHEN** a mod with `open` granted for the app's origin sends `mods.inspect` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the response has an error with code `-32001` whose message names `https://example.org/fixtures/mods/missing/mod_conf.yaml` and `404`

### Requirement: Inspect a collection
`collections.inspect` with `{ collection }`, where `collection` is a collection reference, SHALL read the collection file without requesting any tile and return its index: `source`, `title`, `description`, `tiles` (the resolved address of each tile entry, in entry order, a repeated tile once) and `issues` (the entry issues, each with level `"warning"` or `"error"`). The result SHALL be plain data.

#### Scenario: Inspect the sample collection
- **WHEN** a mod with `open` granted for the app's origin sends `collections.inspect` with `{ "collection": "./fixtures/tiles/books_collection.yaml" }`
- **THEN** the result has source `https://example.org/fixtures/tiles/books_collection.yaml`, title `"Science fiction books"`, three tile addresses and no issues
- **AND** no tile file is requested

#### Scenario: Entry issues are returned
- **WHEN** a mod inspects a collection whose second entry has both `path` and `url`
- **THEN** the result's `issues` has one error that mentions entry 2, and `tiles` leaves that entry out

#### Scenario: Structured clone of a collection inspection
- **WHEN** the sample collection is inspected and a structured clone of the result is made
- **THEN** the clone deep-equals the result
