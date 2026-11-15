# default-mods Specification

## Purpose

Ships the vanilla app's Explore, Viewer and Maker components as default mods: ordinary sandboxed mods in a default mods folder, which an instantiation can switch off or replace. This app ships the first two, the mod explorer and the mod viewer. They use only the engine API, like any mod.

## Requirements

### Requirement: Default mods folder
Default mods SHALL live in the default mods folder, `./default_mods/` next to the app, one folder per mod named after the mod, each with a `mod_conf.yaml`. They SHALL be served from the app's origin, so they get their declared permissions. A default mod name SHALL resolve to the folder of that name in the default mods folder, whatever `name` the mod file declares, so an instantiation replaces a default mod by putting another mod in its folder.

#### Scenario: Explorer from the default folder
- **WHEN** the app at `https://example.org/` opens the Mods section
- **THEN** the mod's source is `https://example.org/default_mods/mod_explorer/mod_conf.yaml` and its `open` permission is granted

#### Scenario: Replaced viewer
- **WHEN** the default mods folder's `mod_viewer/mod_conf.yaml` declares `name: "fancy_viewer"` and the explorer opens `mod_viewer`
- **THEN** that mod is opened

### Requirement: Default mod settings
The app SHALL have default mod settings with the default mods folder and the list of switched-off default mods. The vanilla app SHALL use `./default_mods/` and no switched-off mods. Which mod, if any, is shown for `#/` SHALL be decided by the Home section of the sidebar's registry, not by the default mod settings.

#### Scenario: Vanilla settings
- **WHEN** the vanilla app is opened and the user opens Mods
- **THEN** the mod explorer runs, and opening the mod viewer is allowed

#### Scenario: Vanilla home is not a mod
- **WHEN** the vanilla app is opened with no hash
- **THEN** no mod frame is visible and the Home page is shown

### Requirement: Default mods are ordinary mods
Default mods SHALL run in a sandbox with the same policy, grants and engine API as any other mod, and SHALL have no other access to the app.

#### Scenario: Explorer sandbox
- **WHEN** the mod explorer is running
- **THEN** its frame has the sandbox value `allow-scripts` and reading `parent.document` inside it fails with a security error

### Requirement: Mod explorer
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod reference in its config's `mods` with the title and description it gets from `mods.inspect`. A reference that cannot be inspected SHALL be listed with the reference and the error message. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter.

#### Scenario: Vanilla explorer lists the sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Book List` with the description `A grid of book covers, with a card for each book that shows its details and text.`

#### Scenario: Vanilla explorer lists the flashcards sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Flashcards` after `Book List`, with the flashcards mod's description

#### Scenario: Select a mod
- **WHEN** the mod explorer lists a mod and the user selects it
- **THEN** the mod viewer is the visible mod and shows the selected mod's title
- **AND** the app's address is a run link with `mod=mod_viewer` and the selected mod's source as `target`

#### Scenario: Mod that cannot be inspected
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame lists `./samples/mods/missing` with a message that names `404`

### Requirement: Mod explorer vanilla config
The mod explorer's vanilla config SHALL list the sample book list mod, then the sample flashcards mod, then the sample country map mod, and use `mod_viewer` as viewer.

#### Scenario: Select the flashcards sample
- **WHEN** the user selects `Flashcards` in the mod explorer with its vanilla config
- **THEN** the mod viewer is the visible mod and shows `Flashcards`
- **AND** the app's address is a run link with `mod=mod_viewer` and the flashcards mod's source as `target`

#### Scenario: Vanilla explorer lists the country map sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Country Map` after `Flashcards`, with the country map mod's description

### Requirement: Mod viewer
The mod viewer `mod_viewer` SHALL declare `open` for `"*"`, and SHALL show the mod named by its `target` parameter, using `mods.inspect`: title, version, description, name, source, API range and whether it matches the app's mod API version, tile type, sample collection, config, and each declared permission with its reason and whether it would be granted. It SHALL NOT need a collection.

