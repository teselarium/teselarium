# Tasks

## 1. Prerequisites and baseline

- [ ] 1.1 Check that `streamline-test-suite` is applied: `docs/code_conventions.md` has the "Tests" section, and `npm run test:e2e:samples -- --list` and `npm run test:e2e:full -- --list` work. Verify both, and stop if either fails.
- [ ] 1.2 Run the default run with `PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/isolate-baseline.json npx playwright test --reporter=json,line` and record its runs, wall time and test time per engine. Verify that it passes.

## 2. Test-owned mods

- [ ] 2.1 Add the tiles mod of design.md decision 1 as files in `e2e/test_mods/tiles/`:
  - a mod file with a tile type, a sample collection of three tiles, `show` for `COVER_HOST`, a config key and `test_path`
  - a `main.js` that lists each tile as an `<li>` with its title and image, reads and writes one storage key, and stores `globalThis.probe`
  - a test file with two cases that pass

  Follow `docs/code_conventions.md`. Verify with `npm run lint` and `npm run format:check`.
- [ ] 2.2 Add `e2e/test_mods.ts`:
  - `serveTilesMod`, which serves `e2e/test_mods/tiles/` at `/test-mods/tiles/`, and the tiles mod's path, reference and run link constants
  - `openProbe`, `openTypedProbe` and the typed probe's builders, moved from `e2e/stage_bar.spec.ts`
  - `MISSING_TEST_MOD_REFERENCE` (`./test-mods/missing`, answered with HTTP 404)

  Make `stage_bar.spec.ts` import from it. Verify that `E2E_RUN=full npx playwright test e2e/stage_bar.spec.ts` passes.
- [ ] 2.3 Remove `e2e/mod_routes.ts`'s import of `sample_mod.ts`:
  - replace `exposeSampleEngine` and `serveColumnsReportingSample` with the tiles mod
  - point the helpers built on `SAMPLE_TYPE_PATH` and `SAMPLE_COLLECTION_PATH` at the typed probe's or the tiles mod's files
  - update their callers

  Verify that `grep -n "sample_mod" e2e/mod_routes.ts` finds nothing, and that the specs that call the changed helpers pass with `E2E_RUN=full`.

## 3. Sample requirements move to the sample's tests

- [ ] 3.1 Move the tests of the moved scenarios into `e2e/sample_book_list.spec.ts`, under `@sample` (design.md decision 3):
  - "Books with covers", from `mod_stage`
  - "Sample tests", from `mod_tests`
  - "Dark sample mod", from `mod_theme`
  - "Sample mod's own styles": find the test that checks it and name it after the scenario
  - "Sample matches the app's API": add it, with the sample's part of `mod_api_version` › "Shipped mods match"

  Verify that `npm run test:e2e:samples` passes, and that each of the five titles appears once in `e2e/sample_book_list.spec.ts`.
- [ ] 3.2 Rename `mod_api_version` › "Shipped mods match" to "Default mods match", for the explorer and the viewer only.
  - Remove the e2e tests "Selection is remembered" and "Raised book uses the theme's shadow". First check that "Choice kept across starts" and "Raised on hover" assert the same.
  - Drop the sample from `mod_check` › "Shipped mods pass".

  Verify that `E2E_RUN=full npx playwright test e2e/mod_api_version.spec.ts e2e/mod_stage.spec.ts e2e/mod_theme.spec.ts e2e/mod_check.spec.ts e2e/mod_tests.spec.ts` passes.

## 4. Spec files off the shipped sample

For every task in this group:
- Follow the reworded steps of this change's `specs/`.
- Use the probe, the typed probe or the tiles mod, as design.md decision 1's table says.
- Verify that the listed files import nothing from `sample_mod.ts`, and that they pass with `E2E_RUN=full npx playwright test <files>`.

