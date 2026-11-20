# mod-engine-api Specification

## Purpose

Defines how a running mod talks to the core engine, which acts as the mod's backend inside the browser tab: a private channel of plain-data messages where the engine pushes events and answers requests, the context a mod receives when it is mounted, the mod's own storage slot, and the requests that let a mod inspect and open other mods.

## Requirements

### Requirement: Private channel per mod
The engine SHALL talk to each running mod only through a message channel created for that mod when its frame starts. The engine SHALL ignore messages that a frame posts to the app's window.

#### Scenario: Requests on the private channel are answered
- **WHEN** a running mod sends a `storage.get` request through its engine API object
- **THEN** it receives the answer

#### Scenario: Window messages are ignored
- **WHEN** code inside a running mod's frame posts a `storage.set` request to `parent` with `postMessage`
- **THEN** nothing is stored and no answer is sent

### Requirement: Messages follow JSON-RPC 2.0
Messages on the channel SHALL be JSON-RPC 2.0 objects. A request SHALL have `jsonrpc: "2.0"`, an `id`, a `method` and optional `params`. Each request SHALL get exactly one response with the same `id` and either a `result` or an `error` with a numeric `code` and a `message`. Events SHALL be notifications: a `method`, `params` and no `id`.

#### Scenario: Response matches the request id
- **WHEN** a mod sends request `{ "jsonrpc": "2.0", "id": 7, "method": "storage.get", "params": { "key": "selected" } }`
- **THEN** it receives exactly one response with `"jsonrpc": "2.0"`, `"id": 7` and a `result`

#### Scenario: Events have no id
- **WHEN** the engine pushes `tiles.changed`
- **THEN** the message has `"jsonrpc": "2.0"`, `"method": "tiles.changed"`, `params` and no `id`

### Requirement: Engine API object in the frame
The engine API object given to `mount` SHALL have `request(method, params)` and `on(event, handler)`. `request` SHALL return a promise that resolves with the response's `result`, or rejects with an error whose message is the response's error message and whose `code` is its error code. `on` SHALL call the handler with the event's `params` each time the event arrives, in registration order.

#### Scenario: Request resolves with the result
- **WHEN** a mod stores `"kallocain"` under key `selected` and then calls `engine.request("storage.get", { key: "selected" })`
- **THEN** the promise resolves with `"kallocain"`

#### Scenario: Request rejects with the error
- **WHEN** a mod calls `engine.request("tiles.delete", {})`
- **THEN** the promise rejects with an error whose `code` is `-32601` and whose message names `tiles.delete`

#### Scenario: Several handlers for one event
- **WHEN** a mod registers two handlers for `tiles.changed` and the engine pushes it
- **THEN** both handlers are called once with the event's params, in the order they were registered

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

### Requirement: Request errors
The engine SHALL answer a request for an unknown method with error code `-32601` and a message naming the method. It SHALL answer a request with wrong params with error code `-32602` and a message naming the method and the problem. It SHALL answer a request that is not a valid JSON-RPC request, but has an `id`, with error code `-32600`.

#### Scenario: Unknown method
- **WHEN** a mod sends a request for method `tiles.delete`
- **THEN** the response has an error with code `-32601` whose message names `tiles.delete`

#### Scenario: Wrong params
- **WHEN** a mod sends `storage.get` with params `{ "key": 3 }`
- **THEN** the response has an error with code `-32602` whose message names `storage.get` and says that `key` must be a non-empty string

#### Scenario: Not a JSON-RPC request
- **WHEN** a mod sends `{ "id": 4, "method": 12 }`
- **THEN** the response has `"id": 4` and an error with code `-32600`

### Requirement: Engine error codes
The engine's own error codes SHALL be `-32000` (storage failed), `-32001` (a mod file or a collection file could not be loaded), `-32002` (permission denied) and `-32003` (the mod is switched off), each with a message that says what failed.

#### Scenario: Storage fails
- **WHEN** a mod sends `storage.set` and the browser storage throws a quota error
- **THEN** the response has an error with code `-32000` whose message is the storage error's message

### Requirement: Storage slot
`storage.get` with `{ key }` SHALL return the value stored under `key` in the mod's slot, or `null`. `storage.set` with `{ key, value }` SHALL store the value and return `null`; storing `null` SHALL remove the key. Keys SHALL be non-empty strings and values plain data (strings, finite numbers, booleans, null, lists and mappings).

