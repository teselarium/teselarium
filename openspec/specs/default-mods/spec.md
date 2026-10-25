# default-mods Specification

## Purpose

Ships the vanilla app's Explore, Viewer and Maker components as default mods: ordinary sandboxed mods in a default mods folder, which an instantiation can switch off or replace. This change ships the first two, the mod explorer and the mod viewer. They use only the engine API, like any mod.

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
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod reference in its config's `mods` with the title and description it gets from `mods.inspect`. A reference that cannot be inspected SHALL be listed with the reference and the error message. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter. The vanilla config SHALL list the sample book list mod and use `mod_viewer` as viewer.

#### Scenario: Vanilla explorer lists the sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Book List` with the description `A very simple list of books with their covers.`

#### Scenario: Select a mod
- **WHEN** the user selects `Book List` in the mod explorer
- **THEN** the mod viewer is the visible mod and shows `Book List`
- **AND** the app's address is a run link with `mod=mod_viewer` and the sample mod's source as `target`

#### Scenario: Mod that cannot be inspected
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame lists `./samples/mods/missing` with a message that names `404`

### Requirement: Mod viewer
The mod viewer `mod_viewer` SHALL declare `open` for `"*"`, and SHALL show the mod named by its `target` parameter, using `mods.inspect`: title, version, description, name, source, API range and whether it matches the app's mod API version, tile type, sample collection, config, and each declared permission with its reason and whether it would be granted. It SHALL NOT need a collection. Without `target`, it SHALL say that no mod was given. When the mod cannot be inspected, it SHALL show the error message.

#### Scenario: View the sample mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer&target=./samples/mods/book_list`
- **THEN** the viewer's frame shows `Book List`, `1.0.0`, its description, the config value `show_covers`, and the `show` permission for `https://upload.wikimedia.org` with the reason `Shows the book covers`, marked as granted
- **AND** it shows the API range `^0.1.0`, marked as matching

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
The mod viewer SHALL offer to run the viewed mod with its sample collection (only when the mod declares one), with a collection whose address the user types, or without tiles. Each choice SHALL send `mods.open` with the mod's source as `mod` and, when there is one, the chosen collection as `collection`.

#### Scenario: Run with the sample tiles
- **WHEN** the viewer shows the sample book list mod and the user chooses to run it with its sample tiles
- **THEN** the sample book list mod is the visible mod and lists the three sample books
- **AND** the mod viewer is hidden and still running

#### Scenario: Run with a typed collection
- **WHEN** the user types the address of a collection with two books and chooses to run the mod with it
- **THEN** the sample book list mod lists the two books

#### Scenario: Run without tiles
- **WHEN** the user chooses to run the sample book list mod without tiles
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
