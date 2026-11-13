# Proposal

## Why

The e2e suite runs every one of its 520 tests in Chromium, Firefox and WebKit: 1560 runs, about 200 s of wall time and 2136 s of test time on 12 workers. Firefox and WebKit take 80% of that time, also for app UI that does not depend on the engine. The load makes tests flaky: "Turn theater mode on" (`e2e/stage_bar.spec.ts`) fails under load because its re-hover races Radix's tooltip. The stage bar, a critical component, is tested twice for many scenarios, once in jsdom and once in e2e, and its e2e tests depend on the shipped book list sample, so a change to an example can break them. Nothing written says how tests should be organized, and no tests run before a release.

## What Changes

- A "Tests" section in `docs/code_conventions.md` with five project-independent rules: test each behavior once at the lowest level that can prove it, tests own their fixtures, test effort follows importance, the default run covers what every change can break, and expensive variants run only where they matter.
- The "Turn theater mode on" e2e test waits for the tooltip to be gone before hovering again, so the re-hover no longer races the tooltip's closing animation. The app does not change.
- Two e2e tags: `@frames` for tests whose result depends on how engines treat frames, and `@sample` for the shipped samples' own tests.
- Three e2e runs:
  - default (`npm run test:e2e`): every test except `@sample` in Chromium, with the `@frames` tests also in Firefox and WebKit
  - samples (`npm run test:e2e:samples`): the `@sample` tests in all three engines
  - full (`npm run test:e2e:full`): every test in all three engines
- The stage bar is tested on its own:
  - its e2e tests use test-owned probe mods instead of the shipped sample
  - its scenarios no longer name the sample
  - each scenario keeps one test, at the lowest level that proves it, which removes 30 e2e tests already covered by jsdom and Node tests
- Releases run the full checks first: a `release:check` script (build, unit tests, lint, format check, full e2e run), which `npm run version` runs before applying the changesets. `docs/releasing.md` explains it.
- `openspec/config.yaml` task rules:
  - tasks.md ends with a verification task that names the commands to run
  - changes that touch the samples or the mod API also run the samples run
  - the changeset task comes before that verification task
- Out of scope, for a follow-up change:
  - moving the other 16 e2e spec files off the shipped sample and rewording their scenarios
  - the lint rule that keeps non-sample specs from importing the sample's helpers
  - the duplicate audit of the remaining unit/e2e title overlaps

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stage-bar`: the scenarios that name the shipped book list sample or the samples folder are reworded to name any mod, any collection or a mod file that cannot be loaded. The behavior they describe does not change. Scenario names stay the same, because a modified requirement keeps its scenarios' names.

The change touches no spec of the mod API and needs no mod API version bump.

## Impact

- `docs/code_conventions.md`, `docs/releasing.md`, `openspec/config.yaml`
- `playwright.config.ts` (runs, tags, engine filters) and `package.json` scripts (`test:e2e`, `test:e2e:samples`, `test:e2e:full`, `release:check`, `version`)
- `e2e/*.spec.ts`: tags on the sample specs and the frame-dependent tests
- `e2e/stage_bar.spec.ts`: probe mods, the flaky test's fix, renamed and removed tests
- Unit tests named after renamed stage-bar scenarios: `src/main/stage/*.test.tsx`, `src/lib/core/stage/*.test.ts`
- `openspec/specs/stage-bar/spec.md` (through the delta)
- No change to the app or to the mod API. A patch changeset says that the test suite is faster and steadier.
