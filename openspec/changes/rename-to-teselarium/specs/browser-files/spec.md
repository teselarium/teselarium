## MODIFIED Requirements

### Requirement: Browser file addresses
Each stored file SHALL have an absolute address of the scheme `teselarium-browser:`, of the form `teselarium-browser:///<root>/<path>`. `<root>` SHALL be an identifier the app generates once per imported folder or single file, and SHALL never change. `<path>` SHALL be the file's path inside the picked folder, or its file name.

#### Scenario: File of a folder
- **WHEN** the user imports the folder `my-mosaics`, which holds `maps/nobel_map.yaml`
- **THEN** the stored file's address is `teselarium-browser:///<root>/maps/nobel_map.yaml`, with the root generated for that import

#### Scenario: Single file
- **WHEN** the user imports the single file `nobel_map.yaml`
- **THEN** the stored file's address is `teselarium-browser:///<root>/nobel_map.yaml`, with a root of its own

### Requirement: Stored files are read like other files
Wherever the app reads a file, an `teselarium-browser:` address SHALL be read from the store and never requested from the network. A relative reference in a stored file SHALL resolve against the stored file's address, as for a file from a site. An address the store does not hold SHALL fail with an error that names the address and says it is not stored in this browser.

#### Scenario: Stored mosaic opens
- **WHEN** a run link opens `#/run?mosaic=teselarium-browser:///<root>/nobel_map.yaml`, a stored mosaic whose `mod` and `collection` are `https:` addresses
- **THEN** the mosaic's mod runs with its collection, and no request is made for the mosaic's address

#### Scenario: Relative reference outside the store
- **WHEN** a stored mosaic at `teselarium-browser:///<root>/maps/nobel_map.yaml` has the collection `../tiles/laureates`, which the store does not hold
- **THEN** opening it fails with an error that names `teselarium-browser:///<root>/tiles/laureates/collection.yaml` and says it is not stored in this browser

### Requirement: Stored files are not content hosts
An `teselarium-browser:` address SHALL NOT be a content host of a sandbox, SHALL NOT be granted as the app's origin, and SHALL add no source to a mod frame's content policy.

#### Scenario: Stored mosaic's sandbox
- **WHEN** a stored mosaic opens
- **THEN** the sandbox's content hosts hold its mod's and its collection's `https:` origins, and nothing of the scheme `teselarium-browser:`