#### Scenario: Store and read a value
- **WHEN** a mod sets key `selected` to `{ "source": "https://example.org/fixtures/tiles/books/kallocain.md" }` and then gets key `selected`
- **THEN** the result deep-equals the stored value

#### Scenario: Missing key
- **WHEN** a mod gets a key it never stored
- **THEN** the result is `null`

#### Scenario: Remove a value
- **WHEN** a mod sets key `selected` to `null` and then gets it
- **THEN** the result is `null`

#### Scenario: Value that is not plain data
- **WHEN** a mod sets a key to a `Date`
- **THEN** the response has an error with code `-32602` whose message says that the value must be plain data

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

### Requirement: Inspecting and opening need the open permission
The engine SHALL answer `mods.inspect` and `mods.open` with error code `-32002`, without requesting any file, unless the requesting mod has a granted `open` permission whose host is `"*"` or the origin of the target mod file. The message SHALL name the origin and say to add it to `permissions.open` in `mod_conf.yaml`, or that the declared permission was not granted.

#### Scenario: Mod without the open permission
- **WHEN** a mod without a granted `open` permission sends `mods.inspect` with `{ "mod": "https://mods.example.net/clock/" }`
- **THEN** the response has an error with code `-32002` whose message names `https://mods.example.net` and `permissions.open`
- **AND** nothing is requested from `https://mods.example.net`

#### Scenario: Any site
- **WHEN** a mod with `open` granted for `"*"` sends `mods.inspect` for a mod at `https://mods.example.net/clock/mod_conf.yaml`
- **THEN** the mod file is requested and its metadata is returned

#### Scenario: Foreign mod declares open
- **WHEN** a mod from another origin that declares `open` for `"*"` sends `mods.open`
- **THEN** the response has an error with code `-32002` whose message says that the declared permission was not granted

### Requirement: Only the visible mod opens mods
The engine SHALL answer `mods.open` from a mod whose sandbox is not the visible one with error code `-32002`, and SHALL NOT open the link.

#### Scenario: Hidden mod tries to open a mod
- **WHEN** the mod explorer opened the mod viewer, and the hidden explorer then sends `mods.open`
- **THEN** the response has an error with code `-32002` whose message says that only the visible mod can open mods
- **AND** the mod viewer stays visible

### Requirement: Switched-off default mods are refused
The engine SHALL refuse a default mod that is switched off, whatever reference names it: `mods.inspect` and `mods.open` SHALL be answered with error code `-32003` and a message naming the mod, without requesting its file.

#### Scenario: Viewer switched off
- **WHEN** `mod_viewer` is switched off and a mod with `open` granted for `"*"` sends `mods.open` with `{ "mod": "./default_mods/mod_viewer/mod_conf.yaml" }`
- **THEN** the response has an error with code `-32003` whose message names `mod_viewer`

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

### Requirement: Engine messages are plain data
Everything the engine sends to a mod SHALL be plain data, so it crosses the channel without conversion and the mod never shares objects with the engine.

#### Scenario: Structured clone of the mount context
- **WHEN** the mount context of the sample book list mod is built and a structured clone of it is made
- **THEN** the clone deep-equals the context

#### Scenario: Structured clone of an inspection
- **WHEN** the sample book list mod is inspected and a structured clone of the result is made
- **THEN** the clone deep-equals the result

### Requirement: Relative paths in tiles are resolved
In the tiles the engine gives a mod, each metadata string that starts with `./` or `../` SHALL be replaced by the absolute URL it names, resolved against the tile's `source`. Strings inside lists and nested mappings SHALL be resolved too. Every other value SHALL be left as written: other strings, numbers, booleans, null and mapping keys. This applies to the mount context's `tiles`, including when a mod is mounted for a check.

#### Scenario: Image next to the tile
- **WHEN** a mod is opened with a collection whose tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** that tile's `metadata.image` in the context's `tiles` is `"https://example.org/books/cover.jpg"`

#### Scenario: Path to a parent folder
- **WHEN** the tile `https://example.org/books/kallocain.md` has `image: "../covers/kallocain.jpg"`
- **THEN** that tile's `metadata.image` in the context's `tiles` is `"https://example.org/covers/kallocain.jpg"`

#### Scenario: Strings in lists and nested mappings
- **WHEN** the tile `https://example.org/books/kallocain.md` has `gallery: ["./front.jpg", "./back.jpg"]` and `editions: [{ year: 1940, cover: "./first.jpg" }]`
- **THEN** its `gallery` is `["https://example.org/books/front.jpg", "https://example.org/books/back.jpg"]`
- **AND** its `editions` is `[{ year: 1940, cover: "https://example.org/books/first.jpg" }]`

