# mod-tests Specification

## Purpose

Lets a mod ship JavaScript tests in its own folder, written by its author, that the app runs as part of `mods.check` in the mod's own sandbox, so the author's expectations can be checked wherever the mod is served and whatever app runs it.

## Requirements

### Requirement: Tests run in the check
When a mod declares `test_path`, `mods.check` SHALL run its tests after the mount check, only when the bundle and mount checks found no error. Only then SHALL the app fetch the test file and hand its code to the case frames, as for the entrypoint. The test file SHALL NOT be requested when the mod is opened or inspected, or when its tests do not run. A test file that cannot be loaded SHALL be a `test` error whose source is the test file's address and whose message is the load error's message.

#### Scenario: Sample mod tests pass
- **WHEN** the visible mod viewer checks a mod whose test file has two cases that pass
- **THEN** the report has `testsChecked` `true`, two tests with status `"pass"`, and status `"pass"`

#### Scenario: Opening does not fetch the tests
- **WHEN** a mod with `test_path` is opened, or inspected with `mods.inspect`
- **THEN** its test file is not requested

#### Scenario: Mount error skips the tests
- **WHEN** a mod with `test_path` whose `mount` throws is checked
- **THEN** the report has `testsChecked` `false`, an empty `tests` list, and the test file is not requested

#### Scenario: Missing test file
- **WHEN** a mod with a valid bundle that mounts, whose test file answers HTTP 404, is checked
- **THEN** the report has `mountChecked` `true`, `testsChecked` `false`, and a `test` error whose source is the test file's address and whose message names `404`

### Requirement: Test file format
The test file SHALL be an ES module whose default export is a function. The system SHALL call it with `t`, whose `test(name, fn)` registers a case with a non-empty name that no other case has, and an async or plain function `fn`. A test file that cannot be imported, has no default export function, throws while registering, registers a case with an empty or repeated name, or registers no case SHALL give a `test` error whose source is the test file's address, and no case SHALL run.

#### Scenario: Syntax error
- **WHEN** a mod whose test file has a syntax error is checked
- **THEN** the report has status `"fail"` and a `test` error whose source is the test file's address

#### Scenario: Repeated name
- **WHEN** a test file registers two cases named `lists books`
- **THEN** the report has a `test` error whose message names `lists books`, and its `tests` list is empty

#### Scenario: No case
- **WHEN** a test file's default export registers no case
- **THEN** the report has a `test` error whose message says that the test file registers no test

### Requirement: Each case in a fresh frame
Each case SHALL run in its own hidden frame, with the content policy and permissions the mod would get if it were opened, and its own throwaway storage slot that starts empty. Nothing a case does SHALL be seen by another case or by the mod's real slot. The mod SHALL NOT be mounted until the case calls `mount`.

#### Scenario: Cases do not share storage
- **WHEN** the first case stores key `selected` and the second case gets key `selected` before mounting
- **THEN** the second case receives `null`

#### Scenario: Cases do not share the page
- **WHEN** the first case mounts the mod and adds an element to `root`, and the second case reads `root` before mounting
- **THEN** the second case's `root` has no children

### Requirement: Mounting from a case
`mount(options)` SHALL call the mod's default export with the engine API object and a mount context built as for a check, and SHALL resolve once that call has finished. `options.tiles` SHALL replace the case's tiles, `options.config` SHALL replace the mod's config keys it names, and `options.params` SHALL be the context's `params`. When the mod's `mount` throws or rejects, `mount` SHALL reject with that error. A second call SHALL reject.

#### Scenario: Config override
- **WHEN** a case calls `mount` with a `config` that names one key of the mod's config
- **THEN** the mod's mount context has that key's value from `config`, and the mod's other config keys unchanged

#### Scenario: Other tiles
- **WHEN** a case calls `mount({ tiles: [] })`
- **THEN** the mod's mount context has no tiles

#### Scenario: Mount twice
- **WHEN** a case calls `mount()` twice
- **THEN** the second call rejects with an error that says the mod is already mounted