#### Scenario: View the sample mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/book_list`
- **THEN** the viewer's frame shows `Book List`, `1.1.0`, its description, the config value `show_covers`, and the `show` permission for `https://upload.wikimedia.org` with the reason `Shows the book covers`, marked as granted
- **AND** it shows the API range `^0.1.5`, marked as matching

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

### Requirement: Mod viewer reports a missing or failing target
Without `target`, or with an empty `target`, the mod viewer SHALL say that no mod was given. When the mod named by `target` cannot be inspected, for any reason, it SHALL show the error message.

#### Scenario: Empty target
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=`
- **THEN** the viewer's frame says that no mod was given

#### Scenario: Target with a format error
- **WHEN** the viewer is opened with a target mod file that has `theme: "dark"` under `mod`
- **THEN** the viewer's frame shows an error whose message says that `theme` must be `"default"` or `"none"`

### Requirement: Mod viewer runs the mod
The mod viewer SHALL offer to run the viewed mod with its sample collection (only when the mod declares one), with a collection whose address the user types, or without tiles. Each choice SHALL send `mods.open` with the mod's source as `mod` and, when there is one, the chosen collection as `collection`. A typed address SHALL be sent as typed, without surrounding spaces, whether it is a full address or a relative path, which is resolved against the app's address.

#### Scenario: Run with the sample tiles
- **WHEN** the viewer shows a mod whose sample collection has three tiles of its type, and the user chooses to run it with its sample tiles
- **THEN** the viewed mod is the visible mod and receives the three tiles of its sample collection
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
- **WHEN** the viewer shows a mod that declares no `sample_collection`
- **THEN** the viewer offers no choice to run it with sample tiles

### Requirement: Default mods show how to get the app's look
The default mods SHALL get their look only from the theme: semantic HTML, the color scheme, and the `data-ot-variant` attribute. Their own styles SHALL set layout only (display, grid, flex, gaps, widths, alignment, overflow) and SHALL NOT set colors, borders, backgrounds, fonts, radii or shadows. No class or `style` attribute in them SHALL exist to change the look.

#### Scenario: Own styles are layout only
- **WHEN** the mod explorer, the mod viewer, the collection explorer, the collection viewer and the tile viewer are running and the rules of each frame's stylesheets outside the `opentesela` layer are listed
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

#### Scenario: Tile viewer draws the tile as a card
- **WHEN** the tile viewer shows a tile
- **THEN** the heading, source, metadata and body are in an `<article>` whose computed background color is the value of `--ot-card`, with an `<hr>` between the source and the metadata and another between the metadata and the body, and the Next button's computed background color is the value of `--ot-primary` when it is shown

### Requirement: Mod viewer checks the mod
While the mod viewer shows a mod, it SHALL have a "Check mod" button that sends `mods.check` with the viewed mod's source, and the typed collection whenever the collection field is not empty, sent as typed, without surrounding spaces, as "Run with this collection" sends it. Without a mod to show, it SHALL have no such button. While the check runs, the button SHALL be disabled and the viewer SHALL say that the mod is being checked.

#### Scenario: Checking in progress
- **WHEN** the user presses "Check mod" for a mod whose `mount` takes 3 seconds
- **THEN** until the report arrives, the button is disabled and the viewer says that the mod is being checked

#### Scenario: No button without a mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame has no "Check mod" button

#### Scenario: Check with a relative collection address
- **WHEN** the app's address is `https://example.org/`, the viewer shows a mod that declares a sample collection, and the user types `./test-mods/missing.yaml`, which answers HTTP 404, and presses "Check mod"
- **THEN** the report shows an error finding whose source is `https://example.org/test-mods/missing.yaml` and whose message names `404`
- **AND** the mod's sample collection is not requested

### Requirement: Mod viewer shows the check report
The mod viewer SHALL show the report's status as a badge, with `data-ot-variant` `success` for `"pass"`, `warning` for `"warn"` and `destructive` for `"fail"`, each test case with its status and message, and each finding with its step, level, source and message. When the request fails, it SHALL show the error message as an alert. The mod viewer SHALL stay the visible mod.

