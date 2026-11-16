# Spec Delta

## MODIFIED Requirements

### Requirement: Check a mod
`mods.check` with `{ mod, collection }`, where `mod` is a mod reference and `collection` an optional collection reference, SHALL check the mod and return a report once the check is done. Relative references SHALL be resolved against the app's address. With `collection`, the tiles SHALL come from it, with the mod's own config and permissions. Without it, the mod SHALL be checked as its default mosaic opens it. There SHALL be no tiles when the mod declares no default mosaic.

#### Scenario: Check the sample mod
- **WHEN** the visible mod viewer of the app at `https://example.org/` sends `mods.check` with the relative reference of a mod that passes every check
- **THEN** the result is a report whose source is the mod file's address resolved against `https://example.org/`, with status `"pass"`, `mountChecked` `true` and no findings

#### Scenario: Check with another collection
- **WHEN** the visible mod viewer sends `mods.check` for a mod that declares a default mosaic, with a collection of two books
- **THEN** the mount check gives the mod those two books with the mod's own config, and the default mosaic is not requested

#### Scenario: Check with the default mosaic
- **WHEN** the visible mod viewer checks, without `collection`, a mod whose default mosaic names a collection of three books, overrides `columns` and declares `show` for `https://covers.example.net`
- **THEN** the mount check gives the mod the three books, `context.config.columns` is the mosaic's value, and images from `https://covers.example.net` are allowed
- **AND** the report's `mosaic` is the default mosaic's address

#### Scenario: Mod without a sample collection
- **WHEN** the visible mod viewer checks a mod that declares no `default_mosaic`, without `collection`
- **THEN** the mod is mounted with no tiles, no collection file is requested and the report's `mosaic` is `null`

