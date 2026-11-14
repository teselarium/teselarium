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
- **WHEN** the mod explorer and the mod viewer are running and the rules of each frame's stylesheets outside the `opentesela` layer are listed
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

### Requirement: Default mod test fixtures
The mods a default mod's cases inspect SHALL be fixture mods shipped in a `fixtures/` folder of that default mod, named by their address in the default mods folder, so the cases pass wherever the app is served, whatever samples it ships. Fixture mods SHALL NOT be listed by the vanilla explorer.

#### Scenario: Cases without the samples
- **WHEN** an app built without `samples/` checks `mod_viewer`
- **THEN** the report has status `"pass"` and every test has status `"pass"`

#### Scenario: Fixture address
- **WHEN** the app at `https://example.org/` is built with the fixture mod `default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`
- **THEN** that file is served at `https://example.org/default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`

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
