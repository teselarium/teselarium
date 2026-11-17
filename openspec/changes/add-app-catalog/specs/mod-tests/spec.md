# Spec Delta

## MODIFIED Requirements

### Requirement: Scripted answers
`answer(method, value)` SHALL queue the answer to the next request for `method`, which SHALL be `links.open`, `files.save`, `ui.confirm` or `players.open` with a boolean value, `mods.open` or `mosaics.open` with `null`, or `catalog.list` with a catalog (see "Scripted catalog"). The request SHALL resolve with the queued value without any dialog. A `mods.open` or `mosaics.open` answered this way SHALL NOT open anything. Requests without a queued answer SHALL be answered as in the mount check, and `mods.check` and `mosaics.check`, which cannot be answered, SHALL be answered with error code `-32002`. In cases, no request that needs the user SHALL be a finding, answered or not.

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

#### Scenario: Mosaic open answered
- **WHEN** a case calls `answer("mosaics.open", null)` and the mod then sends `mosaics.open` for a fixture mosaic
- **THEN** the request resolves with `null`, nothing is opened, and the case's `requests` holds the `mosaics.open` with its `mosaic`

#### Scenario: Mosaic check in a case
- **WHEN** the mod sends `mosaics.check` in a case
- **THEN** the request is answered with error code `-32002`, nothing is checked, and the report has no finding about `mosaics.check`

## ADDED Requirements

### Requirement: Scripted catalog
The answer to `catalog.list` SHALL be a mapping whose optional `mods`, `collections` and `mosaics` are lists of entries with a non-empty string `source`, and, for a mosaic, an optional `defaultOf` that is `null` or `{ source, title }` with non-empty strings. A missing list SHALL be empty and a missing `defaultOf` `null`. The request SHALL resolve with the catalog in that complete form. Any other value SHALL make `answer` throw.

#### Scenario: Fixture catalog
- **WHEN** a case calls `answer("catalog.list", { "mods": [{ "source": "./default_mods/mod_explorer/fixtures/listed_mod" }] })` and the mod then sends `catalog.list`
- **THEN** the request resolves with that mod entry, empty `collections` and empty `mosaics`, and nothing is requested

#### Scenario: Wrong catalog
- **WHEN** a case calls `answer("catalog.list", { "mods": ["./listed_mod"] })`
- **THEN** the call throws an error that says the answer to `catalog.list` must be a catalog and names `mods`

### Requirement: Unanswered catalog
A `catalog.list` without a queued answer, in a case or in the mount check, SHALL be answered with the app's catalog, as in the app.

#### Scenario: Case without a scripted catalog
- **WHEN** the mod sends `catalog.list` in a case that queued no answer for it
- **THEN** the request resolves with the app's catalog, and the report has no finding about `catalog.list`
