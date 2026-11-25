# Spec Delta

## ADDED Requirements

### Requirement: Tried combinations are recorded
For a sandbox opened with a collection and not from a mosaic, the app SHALL record its mod and collection as a recently used combination once both the mod file and the collection file are loaded, with `sites` or without. A sandbox opened with a tile or without a collection SHALL NOT record a combination. Two combinations SHALL be the same when their mods and their collections have the same resolved sources.

#### Scenario: Tried pair
- **WHEN** a run link opens Flashcards with the laureates' collection
- **THEN** Flashcards with the laureates' collection is a recently used combination

#### Scenario: Mosaic not recorded as a combination
- **WHEN** the user opens "Nobel laureates on the map"
- **THEN** no combination is recorded

#### Scenario: Mod without a collection
- **WHEN** the user chooses "None" in the collection list of a Flashcards sandbox
- **THEN** no combination is recorded for the new sandbox

#### Scenario: Collection that fails to load
- **WHEN** a run link opens Flashcards with a collection that answers HTTP 404
- **THEN** no combination is recorded

## MODIFIED Requirements

### Requirement: What is recorded
For a sandbox opened from a mosaic, a collection or a tile, the app SHALL record as recently used its mod once the mod file is loaded, its collection once the collection file is loaded, and its mosaic once the mosaic file is loaded, and its combination as "Tried combinations are recorded" says. Tiles, the mosaic named by `sites`, and sandboxes opened from a mod link without a collection or tile SHALL NOT be recorded. A recently used mod, collection or mosaic that the catalog does not list, and every recently used combination, is what the stage bar's lists mark as tried recently and not saved in the app.

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
Each kind, mods, collections, mosaics and combinations, SHALL keep at most 10 entries, newest first, compared by resolved source, or by resolved sources for combinations. Recording an entry already kept SHALL move it to the front. Recording an eleventh SHALL drop the oldest.

#### Scenario: Opened again
- **WHEN** the user opened collection A, then collection B, then A again
- **THEN** the recently used collections are A, then B

#### Scenario: Eleventh mod
- **WHEN** ten mods are recently used and the user opens an eleventh
- **THEN** the oldest of the ten is no longer recently used

#### Scenario: Combination tried again
- **WHEN** the user tried Flashcards with collection A, then Book List with collection A, then Flashcards with collection A again
- **THEN** the recently used combinations are Flashcards with A, then Book List with A

### Requirement: Recently used is remembered
Recently used entries SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A stored entry that is not a valid source, or a combination without a valid mod and collection source, SHALL be ignored and dropped. When the storage cannot be read or written, recently used SHALL still work until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user tried a mod outside the catalog and reloads the app page
- **THEN** the stage bar's mod list still holds that mod, marked with the ring

#### Scenario: Combinations kept after a reload
- **WHEN** the user tried Flashcards with the laureates' collection and reloads the app page
- **THEN** the mosaic list still holds that "Unsaved combination", marked with the ring

#### Scenario: Stored before combinations were recorded
- **WHEN** the stored entries have mods, collections and mosaics but no combinations
- **THEN** they are restored, and no combination is recently used

#### Scenario: Mods cannot reach it
- **WHEN** a running mod sends `storage.get` with any key
- **THEN** the result is never the stored recently used entries

### Requirement: Clear recently used
Clearing recently used SHALL drop every entry of the four kinds at once, from the app's storage too. Sandboxes opened afterwards SHALL be recorded again as usual.

#### Scenario: Cleared
- **WHEN** the user tried a mod outside the catalog, clears recently used in Settings, and opens the mod list of a sandbox running a catalog mod
- **THEN** no entry is marked with the ring, and the mod outside the catalog is not listed

#### Scenario: Combinations cleared
- **WHEN** the user tried Flashcards with the laureates' collection, clears recently used in Settings, and opens the mosaic list of "Books by Nobel laureates"
- **THEN** the list holds no "Unsaved combination"
