# Tasks

## 1. Setup

- [ ] 1.1 Record the current test counts: run `npm test` and `npm run test:e2e` and note the number of passing tests of each, for the checks in 2.5 and 9.1

## 2. Shared pieces, with no behavior change

- [ ] 2.1 In `src/lib/mod/mod_loader.ts`, add `loadModCode(modFile, options)`, which fetches the entrypoint and returns the `LoadedMod`, and make `loadMod` call `loadModFile` then `loadModCode`. Export it from `src/lib/mod/index.ts`, add a test in `mod_loader.test.ts` for a mod file whose entrypoint answers 404 (a `FileFetchError` whose source is the entrypoint), and document it in `docs/modules/lib/mod/README.md`. Verify `npx vitest run src/lib/mod` passes
- [ ] 2.2 In `src/lib/core/engine/mod_launch.ts`, extract `selectModTiles(collection, validator)` from `loadModTiles` and `buildModLaunch(mod, link, modTiles, appOrigin)` from `prepareModLaunch`, which then resolves, loads and calls it. Export both from the engine's `index.ts`. Verify `npx vitest run src/lib/core/engine/mod_launch.test.ts` passes unchanged
- [ ] 2.3 In `src/lib/core/engine/mods_methods.ts`, give `readOpenCollection` the method name as an argument, so its message names the method that called it. Verify `npx vitest run src/lib/core/engine/mods_methods.test.ts` passes unchanged
- [ ] 2.4 Move the `Map`-backed storage of `src/test/memory_storage.ts` to `src/lib/core/storage/memory_storage.ts` as `createMemoryStorage()` (with its `MemoryStorage` type), export it from the storage module's `index.ts`, and make `src/test/memory_storage.ts` re-export it and keep `createFullStorage` and `createBlockedStorage`. Add a unit test next to it (set, get, remove, two storages do not share items), and document it in `docs/modules/lib/core/storage/README.md`. Verify `npx vitest run src/lib/core/storage` passes
- [ ] 2.5 Verify that `npm test` passes with the count of 1.1 plus only the tests added in 2.1 and 2.4

## 3. Bundle check and report

- [ ] 3.1 Add the unit test mods the bundle check needs to `src/test/sample_mods.ts`, each with a constant and a `serve…` function built on `serveTestMod`: an entrypoint that answers 404, a tile type that answers 404, and a sample collection with a tile that misses a field its type requires. Reuse `serveNoApiBookMod` and `serveOtherApiMod` for the range cases. Verify `npm run build` type-checks them
- [ ] 3.2 Write the failing tests first in `src/lib/core/engine/mod_check_report.test.ts` for the "Check report" scenarios "Warnings only" (status from the levels) and "Plain data", then add `mod_check_report.ts` with `ModCheckFinding`, `ModCheckReport` and `buildModCheckReport(source, findings, mountChecked)`. Verify the tests pass
- [ ] 3.3 Write the failing tests first in `src/lib/core/engine/mod_bundle_check.test.ts`, with one `describe` per requirement, for the scenarios:
  - "Fixture mod" of "Bundle check";
  - "Missing entrypoint" and "Sample tile that does not match";
  - "Mod for another API" and "Range finding comes first";
  - a missing mod file (one error, nothing else requested);
  - a given collection that replaces the sample collection;
  - no collection without a sample collection;
  - a failed tile type, which skips the collection.

  Then add `mod_bundle_check.ts` with `checkModBundle(source, collectionLocation, options)`, following design.md, and export it and the report types from the engine's `index.ts`. Verify `npx vitest run src/lib/core/engine` passes
- [ ] 3.4 Document the bundle check and the report in `docs/modules/lib/core/engine/README.md`: the steps and their order, the findings, the status and that it needs no DOM. Verify the README names `checkModBundle` and the three statuses

## 4. Frame loader and session hooks

