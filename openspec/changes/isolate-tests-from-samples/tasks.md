# Tasks

## 1. Prerequisites and baseline

- [x] 1.1 Check that `streamline-test-suite` is applied: `docs/code_conventions.md` has the "Tests" section, and `npm run test:e2e:samples -- --list` and `npm run test:e2e:full -- --list` work. Verify both, and stop if either fails.
- [x] 1.2 Run the default run with `PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/isolate-baseline.json npx playwright test --reporter=json,line` and record its runs, wall time and test time per engine. Verify that it passes.
  - Baseline: 974 runs (973 passed, 1 skipped), 123 s wall time. Test time: Chromium 432 runs, 332.0 s; Firefox 271 runs, 479.9 s; WebKit 271 runs, 433.8 s; 1245.7 s in all.

## 2. Test-owned mods

- [x] 2.1 Add the tiles mod of design.md decision 1 as files in `e2e/test_mods/tiles/`:
  - a mod file with a tile type, a sample collection of three tiles, `show` for `COVER_HOST`, a config key and `test_path`
  - a `main.js` that lists each tile as an `<li>` with its title and image, reads and writes one storage key, and stores `globalThis.probe`
  - a test file with two cases that pass

  Follow `docs/code_conventions.md`. Verify with `npm run lint` and `npm run format:check`.
- [x] 2.2 Add `e2e/test_mods.ts`:
  - `serveTilesMod`, which serves `e2e/test_mods/tiles/` at `/test-mods/tiles/`, and the tiles mod's path, reference and run link constants
  - `openProbe`, `openTypedProbe` and the typed probe's builders, moved from `e2e/stage_bar.spec.ts`
  - `MISSING_TEST_MOD_REFERENCE` (`./test-mods/missing`, answered with HTTP 404)

  Make `stage_bar.spec.ts` import from it. Verify that `E2E_RUN=full npx playwright test e2e/stage_bar.spec.ts` passes.
- [x] 2.3 Remove `e2e/mod_routes.ts`'s import of `sample_mod.ts`:
  - replace `exposeSampleEngine` and `serveColumnsReportingSample` with the tiles mod
  - point the helpers built on `SAMPLE_TYPE_PATH` and `SAMPLE_COLLECTION_PATH` at the typed probe's or the tiles mod's files
  - update their callers

  Verify that `grep -n "sample_mod" e2e/mod_routes.ts` finds nothing, and that the specs that call the changed helpers pass with `E2E_RUN=full`.

## 3. Sample requirements move to the sample's tests

- [x] 3.1 Move the tests of the moved scenarios into `e2e/sample_book_list.spec.ts`, under `@sample` (design.md decision 3):
  - "Books with covers", from `mod_stage`
  - "Sample tests", from `mod_tests`
  - "Dark sample mod", from `mod_theme`
  - "Sample mod's own styles": find the test that checks it and name it after the scenario
  - "Sample matches the app's API": add it, with the sample's part of `mod_api_version` › "Shipped mods match"

  Verify that `npm run test:e2e:samples` passes, and that each of the five titles appears once in `e2e/sample_book_list.spec.ts`.
- [x] 3.2 Rename `mod_api_version` › "Shipped mods match" to "Default mods match", for the explorer and the viewer only.
  - Remove the e2e tests "Selection is remembered" and "Raised book uses the theme's shadow". First check that "Choice kept across starts" and "Raised on hover" assert the same.
  - Drop the sample from `mod_check` › "Shipped mods pass".

  Verify that `E2E_RUN=full npx playwright test e2e/mod_api_version.spec.ts e2e/mod_stage.spec.ts e2e/mod_theme.spec.ts e2e/mod_check.spec.ts e2e/mod_tests.spec.ts` passes.

## 4. Spec files off the shipped sample

For every task in this group:
- Follow the reworded steps of this change's `specs/`.
- Use the probe, the typed probe or the tiles mod, as design.md decision 1's table says.
- Verify that the listed files import nothing from `sample_mod.ts`, and that they pass with `E2E_RUN=full npx playwright test <files>`.