#### Scenario: Strings without the marker are left as written
- **WHEN** the tile `https://example.org/books/kallocain.md` has `link: "/r/books"`, `file: "cover.jpg"`, `image: "https://upload.wikimedia.org/wikipedia/en/a/ab/KallocainCover.jpg"` and `title: "Kallocain"`
- **THEN** each of those values in the context's `tiles` is the same string as written

#### Scenario: Values that are not strings and keys are left as written
- **WHEN** the tile has `pages: 156`, `read: true`, `series: null` and a mapping `covers: { "./front.jpg": "./front.jpg" }`
- **THEN** `pages`, `read` and `series` are unchanged
- **AND** `covers` is `{ "./front.jpg": "https://example.org/books/front.jpg" }`

#### Scenario: Tile picked from the user's computer
- **WHEN** a tile picked from the user's computer at `file:///library/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** that tile's `metadata.image` in the context's `tiles` is `"file:///library/books/cover.jpg"`

#### Scenario: Mount check gets the resolved tiles
- **WHEN** a mod is checked with a collection whose tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** the mount context of the mount check and of each test case has that tile with `metadata.image` `"https://example.org/books/cover.jpg"`

#### Scenario: Tiles a test passes to mount are used as given
- **WHEN** a case in a mod's test file calls `mount({ tiles })` with a tile whose `metadata.image` is `"./cover.jpg"`
- **THEN** the mod is mounted with that tile's `metadata.image` still `"./cover.jpg"`

### Requirement: Only the tiles given to mods are resolved
Resolving relative paths SHALL change only the tiles the engine gives a mod. A loaded tile SHALL keep its metadata as written, the collection SHALL be validated against the metadata as written, after the mosaic's aliases when the mod was opened from a mosaic, and a tile's `body` SHALL stay exactly as written.

#### Scenario: Loaded tile keeps the path as written
- **WHEN** the tile `https://example.org/books/kallocain.md` with `image: "./cover.jpg"` is loaded
- **THEN** the loaded tile's `metadata.image` is `"./cover.jpg"`

#### Scenario: Body is not resolved
- **WHEN** a mod is opened with a collection whose tile has the body `![Cover](./cover.jpg)`
- **THEN** that tile's `body` in the context's `tiles` is `![Cover](./cover.jpg)`

### Requirement: Notify the user
`ui.notify` with `{ message, level, source }` SHALL add a message from the mod to the stage bar of the mod's sandbox and resolve with `null`, without a dialog and without any permission. `level` SHALL be `"info"` (the default), `"warning"` or `"error"`. `source`, when given, SHALL name what the message is about, and SHALL default to the mod's source. The engine SHALL accept it from hidden mods too.

#### Scenario: Notification with the defaults
- **WHEN** the visible sample book list mod sends `ui.notify` with `{ "message": "Saved" }`
- **THEN** the request resolves with `null`, no dialog is shown, and the sandbox has an `info` message from the mod whose source is the mod's source and whose text is `Saved`

#### Scenario: Error about a tile
- **WHEN** a mod sends `ui.notify` with `{ "message": "Cannot read the rating", "level": "error", "source": "https://example.org/books/kallocain.md" }`
- **THEN** the sandbox has an error from the mod whose source is `https://example.org/books/kallocain.md`

#### Scenario: Hidden mod
- **WHEN** the mod explorer opened the mod viewer, and the hidden explorer sends `ui.notify` with `{ "message": "Done" }`
- **THEN** the request resolves with `null` and the explorer's sandbox has the message

#### Scenario: Same message twice
- **WHEN** a mod sends `ui.notify` with `{ "message": "Saved" }` twice
- **THEN** the sandbox has two messages `Saved`

### Requirement: Notification params are checked
The engine SHALL answer `ui.notify` with error code `-32602`, and add no message, when `message` is not a non-empty string of at most 1000 characters, when `level` is present but not `"info"`, `"warning"` or `"error"`, or when `source` is present but not a non-empty string of at most 1000 characters. The message SHALL name `ui.notify` and the field.

#### Scenario: Message too long
- **WHEN** a mod sends `ui.notify` with a message of 1001 characters
- **THEN** the response has an error with code `-32602` whose message names `ui.notify` and `message`