- [ ] 4.1 `mod_stage`, `app_theme` and `app_sidebar`, including the local `openSample` helpers of `app_theme` and `app_sidebar`.
- [ ] 4.2 `stage_layout`, including its local `openSample`.
- [ ] 4.3 `mod_sandbox`, `mod_engine_api`, `mod_libraries` and `site_consent`.
- [ ] 4.4 `mod_check` and `mod_tests`. The mod test API scenarios use the tiles mod's config key, storage key and list.
- [ ] 4.5 `default_mods`:
  - The viewer and checker scenarios use the tiles mod.
  - "Select a mod" serves the explorer's mod file with a `config.mods` that lists the tiles mod (design.md decision 4). If that cannot be routed, it stays a B test and the task says why.
  - The B tests (the vanilla explorer's list and the flashcards selection) get `@sample` and name the samples by literal reference.

  Also verify that `npm run test:e2e -- --list` lists none of the B tests.
- [ ] 4.6 `mod_api_version`, `mod_app_actions`, `mod_theme`, `app_pages` and `app_settings`. For the page link scenario, serve a test page whose link names a probe mod.
- [ ] 4.7 Check that every reworded scenario still has a test named after it, in an e2e spec or a unit test. Verify by listing the scenario names of this change's `specs/` and finding each one among the test titles.

## 5. Lint guard

- [ ] 5.1 Add the two `.oxlintrc.json` overrides of design.md decision 5. Verify:
  - `npm run lint` passes
  - a temporary `import { SAMPLE_RUN_HASH } from "./sample_mod.ts";` in `e2e/app.spec.ts` fails `npm run lint` with the rule's message, and the import is then removed
  - `grep -rn "samples/mods" e2e --include="*.ts"`, outside `e2e/sample_*.spec.ts` and `e2e/sample_mod.ts`, finds only `@sample` tests

## 6. Duplicate audit

For every task in this group:
- Apply design.md decision 6 to each overlapping title of the listed files. The overlaps come from comparing the files' test titles with the unit tests' titles.
- Run the check before removing each e2e test.
- In the task, note each overlap that keeps its e2e test, with the reason.
- Verify that `npm run test` and `E2E_RUN=full npx playwright test <files>` pass.

- [ ] 6.1 App shell: `app_sidebar`, `app_settings`, `app_pages` and `app_theme`.
- [ ] 6.2 Stage: `mod_stage` and `stage_layout`.
- [ ] 6.3 Mods and frames: `mod_sandbox`, `mod_check`, `mod_tests`, `mod_engine_api`, `mod_libraries`, `mod_app_actions`, `mod_api_version`, `site_consent`, `media_players`, `mod_theme` and `default_mods`.
- [ ] 6.4 Tile bodies: `tile_bodies`, `tile_body_diagrams` and `tile_body_extras`.
- [ ] 6.5 Stage bar scenarios without a test named after them (design.md decision 6): "App errors stay", "Blocked request while the mod runs", "Cancelled API question", "Message from the app" and "Message from the mod". Give each one test named after it, at the lowest level that can prove it: name a covering unit test after it, or split `stage_bar.spec.ts` › "Message from the app and from the mod" into "Message from the app" and "Message from the mod". Run the check before renaming or removing a test. Verify that each of the five names appears among the test titles, and that `npm run test` and `E2E_RUN=full npx playwright test e2e/stage_bar.spec.ts` pass.

## 7. Changeset

- [ ] 7.1 Add `.changeset/isolate-tests-from-samples.md` with a `patch` bump for `opentesela` and the summary "The tests no longer depend on the shipped samples; no change to the app.", following the "Bump rule" section of `docs/releasing.md`. Verify with `npx changeset status` (it lists the patch) and `npm run format:check`.

## 8. Verification

- [ ] 8.1 Check that the core's tests no longer need the samples:
  - move `public/samples/` out of the repository temporarily, then run `npm run test:e2e`
  - verify that it passes: its builds no longer contain the samples, and the default run has no `@sample` test
  - also run `npm run test`, and verify that only `src/lib/mod/sample_mod.test.ts` fails
  - move `public/samples/` back, and verify that `git status` shows no change under `public/`
- [ ] 8.2 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e`, `npm run test:e2e:samples` and `npm run test:e2e:full`, and verify that all pass. The samples run is needed because this change edits specs of the mod API.
  - Run the default run with `PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/isolate-after.json npx playwright test --reporter=json,line`, and report its runs, wall time and test time per engine next to task 1.2's numbers.
  - Verify that `git status` shows only the files in the proposal's Impact section plus this change's folder.
