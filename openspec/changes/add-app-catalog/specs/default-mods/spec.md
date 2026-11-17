# Spec Delta

## MODIFIED Requirements

### Requirement: Mod explorer
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod of the app's catalog, from `catalog.list`, in catalog order, with the title and description it gets from `mods.inspect`. A mod that cannot be inspected SHALL be listed with its source and the error message. A `mods` key in its config SHALL be ignored. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter.

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

### Requirement: Mod explorer vanilla config
The mod explorer's vanilla config SHALL use `mod_viewer` as viewer and SHALL hold no `mods` key: the mods it lists are the vanilla catalog's.

#### Scenario: Select the flashcards sample
- **WHEN** the user selects `Flashcards` in the mod explorer of the vanilla app
- **THEN** the mod viewer is the visible mod and shows `Flashcards`
- **AND** the app's address is a run link with `mod=mod_viewer` and the flashcards mod's source as `target`

#### Scenario: Vanilla explorer lists the country map sample
- **WHEN** the mod explorer runs in the vanilla app
- **THEN** its frame lists `Country Map` after `Flashcards`, with the country map mod's description

### Requirement: Explorer cases
The mod explorer's cases SHALL answer `catalog.list` with a catalog of fixture mods before mounting, and SHALL cover listing the catalog's mods as cards, listing a mod that cannot be inspected as an alert, and selecting a mod: the case answers `mods.open` with `null`, and `requests` shows a `mods.open` for the mod in its config's `viewer` with the selected mod's source as the `target` parameter.

#### Scenario: Selecting a mod in a case
- **WHEN** a case of the mod explorer answers `catalog.list` with a catalog whose `mods` holds one fixture mod, mounts it with a config whose `viewer` is `mod_viewer`, answers `mods.open` with `null`, and selects that mod
- **THEN** the case's `requests` holds a `mods.open` with `mod` `mod_viewer` and `params.target` the fixture mod's source

### Requirement: Collection explorer
The collection explorer `collection_explorer` SHALL declare `open` for `"*"`, and SHALL list each collection of the app's catalog, from `catalog.list`, in catalog order, with the title, description and number of tiles it gets from `collections.inspect`. A collection that cannot be inspected SHALL be listed with its source and the error message. A `collections` key in its config SHALL be ignored. Selecting a collection SHALL send `mods.open` for the mod in its config's `viewer`, with the collection's source as the `target` parameter.

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

### Requirement: Collection explorer vanilla config
The collection explorer's vanilla config SHALL use `collection_viewer` as viewer and SHALL hold no `collections` key: the collections it lists are the vanilla catalog's.

#### Scenario: Vanilla explorer lists the books after the laureates
- **WHEN** the collection explorer runs in the vanilla app
- **THEN** its frame lists `Nobel Prize in Literature laureates books` after `Nobel Prize in Literature laureates`, and no other collection

### Requirement: Collection explorer cases
The collection explorer's cases SHALL answer `catalog.list` with a catalog of fixture collections before mounting, and SHALL cover listing the catalog's collections as cards, listing a collection that cannot be inspected as an alert, and selecting a collection: the case answers `mods.open` with `null`, and `requests` shows a `mods.open` for the mod in its config's `viewer` with the selected collection's source as the `target` parameter.

#### Scenario: Selecting a collection in a case
- **WHEN** a case of the collection explorer answers `catalog.list` with a catalog whose `collections` holds one fixture collection, mounts it with a config whose `viewer` is `collection_viewer`, answers `mods.open` with `null`, and selects that collection
- **THEN** the case's `requests` holds a `mods.open` with `mod` `collection_viewer` and `params.target` the fixture collection's source

### Requirement: Mosaic explorer
The mosaic explorer `mosaic_explorer` SHALL declare `open` for `"*"`, and SHALL list each mosaic of the app's catalog, from `catalog.list`, in catalog order, as a card with the title and description it gets from `mosaics.inspect`. A mosaic that cannot be inspected SHALL be listed with its source and the error message. A `mosaics` key in its config SHALL be ignored. While the mosaics load, the list SHALL be busy. The explorer SHALL send no request that loads a mod, collection or tile.

#### Scenario: Vanilla explorer lists the sample mosaics
- **WHEN** the mosaic explorer runs in the vanilla app, with "List the default mosaics of mods" off
- **THEN** its frame lists `Books by Nobel laureates`, then `Nobel laureates on the map`, each with its description
- **AND** no mod file, collection file or tile file is requested

