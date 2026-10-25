# Proposal

## Why

`mods.check` tells whether a mod's files fit together and whether it mounts and uses the mod API correctly, but not whether it does what its author meant: that it lists the books, that a click stores the selection, that it asks before deleting. Mod authors have no way to state that and have it checked wherever the mod goes. People who run a mod cannot see whether the author's own expectations still hold on their OpenTesela. Tests shipped inside the mod's folder, run by the app itself, need no tools on either side.

This change builds on `add-mod-check`: tests run as a third step of `mods.check`, in the same hidden frames with throwaway storage.

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
- **Running**: tests run after the mount check, only when the bundle and mount checks found no error. Each case has 10 seconds, and a failing case does not stop the others.
- **Report**: a `tests` list of `{ name, status, message }` and `testsChecked`. A failed case is an error finding with step `"test"`, so the report fails. A missing test file is a `bundle` error. A test file that cannot be imported or registers no valid cases is a `test` error.
- **`mods.inspect`** also returns `testSource`.
- **Mod viewer**: the check report lists each case with its status and message.
- **Sample mod**: `book_list` ships a `test.js` with the cases "lists the sample books" and "highlights the remembered book", the first example for mod authors.
- **Mod API version**: `0.1.1` becomes `0.1.2`. The test API is part of the mod API, and this is an addition.

## Capabilities

### New Capabilities

- `mod-tests`: the test file and how it is loaded, the case context and what each part does, scripted answers, isolation per case, time limits, case results, and the sample mod's tests.

### Modified Capabilities

- `mod-loading`: a new requirement for the optional `test_path` key. The loaded mod carries `testSource`.
- `mod-check`: "Check report" adds `testsChecked`, `tests` and the `"test"` step.
- `mod-api-version`: "Mod API version" changes from `0.1.1` to `0.1.2`.
- `default-mods`: "Mod viewer checks the mod" also lists the test cases.

## Impact

- **Code**:
  - `src/lib/mod/`: read `test_path`, and `testSource` in the loaded mod and the inspection.
  - `src/lib/core/engine/`: running the cases in `mods.check`, scripted answers, the `requests` record, the report's `tests`, and the API version.
  - `src/lib/core/sandbox/sandbox_loader.js`: import the test file next to the entrypoint, and build `t` and the case context, `expect` and `waitFor` included, in the frame.
  - `src/lib/core/stage/`: one hidden frame per case.
  - `public/samples/mods/book_list/`: `test.js` and `test_path`. `public/default_mods/mod_viewer/`: the case list.
- **Tests**:
  - Unit tests for `test_path`, the report and the answers; e2e tests for the case context, isolation, limits and the sample mod's tests. The API surface guard test gets the test API and the new version.
  - Only the shipped sample gets `test.js`. The fixture `book_list` mod in `src/test/fixtures/` gets no `test_path`. Unit tests build their mods with tests through `src/test/sample_mods.ts`, and the sample's `test.js` runs in e2e tests through `e2e/sample_mod.ts`, as `centralize-test-sample-references` set up.
- **Docs**: a guide to writing mod tests in `docs/mod_plugin_spec.md`, with the sample's `test.js` as the example, and the test API in `docs/modules/lib/core/engine/README.md`. `docs/modules/lib/mod/README.md` gets `test_path`, and its bundle convention and its list of the sample's files include the test file.
- **Mods**: an API addition. Mods without `test_path` are checked as before.
- **Out of scope**: declarative test files, third-party assertion libraries in the frame, snapshot or visual comparisons, running tests outside `mods.check`, a command-line runner and a CI workflow.
