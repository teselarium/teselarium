## MODIFIED Requirements

### Requirement: Mod viewer
The mod viewer `mod_viewer` SHALL declare `open` for `"*"`, and SHALL show the mod named by its `target` parameter, using `mods.inspect`: title, version, description, source, API range and whether it matches the app's mod API version, tile type, default mosaic, config, and each declared permission with its reason and whether it would be granted. It SHALL NOT need a collection.

#### Scenario: View the sample mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/book_list`
- **THEN** the viewer's frame shows `Book List`, `1.1.0`, its description, the config value `show_covers`, and the default mosaic's address ending in `samples/mods/book_list/mosaic.yaml`
- **AND** it shows the API range `^0.2.0`, marked as matching, and no "Name" row

#### Scenario: View a mod with a permission
- **WHEN** the viewer shows a fixture mod that declares `show` for `https://upload.wikimedia.org` with the reason `Shows the book covers`
- **THEN** the viewer's frame shows that permission with its reason, marked as granted

#### Scenario: View a mod for another API
- **WHEN** the viewer shows a mod with `api: "^0.3.0"`
- **THEN** the viewer's frame shows `^0.3.0` and the app's mod API version, marked as not matching

#### Scenario: View a mod without a range
- **WHEN** the viewer shows a mod file without `api`
- **THEN** the viewer's frame says that the mod declares no API range

#### Scenario: No target
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame says that no mod was given

#### Scenario: Missing target
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/missing`
- **THEN** the viewer's frame shows an error that names `404`

### Requirement: Default mods show how to get the app's look
The default mods SHALL get their look only from the theme: semantic HTML, the color scheme, and the `data-tes-variant` attribute. Their own styles SHALL set layout only (display, grid, flex, gaps, widths, alignment, overflow) and SHALL NOT set colors, borders, backgrounds, fonts, radii or shadows. No class or `style` attribute in them SHALL exist to change the look.

#### Scenario: Own styles are layout only
- **WHEN** the mod explorer, the mod viewer, the collection explorer, the collection viewer and the tile viewer are running and the rules of each frame's stylesheets outside the `teselarium` layer are listed
- **THEN** no rule sets a color, background, border, font, border radius or shadow property

#### Scenario: Explorer lists mods as cards
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** `Book List` is shown in an `<article>` whose computed background color is the value of `--tes-card`
- **AND** the article holds a button whose accessible name contains `Book List`

#### Scenario: Explorer shows a failure as an alert
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame shows an element with `role="alert"` that holds `./samples/mods/missing` and a message naming `404`, with the computed border color of `--tes-destructive`

#### Scenario: Viewer's main action is primary
- **WHEN** the viewer shows the sample book list mod
- **THEN** the "Run with sample tiles" button's computed background color is the value of `--tes-primary`, and the "Run without tiles" button's is the value of `--tes-background`

#### Scenario: Viewer shows permission statuses as badges
- **WHEN** the viewer shows the sample book list mod
- **THEN** the `show` permission for `https://upload.wikimedia.org` has a badge with the text `granted` and `data-tes-variant="success"`

#### Scenario: Collection explorer lists collections as cards
- **WHEN** the collection explorer runs with its vanilla config
- **THEN** `Nobel Prize in Literature laureates` is shown in an `<article>` whose computed background color is the value of `--tes-card`
- **AND** the article holds a button whose accessible name contains `Nobel Prize in Literature laureates`

#### Scenario: Collection explorer shows a failure as an alert
- **WHEN** the collection explorer's `collections` list holds `./samples/tiles/missing.yaml`
- **THEN** its frame shows an element with `role="alert"` that holds `./samples/tiles/missing.yaml` and a message naming `404`, with the computed border color of `--tes-destructive`

#### Scenario: Tile viewer draws the tile as a card
- **WHEN** the tile viewer shows a tile
- **THEN** the heading, source, metadata and body are in an `<article>` whose computed background color is the value of `--tes-card`, with an `<hr>` between the source and the metadata and another between the metadata and the body, and the Next button's computed background color is the value of `--tes-primary` when it is shown

### Requirement: Mod viewer shows the check report
The mod viewer SHALL show the report's status as a badge, with `data-tes-variant` `success` for `"pass"`, `warning` for `"warn"` and `destructive` for `"fail"`, each test case with its status and message, and each finding with its step, level, source and message. When the request fails, it SHALL show the error message as an alert. The mod viewer SHALL stay the visible mod.

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

### Requirement: Tile viewer
The tile viewer `tile_viewer` SHALL declare `open` for `"*"` and have no tile type. It SHALL show the first tile it receives: a heading, the tile's source, its metadata and its body, drawn by `<tes-tile-body>`. The heading SHALL be the tile's `title` when it is a non-empty string, and the decoded file name of its source otherwise. Without a tile, it SHALL say that no tile was given.

#### Scenario: View a tile
- **WHEN** the app is opened at the run link of `tile_viewer` whose `tile` is a tile with `title: "Kallocain"` and a body
- **THEN** the viewer's frame shows the heading `Kallocain`, the tile's source and its rendered body

#### Scenario: Tile without a title
- **WHEN** the viewer shows the tile `https://example.org/notes/reading_list.md`, which has no `title`
- **THEN** its heading is `reading_list.md`

#### Scenario: No tile
- **WHEN** the app is opened at `#/run?mod=tile_viewer`
- **THEN** the viewer's frame says that no tile was given

### Requirement: Tile viewer metadata button looks like a button
The button next to the "Metadata" heading SHALL look like a button without a pointer over it, as the theme's outline button, and SHALL be no taller than the heading.

#### Scenario: Button shape
- **WHEN** the viewer shows a tile whose metadata starts collapsed
- **THEN** the button next to the "Metadata" heading has a visible border and the background of the theme's outline button, `--tes-background`, without a pointer over it
- **AND** it is no taller than the heading

### Requirement: Tile viewer links metadata addresses
Each metadata string that is an absolute `http:` or `https:` address SHALL be shown as a link to it with `data-tes-link`, so that following it asks the user as any link of a body does.

#### Scenario: Web address
- **WHEN** the viewer shows a tile with `source: "https://example.org/books/kallocain"`
- **THEN** the value is a link to that address with `data-tes-link`, and clicking it sends `links.open` with that address
