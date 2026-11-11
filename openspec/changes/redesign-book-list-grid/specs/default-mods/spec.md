# Spec Delta

## MODIFIED Requirements

### Requirement: Mod explorer
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod reference in its config's `mods` with the title and description it gets from `mods.inspect`. A reference that cannot be inspected SHALL be listed with the reference and the error message. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter. The vanilla config SHALL list the sample book list mod and use `mod_viewer` as viewer.

#### Scenario: Vanilla explorer lists the sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Book List` with the description `A grid of book covers, with a card for each book that shows its details and text.`

#### Scenario: Select a mod
- **WHEN** the user selects `Book List` in the mod explorer
- **THEN** the mod viewer is the visible mod and shows `Book List`
- **AND** the app's address is a run link with `mod=mod_viewer` and the sample mod's source as `target`

#### Scenario: Mod that cannot be inspected
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame lists `./samples/mods/missing` with a message that names `404`

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

### Requirement: Mod viewer shows the check report
The mod viewer SHALL show the report's status as a badge, with `data-ot-variant` `success` for `"pass"`, `warning` for `"warn"` and `destructive` for `"fail"`, each test case with its status and message, and each finding with its step, level, source and message. When the request fails, it SHALL show the error message as an alert. The mod viewer SHALL stay the visible mod.

#### Scenario: Sample mod passes
- **WHEN** the viewer shows the sample book list mod and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check passed, with a `success` badge and no findings
- **AND** it lists the sample's cases, among them `lists the sample books` and `remembers the books per row`, all passed
- **AND** the mod viewer is still the visible mod

#### Scenario: Failing mod
- **WHEN** the viewer shows a mod whose entrypoint answers HTTP 404 and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check failed, with a `destructive` badge and a bundle error that names the entrypoint's address and `404`

#### Scenario: Failing case
- **WHEN** the viewer checks a mod whose case `lists books` fails with `no books`
- **THEN** the viewer's frame shows a `destructive` badge and lists `lists books` as failed with the message `no books`