#### Scenario: Sample mod passes
- **WHEN** the viewer shows a mod whose check passes, with a test file of two cases, and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check passed, with a `success` badge and no findings
- **AND** it lists the mod's two cases, both passed
- **AND** the mod viewer is still the visible mod

#### Scenario: Failing mod
- **WHEN** the viewer shows a mod whose entrypoint answers HTTP 404 and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check failed, with a `destructive` badge and a bundle error that names the entrypoint's address and `404`

#### Scenario: Failing case
- **WHEN** the viewer checks a mod whose case `lists books` fails with `no books`
- **THEN** the viewer's frame shows a `destructive` badge and lists `lists books` as failed with the message `no books`

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

### Requirement: Explorer cases
The mod explorer's cases SHALL cover listing the mods of its config as cards, listing a reference that cannot be inspected as an alert, and selecting a mod: the case answers `mods.open` with `null`, and `requests` shows a `mods.open` for the mod in its config's `viewer` with the selected mod's source as the `target` parameter.

#### Scenario: Selecting a mod in a case
- **WHEN** a case of the mod explorer mounts it with a config whose `mods` lists one fixture mod and whose `viewer` is `mod_viewer`, answers `mods.open` with `null`, and selects that mod
- **THEN** the case's `requests` holds a `mods.open` with `mod` `mod_viewer` and `params.target` the fixture mod's source

### Requirement: Viewer cases
The mod viewer's cases SHALL cover showing the metadata of the mod named by its `target` parameter, the API range marked as matching, not matching or missing, a missing, empty or failing `target`, and each run choice: the case answers `mods.open` with `null`, and `requests` shows the `mods.open` that the choice sends.

#### Scenario: Run without tiles in a case
- **WHEN** a case of the mod viewer mounts it with a fixture mod as `params.target`, answers `mods.open` with `null`, and chooses to run the mod without tiles
- **THEN** the case's `requests` holds a `mods.open` with the fixture mod's source as `mod` and no `collection`

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
Each tile of the collection viewer's list SHALL be labeled by the file name of its address, decoded, and SHALL show its full address. When two tiles of the list have the same file name, each of them SHALL be labeled by its parent folder and file name. Selecting a tile SHALL open it (see "Collection viewer opens tiles").

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
The collection viewer's cases SHALL cover showing the name, description, source and tiles of the collection named by its `target` parameter, entry issues, labels of tiles that share a file name, the filter, a missing, empty or failing `target`, and selecting a tile: the case answers `mods.open` with `null`, and `requests` shows a `mods.open` for the mod in its config's `tile_viewer` with the tile's address as `tile` and the collection's source as `params.from`. They SHALL also cover selecting a tile whose `mods.open` is not answered, whose refusal the viewer shows.

#### Scenario: Shared file names in a case
- **WHEN** a case of the collection viewer mounts it with a fixture collection as `params.target` that lists two tiles named `index.md` in two folders
- **THEN** the case finds two items labeled with each tile's parent folder and `index.md`

#### Scenario: Selecting a tile in a case
- **WHEN** a case of the collection viewer mounts it with a fixture collection as `params.target`, answers `mods.open` with `null`, and selects the collection's first tile
- **THEN** the case's `requests` holds a `mods.open` with `mod` `tile_viewer`, that tile's address as `tile` and `params.from` the collection's source

#### Scenario: Refused open in a case
- **WHEN** a case of the collection viewer mounts it with a fixture collection as `params.target` and selects a tile without answering `mods.open`
- **THEN** the viewer still shows the collection, and its `role="status"` region holds the `-32002` refusal's message

