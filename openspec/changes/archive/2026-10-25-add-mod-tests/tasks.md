# Tasks

## 1. Setup

- [x] 1.1 Record the current test counts: run `npm test` and `npm run test:e2e` and note the number of passing tests of each, for the checks in 9.1

## 2. `test_path` in the mod file, and the version bump

- [x] 2.1 Write the failing tests first in `src/lib/mod/mod_format.test.ts` and `mod_loader.test.ts` for the "Test file in the mod file" scenarios ("Test file next to the mod file", "No test file", "Empty test path") and a `test_path` that is a number. Then read `test_path` in `mod_format.ts` (with the message that `test_path` must be a non-empty string), add `"test_path"` to `MOD_FILE_KEYS`, and resolve it into `ModFile.testSource` in `mod_loader.ts`. Verify `npx vitest run src/lib/mod` passes, and that loading the mod requests no test file
- [x] 2.2 Add `loadModTestCode(mod, options)` to `src/lib/mod/mod_loader.ts`, next to `loadModCode`, and export it from `src/lib/mod/index.ts`. Test it in `mod_loader.test.ts`: it returns the test file's text, and raises a `FileFetchError` whose source is the test file for a 404. Verify `npx vitest run src/lib/mod` passes
- [x] 2.3 Write the failing tests first in `src/lib/core/engine/mod_inspection.test.ts` and `mods_methods.test.ts` for "Inspect a mod with tests" (the test file is not requested) and "Inspect a mod without tests". Then add `testSource` to the inspection in `mod_inspection.ts`. Verify `npx vitest run src/lib/core/engine` passes
- [x] 2.4 Bump `MOD_API_VERSION` to `"0.1.2"`, and add a `"0.1.2"` entry to the surface guard in `mod_api_surface.test.ts`: the `0.1.1` surface plus `test_path` in `modFileKeys`. Leave the `0.1.1` entry as it is. Update the version test in `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`, and keep `TEST_MOD_API_RANGE` at `^0.1.0`. Verify `npx vitest run src/lib/core/engine` and `npm run build` pass
- [x] 2.5 Document `test_path`, `testSource` and `loadModTestCode` in `docs/modules/lib/mod/README.md`, with the test file in its bundle convention. Document `testSource` of `mods.inspect` in `docs/modules/lib/core/engine/README.md`. Change `0.1.1` to `0.1.2` there where it is the current version, and add a line saying that the test API is part of the mod API but the surface guard does not record it. Verify `grep -n "0\.1\.1" docs/modules/lib/core/engine/README.md` matches only the bump rule's examples

## 3. Test results in the report

- [x] 3.1 Write the failing tests first in `src/lib/core/engine/mod_check_report.test.ts` for "Mod without tests" (results `null`: `testsChecked` `false`, empty `tests`), "Passing case" (message `null`), "Failed case in the findings" (status `"fail"` from the `test` error), and "Plain data" with tests. Then add `"test"` to `ModCheckStep`, add `ModTestResult`, and give `buildModCheckReport` the results as a fourth argument, following design.md. Pass `null` from every current caller. Export the type from the engine's `index.ts`. Verify `npx vitest run src/lib/core/engine` passes and the existing check tests pass unchanged
- [x] 3.2 Document `testsChecked`, `tests` and the `"test"` step with the report in `docs/modules/lib/core/engine/README.md`. Verify the README names `testsChecked`

## 4. Frame scripts

- [x] 4.1 Add `src/lib/core/sandbox/sandbox_assertions.js` with `expect` (`toBe`, `toEqual`, `toContain`, `toBeTruthy` and `not`), deep equality of plain data, the value descriptions for failure messages, and `waitFor`, all exported and following the code conventions. Write the tests first in `sandbox_assertions.test.ts`, with Vitest's fake timers for `waitFor`:
  - the "Expectations" scenarios "Failing equality" and "Negation";
  - each matcher passing and failing, with a message that names both values;
  - `toContain` on a string and on a list compared by `toEqual`;
  - `toEqual` on nested arrays and objects, and on values that differ only in key order;
  - the "Waiting" scenarios: a condition that becomes true, one that stays false with timeout 100, the last error `fn` threw in the rejection, and the 2000 ms default.

  Verify `npx vitest run src/lib/core/sandbox` passes
