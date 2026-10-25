# mod-check Specification

## Purpose

Lets a mod ask the engine to check another mod without running it for the user: that its files load and fit together, and that it mounts in its sandbox and uses the mod API correctly, with the result returned as a report.

## Requirements

### Requirement: Check a mod
`mods.check` with `{ mod, collection }`, where `mod` is a mod reference and `collection` an optional collection location, SHALL check the mod and return a report once the check is done. Relative references and locations SHALL be resolved against the app's address. The tiles SHALL come from `collection` when it is given, from the mod's sample collection otherwise, and there SHALL be none when the mod declares no sample collection.

#### Scenario: Check the sample mod
- **WHEN** the visible mod viewer of the app at `https://example.org/` sends `mods.check` with `{ "mod": "./samples/mods/book_list" }`
- **THEN** the result is a report with source `https://example.org/samples/mods/book_list/mod_conf.yaml`, status `"pass"`, `mountChecked` `true` and no findings

#### Scenario: Check with another collection
- **WHEN** the visible mod viewer sends `mods.check` for the sample mod with a collection of two books
- **THEN** the mount check gives the mod those two books, and the sample collection is not requested

#### Scenario: Mod without a sample collection
- **WHEN** the visible mod viewer checks a mod that declares no `sample_collection`, without `collection`
- **THEN** the mod is mounted with no tiles and no collection file is requested

### Requirement: Check requests follow the inspect rules
The engine SHALL answer `mods.check` with error code `-32002`, without requesting any file, unless the requesting mod has a granted `open` permission whose host is `"*"` or the origin of the target mod file. It SHALL answer with `-32003` for a default mod that is switched off, with `-32002` when the requesting sandbox is not the visible one, and with `-32602` when `mod` is not a non-empty string or `collection` is neither absent, `null` nor a non-empty string.

#### Scenario: Mod without the open permission
- **WHEN** the sample book list mod sends `mods.check` with `{ "mod": "https://mods.example.net/clock/" }`
- **THEN** the response has an error with code `-32002` whose message names `https://mods.example.net` and `permissions.open`
- **AND** nothing is requested from `https://mods.example.net`

#### Scenario: Hidden mod asks for a check
- **WHEN** the mod explorer opened the mod viewer, and the hidden explorer sends `mods.check`
- **THEN** the response has an error with code `-32002` whose message says that only the visible mod can check mods

#### Scenario: Switched-off mod
- **WHEN** `mod_viewer` is switched off and a mod with `open` granted for `"*"` checks `./default_mods/mod_viewer/`
- **THEN** the response has an error with code `-32003` whose message names `mod_viewer`

#### Scenario: Missing mod reference
- **WHEN** a mod sends `mods.check` with `{}`
- **THEN** the response has an error with code `-32602` whose message names `mods.check` and says that `mod` must be a non-empty string

### Requirement: Check report
The report SHALL be plain data with `source` (the resolved mod file address), `status`, `mountChecked` (whether the mount check ran) and `findings`, a list of `{ step, level, source, message }` in the order they were found, where `step` is `"bundle"` or `"mount"` and `level` is `"error"` or `"warning"`. `status` SHALL be `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none.

#### Scenario: Warnings only
- **WHEN** a mod without `api` and with a valid bundle that mounts is checked
- **THEN** the report's status is `"warn"` and its only finding is a `bundle` warning about the missing `api` range

#### Scenario: Plain data
- **WHEN** the sample mod is checked and a structured clone of the report is made
- **THEN** the clone deep-equals the report

### Requirement: Bundle check
The check SHALL load the mod file, its entrypoint, its tile type and the collection, and validate the collection's tiles against the type. A file that cannot be loaded or has the wrong format SHALL be an error finding whose source is that file and whose message is the load error's message. The collection's issues SHALL be findings with their own level and source. A failure to load the mod file SHALL be a report, not an error response.

#### Scenario: Fixture mod
- **WHEN** the bundle check runs on the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` with its sample collection
- **THEN** it has no findings and gives the three books of the sample collection as the tiles to mount

#### Scenario: Missing mod file
- **WHEN** the visible mod, with `open` granted for the app's origin, sends `mods.check` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the result is a report with status `"fail"`, `mountChecked` `false` and one `bundle` error whose source is `https://example.org/fixtures/mods/missing/mod_conf.yaml` and whose message names `404`

#### Scenario: Missing entrypoint
- **WHEN** a mod whose entrypoint answers HTTP 404 is checked
- **THEN** the report has status `"fail"` and a `bundle` error whose source is the entrypoint's address

