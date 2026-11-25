# Spec Delta

## Purpose

Remembers the mods, collections and mosaics the user tried in combination sandboxes, so the stage bar's lists offer them again, also those the catalog does not list.

## ADDED Requirements

### Requirement: What is recorded
For a sandbox opened from a mosaic, a collection or a tile, the app SHALL record as recently used its mod once the mod file is loaded, its collection once the collection file is loaded, and its mosaic once the mosaic file is loaded. Tiles, the mosaic named by `sites`, and sandboxes opened from a mod link without a collection or tile SHALL NOT be recorded.

#### Scenario: Run link with a collection
- **WHEN** the user opens a run link with a mod outside the catalog and the laureates' collection
- **THEN** that mod and the laureates' collection are recently used

#### Scenario: Explorer not recorded
- **WHEN** the user opens Mods, whose mod explorer runs without a collection
- **THEN** `mod_explorer` is not recently used

#### Scenario: Mod that fails to load
- **WHEN** a run link names a mod whose mod file answers HTTP 404, with a collection
- **THEN** the mod is not recently used

### Requirement: Newest first, ten of each kind
Each kind SHALL keep at most 10 entries, newest first, compared by resolved source. Recording an entry already kept SHALL move it to the front. Recording an eleventh SHALL drop the oldest.

#### Scenario: Opened again
- **WHEN** the user opened collection A, then collection B, then A again
- **THEN** the recently used collections are A, then B

#### Scenario: Eleventh mod
- **WHEN** ten mods are recently used and the user opens an eleventh
- **THEN** the oldest of the ten is no longer recently used

### Requirement: Recently used is remembered
Recently used entries SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A stored entry that is not a valid source SHALL be ignored and dropped. When the storage cannot be read or written, recently used SHALL still work until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user tried a mod outside the catalog and reloads the app page
- **THEN** the stage bar's mod list still holds that mod, marked "Recent"

#### Scenario: Mods cannot reach it
- **WHEN** a running mod sends `storage.get` with any key
- **THEN** the result is never the stored recently used entries

### Requirement: Clear recently used
Clearing recently used SHALL drop every entry of the three kinds at once, from the app's storage too. Sandboxes opened afterwards SHALL be recorded again as usual.

#### Scenario: Cleared
- **WHEN** the user tried a mod outside the catalog, clears recently used in Settings, and opens the mod list of a sandbox running a catalog mod
- **THEN** no entry is marked "Recent", and the mod outside the catalog is not listed