- [x] 4.2 In `sandbox_loader.js`, move the start of the mod into a `frameModes` table with a `mount` mode, chosen in `connectToEngine` from the connect params. Without a `test` param, the loader behaves as before. Verify `npm run test:e2e -- e2e/mod_sandbox.spec.ts e2e/mod_check.spec.ts` passes unchanged
- [x] 4.3 Add the loader notifications `sandbox.testsListed`, `sandbox.testsFailed`, `sandbox.answerQueued` and `sandbox.caseFinished` to `src/lib/core/sandbox/sandbox_messages.ts`, with a reader that returns a `SandboxTestReport` union or `null` for the wrong shape. Add `test` (`{ code, caseName }`) to `SandboxConnectParams`. Test each reader in `sandbox_messages.test.ts`, including an answer whose value has the wrong type for its method. Verify `npx vitest run src/lib/core/sandbox` passes
- [x] 4.4 Add `src/lib/core/sandbox/sandbox_test_runner.js` following design.md:
  - the `list` and `case` modes in `frameModes`;
  - `t.test` with its registration errors (empty or repeated name, no case, no default export function, a throw while registering);
  - the case context: `mount` with its options, the second call and the recording engine object, `root`, `tiles`, `storage`, `requests` and `answer`;
  - `sandbox.caseFinished` when the case's function settles.

  Give `buildSandboxDocument` a `{ testRunner }` option that inlines the assertions and the runner after the loader, in the same module script. Test in `sandbox_document.test.ts`: the runner is there only with the option, and no inlined script holds a closing script tag. Verify `npx vitest run src/lib/core/sandbox` passes, and the runner is covered by the e2e tests of group 7
- [x] 4.5 Document the frame modes, the runner, the assertions and the new notifications in `docs/modules/lib/core/sandbox/README.md`, as the loader's protocol, outside the mod API. Verify the README names the four notifications

## 5. Engine: test frames and sessions

- [x] 5.1 Add `policy` to `ModLaunch`, and `buildModTestDocument(launch)` to the engine, which builds the runner's document from the launch's policy and the mod's theme. Export it from the engine's `index.ts`. Test in `mod_launch.test.ts` that the test document has the same policy as `sandboxDocument` and holds the runner. Verify `npx vitest run src/lib/core/engine` passes
- [x] 5.2 In `src/lib/core/engine/mod_session.ts`, add the optional `test` and `onTestReport` to `ModSessionOptions`. `test` goes into `sandbox.connect`, and `onTestReport` is called with each test notification the readers accept. Write the tests first in `mod_session.test.ts` with a fake frame: the connect params with and without `test`, each notification reaching `onTestReport`, a notification of the wrong shape ignored, and a session without `onTestReport` ignoring them. Verify `npx vitest run src/lib/core/engine` passes
- [x] 5.3 Document `buildModTestDocument`, `policy`, `test` and `onTestReport` in `docs/modules/lib/core/engine/README.md`. Verify the README names `onTestReport`

## 6. Tests in the stage

- [x] 6.1 Give each check a frame with a `key`, following design.md: `StageCheck.frame`, the frame's `key` in `CheckSnapshot`, and `attachCheckFrame` and `checkFrameLoadedAgain` taking the key and ignoring a frame that was replaced. Key `CheckFrame` by it in `StageView`. The mount check behaves as before. Test in `stage_checks.test.ts` that a stale key is ignored, and in `StageView.test.tsx` that a new key renders a new iframe. Verify `npx vitest run src/lib/core/stage` and `npx vitest run --project app` pass, with the existing check tests unchanged
- [x] 6.2 Add `src/lib/core/stage/stage_check_cases.ts` following design.md: the session options of list and case frames, the per-method answer queues, the case results, the `test` findings and `CHECK_CASE_LIMIT_MS`. Write the tests first in `stage_check_cases.test.ts`, with a fake frame that plays the runner and Vitest's fake timers, for:
  - "Confirm answered yes", "No answer queued", and queued answers to `links.open`, `files.save` and `mods.open` (nothing opened);
  - a queued `links.open` answer that is not used when the URL is bad (`-32602`);
  - `mods.check` from a case (`-32002`), with no finding for any of these requests;
  - "Unknown method in a case" and "Blocked image in a case" (each message names the case);
  - "Expected mount failure" (no `sandbox.mountFailed`, so no finding);
  - "Case too long", a frame that loads again, and a list frame that never reports.

  Verify `npx vitest run src/lib/core/stage` passes
- [x] 6.3 In `src/lib/core/stage/stage_checks.ts`, run the tests after the mount check, following design.md: fetch the test code with `loadModTestCode`, then the list frame, then one case frame per name in order, then the report with the results. Write the tests first in `stage_checks.test.ts` for:
  - "Mod without tests";
  - "Mount error skips the tests" (the test file is not requested);
  - "Missing test file" (`mountChecked` `true`, `testsChecked` `false`, a `test` error naming `404`);
  - a listing error ("Syntax error", "Repeated name", "No case"), after which no case frame starts;
  - "One case fails" (pass, fail, pass, in order);
  - "Failed case" and "Failed case in the findings";
  - "Cases do not share storage" (a new memory storage per case frame);
  - a case whose name the test file no longer registers;
  - closing the requester during the tests.

  Verify `npx vitest run src/lib/core/stage` passes
