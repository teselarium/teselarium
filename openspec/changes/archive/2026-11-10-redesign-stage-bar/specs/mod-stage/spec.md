# Spec Delta

## MODIFIED Requirements

### Requirement: Show load failures
When the mod file, its entrypoint, its tile type file or the collection file cannot be loaded, the sandbox SHALL show an error naming the file that failed and the reason, and SHALL NOT start a mod frame. The same failure SHALL also be an error from the app in the stage bar, whose source is the address of the file that failed and whose text is the reason. The sandbox SHALL keep its history entry and its close button.

#### Scenario: Missing mod file
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing`
- **THEN** the stage shows an error that names the mod file's resolved address and `404`
- **AND** no mod frame is shown

#### Scenario: Missing collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/missing.yaml`
- **THEN** the stage shows an error that names the collection's resolved address
- **AND** no mod frame is shown

#### Scenario: Load failure in the errors popover
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing` and the user opens the errors popover
- **THEN** it lists one error labeled "App" whose source is the mod file's resolved address and whose text names `404`

### Requirement: Switched-off default mods are not opened
When a link names a default mod that is switched off, by name or by any other reference, the sandbox SHALL show an error saying that the mod is switched off, SHALL NOT request its files and SHALL NOT start a mod frame. The same error SHALL also be an error from the app in the stage bar, whose source is the mod reference resolved against the app's address.

#### Scenario: Link to a switched-off viewer
- **WHEN** `mod_viewer` is switched off and the app is opened at `#/run?mod=./default_mods/mod_viewer/`
- **THEN** the stage shows an error that names `mod_viewer` and says that it is switched off
- **AND** no file under `./default_mods/mod_viewer/` is requested
- **AND** the stage bar shows "Mod not loaded" and its errors popover lists the same error, labeled "App"

### Requirement: Reload the tiles
For a sandbox opened with a collection, the stage bar SHALL have a "Reload tiles" icon button, with "Reload tiles" as its accessible name and tooltip, that loads and validates the collection again and pushes the result to the running mod as a `tiles.changed` event, without restarting the mod. New collection issues SHALL replace the previous collection issues in the sandbox's messages, and SHALL be unread. A sandbox opened without a collection SHALL have no "Reload tiles" button.

#### Scenario: Reload after the collection changed
- **WHEN** the sample mod is running with the sample collection, the collection file now lists two books, and the user presses "Reload tiles"
- **THEN** the mod's frame lists two books and the frame was not reloaded

#### Scenario: No collection, no reload
- **WHEN** the sample book list mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button

#### Scenario: Reloaded issues are unread
- **WHEN** the user read the warnings of a sandbox, the collection file now has a tile that does not match the mod's type, and the user presses "Reload tiles"
- **THEN** the warnings popover lists the tile's issue and the warnings capsule is filled

## REMOVED Requirements

### Requirement: Show the mod issues
**Reason**: The stage bar no longer lists issues under the mod's summary. The issues become the sandbox's messages, sorted by level behind the errors, warnings and notifications buttons, which the new `stage-bar` capability specifies.
**Migration**: See `stage-bar`. "Sandbox messages" keeps the order of the issues and each sandbox's own list. "Message popovers" lists them with their level, source and text. "Empty levels are dimmed" replaces the "No issues." line. Tests that read the issue list or "No issues." read the message buttons and popovers instead.