### Requirement: Tile viewer
The tile viewer `tile_viewer` SHALL declare `open` for `"*"` and have no tile type. It SHALL show the first tile it receives: a heading, the tile's source, its metadata and its body, drawn by `<ot-tile-body>`. The heading SHALL be the tile's `title` when it is a non-empty string, and the decoded file name of its source otherwise. Without a tile, it SHALL say that no tile was given.

#### Scenario: View a tile
- **WHEN** the app is opened at the run link of `tile_viewer` whose `tile` is a tile with `title: "Kallocain"` and a body
- **THEN** the viewer's frame shows the heading `Kallocain`, the tile's source and its rendered body

#### Scenario: Tile without a title
- **WHEN** the viewer shows the tile `https://example.org/notes/reading_list.md`, which has no `title`
- **THEN** its heading is `reading_list.md`

#### Scenario: No tile
- **WHEN** the app is opened at `#/run?mod=tile_viewer`
- **THEN** the viewer's frame says that no tile was given

### Requirement: Tile viewer draws the tile as one card
The tile viewer SHALL draw the tile as one card: the heading and the source, then a separator and the metadata, then another separator and the body. A tile with an empty body SHALL show neither the second separator nor a body.

#### Scenario: Body in the card
- **WHEN** the viewer shows a tile with metadata and a body
- **THEN** one `<article>` holds the heading, the source, an `<hr>`, the metadata, another `<hr>` and the body, in that order

#### Scenario: Empty body
- **WHEN** the viewer shows a tile whose body is empty
- **THEN** its card ends with the metadata, without a second `<hr>`

### Requirement: Tile viewer shows the metadata
The tile viewer SHALL show the metadata as a description list in frontmatter order, laid out in two columns: each key, with its value beside it. A value that is not a list or a mapping SHALL be shown as written, on the key's row. A list SHALL be a list without bullets, one item per line, in the value column. A mapping SHALL be a nested description list, laid out the same way, in the value column. A tile with empty metadata SHALL show that the file has no metadata instead.

#### Scenario: Nested values
- **WHEN** the viewer shows a tile with `authors: ["Karin Boye"]`, `pages: 156`, `read: true` and `edition: { year: 1940 }`
- **THEN** the metadata lists `authors` with a list holding `Karin Boye`, `pages` with `156`, `read` with `true`, and `edition` with a nested list holding `year` and `1940`, in that order

#### Scenario: Value beside its key
- **WHEN** the viewer shows a tile with `pages: 156` and `genres: ["Dystopian", "Political"]`
- **THEN** `156` is on the same line as `pages`, right of it
- **AND** `Dystopian` and `Political` are on two lines, each right of the key column and without a bullet

#### Scenario: File without metadata
- **WHEN** the viewer shows a markdown file without frontmatter
- **THEN** its frame says that the file has no metadata, and shows the file's text as the body

### Requirement: Tile viewer counts metadata lines
The tile viewer SHALL count the lines of the metadata from its values: a value that is not a list or a mapping takes 1 line, and an image address 2. A list takes the lines of its items, and a mapping those of its values. An empty list or mapping takes 1 line.

#### Scenario: Line counts
- **WHEN** the viewer counts `pages: 156`, `cover: "https://example.org/cover.png"`, `genres: ["Dystopian", "Political"]` and `edition: { year: 1940, place: "Stockholm" }`
- **THEN** they take 1, 2, 2 and 2 lines

### Requirement: Tile viewer collapses long metadata
The tile viewer SHALL show a "Metadata" heading above the metadata. Metadata that takes more than 6 lines SHALL start collapsed, with a button next to the heading that shows all the fields, then shows fewer again. Collapsed, the fields SHALL show in frontmatter order while they fit in 6 lines, and the fields after the first that does not fit SHALL be hidden. Each viewer SHALL start collapsed, also after Previous or Next. Metadata that fits in 6 lines SHALL have no button.

#### Scenario: Long metadata starts collapsed
- **WHEN** the viewer shows a tile with `pages: 156`, `read: true`, `year: 1940`, `language: "Swedish"`, `genres` with 5 items and `source: "https://example.org/books/kallocain"`
- **THEN** it shows `pages`, `read`, `year`, `language`, the first item of `genres` and a line saying `and 4 more`, and hides `source`
- **AND** a button next to the "Metadata" heading says `Show all 6 fields`