#### Scenario: Unknown level
- **WHEN** a mod sends `ui.notify` with `{ "message": "Saved", "level": "success" }`
- **THEN** the response has an error with code `-32602` whose message names `ui.notify` and `level`, and the sandbox has no new message

#### Scenario: Missing message
- **WHEN** a mod sends `ui.notify` with `{}`
- **THEN** the response has an error with code `-32602` whose message names `ui.notify` and `message`

### Requirement: Mods receive only collection issues
The `issues` of the mount context and of `tiles.changed` SHALL hold only the issues of loading and validating the collection, each with level `"warning"` or `"error"`. Notifications, from the app or from mods, and the other messages of the stage bar SHALL NOT be sent to mods.

#### Scenario: Loaded collection notification stays in the app
- **WHEN** the sample book list mod starts with the sample collection
- **THEN** its mount context's `issues` is empty, while the stage bar has the notification that the collection was loaded

#### Scenario: Reload sends no notification
- **WHEN** the user presses "Reload tiles" for the sample mod
- **THEN** the `tiles.changed` event's `issues` has no item with level `"info"`

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

### Requirement: Collection inspection failures
When the collection file cannot be fetched or read, is not plain YAML, or has the wrong structure, the engine SHALL answer `collections.inspect` with error code `-32001` and the load error's message, which names the collection's source. A request whose `collection` is not a non-empty string SHALL be answered with error code `-32602`.

#### Scenario: Missing collection file
- **WHEN** a mod with `open` granted for the app's origin sends `collections.inspect` with `{ "collection": "./fixtures/tiles/missing.yaml" }`, which answers HTTP 404
- **THEN** the response has an error with code `-32001` whose message names `https://example.org/fixtures/tiles/missing.yaml` and `404`

#### Scenario: Collection without a tiles list
- **WHEN** a mod inspects a collection file with a `collection` mapping but no `tiles`
- **THEN** the response has an error with code `-32001` whose message says that `tiles` must be a list

#### Scenario: Missing collection param
- **WHEN** a mod sends `collections.inspect` with `{}`
- **THEN** the response has an error with code `-32602` whose message names `collections.inspect` and says that `collection` must be a non-empty string

### Requirement: Inspecting collections needs the open permission
The engine SHALL answer `collections.inspect` with error code `-32002`, without requesting any file, unless the requesting mod has a granted `open` permission whose host is `"*"` or the origin of the collection file. The message SHALL name the origin and say to add it to `permissions.open` in `mod_conf.yaml`, or that the declared permission was not granted. Inspecting a collection SHALL NOT show any dialog.

#### Scenario: Mod without the open permission
- **WHEN** a mod without a granted `open` permission sends `collections.inspect` with `{ "collection": "https://tiles.example.net/books.yaml" }`
- **THEN** the response has an error with code `-32002` whose message names `https://tiles.example.net` and `permissions.open`
- **AND** nothing is requested from `https://tiles.example.net`

#### Scenario: Any site
- **WHEN** a mod with `open` granted for `"*"` sends `collections.inspect` for `https://tiles.example.net/books.yaml`
- **THEN** the collection file is requested and its index is returned

#### Scenario: Foreign mod declares open
- **WHEN** a mod from another origin that declares `open` for `"*"`, without a remembered allow, sends `collections.inspect`
- **THEN** the response has an error with code `-32002` whose message says that the declared permission was not granted
- **AND** no dialog is shown

#### Scenario: Hidden mod inspects
- **WHEN** the collection explorer opened the collection viewer, and the hidden explorer sends `collections.inspect` for a collection it may reach
- **THEN** the index is returned

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

### Requirement: Open a mosaic in place of the requester
`mosaics.open` with `replace: true` SHALL open the mosaic as `mods.open` with `replace: true` opens a mod: in place of the requesting sandbox, which the stage then closes, and with no answer to the requester. The Home mod shown at `#/` SHALL NOT be replaced.

#### Scenario: Replace the requester
- **WHEN** the visible mod sends `mosaics.open` with `{ "mosaic": "./fixtures/mosaics/nobel_map.yaml", "replace": true }`
- **THEN** the mosaic's mod is visible in the requester's history entry, and the requester is closed

#### Scenario: Home mod replacing itself
- **WHEN** the Home mod shown at `#/` sends `mosaics.open` with `replace: true`
- **THEN** the response has an error with code `-32002` whose message says that the home mod cannot be replaced, and nothing opens

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
