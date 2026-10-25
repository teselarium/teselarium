# Tasks

## 1. Setup

- [ ] 1.1 Record the current test counts: run `npm test` and `npm run test:e2e` and note the number of passing tests of each, for the checks in 2.3 and 9.1
- [ ] 1.2 Add `semver` 7 as a dependency and `@types/semver` as a dev dependency. Verify that `npm run build` succeeds with a temporary import of `semver/ranges/valid.js` in `src/lib/mod/mod_format.ts` (then remove it), so CommonJS bundling is proven before it is used

## 2. Test mods declare a range

- [ ] 2.1 In `src/test/sample_mods.ts`, add `TEST_MOD_API_RANGE` (`"^0.1.0"`, with a doc comment). Make `serveTestMod` and `serveUntypedMod` write `api` with it as the first line under `mod`, and take an optional range whose `null` leaves the line out. Verify `npx vitest run src/lib/core` passes
- [ ] 2.2 In `e2e/mod_routes.ts`, add the same `TEST_MOD_API_RANGE` and the same optional range to `buildModConf` and `buildProbeFiles`. Give `api` to the inline mod files in e2e specs whose tests expect no issues, such as the explorer in `e2e/default_mods.spec.ts`. Verify `npm run build` (which type-checks `e2e/`) succeeds
- [ ] 2.3 Add `api: "^0.1.0"` under `mod` in `src/test/fixtures/mods/book_list/mod_conf.yaml`. Verify that `npm test` and `npm run test:e2e` pass with the counts of 1.1. The loader still ignores the key, so nothing changes yet

## 3. API range in the mod file

- [ ] 3.1 Write the failing tests first, in `src/lib/mod/mod_format.test.ts` and `mod_loader.test.ts`, for the `mod-loading` scenarios "Caret range", "No api key", "Not a range" and "Range written as a number". Add cases for `api: ""` and `api: "  "`. Verify they fail for the expected reason
- [ ] 3.2 In `src/lib/mod/mod_format.ts`, add `readModApiRange` with `validRange` from `semver/ranges/valid.js`. It requires a non-empty string after trimming, and its error message is `"api" must be a semver range, such as "^0.1.0"`. Add `api: string | null` to `ModFormat`, `ModFile` and `LoadedMod`, and export `MOD_FILE_KEYS`, the keys `readModFormat` reads, with the doc comment of `readModFormat` pointing to it. Set `api` to `TEST_MOD_API_RANGE` in `buildRequestingMod` (`src/test/method_contexts.ts`). Verify the tests of 3.1 pass and `npx vitest run src/lib/mod` and `npm run build` succeed
- [ ] 3.3 Document `api` in `docs/modules/lib/mod/README.md` (the key, its format error, `api` in the loaded mod) and in `docs/mod_plugin_spec.md` (the key in the `mod_conf.yaml` example and a sentence on what it means). Replace the claim that mods can ask for "the opentesela version" with the mod API version. Verify both documents name `api` and `^0.1.0`

## 4. Mod API version in the engine

- [ ] 4.1 Add `src/lib/core/engine/mod_api_version.ts` with `MOD_API_VERSION` (`"0.1.0"`), `matchModApiRange` (`satisfies` from `semver/functions/satisfies.js`, `null` without a range), and the texts of the missing-range warning and of the cancel error, each naming the range when there is one and the version. Export them from the engine's `index.ts`. Test-first in `mod_api_version.test.ts`, with the `mod-api-version` scenarios "Caret range on 0.1", "Range for a later API" and "Comparison range" (checked against the given versions with `satisfies`, through a function that takes the version) and the `null` case. Verify `npx vitest run src/lib/core/engine/mod_api_version.test.ts` passes
- [ ] 4.2 Add `api: { version: MOD_API_VERSION }` to `ModContext` and `buildModContext`, and test the "API version in the mount context" scenarios in `mod_launch.test.ts`: the sample mod's `api` has exactly `version`, a mod without a range gets it too, and a structured clone deep-equals it. Verify `npx vitest run src/lib/core/engine/mod_launch.test.ts` passes
- [ ] 4.3 Add `apiCompatible` and `fileIssues` to `ModLaunch`. A mod without a range gets one warning whose source is the mod file's source and whose message names `api` and the version, and no other mod gets one. Test both in `mod_launch.test.ts`, including a mod with `api: "^0.2.0"`, which has `apiCompatible` `false` and no file issue. Verify the engine tests pass
- [ ] 4.4 Add `api` and `apiCompatible` to `ModInspection` and `inspectMod`, and test the "Inspect reports the API range" scenarios in `mod_inspection.test.ts` and `mods_methods.test.ts` on the fixture mod, a mod with `api: "^0.2.0"` and a mod without a range. Verify `npx vitest run src/lib/core/engine` passes
- [ ] 4.5 Document `MOD_API_VERSION`, `context.api` (in the mount context table) and the inspection's `api` and `apiCompatible` in `docs/modules/lib/core/engine/README.md`. Verify the README's mount context table has an `api` row and its `mods.inspect` line names both fields

## 5. Stage: missing range and the question