### Requirement: Check report
The report SHALL be plain data with `source` (the resolved mod file address, or `null` when a mosaic check failed before its mod was known), `mosaic` (the address of the mosaic the check used, or `null`), `status`, `mountChecked` (whether the mount check ran), `testsChecked` and `tests` (the mod's test results) and `findings`, a list of `{ step, level, source, message }` in the order they were found, where `step` is `"bundle"`, `"mount"` or `"test"` and `level` is `"error"` or `"warning"`. `status` SHALL be `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none.

#### Scenario: Warnings only
- **WHEN** a mod without `api` and with a valid bundle that mounts is checked
- **THEN** the report's status is `"warn"` and its only finding is a `bundle` warning about the missing `api` range

#### Scenario: Mod without tests
- **WHEN** a mod without `test_path`, with a valid bundle that mounts, is checked
- **THEN** the report has `testsChecked` `false`, an empty `tests` list and no `test` finding

#### Scenario: Failed case
- **WHEN** a mod whose test case `lists books` throws is checked
- **THEN** the report's status is `"fail"`, its tests list `lists books` with status `"fail"`, and it has a `test` error whose message names `lists books`

#### Scenario: Plain data
- **WHEN** the sample mod is checked and a structured clone of the report is made
- **THEN** the clone deep-equals the report

### Requirement: Bundle check
The check SHALL load the mosaic file when it uses one, the mod file, its entrypoint, the files of its declared libraries, its tile type and the collection, and validate the collection's tiles against the type, after the mosaic's aliases. A file that cannot be loaded or has the wrong format SHALL be an error finding whose source is that file and whose message is the load error's message. The collection's issues SHALL be findings with their own level and source. A failure to load the mod file SHALL be a report, not an error response.

#### Scenario: Fixture mod
- **WHEN** the bundle check runs on the mod at `https://example.org/fixtures/mods/book_list/mod_conf.yaml` with its default mosaic
- **THEN** it has no findings and gives the three books of the default mosaic's collection as the tiles to mount

#### Scenario: Missing mod file
- **WHEN** the visible mod, with `open` granted for the app's origin, sends `mods.check` with `{ "mod": "./fixtures/mods/missing" }`
- **THEN** the result is a report with status `"fail"`, `mountChecked` `false` and one `bundle` error whose source is `https://example.org/fixtures/mods/missing/mod_conf.yaml` and whose message names `404`

#### Scenario: Missing entrypoint
- **WHEN** a mod whose entrypoint answers HTTP 404 is checked
- **THEN** the report has status `"fail"` and a `bundle` error whose source is the entrypoint's address

#### Scenario: Missing library file
- **WHEN** a mod that declares `leaflet` with `npm: "leaflet@1.9.4"` and `files: ["dist/missing.js"]` is checked, and the npm host answers that file with HTTP 404 and the text `Couldn't find the requested file /dist/missing.js in leaflet.`
- **THEN** the report has status `"fail"`, `mountChecked` `false` and a `bundle` error whose source is `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/missing.js` and whose message names `leaflet`, `404` and that text

#### Scenario: Sample tile that does not match
- **WHEN** a mod whose default mosaic's collection has a tile without a field its type requires is checked
- **THEN** the report has a `bundle` warning whose source is that tile's source, and the other tiles are given to the mod

#### Scenario: Missing default mosaic
- **WHEN** a mod whose `default_mosaic` answers HTTP 404 is checked without `collection`
- **THEN** the report has status `"fail"`, `mountChecked` `false` and a `bundle` error whose source is the mosaic file's address

### Requirement: API range in the check
The bundle check SHALL compare the mod's `api` range with the app's mod API version. A missing range SHALL be a `bundle` warning that names `api`. A range that does not match SHALL be a `bundle` warning that names the range and the app's mod API version. This finding SHALL come right after the mod file's, before the findings of the entrypoint, the tile type and the collection, as in the stage bar. No dialog SHALL be shown, and the mount check SHALL still run.

#### Scenario: Mod for another API
- **WHEN** a mod with `api: "^0.2.0"` and a valid bundle is checked
- **THEN** no dialog is shown, the report has a `bundle` warning that names `^0.2.0` and the app's mod API version, and `mountChecked` is `true`

#### Scenario: Range finding comes first
- **WHEN** a mod without `api`, whose default mosaic's collection has a tile that does not match its type, is checked
- **THEN** the first finding is the `bundle` warning about the missing `api` range, followed by the tile's warning

## ADDED Requirements

### Requirement: A default mosaic names its mod
When a check uses a mod's default mosaic and the mosaic's `mod` is not that mod's file, the bundle check SHALL report an error that names both addresses, and the mount check SHALL NOT run.

#### Scenario: Default mosaic of another mod
- **WHEN** a mod's default mosaic names `../other_mod` and the mod is checked without `collection`
- **THEN** the report has status `"fail"` and a `bundle` error whose source is the mosaic file and whose message names the mosaic's mod and the checked mod

### Requirement: Check a mosaic
`mosaics.check` with `{ mosaic }`, where `mosaic` is a mosaic reference resolved against the app's address, SHALL check the mosaic's mod as the mosaic opens it, with its collection, merged config, aliases and `show` grants. It SHALL run the bundle check and the mount check, SHALL NOT run the mod's tests, and SHALL return a report with `testsChecked` `false` and the mosaic file's address as `mosaic`.

#### Scenario: Check the laureates' map
- **WHEN** the visible mod sends `mosaics.check` for a mosaic with aliases that make every tile of its collection match its mod's type
- **THEN** the report's status is `"pass"`, its `mosaic` is the mosaic file's address, its `source` is the mod file's address, and `testsChecked` is `false`

#### Scenario: Missing mosaic file
- **WHEN** the visible mod sends `mosaics.check` for a mosaic file that answers HTTP 404
- **THEN** the result is a report with status `"fail"`, `source` `null`, `mountChecked` `false` and a `bundle` error whose source is the mosaic file's address

#### Scenario: Mosaic of a switched-off mod
- **WHEN** a mosaic names `mod_viewer`, `mod_viewer` is switched off, and the mosaic is checked
- **THEN** the report has status `"fail"` and a `bundle` error that says `mod_viewer` is switched off, and no file of `mod_viewer` is requested

### Requirement: Mosaic check requests follow the open rules
The engine SHALL answer `mosaics.check` with error code `-32002`, without requesting any file, unless the requesting mod has a granted `open` permission whose host is `"*"` or the origin of the mosaic file. It SHALL answer with `-32002` when the requesting sandbox is not the visible one, and with `-32602` when `mosaic` is not a non-empty string. A foreign mosaic's `show` lines SHALL count as granted only with a remembered allow, and no dialog SHALL be shown.

#### Scenario: Mod without the open permission
- **WHEN** a mod without a granted `open` permission sends `mosaics.check` for `https://mosaics.example.net/maps/`
- **THEN** the response has an error with code `-32002` whose message names `https://mosaics.example.net` and `permissions.open`

#### Scenario: Foreign mosaic without decisions
- **WHEN** a mosaic from another origin that declares `show` for `https://covers.example.net` is checked with no remembered decision
- **THEN** no dialog is shown, and images from `https://covers.example.net` are blocked in the mount check and reported as a `mount` warning that says the mosaic declares the host in `permissions.show` but the permission was not granted

### Requirement: Mosaic findings
When a check uses a mosaic, the bundle check SHALL report a warning, whose source is the mosaic file, for each field of `aliases` that the mod's tile type does not declare, and for each key of the mosaic's config, at any depth of nested mappings, that the mod's config does not have. Each message SHALL name the field or the key path.

#### Scenario: Alias for an unknown field
- **WHEN** a mosaic's aliases are `{ contry: ["birth_country"] }` and its mod's tile type declares `title` and `country`
- **THEN** the report has a `bundle` warning whose source is the mosaic file and whose message names `contry`

#### Scenario: Config key the mod does not have
- **WHEN** a mosaic's config is `{ colums: 4 }` and its mod's config has `columns` and no `colums`
- **THEN** the report has a `bundle` warning whose message names `config.colums`

#### Scenario: Nested key
- **WHEN** a mosaic's config is `{ map: { zom: 3 } }` and its mod's config has `map` with `zoom` and `center`
- **THEN** the report has a `bundle` warning whose message names `config.map.zom`

#### Scenario: Known keys
- **WHEN** a mosaic overrides only keys its mod's config has, and aliases only fields its mod's tile type declares
- **THEN** the report has no mosaic finding
