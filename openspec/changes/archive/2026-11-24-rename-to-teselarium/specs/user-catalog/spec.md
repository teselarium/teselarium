## MODIFIED Requirements

### Requirement: User catalog entries
The user catalog SHALL hold mosaic entries in order of addition. Each entry SHALL be either stored, with the `teselarium-browser:` address of its file, or remote, with the `http:` or `https:` address of its mosaic file. Two entries SHALL NOT have the same address. The user catalog SHALL be kept in the browser with the browser files store, and restored when the app opens.

#### Scenario: Stored and remote entries
- **WHEN** the user imports `nobel_map.yaml` and then adds `https://mosaics.example.net/maps/laureates.yml` by URL
- **THEN** the user catalog holds the stored mosaic, then the remote one

#### Scenario: Kept after a reload
- **WHEN** the user added a mosaic by URL and reloads the app page
- **THEN** the mosaic is still in the catalog, marked as listed by the user and remote

### Requirement: References that will not open
The review SHALL warn, under a file, for each relative `mod` or `collection` reference of the mosaic whose resolved `teselarium-browser:` address is not stored and is not in the picked files, naming the reference as written. The file SHALL still be importable.

#### Scenario: Single file with a relative collection
- **WHEN** the user imports the single file `nobel_map.yaml`, whose `collection` is `../tiles/laureates`
- **THEN** the review warns that `../tiles/laureates` is not in this browser, so the mosaic will not open until it is, and the file is checked
