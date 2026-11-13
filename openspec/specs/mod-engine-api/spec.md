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
The mount context SHALL have `mod` (`source`, `name`, `title`, `version`, `description`), `config` (the mod's config), `params` (the parameters of the link that opened the mod, other than `mod` and `collection`, as a mapping of strings), `tiles`, `issues` (the issues from loading and validating the collection) and `permissions` with `granted` and `denied` lists of `{ category, host, reason }`.

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

### Requirement: A collection is optional
When a mod is opened without a collection, the context's `tiles` and `issues` SHALL be empty lists and no collection file SHALL be requested.

#### Scenario: Mod opened without a collection
- **WHEN** the sample book list mod is opened without a `collection`
- **THEN** the context's `tiles` and `issues` are empty and no collection file is requested

### Requirement: Mods receive only tiles of their type
When the mod has a tile type, the engine SHALL validate the collection with it and give the mod only the tiles that match, with the type name in their `types`. Tiles that do not match SHALL be left out of `tiles` and appear as warnings in `issues`. Without a tile type, the mod SHALL receive every tile.

#### Scenario: Sample tiles are books
- **WHEN** the sample book list mod is opened with the sample collection
- **THEN** each of the three tiles has `types` `["book"]` and `issues` is empty

#### Scenario: Tile of another type is left out
- **WHEN** the collection has a fourth tile without `country`
- **THEN** the context has three tiles, and `issues` has one warning whose source is the fourth tile's source

#### Scenario: Mod without a tile type
- **WHEN** a mod without `type_path` is opened with the sample collection
- **THEN** the context has the three tiles, each with `types` `[]`

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
The engine's own error codes SHALL be `-32000` (storage failed), `-32001` (a mod file could not be loaded), `-32002` (permission denied) and `-32003` (the mod is switched off), each with a message that says what failed.

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

### Requirement: Storage slots are separate per mod source
Each mod SHALL have its own storage slot, identified by the mod's source. Two mods with different sources SHALL NOT read each other's values, even when they have the same name. A slot SHALL keep its values when the app is reloaded.

#### Scenario: Same name, different sources
- **WHEN** a mod named `book_list` at one source stores key `selected`, and a mod named `book_list` at another source gets key `selected`
- **THEN** the second mod receives `null`

#### Scenario: Value kept after a reload
- **WHEN** a mod stores key `selected` and the app page is reloaded and the same mod is opened again
- **THEN** getting key `selected` returns the stored value

### Requirement: Inspect a mod
`mods.inspect` with `{ mod }`, where `mod` is a mod reference, SHALL load the mod file without fetching its entrypoint and return `source`, `name`, `title`, `version`, `description`, `typeSource`, `sampleCollection`, `config` and `permissions`, with the `granted` and `denied` lists that mod would get if it were opened. When the mod file cannot be loaded, the engine SHALL answer with error code `-32001` and the load error's message.

#### Scenario: Inspect the sample mod
- **WHEN** a mod with `open` granted for the app's origin sends `mods.inspect` with `{ "mod": "./fixtures/mods/book_list" }`
- **THEN** the result has source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`, title `"Book List"`, `sampleCollection` `https://example.org/fixtures/tiles/books_collection.yaml`, and the `show` permission in `permissions.granted`
- **AND** `main.js` is not requested

#### Scenario: Inspect a missing mod
- **WHEN** a mod with `open` granted for the app's origin sends `mods.inspect` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the response has an error with code `-32001` whose message names `https://example.org/fixtures/mods/missing/mod_conf.yaml` and `404`

### Requirement: References in requests resolve against the app's address
Relative mod references and locations in `mods.inspect` and `mods.open` SHALL be resolved against the app's address, so a reference means the same in a request, in the address bar and after a reload.

#### Scenario: Same reference from two mods
- **WHEN** the mod explorer and the mod viewer each inspect `./fixtures/mods/book_list`
- **THEN** both results have the source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`

### Requirement: Open a mod in a new sandbox
`mods.open` with `{ mod, collection, params }`, where `mod` is a mod reference, `collection` an optional collection location and `params` an optional mapping of strings, SHALL open the mod as if the user had followed its run link: in a new sandbox that becomes the visible one, with a new history entry whose address is that run link, and with the requesting sandbox recorded as its opener. It SHALL return `null` once the new sandbox is created. Mods SHALL NOT need to know the app's address format.

#### Scenario: Explorer opens the viewer
- **WHEN** the visible mod explorer sends `mods.open` with `{ "mod": "mod_viewer", "params": { "target": "https://example.org/fixtures/mods/book_list/mod_conf.yaml" } }`
- **THEN** the response's result is `null`, the mod viewer is the visible mod and the explorer is hidden
- **AND** the app's address is `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Ffixtures%2Fmods%2Fbook_list%2Fmod_conf.yaml`

### Requirement: Opened mods report their own failures
Loading and running the opened mod SHALL NOT change the `mods.open` response: its load failures and issues SHALL belong to the new sandbox. A request whose `mod` is not a non-empty string, whose `collection` is neither absent, `null` nor a non-empty string, or whose `params` is present but not a mapping of strings SHALL be answered with error code `-32602`.

#### Scenario: Opened mod is missing
- **WHEN** the visible mod explorer sends `mods.open` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the response's result is `null`, and the new sandbox shows an error that names `404`

#### Scenario: Missing mod reference
- **WHEN** a mod sends `mods.open` with `{ "collection": "./fixtures/tiles/books_collection.yaml" }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `mod` must be a non-empty string

#### Scenario: Parameter that is not a string
- **WHEN** a mod sends `mods.open` with `{ "mod": "mod_viewer", "params": { "target": 3 } }`
- **THEN** the response has an error with code `-32602` whose message names `mods.open` and says that `params.target` must be a string

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
When the tiles of a running mod that was opened with a collection are reloaded, the engine SHALL push `tiles.changed` with `{ tiles, issues }`, following the same rules as the mount context.

#### Scenario: Reloaded tiles are pushed
- **WHEN** the sample collection is reloaded for a running sample book list mod and now lists two books
- **THEN** the mod's `tiles.changed` handlers receive two tiles

#### Scenario: Reloaded tiles have their relative paths resolved
- **WHEN** the collection of a running mod is reloaded and its tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** the mod's `tiles.changed` handlers receive that tile with `metadata.image` `"https://example.org/books/cover.jpg"`

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
Resolving relative paths SHALL change only the tiles the engine gives a mod. A loaded tile SHALL keep its metadata as written, the collection SHALL be validated against the metadata as written, and a tile's `body` SHALL stay exactly as written.

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
