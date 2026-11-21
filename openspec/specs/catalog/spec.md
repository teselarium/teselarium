# catalog Specification

## Purpose

Gives the app one catalog of the mods, collections and mosaics it offers, built from the instance catalog that the instantiation sets and the default mosaics of its mods, so the explorers, the stage bar and every mod list the same things from one place.

## Requirements

### Requirement: The catalog and its parts
The app SHALL have one catalog: three ordered lists, `mods`, `collections` and `mosaics`, of resolved addresses. Its mods and collections SHALL be those of the instance catalog, in its order. Its mosaics SHALL be those of the instance catalog, in its order, followed by the default mosaics while "List the default mosaics of mods" is on (see "Default mosaics join the catalog's mosaics").

#### Scenario: Vanilla catalog with the switch off
- **WHEN** the vanilla app starts with "List the default mosaics of mods" off
- **THEN** the catalog's mods, collections and mosaics are exactly those of the vanilla instance catalog, in its order

#### Scenario: Vanilla catalog with the switch on
- **WHEN** "List the default mosaics of mods" is on in the vanilla app
- **THEN** the catalog's mods and collections are those of the instance catalog, and its mosaics are the instance catalog's two sample mosaics followed by the default mosaics

### Requirement: The instance catalog
The instantiation SHALL set the instance catalog: three ordered lists of references, `mods` (mod references), `collections` (collection references) and `mosaics` (mosaic references). Each entry SHALL be resolved against the app's address with the rules of its kind, so a default mod name stays a default mod name and a collection folder means the `collection.yaml` in it.

#### Scenario: Entries are resolved by kind
- **WHEN** the app at `https://example.org/` has an instance catalog whose `mods` lists `./samples/mods/book_list`, whose `collections` lists `./samples/tiles/literature_nobel_laureates` and whose `mosaics` lists `./samples/mosaics/nobel_books_list.yaml`
- **THEN** the catalog holds the mod `https://example.org/samples/mods/book_list/mod_conf.yaml`, the collection `https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml` and the mosaic `https://example.org/samples/mosaics/nobel_books_list.yaml`

#### Scenario: Default mod name
- **WHEN** the instance catalog's `mods` lists `tile_viewer`
- **THEN** the catalog holds the mod file of `tile_viewer` in the default mods folder

### Requirement: The instance catalog is checked at start
When an entry of the instance catalog is not a non-empty string, cannot be resolved, or resolves to the same file as an earlier entry of the same list, the app SHALL NOT start. It SHALL report an error that names the instance catalog, the list, the entry as written and the reason, under a title that says the instance catalog is invalid, as for an invalid section registry.

#### Scenario: Two references to one mod
- **WHEN** the app starts with an instance catalog whose `mods` lists `./samples/mods/book_list` and `./samples/mods/book_list/mod_conf.yaml`
- **THEN** the app does not render the sidebar or the stage, and reports, under the title "The app cannot start: the instance catalog is invalid", an error that starts with `Instance catalog mods:`, names `./samples/mods/book_list/mod_conf.yaml` and says it repeats an earlier entry

#### Scenario: Empty entry
- **WHEN** the app starts with an instance catalog whose `collections` lists `""`
- **THEN** the app does not start, and reports an error that starts with `Instance catalog collections:` and says the entry is empty

### Requirement: Switched-off default mods are left out
An instance catalog mod entry that names a default mod switched off by the instantiation SHALL be left out of the catalog, whatever reference names it, and SHALL NOT stop the app.

#### Scenario: Switched-off tile viewer
- **WHEN** the instance catalog's `mods` lists `tile_viewer` and `./samples/mods/book_list`, and `tile_viewer` is switched off
- **THEN** the catalog's mods hold only the book list mod

### Requirement: Vanilla instance catalog
The vanilla instance catalog SHALL list, as `mods`, the sample book list, flashcards and country map mods; as `collections`, the sample collection of Nobel Prize in Literature laureates, then the sample collection of their books; and as `mosaics`, `./samples/mosaics/nobel_books_list.yaml`, then `./samples/mosaics/nobel_laureates_map.yaml`. It SHALL list no default mod, no fixture, no collection of a mod and no default mosaic.

#### Scenario: Vanilla lists
- **WHEN** the vanilla app starts
- **THEN** the catalog's mods are Book List, Flashcards and Country Map, in that order, its collections are the laureates and then their books, and its mosaics are "Books by Nobel laureates" and then "Nobel laureates on the map"

#### Scenario: No default mosaic listed
- **WHEN** the vanilla app starts with "List the default mosaics of mods" off
- **THEN** the catalog's mosaics hold neither `samples/mods/book_list/mosaic.yaml`, `samples/mods/flashcards/mosaic.yaml` nor `samples/mods/country_map/mosaic.yaml`

### Requirement: Default mosaics join the catalog's mosaics
While "List the default mosaics of mods" is on, the catalog's mosaics SHALL also hold the default mosaic of each catalog mod that declares one, after the instance catalog's mosaics, in the order of the mods. Each SHALL be marked with its mod's source and title. A mod whose mod file cannot be loaded SHALL add nothing, and SHALL NOT stop the catalog from being read.

#### Scenario: Vanilla default mosaics
- **WHEN** "List the default mosaics of mods" is on in the vanilla app
- **THEN** the catalog's mosaics are the two sample mosaics, then the default mosaics of Book List, Flashcards and Country Map, each marked with its mod's title

#### Scenario: Mod that cannot be loaded
- **WHEN** the switch is on and the instance catalog's `mods` lists a mod whose mod file answers HTTP 404, then the book list mod
- **THEN** the catalog's mosaics end with the book list's default mosaic, and nothing for the missing mod

### Requirement: A default mosaic is listed once
A default mosaic that the instance catalog's `mosaics` already lists, or that an earlier mod already added, SHALL appear once, at its first place. A default mosaic at the place of an instance catalog entry SHALL NOT be marked with a mod.

#### Scenario: Default mosaic also in the instance catalog
- **WHEN** the switch is on and the instance catalog's `mosaics` lists `./samples/mods/book_list/mosaic.yaml`, and its `mods` lists the book list mod
- **THEN** the catalog's mosaics hold that mosaic once, at the instance catalog's place, without a mod mark