### Requirement: Case context
Each case's function SHALL receive a context with `mount`, `root` (the frame's body), `tiles` (the tiles the check gives), `storage` (`get(key)` and `set(key, value)` on the case's slot, with the rules of `storage.get` and `storage.set`, usable before mounting), `requests` (each request the mod sent, in order, as `{ method, params, result }` or `{ method, params, error }`), `answer`, `expect` and `waitFor`.

#### Scenario: Seeded storage
- **WHEN** a case sets a key with `storage.set`, then mounts the mod
- **THEN** the mod's `storage.get` for that key returns the seeded value

#### Scenario: Requests are recorded
- **WHEN** a case mounts a mod that reads a key with `storage.get` and then writes it with `storage.set`
- **THEN** `requests` lists the `storage.get` for that key with its result, and then the `storage.set` with that key and the written value

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

### Requirement: What a case records
While a case runs, the check SHALL record as `test` findings what the mount check records as `mount` findings, with the same level and source and a message that also names the case: blocked requests and blocked browser dialogs as warnings, and each request answered with `-32600`, `-32601` or `-32602` as an error. A mount that throws or rejects SHALL NOT be a finding, since it rejects the case's `mount` call.

#### Scenario: Unknown method in a case
- **WHEN** a case named `deletes a book` mounts a mod that then sends `tiles.delete`
- **THEN** the report has a `test` error whose message names `deletes a book` and `tiles.delete` and says that the method is unknown

#### Scenario: Blocked image in a case
- **WHEN** a case named `shows covers` mounts a mod that then requests an image from an undeclared host
- **THEN** the report has a `test` warning whose message names `shows covers`, the host and `permissions.show`

#### Scenario: Expected mount failure
- **WHEN** a case expects `mount()` to reject, and the mod's `mount` throws `new Error("map failed")`
- **THEN** the case passes and the report has no finding whose message includes `map failed`

### Requirement: Expectations
`expect(actual)` SHALL return matchers that throw an error naming the expected and the actual value when they fail: `toBe(expected)` by `Object.is`, `toEqual(expected)` by deep equality of plain data, `toContain(item)` for a string's substring or a list's element by `toEqual`, and `toBeTruthy()`. `expect(actual).not` SHALL have the same matchers with the opposite result.

#### Scenario: Failing equality
- **WHEN** a case runs `expect(2).toBe(3)`
- **THEN** the case fails with a message that names `2` and `3`

#### Scenario: Negation
- **WHEN** a case runs `expect([1, 2]).not.toContain(3)`
- **THEN** the expectation passes

### Requirement: Waiting
`waitFor(fn, timeout)` SHALL call `fn` until it returns a truthy value without throwing, and resolve with that value. When `timeout` milliseconds pass first, it SHALL reject with an error that includes the last error `fn` threw, if any. The default timeout SHALL be 2000 milliseconds.

#### Scenario: Wait for the list
- **WHEN** a case mounts a mod that lists its three tiles and waits for `root.querySelectorAll("li").length === 3`
- **THEN** `waitFor` resolves

#### Scenario: Waiting too long
- **WHEN** a case waits for a condition that stays false, with timeout 100
- **THEN** `waitFor` rejects about 100 milliseconds later

### Requirement: Case results
A case SHALL pass when its function finishes without throwing. It SHALL fail when its function throws or rejects, when the mod is stopped, or when it has not finished 10 seconds after its frame started. A failing case SHALL NOT stop the other cases, and each case's frame SHALL be removed when it ends.

#### Scenario: One case fails
- **WHEN** a test file has three cases and the second throws `new Error("no books")`
- **THEN** the report's tests are, in order, pass, fail with a message that includes `no books`, and pass

#### Scenario: Case too long
- **WHEN** a case awaits a promise that never settles
- **THEN** about 10 seconds later the case fails with a message that says it did not finish within 10 seconds

### Requirement: Test results in the report
The check report's `testsChecked` SHALL say whether the mod's cases ran. `tests` SHALL list each registered case, in order, as `{ name, status, message }`, where `status` is `"pass"` or `"fail"` and `message` is `null` for a passing case and the failure's message otherwise. Each failed case SHALL also be a `test` error finding whose source is the test file's address and whose message names the case.

#### Scenario: Failed case in the findings
- **WHEN** a mod whose case `lists books` throws `new Error("no books")` is checked
- **THEN** the report's tests list `lists books` with status `"fail"` and a message that includes `no books`
- **AND** the report has a `test` error whose source is the test file's address and whose message names `lists books`

#### Scenario: Passing case
- **WHEN** a mod whose only case passes is checked
- **THEN** the report's tests list that case with status `"pass"` and message `null`

### Requirement: Inspect reports the test file
The result of `mods.inspect` SHALL also have `testSource`, the resolved address of the mod's test file, or `null` when the mod declares none.

#### Scenario: Inspect a mod with tests
- **WHEN** a mod with `open` granted for the app's origin inspects the mod at `https://example.org/mods/clock/mod_conf.yaml`, which declares `test_path: "./test.js"`
- **THEN** the result's `testSource` is `https://example.org/mods/clock/test.js`
- **AND** the test file is not requested

#### Scenario: Inspect a mod without tests
- **WHEN** a mod with `open` granted for the app's origin inspects a mod file without `test_path`
- **THEN** the result's `testSource` is `null`

### Requirement: Notifications in a case
A `ui.notify` sent while a case runs SHALL resolve with `null` and SHALL NOT be a finding, whatever its level; the case reads it from `requests`.

#### Scenario: Expected error notification
- **WHEN** a case mounts a mod with no tiles, and the mod sends `ui.notify` with `{ "message": "No books found", "level": "error" }`
- **THEN** the request resolves with `null`, the report has no finding whose message includes `No books found`, and `requests` lists `ui.notify` with those params and result `null`

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
