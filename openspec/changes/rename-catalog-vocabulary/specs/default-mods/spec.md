# Spec Delta

## MODIFIED Requirements

### Requirement: Mod explorer
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod of the catalog, from `catalog.list`, in catalog order, with the title and description it gets from `mods.inspect`. A mod that cannot be inspected SHALL be listed with its source and the error message. A `mods` key in its config SHALL be ignored. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter.

#### Scenario: Vanilla explorer lists the sample
- **WHEN** the mod explorer runs in the vanilla app
- **THEN** its frame lists `Book List` with the description `A grid of book covers, with a card for each book that shows its details and text.`

#### Scenario: Vanilla explorer lists the flashcards sample
- **WHEN** the mod explorer runs in the vanilla app
- **THEN** its frame lists `Flashcards` after `Book List`, with the flashcards mod's description

#### Scenario: Select a mod
- **WHEN** the mod explorer lists a mod and the user selects it
- **THEN** the mod viewer is the visible mod and shows the selected mod's title
- **AND** the app's address is a run link with `mod=mod_viewer` and the selected mod's source as `target`

#### Scenario: Mod that cannot be inspected
- **WHEN** the catalog's mods hold `https://example.org/samples/mods/missing/mod_conf.yaml`
- **THEN** the explorer's frame lists `https://example.org/samples/mods/missing/mod_conf.yaml` with a message that names `404`

### Requirement: Collection explorer
The collection explorer `collection_explorer` SHALL declare `open` for `"*"`, and SHALL list each collection of the catalog, from `catalog.list`, in catalog order, with the title, description and number of tiles it gets from `collections.inspect`. A collection that cannot be inspected SHALL be listed with its source and the error message. A `collections` key in its config SHALL be ignored. Selecting a collection SHALL send `mods.open` for the mod in its config's `viewer`, with the collection's source as the `target` parameter.

#### Scenario: Vanilla explorer lists the Nobel laureates
- **WHEN** the collection explorer runs in the vanilla app
- **THEN** its frame lists `Nobel Prize in Literature laureates` with the description `Nobel Prize in Literature laureates from 2010 to 2026, ordered by award year.` and its number of tiles

#### Scenario: Select a collection
- **WHEN** the collection explorer lists a collection and the user selects it
- **THEN** the collection viewer is the visible mod and shows the selected collection's title
- **AND** the app's address is a run link with `mod=collection_viewer` and the selected collection's source as `target`

#### Scenario: Collection that cannot be inspected
- **WHEN** the catalog's collections hold `https://example.org/samples/tiles/missing.yaml`
- **THEN** the explorer's frame lists `https://example.org/samples/tiles/missing.yaml` with a message that names `404`

#### Scenario: Explorer requests no tile
- **WHEN** the collection explorer runs in the vanilla app
- **THEN** no tile file is requested

#### Scenario: Viewer switched off
- **WHEN** `collection_viewer` is switched off and the user selects a collection in the explorer
- **THEN** the explorer stays visible and shows an error that names `collection_viewer`

### Requirement: Mosaic explorer
The mosaic explorer `mosaic_explorer` SHALL declare `open` for `"*"`, and SHALL list each mosaic of the catalog, from `catalog.list`, in catalog order, as a card with the title and description it gets from `mosaics.inspect`. A mosaic that cannot be inspected SHALL be listed with its source and the error message. A `mosaics` key in its config SHALL be ignored. While the mosaics load, the list SHALL be busy. The explorer SHALL send no request that loads a mod, collection or tile.

#### Scenario: Vanilla explorer lists the sample mosaics
- **WHEN** the mosaic explorer runs in the vanilla app, with "List the default mosaics of mods" off
- **THEN** its frame lists `Books by Nobel laureates`, then `Nobel laureates on the map`, each with its description
- **AND** no mod file, collection file or tile file is requested

#### Scenario: Mosaic that cannot be inspected
- **WHEN** the catalog's mosaics hold `https://example.org/samples/mosaics/missing.yaml`
- **THEN** its frame shows an element with `role="alert"` that holds `https://example.org/samples/mosaics/missing.yaml` and a message naming `404`
