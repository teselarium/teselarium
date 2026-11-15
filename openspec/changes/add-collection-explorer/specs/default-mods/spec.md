# Spec Delta

## ADDED Requirements

### Requirement: Collection explorer
The collection explorer `collection_explorer` SHALL declare `open` for `"*"`, and SHALL list each collection location in its config's `collections` with the name, description and number of tiles it gets from `collections.inspect`. A location that cannot be inspected SHALL be listed with the location and the error message. Selecting a collection SHALL send `mods.open` for the mod in its config's `viewer`, with the collection's source as the `target` parameter.

#### Scenario: Vanilla explorer lists the Nobel laureates
- **WHEN** the collection explorer runs with its vanilla config
- **THEN** its frame lists `Nobel Prize in Literature laureates` with the description `Nobel Prize in Literature laureates from 2010 to 2026, ordered by award year.` and its number of tiles

#### Scenario: Select a collection
- **WHEN** the collection explorer lists a collection and the user selects it
- **THEN** the collection viewer is the visible mod and shows the selected collection's name
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

### Requirement: Collection explorer vanilla config
The collection explorer's vanilla config SHALL list the sample collection of Nobel Prize in Literature laureates, then the sample collection of their books, both from `samples/tiles/`, and use `collection_viewer` as viewer. It SHALL list no sample collection of a mod.

#### Scenario: Vanilla explorer lists the books after the laureates
- **WHEN** the collection explorer runs with its vanilla config
- **THEN** its frame lists `Nobel Prize in Literature laureates books` after `Nobel Prize in Literature laureates`, and no other collection

### Requirement: Collection viewer
The collection viewer `collection_viewer` SHALL declare `open` for `"*"`, and SHALL show the collection named by its `target` parameter, using `collections.inspect`: name, description, source, each entry issue with its level, source and message, and the list of its tiles. It SHALL NOT need a collection to be opened with, and SHALL request no tile.

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

### Requirement: Collection viewer labels tiles by file name
Each tile of the collection viewer's list SHALL be labeled by the file name of its address, decoded, and SHALL show its full address. When two tiles of the list have the same file name, each of them SHALL be labeled by its parent folder and file name. Selecting a tile SHALL do nothing.

#### Scenario: File name label
- **WHEN** the viewer shows a collection with the tile `https://example.org/tiles/2024__han_kang.md`
- **THEN** that item is labeled `2024__han_kang.md` and shows `https://example.org/tiles/2024__han_kang.md`

#### Scenario: Encoded file name
- **WHEN** the viewer shows a collection with the tile `https://example.org/tiles/caf%C3%A9.md`
- **THEN** that item is labeled `café.md`

#### Scenario: Same file name in two folders
- **WHEN** the viewer shows a collection with the tiles `https://example.org/a/index.md` and `https://example.org/b/index.md`
- **THEN** they are labeled `a/index.md` and `b/index.md`

### Requirement: Collection viewer filters its tiles
The collection viewer SHALL have a filter field. Typing in it SHALL show only the tiles whose label holds the typed text, ignoring letter case, and SHALL say how many tiles are shown out of the collection's. An empty filter SHALL show every tile.

#### Scenario: Filter by file name
- **WHEN** the viewer shows the Nobel laureates collection and the user types `HAN` in the filter
- **THEN** only the tiles whose label holds `han` in any letter case are shown, and the frame says how many are shown out of the collection's number of tiles

#### Scenario: Clear the filter
- **WHEN** the user empties the filter
- **THEN** every tile of the collection is shown

### Requirement: Collection viewer reports a missing or failing target
Without `target`, or with an empty `target`, the collection viewer SHALL say that no collection was given. When the collection named by `target` cannot be inspected, for any reason, it SHALL show the error message.

#### Scenario: Empty target
- **WHEN** the app is opened at `#/run?mod=collection_viewer&target=`
- **THEN** the viewer's frame says that no collection was given

#### Scenario: Collection that cannot be fetched
- **WHEN** the viewer is opened with a target that answers HTTP 404
- **THEN** the viewer's frame shows an error whose message names the target's address and `404`

#### Scenario: Collection whose site refuses the app
- **WHEN** the viewer is opened with a target whose request the browser rejects
- **THEN** the viewer's frame shows an error that names the target's address and says that the site may be unreachable or may not allow this app to read its files