#### Scenario: Show all the fields
- **WHEN** the user activates `Show all 6 fields`
- **THEN** every field and every item of `genres` is shown, the `and 4 more` line is hidden, and the button says `Show fewer fields`
- **AND** activating it again shows the collapsed metadata

#### Scenario: Short metadata
- **WHEN** the viewer shows a tile with `title`, `pages` and `read`
- **THEN** every field is shown and there is no button

### Requirement: Tile viewer metadata button looks like a button
The button next to the "Metadata" heading SHALL look like a button without a pointer over it, as the theme's outline button, and SHALL be no taller than the heading.

#### Scenario: Button shape
- **WHEN** the viewer shows a tile whose metadata starts collapsed
- **THEN** the button next to the "Metadata" heading has a visible border and the background of the theme's outline button, `--ot-background`, without a pointer over it
- **AND** it is no taller than the heading

### Requirement: Tile viewer cuts a long list
When collapsed, a list that does not fit SHALL show its first items that fit, followed by a line that says how many more items it has, which counts as one of the 6 lines. The first field SHALL always show, a list at least with its first item.

#### Scenario: Long first list
- **WHEN** the viewer shows a tile whose first field is a list of 20 short items
- **THEN** it shows the first 5 items and a line saying `and 15 more`

### Requirement: Tile viewer links metadata addresses
Each metadata string that is an absolute `http:` or `https:` address SHALL be shown as a link to it with `data-ot-link`, so that following it asks the user as any link of a body does.

#### Scenario: Web address
- **WHEN** the viewer shows a tile with `source: "https://example.org/books/kallocain"`
- **THEN** the value is a link to that address with `data-ot-link`, and clicking it sends `links.open` with that address

### Requirement: Tile viewer shows image thumbnails
When a metadata address's path ends with an image extension (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif` or `.svg`, in any letter case, without its query or fragment), its link SHALL also show a thumbnail of the image, two lines of text high, before the address, loaded lazily. A thumbnail that fails to load SHALL be hidden, leaving the link.

#### Scenario: Image thumbnail
- **WHEN** the viewer shows a tile with `image: "https://media.example.net/covers/Kallocain.JPG?w=200"`, and the image loads
- **THEN** the value is a link to that address that shows a thumbnail of the image, two lines of text high

#### Scenario: Image that fails
- **WHEN** the viewer shows a tile whose `image` ends with `.jpg` and answers HTTP 404
- **THEN** no broken image is shown, and the link to the address is still shown

### Requirement: Tile viewer opens linked tiles
A click on a link of the metadata or of the body whose address's path ends with `.md`, in any letter case, SHALL be cancelled and SHALL send `mods.open` for the mod in the tile viewer's config's `tile_viewer`, with the link's address as `tile`, in a new sandbox. The request SHALL carry the viewer's `from` parameter only when the linked tile is in that collection.

#### Scenario: Link to another tile in the body
- **WHEN** the viewer shows a tile whose body links `./fahrenheit_451.md` and the user clicks the link
- **THEN** a new tile viewer showing that tile is visible, and no action dialog is shown
- **AND** pressing back shows the first tile viewer

#### Scenario: Linked tile outside the collection
- **WHEN** the viewer was opened with `from`, and the user clicks a link to a tile that the collection does not list
- **THEN** the new tile viewer's link has no `from`

### Requirement: Tile viewer shows its place in a collection
With a `from` parameter, the tile viewer SHALL inspect that collection with `collections.inspect`. When its tile's source is in the collection's tiles, it SHALL show the collection's name, as a button that opens the mod in its config's `collection_viewer` with `from` as `target` in a new sandbox, and the tile's position as `<i> of <n>`. Otherwise it SHALL show neither.

