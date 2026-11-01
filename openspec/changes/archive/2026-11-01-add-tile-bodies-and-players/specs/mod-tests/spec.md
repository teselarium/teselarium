# Spec Delta

## MODIFIED Requirements

### Requirement: Scripted answers
`answer(method, value)` SHALL queue the answer to the next request for `method`, which SHALL be `links.open`, `files.save`, `ui.confirm` or `players.open` with a boolean value, or `mods.open` with `null`. The request SHALL resolve with the queued value without any dialog. A `mods.open` answered this way SHALL NOT open anything. Requests without a queued answer SHALL be answered as in the mount check. In cases, no request that needs the user SHALL be a finding, answered or not.

#### Scenario: Confirm answered yes
- **WHEN** a case calls `answer("ui.confirm", true)` and the mod then sends `ui.confirm`
- **THEN** the request resolves with `true`, no dialog is shown, and the report has no finding about `ui.confirm`

#### Scenario: No answer queued
- **WHEN** the mod sends `ui.confirm` in a case that queued no answer
- **THEN** the request resolves with `false`

#### Scenario: Wrong answer type
- **WHEN** a case calls `answer("ui.confirm", "yes")`
- **THEN** the call throws an error that says the answer to `ui.confirm` must be a boolean

#### Scenario: Player answered
- **WHEN** a case calls `answer("players.open", true)` and the mod then sends `players.open` with a player address of its tiles
- **THEN** the request resolves with `true`, no dialog is shown and nothing is requested from the player's site
