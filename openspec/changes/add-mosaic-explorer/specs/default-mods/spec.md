# Spec Delta

## MODIFIED Requirements

### Requirement: Default mods ship their tests
Each default mod SHALL declare `test_path` and ship a test file whose cases check its behavior from inside its own sandbox. Checking a default mod with `mods.check` SHALL give a report with status `"pass"`, `testsChecked` `true` and every case passed.

#### Scenario: Explorer passes its check
- **WHEN** the visible mod viewer checks `mod_explorer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

#### Scenario: Viewer passes its check
- **WHEN** the visible mod viewer checks `mod_viewer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

#### Scenario: Collection explorer passes its check
- **WHEN** the visible mod viewer checks `collection_explorer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

#### Scenario: Collection viewer passes its check
- **WHEN** the visible mod viewer checks `collection_viewer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

#### Scenario: Tile viewer passes its check
- **WHEN** the visible mod viewer checks `tile_viewer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

#### Scenario: Mosaic explorer passes its check
- **WHEN** the visible mod viewer checks `mosaic_explorer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

#### Scenario: Mosaic viewer passes its check
- **WHEN** the visible mod viewer checks `mosaic_viewer`
- **THEN** the report has status `"pass"`, `testsChecked` `true`, at least one test, and every test has status `"pass"`

### Requirement: Default mod test fixtures
The mods, collections and mosaics a default mod's cases inspect SHALL be fixtures shipped in a `fixtures/` folder of that default mod, named by their address in the default mods folder, so the cases pass wherever the app is served, whatever samples it ships. Fixtures SHALL NOT be listed by the vanilla mod explorer, the vanilla collection explorer or the vanilla mosaic explorer.

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

### Requirement: Mosaic explorer
The mosaic explorer `mosaic_explorer` SHALL declare `open` for `"*"`, and SHALL list each mosaic location in its config's `mosaics`, in order, as a card with the title and description it gets from `mosaics.inspect`. A location that cannot be inspected SHALL be listed with the location and the error message. While the mosaics load, the list SHALL be busy. The explorer SHALL request no mod, collection or tile.

#### Scenario: Vanilla explorer lists the sample mosaics
- **WHEN** the mosaic explorer runs with its vanilla config
- **THEN** its frame lists `Books by Nobel laureates`, then `Nobel laureates on the map`, each with its description
- **AND** no mod file, collection file or tile file is requested

#### Scenario: Mosaic that cannot be inspected
- **WHEN** the explorer's `mosaics` list holds `./samples/mosaics/missing.yaml`
- **THEN** its frame shows an element with `role="alert"` that holds `./samples/mosaics/missing.yaml` and a message naming `404`

### Requirement: Mosaic explorer opens and views mosaics
Each card of the mosaic explorer SHALL have an "Open" button, its primary action, that sends `mosaics.open` with the mosaic's source, and a "View" button that sends `mods.open` for the mod in its config's `viewer`, with the mosaic's source as the `target` parameter. Their accessible names SHALL be "Open <title>" and "View <title>". Both SHALL open in a new sandbox and leave the explorer open behind it. A refusal SHALL be shown in a `role="status"` region, and the explorer SHALL stay visible.

#### Scenario: Open a mosaic
- **WHEN** the explorer lists `Nobel laureates on the map` and the user presses "Open"
- **THEN** the country map is the visible mod, opened from that mosaic, and the Mosaics item is the current one
- **AND** the app's address is a run link whose `mosaic` is the mosaic's source

#### Scenario: View a mosaic
- **WHEN** the user presses "View" on a card
- **THEN** the mosaic viewer is the visible mod and shows that mosaic, and the Mosaics item is the current one

#### Scenario: Viewer switched off
- **WHEN** `mosaic_viewer` is switched off and the user presses "View"
- **THEN** the explorer stays visible and shows an error that names `mosaic_viewer`

### Requirement: Mosaic explorer vanilla config
The mosaic explorer's vanilla config SHALL list `./samples/mosaics/nobel_books_list.yaml`, then `./samples/mosaics/nobel_laureates_map.yaml`, and use `mosaic_viewer` as viewer. It SHALL list no default mosaic of a mod.

#### Scenario: Only the sample mosaics
- **WHEN** the mosaic explorer runs with its vanilla config
- **THEN** its frame lists exactly two mosaics, and none of them is the default mosaic of `book_list`, `country_map` or `flashcards`

### Requirement: Mosaic viewer
The mosaic viewer `mosaic_viewer` SHALL declare `open` for `"*"`, and SHALL show the mosaic named by its `target` parameter, using `mosaics.inspect`: title, description, source, its mod, its collection, its config overrides as indented `key: value` lines, its aliases as `field ← names` lines, and each `show` permission with its host, reason and whether it would be granted. It SHALL request no tile.

