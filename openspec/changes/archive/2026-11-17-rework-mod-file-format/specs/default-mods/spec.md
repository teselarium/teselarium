# Spec Delta

## MODIFIED Requirements

### Requirement: Default mods folder
Default mods SHALL live in the default mods folder, `./default_mods/` next to the app, one folder per mod named after the mod, each with a `mod_conf.yaml`. They SHALL be served from the app's origin, so they get their declared permissions. A default mod name SHALL resolve to the folder of that name in the default mods folder, whatever `title` the mod file declares, so an instantiation replaces a default mod by putting another mod in its folder.

#### Scenario: Explorer from the default folder
- **WHEN** the app at `https://example.org/` opens the Mods section
- **THEN** the mod's source is `https://example.org/default_mods/mod_explorer/mod_conf.yaml` and its `open` permission is granted

#### Scenario: Replaced viewer
- **WHEN** the default mods folder's `mod_viewer/mod_conf.yaml` declares `title: "Fancy Viewer"` and the explorer opens `mod_viewer`
- **THEN** that mod is opened

### Requirement: Mod viewer
The mod viewer `mod_viewer` SHALL declare `open` for `"*"`, and SHALL show the mod named by its `target` parameter, using `mods.inspect`: title, version, description, source, API range and whether it matches the app's mod API version, tile type, default mosaic, config, and each declared permission with its reason and whether it would be granted. It SHALL NOT need a collection.

#### Scenario: View the sample mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/book_list`
- **THEN** the viewer's frame shows `Book List`, `1.1.0`, its description, the config value `show_covers`, and the default mosaic's address ending in `samples/mods/book_list/mosaic.yaml`
- **AND** it shows the API range `^0.1.14`, marked as matching, and no "Name" row

#### Scenario: View a mod with a permission
- **WHEN** the viewer shows a fixture mod that declares `show` for `https://upload.wikimedia.org` with the reason `Shows the book covers`
- **THEN** the viewer's frame shows that permission with its reason, marked as granted

#### Scenario: View a mod for another API
- **WHEN** the viewer shows a mod with `api: "^0.2.0"`
- **THEN** the viewer's frame shows `^0.2.0` and the app's mod API version, marked as not matching

#### Scenario: View a mod without a range
- **WHEN** the viewer shows a mod file without `api`
- **THEN** the viewer's frame says that the mod declares no API range

#### Scenario: No target
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame says that no mod was given

#### Scenario: Missing target
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/missing`
- **THEN** the viewer's frame shows an error that names `404`

### Requirement: Mod viewer runs the mod
The mod viewer SHALL offer to open the viewed mod's default mosaic (only when the mod declares one), to run the mod with a collection whose address the user types, or to run it without tiles. Opening the default mosaic SHALL send `mosaics.open` with the mod's `defaultMosaic` as `mosaic`. The other choices SHALL send `mods.open` with the mod's source as `mod` and, when there is one, the typed collection as `collection`. A typed address SHALL be sent as typed, without surrounding spaces, whether it is a full address or a relative path, which is resolved against the app's address.

#### Scenario: Run with the sample tiles
- **WHEN** the viewer shows a mod whose default mosaic names a collection with three tiles of its type, and the user chooses "Open default mosaic"
- **THEN** the viewed mod is the visible mod, opened from its default mosaic, and receives the three tiles
- **AND** the mod viewer is hidden and still running

#### Scenario: Run with a typed collection
- **WHEN** the user types the address of a collection with two books and chooses to run the mod with it
- **THEN** the viewed mod receives the two books

#### Scenario: Run with a relative collection address
- **WHEN** the app's address is `https://example.org/`, a collection with two books is at `https://example.org/test-mods/two_books.yaml`, and the user types `./test-mods/two_books.yaml` and chooses to run the mod with it
- **THEN** the opened run link's `collection` is `./test-mods/two_books.yaml`
- **AND** the viewed mod receives the two books, and the viewer shows no alert

#### Scenario: Run with a bare relative path
- **WHEN** the app's address is `https://example.org/`, a collection with two books is at `https://example.org/test-mods/two_books.yaml`, and the user types `test-mods/two_books.yaml` and chooses to run the mod with it
- **THEN** the viewed mod receives the two books

#### Scenario: Run without tiles
- **WHEN** the user chooses to run the viewed mod without tiles
- **THEN** the opened link has no `collection` and the mod runs with no tiles

#### Scenario: Mod without a sample collection
- **WHEN** the viewer shows a mod that declares no `default_mosaic`
- **THEN** the viewer offers no choice to open a default mosaic

### Requirement: Mod viewer checks the mod
While the mod viewer shows a mod, it SHALL have a "Check mod" button that sends `mods.check` with the viewed mod's source, and the typed collection whenever the collection field is not empty, sent as typed, without surrounding spaces, as "Run with this collection" sends it. Without a mod to show, it SHALL have no such button. While the check runs, the button SHALL be disabled and the viewer SHALL say that the mod is being checked.