#### Scenario: Mosaic that cannot be inspected
- **WHEN** the catalog's mosaics hold `https://example.org/samples/mosaics/missing.yaml`
- **THEN** its frame shows an element with `role="alert"` that holds `https://example.org/samples/mosaics/missing.yaml` and a message naming `404`

### Requirement: Mosaic explorer vanilla config
The mosaic explorer's vanilla config SHALL use `mosaic_viewer` as viewer and SHALL hold no `mosaics` key: the mosaics it lists are the vanilla catalog's, which hold no default mosaic of a mod unless "List the default mosaics of mods" is on.

#### Scenario: Only the sample mosaics
- **WHEN** the mosaic explorer runs in the vanilla app, with "List the default mosaics of mods" off
- **THEN** its frame lists exactly two mosaics, and none of them is the default mosaic of `book_list`, `country_map` or `flashcards`

### Requirement: Mosaic explorer and viewer cases
The cases of the mosaic explorer SHALL answer `catalog.list` with a catalog of fixture mosaics before mounting, and SHALL cover listing the catalog's mosaics, a mosaic that cannot be inspected, a default mosaic's mark, and both buttons, answering `mosaics.open` and `mods.open` with `null`. The cases of the mosaic viewer SHALL cover the metadata, its mod and collection, a failing mod or collection, a missing, empty or failing `target`, the links to the mod and collection viewers, "Open mosaic", and "Check mosaic", whose `mosaics.check` a case cannot answer and the check refuses with `-32002`.

#### Scenario: Open in an explorer case
- **WHEN** a case answers `catalog.list` with a catalog whose `mosaics` holds a fixture mosaic, mounts the explorer, answers `mosaics.open` with `null`, and presses "Open"
- **THEN** the case's `requests` holds a `mosaics.open` whose `mosaic` is the fixture mosaic's source

#### Scenario: Default mosaic in an explorer case
- **WHEN** a case answers `catalog.list` with a fixture mosaic whose `defaultOf` has the title `Listed mod`, and mounts the explorer
- **THEN** that mosaic's card says `Default mosaic of Listed mod`

#### Scenario: Check in a viewer case
- **WHEN** a case mounts the viewer with a fixture mosaic as `params.target` and presses "Check mosaic"
- **THEN** the case's `requests` holds a `mosaics.check` whose `mosaic` is the fixture mosaic's source, with an error with code `-32002`
- **AND** the frame shows the error as an alert, and "Check mosaic" is enabled again

### Requirement: Default mod test fixtures
The mods, collections and mosaics a default mod's cases inspect SHALL be fixtures shipped in a `fixtures/` folder of that default mod, named by their address in the default mods folder, so the cases pass wherever the app is served, whatever samples it ships and whatever its catalog holds. Fixtures SHALL NOT be listed by the vanilla catalog.

#### Scenario: Cases without the samples
- **WHEN** an app built without `samples/` checks `mod_viewer`
- **THEN** the report has status `"pass"` and every test has status `"pass"`

#### Scenario: Fixture address
- **WHEN** the app at `https://example.org/` is built with the fixture mod `default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`
- **THEN** that file is served at `https://example.org/default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`

#### Scenario: Collection cases without the samples
- **WHEN** an app built without `samples/` checks `collection_explorer` and `collection_viewer`
- **THEN** each report has status `"pass"` and every test has status `"pass"`

#### Scenario: Mosaic cases without the samples
- **WHEN** an app built without `samples/` checks `mosaic_explorer` and `mosaic_viewer`
- **THEN** each report has status `"pass"` and every test has status `"pass"`

## ADDED Requirements

### Requirement: Mosaic explorer marks default mosaics
A card of the mosaic explorer for a catalog mosaic with a `defaultOf` SHALL say `Default mosaic of <title>`, with the title of that mod, under the mosaic's title. A card of a mosaic without `defaultOf` SHALL have no such line.

#### Scenario: Vanilla default mosaics
- **WHEN** "List the default mosaics of mods" is on and the mosaic explorer runs in the vanilla app
- **THEN** the card of the book list's default mosaic says `Default mosaic of Book List`, and the cards of the two sample mosaics say no such thing

### Requirement: Explorers follow catalog changes
When the mod explorer, the collection explorer or the mosaic explorer receives `catalog.changed`, it SHALL list the new catalog's entries of its kind, inspected again, in place of its list, without reloading its frame. Its list SHALL be busy while they load.

#### Scenario: Switch turned on behind the explorer
- **WHEN** the mosaic explorer is open, the user switches "List the default mosaics of mods" on in Settings, and opens Mosaics again
- **THEN** the explorer lists the default mosaics after the sample mosaics, and its frame was not reloaded