#### Scenario: View the laureates' map
- **WHEN** the app is opened at `#/run?mod=mosaic_viewer&target=./samples/mosaics/nobel_laureates_map.yaml`
- **THEN** the viewer's frame shows `Nobel laureates on the map`, its description and source, the aliases `title ← name` and `country ← birth_country`, and the `show` permission for `https://upload.wikimedia.org` marked as granted
- **AND** no tile file is requested

#### Scenario: View the books mosaic
- **WHEN** the viewer shows `nobel_books_list.yaml`
- **THEN** its frame shows the config override `columns: 8` and no aliases

### Requirement: Mosaic viewer shows its mod and collection
The mosaic viewer SHALL inspect the mosaic's mod with `mods.inspect` and show its title, version and API range, marked as matching or not, and SHALL inspect its collection with `collections.inspect` and show its title and number of tiles. A mosaic without a collection SHALL say so. A mod or collection that cannot be inspected SHALL be shown as an alert with its address and the error message, and the rest of the mosaic SHALL still be shown.

#### Scenario: Mod and collection of the laureates' map
- **WHEN** the viewer shows `nobel_laureates_map.yaml`
- **THEN** its frame shows `Country Map` with its version and its API range marked as matching, and `Nobel Prize in Literature laureates` with `17 tiles`

#### Scenario: Missing collection
- **WHEN** the viewer shows a mosaic whose collection answers HTTP 404
- **THEN** its frame shows the mosaic's title, its mod, and an alert that names the collection's address and `404`

### Requirement: Mosaic viewer links its mod and collection
The mod's title SHALL be a button that sends `mods.open` for the mod in the viewer's config's `mod_viewer` with the mod's source as `target`, and the collection's title SHALL be a button that sends `mods.open` for the mod in its config's `collection_viewer` with the collection's source as `target`. `mod_viewer` and `collection_viewer` SHALL be the defaults when the config names none.

#### Scenario: Open the mod viewer
- **WHEN** the viewer shows `nobel_laureates_map.yaml` and the user activates `Country Map`
- **THEN** the mod viewer is the visible mod and shows the country map mod

#### Scenario: Open the collection viewer
- **WHEN** the user activates `Nobel Prize in Literature laureates`
- **THEN** the collection viewer is the visible mod and shows the laureates' collection

### Requirement: Mosaic viewer opens and checks the mosaic
The mosaic viewer SHALL have an "Open mosaic" button, its primary action, that sends `mosaics.open` with the mosaic's source, and a "Check mosaic" button that sends `mosaics.check` with it. While the check runs, the button SHALL be disabled and the viewer SHALL say that the mosaic is being checked. The report SHALL then be shown as the mod viewer shows a mod's, without a tests list.

#### Scenario: Open the mosaic
- **WHEN** the viewer shows `nobel_laureates_map.yaml` and the user presses "Open mosaic"
- **THEN** the country map is the visible mod, opened from that mosaic, and the viewer is hidden and still running

#### Scenario: Check passes
- **WHEN** the user presses "Check mosaic" on `nobel_laureates_map.yaml`
- **THEN** the viewer shows a "Check passed" report with no findings

#### Scenario: Check with a mosaic finding
- **WHEN** the user checks a mosaic whose aliases name a field its mod's tile type does not declare
- **THEN** the report says "Check passed with warnings" and lists a `bundle` warning that names the field

### Requirement: Mosaic viewer reports a missing or failing target
Without `target`, or with an empty `target`, the mosaic viewer SHALL say that no mosaic was given and SHALL have no buttons. When the mosaic cannot be inspected, for any reason, it SHALL show the error message as an alert.

#### Scenario: No target
- **WHEN** the app is opened at `#/run?mod=mosaic_viewer`
- **THEN** the viewer's frame says that no mosaic was given, and has neither "Open mosaic" nor "Check mosaic"

#### Scenario: Mosaic with a format error
- **WHEN** the viewer is opened with a target mosaic file without `title`
- **THEN** the viewer's frame shows an error whose message says that `title` must be a non-empty string

### Requirement: Mosaic explorer and viewer cases
The cases of the mosaic explorer SHALL cover listing fixture mosaics, a location that cannot be inspected, and both buttons, answering `mosaics.open` and `mods.open` with `null`. The cases of the mosaic viewer SHALL cover the metadata, its mod and collection, a failing mod or collection, a missing, empty or failing `target`, the links to the mod and collection viewers, "Open mosaic", and "Check mosaic" with a report the case answers.

#### Scenario: Open in an explorer case
- **WHEN** a case mounts the explorer with a fixture mosaic, answers `mosaics.open` with `null`, and presses "Open"
- **THEN** the case's `requests` holds a `mosaics.open` whose `mosaic` is the fixture mosaic's source

#### Scenario: Check in a viewer case
- **WHEN** a case mounts the viewer with a fixture mosaic as `params.target`, answers `mosaics.check` with a report with status `"warn"`, and presses "Check mosaic"
- **THEN** the frame shows "Check passed with warnings" and the report's findings
