# Spec Delta

## MODIFIED Requirements

### Requirement: Only the visible mod asks
The engine SHALL answer `links.open`, `files.save`, `ui.confirm` and `players.open` from a mod whose sandbox is not the visible one with error code `-32002`, and SHALL NOT show a dialog.

#### Scenario: Hidden mod asks for a confirmation
- **WHEN** the mod explorer opened the mod viewer, and the hidden explorer sends `ui.confirm`
- **THEN** the response has an error with code `-32002` whose message names `ui.confirm` and says that only the visible mod can ask the user
- **AND** no dialog is shown

#### Scenario: Hidden mod asks for a player
- **WHEN** a hidden mod sends `players.open` with a player address of its tiles
- **THEN** the response has an error with code `-32002` whose message names `players.open`, and no dialog is shown

## ADDED Requirements

### Requirement: The player dialog is an action dialog
The player dialog SHALL follow the rules of the action dialog: drawn by the app and naming the asking mod, shown one at a time in the order the requests arrived, and removed when its mod's sandbox stops being visible, is closed or its mod is stopped. A player shown when its mod stops being visible SHALL be removed with it, and its request SHALL resolve with `true`.

#### Scenario: Confirmation after a player
- **WHEN** the visible mod sends `players.open` and then `ui.confirm`
- **THEN** the confirmation is shown only after the player dialog is closed

#### Scenario: Back while playing
- **WHEN** a player of the mod viewer, opened by the explorer, is playing and the user goes back to the explorer with the browser's back button
- **THEN** the player dialog is removed, the player frame is no longer in the page, and the request resolves with `true`
