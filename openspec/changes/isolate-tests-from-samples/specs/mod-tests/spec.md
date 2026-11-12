## MODIFIED Requirements

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

### Requirement: Waiting
`waitFor(fn, timeout)` SHALL call `fn` until it returns a truthy value without throwing, and resolve with that value. When `timeout` milliseconds pass first, it SHALL reject with an error that includes the last error `fn` threw, if any. The default timeout SHALL be 2000 milliseconds.

#### Scenario: Wait for the list
- **WHEN** a case mounts a mod that lists its three tiles and waits for `root.querySelectorAll("li").length === 3`
- **THEN** `waitFor` resolves

#### Scenario: Waiting too long
- **WHEN** a case waits for a condition that stays false, with timeout 100
- **THEN** `waitFor` rejects about 100 milliseconds later

## REMOVED Requirements

### Requirement: Sample mod tests
**Reason**: It describes the shipped book list sample's test file, which `sample-book-list` owns. The test API is described with test-owned mods.
**Migration**: The requirement and its "Sample tests" scenario move to `sample-book-list` as "Mod tests".
