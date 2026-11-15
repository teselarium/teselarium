# Spec Delta

## ADDED Requirements

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

### Requirement: Tile viewer shows the metadata
The tile viewer SHALL show the metadata as a description list in frontmatter order: each key with its value, lists as lists, mappings as nested description lists, and other values as written. A tile with empty metadata SHALL show that the file has no metadata instead.

#### Scenario: Nested values
- **WHEN** the viewer shows a tile with `authors: ["Karin Boye"]`, `pages: 156`, `read: true` and `edition: { year: 1940 }`
- **THEN** the metadata lists `authors` with a list holding `Karin Boye`, `pages` with `156`, `read` with `true`, and `edition` with a nested list holding `year` and `1940`, in that order

#### Scenario: File without metadata
- **WHEN** the viewer shows a markdown file without frontmatter
- **THEN** its frame says that the file has no metadata, and shows the file's text as the body

### Requirement: Tile viewer links metadata addresses
Each metadata string that is an absolute `http:` or `https:` address SHALL be shown as a link to it with `data-ot-link`, so that following it asks the user as any link of a body does. When the address's path ends with an image extension (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif` or `.svg`, in any letter case, without its query or fragment), the link SHALL also show a small thumbnail of the image, loaded lazily, which SHALL be hidden when it fails to load, leaving the link.

#### Scenario: Web address
- **WHEN** the viewer shows a tile with `source: "https://example.org/books/kallocain"`
- **THEN** the value is a link to that address with `data-ot-link`, and clicking it sends `links.open` with that address

#### Scenario: Image thumbnail
- **WHEN** the viewer shows a tile with `image: "https://media.example.net/covers/Kallocain.JPG?w=200"`, and the image loads
- **THEN** the value is a link to that address that shows a thumbnail of the image

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
The tile viewer's cases SHALL cover the heading with and without `title`, the metadata with nested values, links and thumbnails, a file without metadata, the body, no tile, the place in a fixture collection with Previous and Next sending `mods.open` with `replace` `true`, a tile not in `from`, a `from` that cannot be inspected, and a click on a link to a tile sending `mods.open`.

#### Scenario: Next in a case
- **WHEN** a case of the tile viewer mounts it with the second tile of a fixture collection as its tile and that collection as `params.from`, answers `mods.open` with `null`, and presses Next
- **THEN** the case's `requests` holds a `mods.open` with `mod` `tile_viewer`, the third tile's address as `tile`, the same `params.from` and `replace` `true`

## MODIFIED Requirements

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
- **THEN** the heading, source and metadata are in an `<article>` whose computed background color is the value of `--ot-card`, and the Next button's computed background color is the value of `--ot-primary` when it is shown

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
