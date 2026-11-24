## MODIFIED Requirements

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the mod's name, in the mod capsule of a combination sandbox. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name, even when the sandbox failed later. The mod capsule SHALL NOT show the version, which the mod list's details page shows (see "Details page" in `combination-pickers`).

#### Scenario: Missing mod file
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404
- **THEN** the stage bar shows "Mod not loaded" and no version

#### Scenario: Missing collection
- **WHEN** a mod is opened with a collection that answers HTTP 404
- **THEN** the mod capsule shows the mod's name and no version

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.3.0"` is opened and the user presses "Cancel"
- **THEN** the mod capsule shows the mod's name and no version

### Requirement: Sandbox errors are messages
When a sandbox shows an error instead of its frame, such as a load failure, a switched-off default mod or a cancelled API question, the same error SHALL be an `error` message from the app, so the errors count includes it.

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.3.0"` is opened and the user presses "Cancel"
- **THEN** the errors popover lists one error labeled "App" that names `^0.3.0` and the app's mod API version
