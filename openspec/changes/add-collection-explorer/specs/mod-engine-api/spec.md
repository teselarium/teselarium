# Spec Delta

## ADDED Requirements

### Requirement: Inspect a collection
`collections.inspect` with `{ collection }`, where `collection` is a collection location, SHALL read the collection file without requesting any tile and return its index: `source`, `name`, `description`, `tiles` (the resolved address of each tile entry, in entry order, a repeated tile once) and `issues` (the entry issues, each with level `"warning"` or `"error"`). The result SHALL be plain data.

#### Scenario: Inspect the sample collection
- **WHEN** a mod with `open` granted for the app's origin sends `collections.inspect` with `{ "collection": "./fixtures/tiles/books_collection.yaml" }`
- **THEN** the result has source `https://example.org/fixtures/tiles/books_collection.yaml`, name `"Science fiction books"`, three tile addresses and no issues
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

## MODIFIED Requirements

### Requirement: Engine error codes
The engine's own error codes SHALL be `-32000` (storage failed), `-32001` (a mod file or a collection file could not be loaded), `-32002` (permission denied) and `-32003` (the mod is switched off), each with a message that says what failed.

#### Scenario: Storage fails
- **WHEN** a mod sends `storage.set` and the browser storage throws a quota error
- **THEN** the response has an error with code `-32000` whose message is the storage error's message

### Requirement: References in requests resolve against the app's address
Relative mod references and locations in `mods.inspect`, `mods.open` and `collections.inspect` SHALL be resolved against the app's address, so a reference means the same in a request, in the address bar and after a reload.

#### Scenario: Same reference from two mods
- **WHEN** the mod explorer and the mod viewer each inspect `./fixtures/mods/book_list`
- **THEN** both results have the source `https://example.org/fixtures/mods/book_list/mod_conf.yaml`

#### Scenario: Same collection from two mods
- **WHEN** the collection explorer and the collection viewer each inspect `./fixtures/tiles/books_collection.yaml`
- **THEN** both results have the source `https://example.org/fixtures/tiles/books_collection.yaml`
