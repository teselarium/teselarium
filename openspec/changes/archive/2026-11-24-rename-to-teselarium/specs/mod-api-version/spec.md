## MODIFIED Requirements

### Requirement: Mod API version
The app SHALL have one mod API version, a semver version that covers the engine methods and events, the mount context, the mod file format and the test API. It SHALL be separate from the app's own version. The mod API version SHALL be `0.2.0`.

#### Scenario: Version of this API
- **WHEN** any mod is mounted
- **THEN** the API version it receives is `0.2.0`, whatever the app's own version is

#### Scenario: Mods for 0.1.0 still match
- **WHEN** a mod with `api: "^0.2.0"` is opened
- **THEN** no dialog is shown and the mod runs with no issue about its API

### Requirement: Inspect reports the API range
The result of `mods.inspect` SHALL also have `api`, the mod's range or `null` when it declares none, and `apiCompatible`: `true` when the range matches the app's mod API version, `false` when it does not, and `null` when there is no range. Inspecting SHALL NOT show the dialog.

#### Scenario: Inspect the sample mod
- **WHEN** a mod with `open` granted for the app's origin inspects the sample book list mod
- **THEN** the result has `api` `"^0.2.0"` and `apiCompatible` `true`

#### Scenario: Inspect a mod for another API
- **WHEN** a mod with `open` granted for the app's origin inspects a mod with `api: "^0.3.0"`
- **THEN** the result has `api` `"^0.3.0"` and `apiCompatible` `false`, and no dialog is shown

#### Scenario: Inspect a mod without a range
- **WHEN** a mod with `open` granted for the app's origin inspects a mod file without `api`
- **THEN** the result has `api` `null` and `apiCompatible` `null`

### Requirement: Default mods declare the API range
Every default mod SHALL declare `api: "^0.2.0"`.

#### Scenario: Default mods match
- **WHEN** the mod explorer and the mod viewer are each opened
- **THEN** neither of them shows the dialog or has an issue about its API
