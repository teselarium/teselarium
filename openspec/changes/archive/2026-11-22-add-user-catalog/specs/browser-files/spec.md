# Spec Delta

## Purpose

Keeps the text of files the user imports in the browser, at `opentesela-browser:` addresses that the app reads like any other file, so the user's own content opens, inspects and checks the same way as content from a site.

## ADDED Requirements

### Requirement: Browser file addresses
Each stored file SHALL have an absolute address of the scheme `opentesela-browser:`, of the form `opentesela-browser:///<root>/<path>`. `<root>` SHALL be an identifier the app generates once per imported folder or single file, and SHALL never change. `<path>` SHALL be the file's path inside the picked folder, or its file name.

#### Scenario: File of a folder
- **WHEN** the user imports the folder `my-mosaics`, which holds `maps/nobel_map.yaml`
- **THEN** the stored file's address is `opentesela-browser:///<root>/maps/nobel_map.yaml`, with the root generated for that import

#### Scenario: Single file
- **WHEN** the user imports the single file `nobel_map.yaml`
- **THEN** the stored file's address is `opentesela-browser:///<root>/nobel_map.yaml`, with a root of its own

### Requirement: Stored files are read like other files
Wherever the app reads a file, an `opentesela-browser:` address SHALL be read from the store and never requested from the network. A relative reference in a stored file SHALL resolve against the stored file's address, as for a file from a site. An address the store does not hold SHALL fail with an error that names the address and says it is not stored in this browser.

#### Scenario: Stored mosaic opens
- **WHEN** a run link opens `#/run?mosaic=opentesela-browser:///<root>/nobel_map.yaml`, a stored mosaic whose `mod` and `collection` are `https:` addresses
- **THEN** the mosaic's mod runs with its collection, and no request is made for the mosaic's address

#### Scenario: Relative reference outside the store
- **WHEN** a stored mosaic at `opentesela-browser:///<root>/maps/nobel_map.yaml` has the collection `../tiles/laureates`, which the store does not hold
- **THEN** opening it fails with an error that names `opentesela-browser:///<root>/tiles/laureates/collection.yaml` and says it is not stored in this browser

### Requirement: Stored files are not content hosts
An `opentesela-browser:` address SHALL NOT be a content host of a sandbox, SHALL NOT be granted as the app's origin, and SHALL add no source to a mod frame's content policy.

#### Scenario: Stored mosaic's sandbox
- **WHEN** a stored mosaic opens
- **THEN** the sandbox's content hosts hold its mod's and its collection's `https:` origins, and nothing of the scheme `opentesela-browser:`

### Requirement: The store is kept
The app SHALL ask the browser to keep its storage persistently (`navigator.storage.persist()`) when the first file is stored, and SHALL keep working whether the browser agrees or not. Stored files SHALL stay after the page is reloaded or the browser is restarted, until the user removes them or the browser clears the site's data.

#### Scenario: Kept after a reload
- **WHEN** the user imports a mosaic and reloads the app page
- **THEN** the mosaic is still in the catalog and opens

#### Scenario: Persistence refused
- **WHEN** the browser does not agree to keep the storage persistently and the user imports a mosaic
- **THEN** the mosaic is stored and listed, and Settings says the browser may clear it when space runs low

### Requirement: Storage that cannot be used
When the browser files store cannot be opened, for example in a private window that refuses IndexedDB, the app SHALL still start. Importing SHALL fail with an error in the import dialog that says the browser does not let the app store files, and the catalog SHALL list no stored mosaic.

#### Scenario: Store refused
- **WHEN** opening the store fails and the user starts an import
- **THEN** the import dialog shows an error saying that this browser does not let the app store files, and nothing is stored
