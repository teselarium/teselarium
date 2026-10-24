## MODIFIED Requirements

### Requirement: Mod API version
The app SHALL have one mod API version, a semver version that covers the engine methods and events, the mount context, the mod file format and the test API. It SHALL be separate from the app's own version. The mod API version SHALL be `0.1.2`.

#### Scenario: Version of this API
- **WHEN** any mod is mounted
- **THEN** the API version it receives is `0.1.2`, whatever the app's own version is

#### Scenario: Mods for 0.1.0 still match
- **WHEN** a mod with `api: "^0.1.0"` is opened
- **THEN** no dialog is shown and the mod runs with no issue about its API
