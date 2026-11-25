# Proposal

## Why

`mods.check` tells whether a mod's files fit together and whether it mounts and uses the mod API correctly, but not whether it does what its author meant: that it lists the books, that a click stores the selection, that it asks before deleting. Mod authors have no way to state that and have it checked wherever the mod goes. People who run a mod cannot see whether the author's own expectations still hold on their OpenTesela. Tests shipped inside the mod's folder, run by the app itself, need no tools on either side.

This change builds on `add-mod-check`: tests run as a third step of `mods.check`, in hidden frames with throwaway storage like the mount check's.

## What Changes

- **`test_path` in `mod_conf.yaml`**: an optional path to a JavaScript test file, resolved against the mod file like the entrypoint. The app fetches it only during a check, never when the mod is opened or inspected.
- **Test file**: an ES module whose default export receives `t` and registers cases with `t.test(name, fn)`. A test file cannot import the entrypoint, so each case mounts the mod through its context.
- **Case context**: each case runs in a fresh hidden frame with a fresh throwaway slot and the mod's own content policy and permissions. The case gets:
  - `mount(options?)`, which calls the mod's real `mount`, with `tiles`, `config` and `params` options;
  - `root`, the frame's body;
  - `tiles`, the tiles the check gives;
  - `storage.get` and `storage.set` on the throwaway slot, also before mounting;
  - `requests`, every request the mod sent with its answer;
  - `answer(method, value)`, which scripts the answer to `links.open`, `files.save`, `ui.confirm` or `mods.open`;
  - `expect` (`toBe`, `toEqual`, `toContain`, `toBeTruthy`, and `not`) and `waitFor`.
- **Running**: tests run after the mount check, only when the bundle and mount checks found no error, and the test file is fetched only then. Each case has 10 seconds, and a failing case does not stop the others.
- **Case findings**: blocked requests and dialogs, and requests the engine rejects as invalid or unknown, are `test` findings that name the case, as the mount check records them. Requests that need the user are not findings in cases: they are scripted with `answer` or answered as in the mount check.
- **Report**: a `tests` list of `{ name, status, message }` and `testsChecked`. A failed case is an error finding with step `"test"`, so the report fails. A test file that cannot be loaded or imported, or registers no valid cases, is a `test` error. The mount check has still run.
- **`mods.inspect`** also returns `testSource`.
- **Mod viewer**: the check report lists each case with its status and message, next to the status badge and the findings.
- **Sample mod**: `book_list` ships a `test.js` with the cases "lists the sample books" and "highlights the remembered book", the first example for mod authors.
- **Mod API version**: `0.1.1` becomes `0.1.2`, a patch bump by the rule in "Mod API version" of `docs/modules/lib/core/engine/README.md`. The test API, the optional `test_path` key and `testSource` in `mods.inspect` are additions, and no existing method, key or meaning changes, so mods that declare `^0.1.0` still match.

## Capabilities

### New Capabilities

- `mod-tests`: the test file and how it is loaded, the case context and what each part does, scripted answers, what a case records, isolation per case, time limits, case results, and the sample mod's tests.

### Modified Capabilities

- `mod-loading`: a new requirement for the optional `test_path` key. The loaded mod carries `testSource`.
- `mod-check`: "Check report" adds `testsChecked`, `tests` and the `"test"` step.
- `mod-api-version`: "Mod API version" changes from `0.1.1` to `0.1.2`.
- `default-mods`: "Mod viewer shows the check report" also lists the test cases.

## Impact

- **Code**:
  - `src/lib/mod/`: read `test_path`, and `testSource` in the loaded mod and the inspection.
  - `src/lib/core/engine/`: running the cases in `mods.check` and loading the test file after the mount check, scripted answers, the `requests` record, the report's `tests` and `testsChecked`, and the bump of `MOD_API_VERSION`. The bundle check (`mod_bundle_check.ts`) does not change: the test file is not one of its steps.
  - `src/lib/core/sandbox/`: a test runner (`t`, the case context) and assertions (`expect`, `waitFor`) inlined after the frame loader only in the frames of a check's tests, and the loader notifications they send. In a case frame, the mod is mounted only when the case calls `mount`.
  - `src/lib/core/stage/`: the tests in `stage_checks.ts`, after the mount check of the same check, with the cases in a new `stage_check_cases.ts`: one check frame per case, each with its own `createMemoryStorage()` slot, its 10-second limit and its `test` findings.
  - `src/main/stage/`: the case frames are hidden check frames (`CheckFrame.tsx`).
  - `public/samples/mods/book_list/`: `test.js` and `test_path`. `public/default_mods/mod_viewer/`: the case list in the report.
- **Tests**:
  - Unit tests for `test_path`, the report, the answers and the case findings; e2e tests for the case context, isolation, limits and the sample mod's tests.
  - The bump: the API surface guard (`mod_api_surface.test.ts`) gets a new `"0.1.2"` entry with `test_path` in its mod file keys, and its `0.1.1` entry is not edited. The guard builds its surface from the engine's code and never runs the frame loader, so it does not see the test API (`t`, the case context and the matchers). e2e tests pin the test API's names instead. The version test in `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts` become `0.1.2`. `TEST_MOD_API_RANGE` stays `^0.1.0`, since a patch bump does not change ranges.
  - The e2e test of `add-mod-check` that checks every shipped mod now also runs the sample's tests, and still expects `"pass"`.
  - Only the shipped sample gets `test.js`. The fixture `book_list` mod in `src/test/fixtures/` gets no `test_path`. Unit tests build their mods with tests through `src/test/sample_mods.ts`, and the sample's `test.js` runs in e2e tests through `e2e/sample_mod.ts`, as `centralize-test-sample-references` set up. The sample's `test.js` is the example for mod authors, so it follows `docs/code_conventions.md`: named functions for the cases and the `waitFor` conditions, no anonymous callbacks.
- **Docs**: a guide to writing mod tests in `docs/mod_plugin_spec.md`, with the sample's `test.js` as the example, and the test API in `docs/modules/lib/core/engine/README.md`, where the version it names as current also becomes `0.1.2`. `docs/modules/lib/mod/README.md` gets `test_path`, and its bundle convention and its list of the sample's files include the test file. `docs/modules/lib/core/stage/README.md` gets the case frames, and `docs/modules/mods/viewer/README.md` the case list.
- **Mods**: an API addition. Mods without `test_path` are checked as before.
- **Out of scope**: declarative test files, third-party assertion libraries in the frame, snapshot or visual comparisons, running tests outside `mods.check`, a command-line runner and a CI workflow.
