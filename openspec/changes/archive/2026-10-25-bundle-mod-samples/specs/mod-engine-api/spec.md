## MODIFIED Requirements

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

