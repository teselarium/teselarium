## ADDED Requirements

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
