# Spec Delta

## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold, in order, the mod's name, its version in a capsule, an information button, a Share button and, for a sandbox opened with a collection, the "Reload tiles" button. Its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator and, when the sandbox has one, the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the stage bar shows, from left to right, `Book List`, `1.1.0` in a capsule, the information button, the Share button, the "Reload tiles" button, the errors, warnings and notifications buttons and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** the sample book list mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button and its other items keep their order

#### Scenario: Close button last
- **WHEN** the sample book list mod runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the name and version. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name and version, even when the sandbox failed later.

#### Scenario: Missing mod file
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing`
- **THEN** the stage bar shows "Mod not loaded" and no version capsule

#### Scenario: Missing collection
- **WHEN** the app is opened with the sample book list mod and a collection that answers HTTP 404
- **THEN** the stage bar shows `Book List` and `1.1.0`

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the stage bar shows the mod's name and version