#### Scenario: Tile in its collection
- **WHEN** the viewer is opened with the third tile of a collection of sixteen as `tile` and that collection as `from`
- **THEN** its frame shows the collection's name and `3 of 16`

#### Scenario: Open the collection
- **WHEN** the viewer shows its place in a collection and the user activates the collection's name
- **THEN** a collection viewer showing that collection is visible

#### Scenario: Tile no longer in the collection
- **WHEN** the viewer is opened with a `from` collection that does not list its tile
- **THEN** its frame shows the tile, and neither the collection's name nor a position

### Requirement: Tile viewer steps through its collection
When the tile viewer shows its place in a collection, it SHALL have Previous and Next buttons. Each SHALL send `mods.open` for the mod in its config's `tile_viewer` with the neighbouring tile of the collection as `tile`, the same `from` and `replace` `true`. Previous SHALL be disabled on the first tile and Next on the last; the list SHALL NOT wrap around.

#### Scenario: Next tile
- **WHEN** the viewer shows tile 3 of 16 and the user presses Next
- **THEN** the visible tile viewer shows tile 4 with `4 of 16`
- **AND** pressing back shows what was visible before tile 3 was opened

#### Scenario: Last tile
- **WHEN** the viewer shows tile 16 of 16
- **THEN** the Next button is disabled and the Previous button is enabled

### Requirement: Tile viewer reports a collection it cannot read
When the `from` collection cannot be inspected, the tile viewer SHALL still show its tile, without a place in a collection, and SHALL send `ui.notify` with level `"warning"`, the collection's address as `source` and a message that gives the reason.

#### Scenario: Missing from collection
- **WHEN** the viewer is opened with a `from` that answers HTTP 404
- **THEN** its frame shows the tile
- **AND** the sandbox has a warning from the mod whose source is that address and whose text names `404`

### Requirement: Tile viewer vanilla config
The tile viewer's vanilla config SHALL name `tile_viewer` as `tile_viewer` and `collection_viewer` as `collection_viewer`.

#### Scenario: Vanilla config
- **WHEN** `tile_viewer` is inspected
- **THEN** its `config` is `{ "tile_viewer": "tile_viewer", "collection_viewer": "collection_viewer" }`

### Requirement: Collection viewer opens tiles
Each tile of the collection viewer's list SHALL be a button named after its label. Selecting it SHALL send `mods.open` for the mod in the collection viewer's config's `tile_viewer`, with the tile's address as `tile` and the collection's source as the `from` parameter, in a new sandbox. Its vanilla config SHALL name `tile_viewer`. When the request fails, the viewer SHALL stay visible and show the error.

#### Scenario: Open a tile from the list
- **WHEN** the collection viewer shows a collection and the user selects its first tile
- **THEN** the tile viewer is the visible mod and shows that tile with `1 of <n>`
- **AND** the app's address is a run link with `mod=tile_viewer`, the tile's address as `tile` and the collection's source as `from`
- **AND** the Tiles item is still the current one when the viewer was opened from Tiles

#### Scenario: Opening a tile fails
- **WHEN** the user selects a tile in the collection viewer and its `mods.open` is answered with an error
- **THEN** the collection viewer stays visible and shows the error's message

### Requirement: Tile viewer cases
The tile viewer's cases SHALL cover the heading with and without `title`, the metadata with nested values, links and thumbnails, the collapsed metadata with its line count, the button and a long list, a file without metadata, the body, no tile, the place in a fixture collection with Previous and Next sending `mods.open` with `replace` `true`, a tile not in `from`, a `from` that cannot be inspected, and a click on a link to a tile sending `mods.open`.

#### Scenario: Next in a case
- **WHEN** a case of the tile viewer mounts it with the second tile of a fixture collection as its tile and that collection as `params.from`, answers `mods.open` with `null`, and presses Next
- **THEN** the case's `requests` holds a `mods.open` with `mod` `tile_viewer`, the third tile's address as `tile`, the same `params.from` and `replace` `true`