- [ ] 4.1 Add `SANDBOX_MOUNTED_METHOD` (`"sandbox.mounted"`) to `src/lib/core/sandbox/sandbox_messages.ts` and export it. In `sandbox_loader.js`, send it when the mod's `mount` resolves, and only then. Test the constant and the export in the sandbox's unit tests, and document the notification in `docs/modules/lib/core/sandbox/README.md` as part of the loader's protocol, outside the mod API. Verify `npx vitest run src/lib/core/sandbox` passes
- [ ] 4.2 In `src/lib/core/engine/mod_session.ts`, add the optional `onMounted` and `onErrorResponse` to `ModSessionOptions`. `onMounted` is called for `sandbox.mounted`, and for `sandbox.mountFailed` after the issue is reported. `onErrorResponse` is called with the request's method (or `null` for a message that is not a request) and the error, for every error response sent. Test-first in `mod_session.test.ts` with a fake frame: both hooks, an unknown method (`-32601`), bad params (`-32602`), a message that is not a request (`-32600`), and a session without the hooks, which behaves as before. Verify `npx vitest run src/lib/core/engine` passes
- [ ] 4.3 Document both options in `docs/modules/lib/core/engine/README.md`. Verify the README names `onMounted` and `onErrorResponse`

## 5. `mods.check` and the version bump

- [ ] 5.1 Add `onCheckMod` to `ModMethodContext`, returning the report's promise or `null`, and give `buildMethodContext` and `buildAskingContext` in `src/test/method_contexts.ts` a default that fails the test if called. Add `"mods.check"` to `MODS_METHODS`, following design.md. Test-first in `mods_methods.test.ts` with the "Check requests follow the inspect rules" scenarios (no `open` grant, hidden mod, switched-off mod, missing `mod`), a bad `collection`, and the "Missing mod file" scenario with an `onCheckMod` that runs `checkModBundle`. Verify the method's tests pass
- [ ] 5.2 Bump `MOD_API_VERSION` to `"0.1.1"` and add a `"0.1.1"` entry to the surface guard in `mod_api_surface.test.ts` (the `0.1.0` surface plus `mods.check`), leaving the `0.1.0` entry as it is. Update the version test in `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`, and keep `TEST_MOD_API_RANGE` at `^0.1.0`. Add a test for "Mods for 0.1.0 still match" (a mod with `api: "^0.1.0"` has `apiCompatible` `true`). Verify `npx vitest run src/lib/core/engine` and `npm run build` pass
- [ ] 5.3 In `docs/modules/lib/core/engine/README.md`, document `mods.check` (params, errors, result) next to `mods.inspect`, and change `0.1.0` to `0.1.1` where it is the current version: the mount context table, the "Mod API version" section and the exports list. Verify `grep -n "0\.1\.0" docs/modules/lib/core/engine/README.md` matches only the bump rule's examples

## 6. Checks in the stage

- [ ] 6.1 Add `src/lib/core/stage/stage_checks.ts` and wire it into `stage_controller.ts` following design.md:
  - `stage.checks`, and `checks` in the snapshot;
  - `onCheckMod` in the services of every sandbox;
  - `attachCheckFrame` and `checkFrameLoadedAgain`, exported from the stage's `index.ts`;
  - ending the checks of a closed sandbox.

  Write the tests first in `stage_checks.test.ts`, with a fake frame that plays the loader and Vitest's fake timers, for:
  - "Check the sample mod" (with the fixture), "Check with another collection" and "Mod without a sample collection";
  - "Bundle error skips the mount" (no check in the snapshot, nothing sent to a frame) and "Frame removed after the check" (the check leaves the snapshot);
  - "Mount throws" (through `sandbox.mountFailed`), "Unknown method", "Blocked image" (through `sandbox.blocked`) and "Mount never finishes" (10 seconds);
  - the 1-second settle time, which still records a request sent within it;
  - a frame that loads again;
  - "Mod asks for a confirmation while mounting", and `links.open`, `files.save`, `mods.open` and `mods.check` from the checked mod;
  - "Real slot untouched" with a memory storage, and "Viewer stays visible" (sandboxes, entries, issues and history unchanged);
  - closing the requester during a check.

  Verify `npx vitest run src/lib/core/stage` passes