#### Scenario: Collection with the wrong structure
- **WHEN** the viewer is opened with a target collection file that has no `tiles` list
- **THEN** the viewer's frame shows an error whose message says that `tiles` must be a list

### Requirement: Collection explorer cases
The collection explorer's cases SHALL cover listing the collections of its config as cards, listing a location that cannot be inspected as an alert, and selecting a collection: the case answers `mods.open` with `null`, and `requests` shows a `mods.open` for the mod in its config's `viewer` with the selected collection's source as the `target` parameter.

#### Scenario: Selecting a collection in a case
- **WHEN** a case of the collection explorer mounts it with a config whose `collections` lists one fixture collection and whose `viewer` is `collection_viewer`, answers `mods.open` with `null`, and selects that collection
- **THEN** the case's `requests` holds a `mods.open` with `mod` `collection_viewer` and `params.target` the fixture collection's source

### Requirement: Collection viewer cases
The collection viewer's cases SHALL cover showing the name, description, source and tiles of the collection named by its `target` parameter, entry issues, labels of tiles that share a file name, the filter, and a missing, empty or failing `target`.

#### Scenario: Shared file names in a case
- **WHEN** a case of the collection viewer mounts it with a fixture collection as `params.target` that lists two tiles named `index.md` in two folders
- **THEN** the case finds two items labeled with each tile's parent folder and `index.md`

## MODIFIED Requirements

### Requirement: Default mods show how to get the app's look
The default mods SHALL get their look only from the theme: semantic HTML, the color scheme, and the `data-ot-variant` attribute. Their own styles SHALL set layout only (display, grid, flex, gaps, widths, alignment, overflow) and SHALL NOT set colors, borders, backgrounds, fonts, radii or shadows. No class or `style` attribute in them SHALL exist to change the look.

#### Scenario: Own styles are layout only
- **WHEN** the mod explorer, the mod viewer, the collection explorer and the collection viewer are running and the rules of each frame's stylesheets outside the `opentesela` layer are listed
- **THEN** no rule sets a color, background, border, font, border radius or shadow property

#### Scenario: Explorer lists mods as cards
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** `Book List` is shown in an `<article>` whose computed background color is the value of `--ot-card`
- **AND** the article holds a button whose accessible name contains `Book List`

#### Scenario: Explorer shows a failure as an alert
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame shows an element with `role="alert"` that holds `./samples/mods/missing` and a message naming `404`, with the computed border color of `--ot-destructive`

#### Scenario: Viewer's main action is primary
- **WHEN** the viewer shows the sample book list mod
- **THEN** the "Run with sample tiles" button's computed background color is the value of `--ot-primary`, and the "Run without tiles" button's is the value of `--ot-background`

#### Scenario: Viewer shows permission statuses as badges
- **WHEN** the viewer shows the sample book list mod
- **THEN** the `show` permission for `https://upload.wikimedia.org` has a badge with the text `granted` and `data-ot-variant="success"`

#### Scenario: Collection explorer lists collections as cards
- **WHEN** the collection explorer runs with its vanilla config
- **THEN** `Nobel Prize in Literature laureates` is shown in an `<article>` whose computed background color is the value of `--ot-card`
- **AND** the article holds a button whose accessible name contains `Nobel Prize in Literature laureates`

#### Scenario: Collection explorer shows a failure as an alert
- **WHEN** the collection explorer's `collections` list holds `./samples/tiles/missing.yaml`
- **THEN** its frame shows an element with `role="alert"` that holds `./samples/tiles/missing.yaml` and a message naming `404`, with the computed border color of `--ot-destructive`

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

### Requirement: Default mod test fixtures
The mods and collections a default mod's cases inspect SHALL be fixtures shipped in a `fixtures/` folder of that default mod, named by their address in the default mods folder, so the cases pass wherever the app is served, whatever samples it ships. Fixtures SHALL NOT be listed by the vanilla mod explorer or the vanilla collection explorer.

#### Scenario: Cases without the samples
- **WHEN** an app built without `samples/` checks `mod_viewer`
- **THEN** the report has status `"pass"` and every test has status `"pass"`

#### Scenario: Fixture address
- **WHEN** the app at `https://example.org/` is built with the fixture mod `default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`
- **THEN** that file is served at `https://example.org/default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`

#### Scenario: Collection cases without the samples
- **WHEN** an app built without `samples/` checks `collection_explorer` and `collection_viewer`
- **THEN** each report has status `"pass"` and every test has status `"pass"`