- [x] 6.4 Document the tests of a check in `docs/modules/lib/core/stage/README.md`: the phases, one frame at a time with its key, the case limit, the answer queues and the `test` findings. Update the check frame's description in `docs/modules/main/README.md`. Verify the stage README names `CHECK_CASE_LIMIT_MS`

## 7. Tests in the browser

- [x] 7.1 Add the e2e test mods with test files to `e2e/mod_routes.ts`, built on `buildModConf` and `buildProbeFiles`:
  - a test file that answers 404, one with a syntax error, one with a repeated name, and one that registers no case;
  - three cases where the second throws `new Error("no books")`, and a case that never settles;
  - cases for the case context: seeded storage, the request record, a config override, other tiles, mounting twice, the scripted answers and a wrong answer type;
  - two cases that check storage and page isolation;
  - a case that mounts a mod sending `tiles.delete`, one that mounts a mod requesting an image from an undeclared host, and one that expects a failing mount;
  - a probe test file that reports the keys of `t`, of the case context, of `expect(value)` and of `expect(value).not`.

  Verify `npm run build` type-checks them
- [x] 7.2 Add `e2e/mod_tests.spec.ts`, with one `describe` per requirement of `mod-tests`, for the scenarios that need a browser:
  - "Opening does not fetch the tests" (opened, and inspected);
  - "Syntax error";
  - "Cases do not share storage" and "Cases do not share the page";
  - "Config override", "Other tiles" and "Mount twice";
  - "Seeded storage" and "Requests are recorded";
  - "Confirm answered yes" (no dialog in the page) and "Wrong answer type";
  - "Unknown method in a case", "Blocked image in a case" and "Expected mount failure";
  - "Failing equality", "Negation", "Wait for the list" and "Waiting too long";
  - "One case fails" and "Case too long".

  Add one test that pins the test API's names through the probe test file. Verify `npm run test:e2e -- e2e/mod_tests.spec.ts` passes

## 8. Sample mod tests

- [x] 8.1 Add `public/samples/mods/book_list/test.js` with the cases "lists the sample books" and "highlights the remembered book", as the design.md sketch shows and following the code conventions, and add `test_path: "./test.js"` to its `mod_conf.yaml`. Add the test file's path to `e2e/sample_mod.ts`, and check in `src/lib/mod/sample_mod.test.ts` that the shipped sample declares it. Leave the fixture `book_list` mod in `src/test/fixtures/` without `test_path`. Verify `npx vitest run src/lib/mod/sample_mod.test.ts` passes
- [x] 8.2 In `e2e/mod_tests.spec.ts`, add "Sample mod tests pass" and "Sample tests" with the shipped sample. Verify they pass, and that `npm run test:e2e -- e2e/mod_check.spec.ts` still reports `"pass"` for the shipped sample and default mods, with the sample's tests run
- [x] 8.3 Add a guide to writing mod tests to `docs/mod_plugin_spec.md`: `test_path`, the test file, the case context, scripted answers, `expect` and `waitFor`, what a case records, and the time limits, with the sample's `test.js` as the example. List the test file among the sample's files in `docs/modules/lib/mod/README.md`. Verify the guide's example is the shipped `test.js` as it is

## 9. Mod viewer

- [x] 9.1 In `public/default_mods/mod_viewer/main.js`, add the "Tests" list to the check report, following design.md, with the existing badge and list builders and no new look in the viewer's styles. Update `docs/modules/mods/viewer/README.md`. Verify with the tests of 9.2
- [x] 9.2 In `e2e/default_mods.spec.ts`, under "Mod viewer shows the check report", extend "Sample mod passes" with the two passing cases and add "Failing case". Verify `npm run test:e2e -- e2e/default_mods.spec.ts` passes, including "Own styles are layout only"

## 10. Integration check

- [x] 10.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all pass, with the counts of 1.1 plus only the tests this change added. Verify that `grep -rnE "fixtures(/|%2F)" src --exclude-dir=test` is empty and that `grep -rnE "samples(/|%2F)" e2e` matches only `e2e/sample_mod.ts`. Run `openspec validate add-mod-tests --strict` and verify it reports the change as valid

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed, syncing the `mod-tests`, `mod-loading`, `mod-check`, `mod-api-version` and `default-mods` deltas into the main specs.