#### Scenario: Checking in progress
- **WHEN** the user presses "Check mod" for a mod whose `mount` takes 3 seconds
- **THEN** until the report arrives, the button is disabled and the viewer says that the mod is being checked

#### Scenario: No button without a mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame has no "Check mod" button

#### Scenario: Check with a relative collection address
- **WHEN** the app's address is `https://example.org/`, the viewer shows a mod that declares a default mosaic, and the user types `./test-mods/missing.yaml`, which answers HTTP 404, and presses "Check mod"
- **THEN** the report shows an error finding whose source is `https://example.org/test-mods/missing.yaml` and whose message names `404`
- **AND** the mod's default mosaic is not requested

### Requirement: Viewer cases
The mod viewer's cases SHALL cover showing the metadata of the mod named by its `target` parameter, the API range marked as matching, not matching or missing, a missing, empty or failing `target`, and each run choice: the case answers `mods.open` and `mosaics.open` with `null`, and `requests` shows the request that the choice sends.

#### Scenario: Run without tiles in a case
- **WHEN** a case of the mod viewer mounts it with a fixture mod as `params.target`, answers `mods.open` with `null`, and chooses to run the mod without tiles
- **THEN** the case's `requests` holds a `mods.open` with the fixture mod's source as `mod` and no `collection`

#### Scenario: Open the default mosaic in a case
- **WHEN** a case mounts the viewer with a fixture mod that declares a default mosaic, answers `mosaics.open` with `null`, and chooses "Open default mosaic"
- **THEN** the case's `requests` holds a `mosaics.open` with the fixture mod's `defaultMosaic` as `mosaic`

### Requirement: Collection explorer
The collection explorer `collection_explorer` SHALL declare `open` for `"*"`, and SHALL list each collection location in its config's `collections` with the title, description and number of tiles it gets from `collections.inspect`. A location that cannot be inspected SHALL be listed with the location and the error message. Selecting a collection SHALL send `mods.open` for the mod in its config's `viewer`, with the collection's source as the `target` parameter.

#### Scenario: Vanilla explorer lists the Nobel laureates
- **WHEN** the collection explorer runs with its vanilla config
- **THEN** its frame lists `Nobel Prize in Literature laureates` with the description `Nobel Prize in Literature laureates from 2010 to 2026, ordered by award year.` and its number of tiles

#### Scenario: Select a collection
- **WHEN** the collection explorer lists a collection and the user selects it
- **THEN** the collection viewer is the visible mod and shows the selected collection's title
- **AND** the app's address is a run link with `mod=collection_viewer` and the selected collection's source as `target`

#### Scenario: Collection that cannot be inspected
- **WHEN** the explorer's `collections` list holds `./samples/tiles/missing.yaml`
- **THEN** its frame lists `./samples/tiles/missing.yaml` with a message that names `404`

#### Scenario: Explorer requests no tile
- **WHEN** the collection explorer runs with its vanilla config
- **THEN** no tile file is requested

#### Scenario: Viewer switched off
- **WHEN** `collection_viewer` is switched off and the user selects a collection in the explorer
- **THEN** the explorer stays visible and shows an error that names `collection_viewer`

### Requirement: Collection viewer
The collection viewer `collection_viewer` SHALL declare `open` for `"*"`, and SHALL show the collection named by its `target` parameter, using `collections.inspect`: title, description, source, each entry issue with its level, source and message, and the list of its tiles. It SHALL NOT need a collection to be opened with, and SHALL request no tile.

#### Scenario: View a sample collection
- **WHEN** the app is opened at the run link of `collection_viewer` whose `target` is the Nobel laureates collection's source
- **THEN** the viewer's frame shows `Nobel Prize in Literature laureates`, its description, its source and one item per tile of the collection
- **AND** no tile file is requested

#### Scenario: Collection with entry issues
- **WHEN** the viewer shows a collection whose second entry has both `path` and `url`
- **THEN** its frame shows an error issue that mentions entry 2

#### Scenario: Viewer keeps Tiles active
- **WHEN** the collection explorer opened from Tiles opens the collection viewer
- **THEN** the Tiles item is the current one

### Requirement: Tile viewer shows its place in a collection
With a `from` parameter, the tile viewer SHALL inspect that collection with `collections.inspect`. When its tile's source is in the collection's tiles, it SHALL show the collection's title, as a button that opens the mod in its config's `collection_viewer` with `from` as `target` in a new sandbox, and the tile's position as `<i> of <n>`. Otherwise it SHALL show neither.

#### Scenario: Tile in its collection
- **WHEN** the viewer is opened with the third tile of a collection of sixteen as `tile` and that collection as `from`
- **THEN** its frame shows the collection's title and `3 of 16`

#### Scenario: Open the collection
- **WHEN** the viewer shows its place in a collection and the user activates the collection's title
- **THEN** a collection viewer showing that collection is visible

#### Scenario: Tile no longer in the collection
- **WHEN** the viewer is opened with a `from` collection that does not list its tile
- **THEN** its frame shows the tile, and neither the collection's title nor a position