- [ ] 6.2 Document the checks in `docs/modules/lib/core/stage/README.md`: where they are kept, the snapshot's `checks`, the two frame functions, the settle time and the limit, and that a check never asks about the API. Verify the README names `attachCheckFrame` and both durations

## 7. Hidden check frame

- [ ] 7.1 Add `src/main/stage/CheckFrame.tsx` and render one per entry of `snapshot.checks` from `StageView`, outside the sandboxes, hidden by layout as design.md says (stage size, `opacity: 0`, `pointer-events: none`, `inert`, `aria-hidden="true"`), with layout utilities and no literal colors. Test in `StageView.test.tsx`: a check entry renders a frame with `sandbox="allow-scripts"`, `inert` and `aria-hidden`, outside every `[data-sandbox-id]`, and it is removed when the entry leaves the snapshot. Describe it in `docs/modules/main/README.md`. Verify `npx vitest run --project app` passes
- [ ] 7.2 Add the e2e test mods to `e2e/mod_routes.ts` (and `e2e/sample_mod.ts` for the shipped sample's references), built on `buildModConf` and `buildProbeFiles`:
  - an entrypoint that answers 404, and a tile type that answers 404;
  - a `mount` that throws `new Error("map failed")`, and one that never settles;
  - a `mount` that sends `tiles.delete`, one that sends `ui.confirm`, and one that requests an image from an undeclared host;
  - a `mount` that awaits `requestAnimationFrame`, and one that takes 3 seconds;
  - a `mount` that reads `storage.get` for `selected` and posts the value where the test can read it.

  Verify `npm run build` type-checks them
- [ ] 7.3 Add `e2e/mod_check.spec.ts`, with one `describe` per requirement of `mod-check`, for the scenarios that need a browser:
  - "Check the sample mod" with `./samples/mods/book_list`;
  - "Bundle error skips the mount" (the entrypoint is not requested);
  - "Frame removed after the check";
  - "Mount throws", "Unknown method", "Blocked image" and "Mount never finishes";
  - "Mod asks for a confirmation while mounting" (no dialog in the page);
  - "Real slot untouched";
  - "Viewer stays visible".

  Add one test that a mount awaiting `requestAnimationFrame` passes, and one that checks the shipped sample, `mod_explorer` and `mod_viewer` through a probe mod with `open` for `"*"` and expects `"pass"` for each. Verify `npm run test:e2e -- e2e/mod_check.spec.ts` passes

## 8. Mod viewer

- [ ] 8.1 In `public/default_mods/mod_viewer/main.js`, add the "Check mod" button and the report following design.md, with the existing badge, status and alert builders and no new look in the viewer's styles. Update `docs/modules/mods/viewer/README.md`. Verify with the tests of 8.2
- [ ] 8.2 In `e2e/default_mods.spec.ts`, add a `describe` for "Mod viewer checks the mod" ("Checking in progress", "No button without a mod") and one for "Mod viewer shows the check report" ("Sample mod passes", "Failing mod"), after the existing viewer blocks. Verify `npm run test:e2e -- e2e/default_mods.spec.ts` passes, including "Own styles are layout only"
- [ ] 8.3 In `docs/mod_plugin_spec.md`, add how to check a mod: the mod viewer's "Check mod" button, what the bundle and mount checks look at, the statuses, and that only the first second after `mount` is watched. Verify the document names `mods.check` and the three statuses

## 9. Integration check

- [ ] 9.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all pass, with the counts of 1.1 plus only the tests this change added. Verify that `grep -rnE "fixtures(/|%2F)" src --exclude-dir=test` is empty and that `grep -rnE "samples(/|%2F)" e2e` matches only `e2e/sample_mod.ts`. Run `openspec validate add-mod-check --strict` and verify it reports the change as valid

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed, syncing the `mod-check`, `mod-api-version` and `default-mods` deltas into the main specs, before `add-mod-tests`, which adds its results to the report.
