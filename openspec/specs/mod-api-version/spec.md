# mod-api-version Specification

## Purpose

Gives the mod API a version of its own and lets each mod declare the range it was written for, so the app can tell the user when a mod expects another API before starting it, and a mod can read which API it runs on.

## Requirements

### Requirement: Mod API version
The app SHALL have one mod API version, a semver version that covers the engine methods and events, the mount context, the mod file format and the test API. It SHALL be separate from the app's own version. The mod API version SHALL be `0.1.9`.

#### Scenario: Version of this API
- **WHEN** any mod is mounted
- **THEN** the API version it receives is `0.1.9`, whatever the app's own version is

#### Scenario: Mods for 0.1.0 still match
- **WHEN** a mod with `api: "^0.1.0"` is opened
- **THEN** no dialog is shown and the mod runs with no issue about its API

### Requirement: API version in the mount context
The mount context SHALL have `api` with `version`, the app's mod API version as a string.

#### Scenario: Sample mod reads the version
- **WHEN** the sample book list mod is mounted
- **THEN** its mount context's `api` has exactly one property, `version`, which is the app's mod API version

#### Scenario: Mod without a range reads the version
- **WHEN** a mod file without `api` is opened
- **THEN** the mod's mount context's `api.version` is the app's mod API version

#### Scenario: Plain data
- **WHEN** the mount context of the sample book list mod is built and a structured clone of its `api` is made
- **THEN** the clone deep-equals the context's `api`

### Requirement: Ranges follow npm's semver rules
A mod's `api` range SHALL match the app's mod API version by npm's semver range rules, in which a caret range on a `0.x` version allows only patch updates.

#### Scenario: Caret range on 0.1
- **WHEN** the versions `0.1.0`, `0.1.7` and `0.2.0` are checked against `^0.1.0`
- **THEN** `0.1.0` and `0.1.7` match and `0.2.0` does not

#### Scenario: Range for a later API
- **WHEN** the version `0.1.0` is checked against `^0.2.0`
- **THEN** it does not match

#### Scenario: Comparison range
- **WHEN** the version `0.1.0` is checked against `>=0.1.0 <1.0.0`
- **THEN** it matches

### Requirement: Matching mods start without asking
A mod whose `api` range matches the app's mod API version SHALL start with no dialog and no issue about its API.

#### Scenario: Sample mod
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list`
- **THEN** no dialog is shown, the sample book list mod runs, and the stage bar shows no errors and no warnings

### Requirement: Mods without a range start with a warning
A mod without `api` SHALL start with no dialog. Its sandbox SHALL have a warning issue whose source is the mod file's source and whose message says that the mod declares no `api` range and names the app's mod API version.

#### Scenario: Mod without a range
- **WHEN** a mod file without `api` is opened
- **THEN** no dialog is shown and the mod runs
- **AND** the stage bar lists a warning whose source is the mod file's source and whose message names `api` and the app's mod API version

### Requirement: Ask before starting a mod for another API
When a mod's `api` range does not match the app's mod API version, the app SHALL ask the user before starting the mod, each time the mod is opened in a sandbox. The dialog SHALL be drawn by the app, outside every mod frame, and SHALL show the mod's title, version and source, its `api` range and the app's mod API version, with the buttons "Run anyway" and "Cancel". The mod frame SHALL NOT start before the user answers.

#### Scenario: Run anyway
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Run anyway"
- **THEN** the dialog showed the mod's title, version and source, `^0.2.0` and the app's mod API version
- **AND** the mod runs, and its mount context's `api.version` is the app's mod API version

#### Scenario: Asked at each launch
- **WHEN** the user ran a mod with `api: "^0.2.0"` anyway, closed its sandbox and opens the same link again
- **THEN** the dialog is shown again

#### Scenario: Asked after a page reload
- **WHEN** the user ran a mod with `api: "^0.2.0"` anyway and the app page is reloaded on its entry
- **THEN** the dialog is shown again before the mod starts

#### Scenario: Opened by another mod
- **WHEN** the mod viewer sends `mods.open` for a mod with `api: "^0.2.0"`
- **THEN** the new sandbox is visible and the dialog is shown before the mod starts

### Requirement: Cancelled mods do not start
When the user presses "Cancel" or closes the dialog with Escape, the sandbox SHALL show an error that names the mod's `api` range and the app's mod API version, and SHALL NOT start a mod frame. The sandbox SHALL keep its history entry and its close button. When the sandbox stops being visible or is closed while the dialog is open, the dialog SHALL be removed and the mod SHALL NOT start.

#### Scenario: Cancel
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the stage shows an error that names `^0.2.0` and the app's mod API version
- **AND** no mod frame is shown, and the stage bar has a close button

#### Scenario: Escape
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses Escape
- **THEN** the dialog closes and the stage shows the same error as for "Cancel"

#### Scenario: Back while asking
- **WHEN** the mod explorer opened a mod with `api: "^0.2.0"` and the user presses the browser's back button while the dialog is open
- **THEN** the dialog is removed, the explorer is visible, and the other mod has not started

### Requirement: Inspect reports the API range
The result of `mods.inspect` SHALL also have `api`, the mod's range or `null` when it declares none, and `apiCompatible`: `true` when the range matches the app's mod API version, `false` when it does not, and `null` when there is no range. Inspecting SHALL NOT show the dialog.

#### Scenario: Inspect the sample mod
- **WHEN** a mod with `open` granted for the app's origin inspects the sample book list mod
- **THEN** the result has `api` `"^0.1.0"` and `apiCompatible` `true`

#### Scenario: Inspect a mod for another API
- **WHEN** a mod with `open` granted for the app's origin inspects a mod with `api: "^0.2.0"`
- **THEN** the result has `api` `"^0.2.0"` and `apiCompatible` `false`, and no dialog is shown

#### Scenario: Inspect a mod without a range
- **WHEN** a mod with `open` granted for the app's origin inspects a mod file without `api`
- **THEN** the result has `api` `null` and `apiCompatible` `null`

### Requirement: Sample and default mods declare the API range
The sample mod SHALL declare `api: "^0.1.5"`, the first mod API version with the `<ot-tile-body>` element, and every default mod SHALL declare `api: "^0.1.0"`.

#### Scenario: Shipped mods match
- **WHEN** the sample book list mod, the mod explorer and the mod viewer are each opened
- **THEN** none of them shows the dialog or has an issue about its API