#### Scenario: Sample tile that does not match
- **WHEN** a mod whose sample collection has a tile without a field its type requires is checked
- **THEN** the report has a `bundle` warning whose source is that tile's source, and the other tiles are given to the mod

### Requirement: API range in the check
The bundle check SHALL compare the mod's `api` range with the app's mod API version. A missing range SHALL be a `bundle` warning that names `api`. A range that does not match SHALL be a `bundle` warning that names the range and the app's mod API version. This finding SHALL come right after the mod file's, before the findings of the entrypoint, the tile type and the collection, as in the stage bar. No dialog SHALL be shown, and the mount check SHALL still run.

#### Scenario: Mod for another API
- **WHEN** a mod with `api: "^0.2.0"` and a valid bundle is checked
- **THEN** no dialog is shown, the report has a `bundle` warning that names `^0.2.0` and the app's mod API version, and `mountChecked` is `true`

#### Scenario: Range finding comes first
- **WHEN** a mod without `api`, whose sample collection has a tile that does not match its type, is checked
- **THEN** the first finding is the `bundle` warning about the missing `api` range, followed by the tile's warning

### Requirement: Mount check
When the bundle check found no error, the check SHALL mount the mod in a hidden frame, with the content policy and permissions it would get if it were opened and with the tiles that match its type. The check SHALL end 1 second after the mod's `mount` call finished, and the frame SHALL then be removed. When the bundle check found an error, the mount check SHALL NOT run and the entrypoint SHALL NOT be run.

#### Scenario: Bundle error skips the mount
- **WHEN** a mod whose tile type file answers HTTP 404 is checked
- **THEN** the report has `mountChecked` `false` and the mod's code is not run

#### Scenario: Frame removed after the check
- **WHEN** the sample mod has been checked
- **THEN** no frame of the check is left in the page

### Requirement: What the mount check records
The mount check SHALL record as `mount` findings:
- a mount that throws or rejects, and a stopped mod, as errors;
- blocked requests and blocked browser dialogs, as warnings;
- each request answered with `-32600`, `-32601` or `-32602`, as an error naming the method and the error's message;
- a `mount` that has not finished 10 seconds after the frame started, as an error that says so.

#### Scenario: Mount throws
- **WHEN** a mod whose `mount` throws `new Error("map failed")` is checked
- **THEN** the report has status `"fail"` and a `mount` error whose message includes `map failed`

#### Scenario: Unknown method
- **WHEN** a mod that sends `tiles.delete` while mounting is checked
- **THEN** the report has a `mount` error whose message names `tiles.delete` and says that the method is unknown

#### Scenario: Blocked image
- **WHEN** a mod that requests an image from an undeclared host is checked
- **THEN** the report has a `mount` warning that names the host and `permissions.show`

#### Scenario: Mount never finishes
- **WHEN** a mod whose `mount` returns a promise that never settles is checked
- **THEN** the result comes about 10 seconds later, with status `"fail"` and a `mount` error that says the mount did not finish within 10 seconds

### Requirement: Requests that need the user
During the mount check, no dialog SHALL be shown. `links.open`, `files.save` and `ui.confirm` SHALL resolve with `false` as if the user cancelled, `mods.open` and `mods.check` SHALL be answered with error code `-32002`, and each of these requests SHALL be a `mount` warning that names the method.

#### Scenario: Mod asks for a confirmation while mounting
- **WHEN** a mod that sends `ui.confirm` while mounting is checked
- **THEN** no dialog is shown, the request resolves with `false`, and the report has a `mount` warning that names `ui.confirm`

### Requirement: Throwaway storage slot
During the mount check, the mod SHALL have a storage slot that starts empty and is discarded when the check ends. The mod's real slot SHALL be neither read nor written.

#### Scenario: Real slot untouched
- **WHEN** the user selected "Kallocain" in the sample mod, and the sample mod is then checked
- **THEN** during the check the mod's `storage.get` for `selected` returns `null`
- **AND** after the check, opening the sample mod highlights "Kallocain"

### Requirement: A check leaves the stage unchanged
A check SHALL NOT create a sandbox or a history entry, SHALL NOT change the app's address, the visible sandbox or its issues, and SHALL NOT be listed in the stage bar.

#### Scenario: Viewer stays visible
- **WHEN** the visible mod viewer checks a mod that throws in `mount`
- **THEN** the mod viewer is still the visible mod, the app's address is unchanged, and the stage bar's issue list is unchanged
