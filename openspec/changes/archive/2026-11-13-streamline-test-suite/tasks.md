# Tasks

## 1. Baseline

- [x] 1.1 Run `PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/streamline-baseline.json npx playwright test --reporter=json,line` and record the runs, the wall time and the test time per engine. Verify that they are close to design.md's baseline (1560 runs, about 199 s wall time, 2136 s test time), and note any large difference before going on.

## 2. Tests convention

- [x] 2.1 Add the "Tests" section of design.md decision 1 to `docs/code_conventions.md`, word for word, after the "Conventions" section. Verify with `npm run format:check`, and verify that the section has the five rules and nothing project-specific.

## 3. Theater mode tooltip flake

- [x] 3.1 Confirm the cause (design.md decision 2):
  - Add a throwaway spec, `e2e/tooltip_race.tmp.spec.ts`. It copies "Turn theater mode on", adds a style tag that sets `[data-slot="tooltip-content"] { animation-duration: 2s !important }` before the click, and asserts an open tooltip (`[data-slot="tooltip-content"]:not([data-state="closed"])`) after the re-hover. It records whether the tooltip was mounted before the click.
  - Run it with `--repeat-each=10 --workers=1` in all three engines and verify that the old steps fail on every run where the tooltip was open at the click (every Firefox run, most WebKit runs).
  - If they pass with the tooltip open at the click, stop and report: the cause is something else.
- [x] 3.2 In `e2e/stage_bar.spec.ts` › "Turn theater mode on", wait for `page.getByRole("tooltip")` to have count 0 after the click, before moving the pointer away and hovering again. Update the comment to say why. Verify that the throwaway spec, with the same change, passes 10/10 in each engine, then delete it.
- [x] 3.3 Run `npx playwright test e2e/stage_bar.spec.ts -g "Turn theater mode on" --repeat-each=40 --workers=12` in each engine. Verify 40/40 per engine.

## 4. Tags and runs

- [x] 4.1 In `playwright.config.ts`, read `E2E_RUN` and build each project's `grep` and `grepInvert` from design.md decision 4's table. Throw an error naming the value and the accepted ones for an unknown value, and rewrite the comment about engines to state the policy. Verify with `npx playwright test --list` for each run: `default` lists no test in Firefox or WebKit yet, `full` lists 1560, and `E2E_RUN=other` fails with the error.
- [x] 4.2 Add the `test:e2e:samples` (`E2E_RUN=samples playwright test`) and `test:e2e:full` (`E2E_RUN=full playwright test`) scripts to `package.json`, and keep `test:e2e` as `playwright test`. Verify that `npm run test:e2e:full -- --list` lists 1560 tests.
- [x] 4.3 Tag the top-level describe blocks of `e2e/sample_book_list.spec.ts` and `e2e/sample_flashcards.spec.ts` with `@sample`. Verify that `npm run test:e2e:samples -- --list` lists exactly their 59 tests in each engine, and the default `--list` lists none of them.
- [x] 4.4 Tag `@frames` as listed in design.md decision 5: whole files on their top-level describe blocks, and the describe blocks or tests named for the mixed files. Verify with `--list` that the default run's Firefox and WebKit projects list exactly the tagged tests, and that no test title contains `@` apart from tags (`grep -n 'test("[^"]*@' e2e/*.spec.ts` finds nothing).
- [x] 4.5 Run `npm run test:e2e` and `npm run test:e2e:samples`. Verify that both pass.

## 5. Stage bar tested on its own

- [x] 5.1 Move the 18 tests of `e2e/stage_bar.spec.ts` that open the book list sample to probe mods (design.md decision 7):
  - use `openProbe`, or `openTypedProbe` with a collection for the scenarios that need tiles
  - replace `MISSING_MOD_REFERENCE` with a `/test-mods/` folder that answers HTTP 404
  - check the mod's name and version instead of `Book List` and `1.1.0`
  - follow the reworded steps of `specs/stage-bar/spec.md`

  Verify that `grep -n "sample_mod" e2e/stage_bar.spec.ts` finds nothing and that `npx playwright test e2e/stage_bar.spec.ts` passes with `E2E_RUN=full`.
- [x] 5.2 Remove the 30 e2e tests in design.md decision 7's table. For each, first read the covering test and check that it asserts every THEN and AND of the scenario. Add a missing assertion to the covering test before removing the e2e test. Keep the e2e test, with a note in the task, when jsdom or Node cannot observe it. Verify that `npm run test` and `npx playwright test e2e/stage_bar.spec.ts e2e/mod_stage.spec.ts` pass with `E2E_RUN=full`.
- [x] 5.3 Check that every stage-bar scenario still has a test named after it, in `e2e/stage_bar.spec.ts` or in a unit test. Verify by listing the scenario names of `openspec/specs/stage-bar/spec.md` and finding each one among the test titles.
  - Note: "Dismiss one", "Clear all" and "New message on top" lost their named test with the removed e2e tests, so the covering StageView tests were renamed after them. Seven scenarios had no test named after them in `e2e/stage_bar.spec.ts` or a unit test before this change, and are left for the follow-up duplicate audit: "App errors stay", "Blocked request while the mod runs", "Cancelled API question", "Message from the app" and "Message from the mod" (both in the e2e test "Message from the app and from the mod"), "Issues stay with their sandbox" (`e2e/mod_stage.spec.ts`) and "Missing range found first" (`e2e/mod_api_version.spec.ts`).
- [x] 5.4 Stress the touched tests: `E2E_RUN=full npx playwright test e2e/stage_bar.spec.ts --repeat-each=5`, with the default workers. Verify that every run passes.

## 6. Release checks and task rules

- [x] 6.1 Add `release:check` to `package.json` (`npm run build && npm run test && npm run lint && npm run format:check && npm run test:e2e:full`) and make `version` run it first (`npm run release:check && changeset version && npm install --package-lock-only`). Verify that `npm run release:check` passes. Also verify that when a test fails, `npm run version` stops before `changeset version`: temporarily break a unit test, run it, check that `git status` shows no version or changelog change, then restore the test.
- [x] 6.2 In `docs/releasing.md`, add a "Release checks" section that says what `release:check` runs and that `npm run version` runs it first. Mention it in "Apply the changesets", and describe the three e2e runs. Verify with `npm run format:check`, and verify that the doc's commands match the `package.json` scripts.
- [x] 6.3 In `openspec/config.yaml`, change the changeset rule's "End tasks.md with a task that adds" to "Before the final verification task, add a task that adds". Add the verification task rule of design.md decision 9. Verify that `openspec instructions tasks --change streamline-test-suite --json` returns both rules.

## 7. Verification

- [x] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e`, `npm run test:e2e:samples` and `npm run test:e2e:full`, and verify that all pass. Run the default run with `PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/streamline-after.json npx playwright test --reporter=json,line`. Report its runs, wall time and test time per engine next to task 1.1's baseline, and verify that its test time is at most 60% of the baseline's. Verify that `git status` shows only the files in the proposal's Impact section plus this change's folder.

## 8. Changeset

- [x] 8.1 Add `.changeset/streamline-test-suite.md` with a `patch` bump for `opentesela` and the summary "Faster, steadier test suite; no change to the app.", following the "Bump rule" section of `docs/releasing.md`. Verify with `npx changeset status` (it lists the patch) and `npm run format:check`.