- [x] 4.1 `mod_stage`, `app_theme` and `app_sidebar`, including the local `openSample` helpers of `app_theme` and `app_sidebar`.
- [x] 4.2 `stage_layout`, including its local `openSample`.
- [x] 4.3 `mod_sandbox`, `mod_engine_api`, `mod_libraries` and `site_consent`.
- [x] 4.4 `mod_check` and `mod_tests`. The mod test API scenarios use the tiles mod's config key, storage key and list.
- [x] 4.5 `default_mods`:
  - The viewer and checker scenarios use the tiles mod.
  - "Select a mod" serves the explorer's mod file with a `config.mods` that lists the tiles mod (design.md decision 4). If that cannot be routed, it stays a B test and the task says why.
  - The B tests (the vanilla explorer's list and the flashcards selection) get `@sample` and name the samples by literal reference.

  Also verify that `npm run test:e2e -- --list` lists none of the B tests.
- [x] 4.6 `mod_api_version`, `mod_app_actions`, `mod_theme`, `app_pages` and `app_settings`. For the page link scenario, serve a test page whose link names a probe mod.
- [x] 4.7 Check that every reworded scenario still has a test named after it, in an e2e spec or a unit test. Verify by listing the scenario names of this change's `specs/` and finding each one among the test titles.
  - 124 of the 125 scenario names match a test title. "Vanilla explorer lists the sample" and "Vanilla explorer lists the flashcards sample" shared the e2e test "Vanilla explorer lists the samples", which is split into two `@sample` tests named after them.
  - "Mod that cannot be inspected" (copied unchanged into the delta) has no test of that name before or after this change. The explorer's own case "lists a mod that cannot be inspected as an alert" covers it, run by `default_mods` › "Explorer passes its check". It is not renamed, since this change does not change the default mods.

## 5. Lint guard

- [x] 5.1 Add the two `.oxlintrc.json` overrides of design.md decision 5. Verify:
  - `npm run lint` passes
  - a temporary `import { SAMPLE_RUN_HASH } from "./sample_mod.ts";` in `e2e/app.spec.ts` fails `npm run lint` with the rule's message, and the import is then removed
  - `grep -rn "samples/mods" e2e --include="*.ts"`, outside `e2e/sample_*.spec.ts` and `e2e/sample_mod.ts`, finds only `@sample` tests

## 6. Duplicate audit

For every task in this group:
- Apply design.md decision 6 to each overlapping title of the listed files. The overlaps come from comparing the files' test titles with the unit tests' titles.
- Run the check before removing each e2e test.
- In the task, note each overlap that keeps its e2e test, with the reason.
- Verify that `npm run test` and `E2E_RUN=full npx playwright test <files>` pass.

- [x] 6.1 App shell: `app_sidebar`, `app_settings`, `app_pages` and `app_theme`.
  - Removed 33 of the 57 overlaps; each removed test's scenario is asserted by its unit test. Added first: `Sidebar.test.tsx` › "Tiles is coming soon" checks that the visible page is unchanged; "Other site" moved to a render test in `page_markdown.test.tsx` that asserts `target` and `rel` (the mapping test in `page_links.test.ts` is renamed).
  - `app_sidebar` keeps: "Back where you left off" and "Activating the current section returns to its start" (the frame is not reloaded when shown again); "Back after switching sections" and "Kept after a reload" (browser history across back and reload); "Drag wider", "Width is clamped", "Drag to collapse", "Drag back before releasing", "Drag to expand" and "Short drag stays collapsed" (a real pointer drag on the laid-out handle: jsdom lays nothing out); "Collapsed after a reload" and "Width after a reload" (storage across reloads); "Explorer switched off" (the unit test covers the registry; the Settings switches of the explorer-off build are only built in e2e).
  - `app_settings` keeps: "Allow a remembered refusal", "Refuse all of a mod" and "Switched off before opening a mod" (the frame's content policy); "Running mod keeps its policy" and "Hide Guides" (no frame is reloaded); both "Kept after a reload" (storage across reloads).
  - `app_pages` keeps: "Sibling page" (the browser's back button); "Run link" (the linked mod runs in a frame); "Missing page" (the unit test renders the page alone; that the sidebar still opens Home needs the app shell).
  - `app_theme` keeps "Choice kept after a reload" (storage across reloads; its title is also `stage-layout`'s theater scenario, a different one).
- [x] 6.2 Stage: `mod_stage` and `stage_layout`.
  - Removed 13 of the 29 overlaps. Added first: `StageView.test.tsx` › "Missing collection" checks that the alert names the collection's resolved address and that no frame is shown.
  - `mod_stage` keeps: "Link with a mod and a collection", "Link without a collection" and "Encoded values" (the mod runs in its frame with the link's tiles; the unit tests only parse the link, and "Encoded values" there decodes a `target`, not the `mod`); "Second link hides the first mod", "A page hides the mods" and "Close the viewer" (the hidden frame keeps running and is not reloaded); "Back to the previous mod", "Forward again", "Back after a page reload", "New link after going back", "Back from a page to a mod", "Forward to a page", "Reload on a page" and "New section after going back" (the browser's back, forward and reload).
  - `stage_layout` keeps: "Leaving fullscreen" (real fullscreen and Escape); "Choice kept after a reload" (storage across reloads).
- [x] 6.3 Mods and frames: `mod_sandbox`, `mod_check`, `mod_tests`, `mod_engine_api`, `mod_libraries`, `mod_app_actions`, `mod_api_version`, `site_consent`, `media_players`, `mod_theme` and `default_mods`.
  - Removed 26 of the 80 overlaps, each covered by a unit test that asserts every THEN: `mod_sandbox` › "Sample content hosts"; `mod_check` › "Bundle error skips the mount" and "Viewer stays visible"; `mod_tests` › "Failing equality", "Negation", "Wait for the list" and "Waiting too long" (the case library's own tests); `mod_engine_api` › "Link parameters", "Image next to the tile", "Hidden mod tries to open a mod" and "Mod without the open permission"; `mod_libraries` › "Unknown library" and "Other major version"; `mod_api_version` › "Mod without a range", "Opened by another mod" and "Cancel"; `site_consent` › "Foreign mod with a declared permission", "Lines of a foreign mod", "Another API first", "Cancelled for another API" and "Check a foreign mod without decisions"; `media_players` › "Cancel", "Address not from the tiles" and "Remembered site"; `mod_theme` › "Same color scheme, no event"; `default_mods` › "Explorer from the default folder".
  - `mod_sandbox` keeps 24: the content policy the browser enforces and the violations it reports ("Tile from another host", "Undeclared image host", "Undeclared connection", "Declared but not granted", "Request blocked by another rule", "Repeated block is reported once", the tile-linked media cases from "Image linked by a tile" to "Router address in a tile from the web", "Tile link that redirects", "New link after reloading the tiles", both wildcard cases, "Mod from another origin" and "Confirm"); "Mod navigates its frame" (frame navigation); "Mount throws" (its unit title is `mod-check`'s scenario, a different one).
  - `mod_check` keeps 8 and `mod_tests` keeps 8: the mod or the case runs in a real hidden frame, with its content policy, its timers and its storage (unit tests use fake frames).
  - `mod_libraries` keeps "Load mermaid" (`globalThis.mermaid` in the frame). `mod_app_actions` keeps all 3: "Two confirmations" (native `<dialog>`), "Back while a dialog is open" (the browser's back button), "Stopped while a dialog is open" (the frame navigates). `mod_api_version` keeps: "Run anyway" (native dialog, and the mount context in the frame), "Escape" (a native dialog's Escape), "Asked after a page reload" and "Back while asking" (reload and back). `site_consent` keeps: "Escape" (native dialog); "Remembered allow" and "Kept after a reload" (the covers load under the policy; storage across reloads); "Opened by another mod" (its unit title is `mod-api-version`'s scenario, a different one).
  - `mod_theme` keeps "Visible and hidden mods are told" (a hidden frame receives the event). `default_mods` keeps "Vanilla settings" (the explorer runs in its frame and opens the viewer; the unit test checks the settings only).
- [x] 6.4 Tile bodies: `tile_bodies`, `tile_body_diagrams` and `tile_body_extras`.
  - Removed 4 of the 6 overlaps: `tile_body_extras` › "Fraction", "Unclosed brace", "Labeled JavaScript" and "Shortcodes", whose `render_body.test.ts` tests assert the whole rendered HTML. Loading the math chunk once is asserted by `body_extras.test.ts`, and "Math font" still renders math from the built chunk in a frame.
  - Kept: `tile_bodies` › "Dark-mode picture" (the browser picks the `<picture>` source by the frame's color scheme, and the image loads); `tile_body_diagrams` › "Syntax error" (its unit title is `mod-tests`' "Syntax error", a different scenario).
- [x] 6.5 Stage bar scenarios without a test named after them (design.md decision 6): "App errors stay", "Blocked request while the mod runs", "Cancelled API question", "Message from the app" and "Message from the mod". Give each one test named after it, at the lowest level that can prove it: name a covering unit test after it, or split `stage_bar.spec.ts` › "Message from the app and from the mod" into "Message from the app" and "Message from the mod". Run the check before renaming or removing a test. Verify that each of the five names appears among the test titles, and that `npm run test` and `E2E_RUN=full npx playwright test e2e/stage_bar.spec.ts` pass.
  - Each of the five now has one test named after it. "App errors stay" (`stage_sandboxes.test.ts`: 200 warnings from the mod leave the tile's issue in place), "Blocked request while the mod runs" and "Cancelled API question" (`StageView.test.tsx`) are new unit tests. `stage_bar.spec.ts` › "Message from the app and from the mod" is split into "Message from the app" and "Message from the mod", with the same assertions. No test was removed.

## 7. Changeset

- [x] 7.1 Add `.changeset/isolate-tests-from-samples.md` with a `patch` bump for `opentesela` and the summary "The tests no longer depend on the shipped samples; no change to the app.", following the "Bump rule" section of `docs/releasing.md`. Verify with `npx changeset status` (it lists the patch) and `npm run format:check`.

## 8. Verification

- [x] 8.1 Check that the core's tests no longer need the samples:
  - Without `public/samples/`, `npm run test:e2e` passes (828 passed, 1 skipped), its builds hold no `samples/`, and `npm run test` fails only in `src/lib/mod/sample_mod.test.ts`. To get there, `e2e/sample_mod.ts` now reads the sample's entrypoint when a test asks for it (`readSampleEntrypointCode`), not on import: Playwright loads every spec file, the `@sample` ones too, and the import failed without the samples.
  - move `public/samples/` out of the repository temporarily, then run `npm run test:e2e`
  - verify that it passes: its builds no longer contain the samples, and the default run has no `@sample` test
  - also run `npm run test`, and verify that only `src/lib/mod/sample_mod.test.ts` fails
  - move `public/samples/` back, and verify that `git status` shows no change under `public/`
- [x] 8.2 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e`, `npm run test:e2e:samples` and `npm run test:e2e:full`, and verify that all pass. The samples run is needed because this change edits specs of the mod API.
  - On `npm ci`, all seven commands pass: 1593 unit tests; default run 828 passed, 1 skipped; samples run 201 passed; full run 1247 passed, 1 skipped.
  - After: 829 runs, 110 s wall time. Test time: Chromium 349 runs, 291.0 s; Firefox 240 runs, 430.0 s; WebKit 240 runs, 382.5 s; 1103.5 s in all (baseline: 974 runs, 123 s, 1245.7 s).
  - `git status` shows the Impact section's files, this change's folder, and `e2e/sample_mod.ts` (the sample's case names moved there from `mod_routes.ts`, and its entrypoint is read lazily, see 8.1).
  - Run the default run with `PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/isolate-after.json npx playwright test --reporter=json,line`, and report its runs, wall time and test time per engine next to task 1.2's numbers.
  - Verify that `git status` shows only the files in the proposal's Impact section plus this change's folder.