- [ ] 5.1 In `src/lib/core/stage/stage_sandboxes.ts`, copy `fileIssues` to the runtime on start and list them first in `readSandboxIssues`, before the collection issues. Test-first in `stage_sandboxes.test.ts`: a mod without `api`, opened with a collection that has a tile of another type, lists the missing-range warning first and the tile's issue second, and the warning stays after reloading the tiles. Verify `npx vitest run src/lib/core/stage` passes
- [ ] 5.2 Add the `asking` status: a launch with `apiCompatible === false` makes the runtime `asking` with its `launch` set and no frame document, and `SandboxSnapshot` gets `apiMismatch` (`{ range, apiVersion }`, only while asking). Add `answerApiMismatch(stage, sandboxId, runAnyway)` to the controller and export it from the stage's `index.ts`. "Run anyway" starts the runtime, "Cancel" fails it with the cancel error, and a sandbox that is not visible or not asking is left as it is. Test-first in `stage_controller.test.ts`:
  - matching and range-less mods never ask;
  - run anyway gives a frame document;
  - cancel shows the error naming the range and the version, with no frame document and `canClose` `true`;
  - going back while asking hides the sandbox with no frame document, and going forward asks again;
  - closing while asking stops the runtime, and a later answer does nothing;
  - a reload of the entry and a `mods.open` both ask again.

  Verify `npx vitest run src/lib/core/stage` passes
- [ ] 5.3 Document the `asking` status, `apiMismatch`, `answerApiMismatch` and the issue order in `docs/modules/lib/core/stage/README.md`. Verify the README names the status and the function

## 6. The mismatch dialog

- [ ] 6.1 Move the native-dialog mechanics of `src/main/stage/ActionDialog.tsx` (`showModal` while shown, focus on Cancel, Escape as Cancel, opening again after a stray close) into a shared component in `src/main/stage/`, and render `ActionDialog`'s content inside it. Verify `npx vitest run src/main/stage/ActionDialog.test.tsx` passes unchanged
- [ ] 6.2 Add `ApiMismatchDialog` in `src/main/stage/`, rendered by `StageView` for the visible sandbox while it is asking. It shows the mod's title, source and version, its range and the app's mod API version, with "Run anyway" and "Cancel", and the sandbox shows "Waiting for your answer…" in its place. Test-first in `StageView.test.tsx`: the dialog's texts, Run anyway, Cancel, Escape, and no dialog for the fixture mod. Verify `npx vitest run --project app` passes
- [ ] 6.3 Describe the dialog next to the action dialog in `docs/modules/main/README.md`. Verify the README names both buttons

## 7. Shipped mods and the mod viewer

- [ ] 7.1 Add `api: "^0.1.0"` to `public/samples/mods/book_list/mod_conf.yaml`, `public/default_mods/mod_explorer/mod_conf.yaml` and `public/default_mods/mod_viewer/mod_conf.yaml`. Verify that `npx vitest run src/lib/mod/sample_mod.test.ts` passes and that the sample's loaded mod has `api` `"^0.1.0"`
- [ ] 7.2 In `public/default_mods/mod_viewer/main.js`, show the API range and whether it matches, from `inspection.api` and `inspection.apiCompatible`. Show the app's mod API version from `context.api.version` when the range does not match, and say that the mod declares no API range when it has none. Update `docs/modules/mods/viewer/README.md`. Verify with the e2e tests of 7.3
- [ ] 7.3 Add e2e tests for the `mod-api-version`, `mod-stage` and `default-mods` scenarios of this change, with the shipped sample through `e2e/sample_mod.ts` and other mods through `buildModConf`/`buildProbeFiles`:
  - no dialog for the shipped mods;
  - the dialog's texts, Run anyway (`context.api.version`), Cancel, Escape;
  - asked again after closing and after a reload;
  - opened by the viewer with `mods.open`;
  - back while asking;
  - the missing-range warning first;
  - the viewer's range, its mismatch and its missing range.

  Verify `npm run test:e2e` passes

## 8. Surface guard and the bump rule

- [ ] 8.1 Export the merged method table from `src/lib/core/engine/mod_session.ts`, and add a `TILES_CHANGED_METHOD` constant used where `tiles.changed` is sent. Add `src/lib/core/engine/mod_api_surface.test.ts` with the record of versions (`"0.1.0"` and its surface: method names, event names, mount context keys with the keys of `mod`, `api`, `permissions` and `theme`, `MOD_FILE_KEYS` and `PERMISSION_CATEGORIES`). It checks that the entry for `MOD_API_VERSION` equals the surface built from the code and that `MOD_API_VERSION` is the highest version recorded. Verify that it passes, and that it fails, naming the bump rule, when a method is temporarily added to a handler table (then remove it)
- [ ] 8.2 Add the "Mod API version" section to `docs/modules/lib/core/engine/README.md`: what it covers, where it lives, the `0.x` bump rule and the surface guard entry for each bump. Add `rules.proposal` to `openspec/config.yaml`, asking a proposal that changes the mod API's specs to state its version bump, following that section. Verify that `openspec validate add-mod-api-version` still reports the change as valid and that `openspec instructions proposal --change add-mod-api-version --json` lists the new rule

## 9. Integration check

- [ ] 9.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all pass, with the counts of 1.1 plus only the tests this change added. Verify that `grep -rnE "fixtures(/|%2F)" src --exclude-dir=test` is empty and that `grep -rnE "samples(/|%2F)" e2e` matches only `e2e/sample_mod.ts`. Run `openspec validate add-mod-api-version` and verify it reports the change as valid

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed, before `add-mod-check`, `add-mod-tests` and `add-app-versioning`, which build on it.
