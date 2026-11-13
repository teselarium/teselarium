# Design

## Context

Baseline, measured on 2026-11-12 with a full `npm run test:e2e` on a 24-core machine with Playwright's default 12 workers:

| | Runs | Wall time | Test time | Chromium | Firefox | WebKit |
|---|---|---|---|---|---|---|
| e2e | 1560 (520 × 3) | 199 s | 2136 s | 421 s | 871 s | 844 s |
| unit (Vitest) | 99 files | 8 s | | | | |

- The app's three builds take about 11 s before the first test, so the build is not worth optimizing.
- No test is a large outlier: only 8 runs take more than 6 s. The cost is the number of tests times three engines.
- `playwright.config.ts` runs every test in all three engines, because mods rely on frame behavior that differs between engines. It has no tags and no run selection.
- There is no CI and no git hook. Tests run by hand, or in the last task of an OpenSpec change. That task is a habit of the archived changes, not a rule: `openspec/config.yaml` only requires the changeset task. `docs/releasing.md` runs no tests.
- `e2e/stage_bar.spec.ts` has 49 tests:
  - 18 of them open the shipped book list sample through `SAMPLE_RUN_HASH`, `SAMPLE_COLLECTION_RUN_HASH` and `MISSING_MOD_REFERENCE` from `e2e/sample_mod.ts`
  - the others already use test-owned probe mods (`openProbe`, `openTypedProbe`, `buildProbeFiles` from `e2e/mod_routes.ts`)
  - 29 of its tests repeat a scenario that a jsdom or Node test already covers
- The unit tests already have their own fixtures (`src/test/fixtures/`). `src/lib/mod/sample_mod.test.ts` is the static check of the shipped samples.

## Goals / Non-Goals

**Goals:**

- The default e2e run costs about half of today's test time, and gives the same confidence for the frame behavior that differs between engines.
- The theater mode tooltip test passes under load for the right reason, without retries.
- The stage bar's tests depend on no shipped sample, and test each scenario once.
- Running every test in every engine stays one command, and a release cannot skip it.

**Non-Goals:**

- Moving the other 16 e2e spec files off the shipped sample, rewording their scenarios, the lint rule that guards it and the remaining duplicate audit. These are the follow-up change.
- Changing the number of workers, the timeouts or the retries.
- Changing the app or its mods.
- Running fewer unit tests: the whole unit suite takes 8 s.

## Decisions

### 1. The convention is project-independent

The "Tests" section of `docs/code_conventions.md` holds these five rules, word for word:

```markdown
## Tests

- Test each behavior once, at the lowest level that can prove it. Go up a
  level only for what the lower one cannot observe.
- A module's tests protect that module and use their own fixtures. They never
  depend on examples, demos or other modules' fixtures.
- Test effort follows importance: critical modules are tested thoroughly,
  examples and optional parts lightly.
- The default run covers what every change can break. Tests of optional or
  isolated parts run when those parts change, and in a full run before a
  release.
- Run expensive variants (environments, platforms, configurations) only for
  tests whose result depends on them.
```

This project's way of applying the rules (tags, runs, probe mods) lives in this design, `playwright.config.ts` and `docs/releasing.md`, not in the convention.

- Alternative: project-specific rules naming Playwright and the tags. These are more precise, but they go stale with the tools. They were rejected for a general convention.
- Alternative: a rule against fixed-time waits and retries. Rejected: the tooltip flake is a specific case, and the convention keeps only the general patterns.

### 2. The tooltip flake is fixed in the test, not in the app

**Cause** (from `@radix-ui/react-tooltip`, confirmed with event logs in all three engines):

```
 click(): Playwright moves onto the button, presses and releases
   |  the move schedules the tooltip's opening in a setTimeout(0).
   |  Chromium's click usually lands first: the tooltip never opens,
   |  and the rest of this race does not happen.
   |  Firefox and WebKit usually open it first (8/8 and 6/8 runs).
   v
 the click closes the open tooltip, but its content stays mounted
   |  ~150 ms for the exit animation (shadcn's animate-out)
   v
 mouse.move(0, 0)
   |  pointerleave while the content is mounted: the hoverable content
   |  makes a grace area and sets the provider's isPointerInTransitRef
   |  (one flag for every tooltip)
   v
 hover(): Playwright sends one pointermove
   |  1. the trigger's onPointerMove sees the flag set and does not open
   |  2. the grace area's document listener, or the content unmounting,
   |     clears the flag
   v
 no more pointermoves, so the tooltip never opens
```

The old test still passes most of the time, for the wrong reason: `getByRole("tooltip")` also matches the closing content, which says "Theater mode" until it unmounts. The test fails only when the re-hover lands in the last milliseconds of the exit animation and the content unmounts before the assertion's first check. Load moves the re-hover into that window, which explains why the failure depends on CPU load.

A user's mouse sends many pointermoves, so the next one opens the tooltip. Users don't hit this; only Playwright's single move does.

**A second race.** The test does not wait for the mod to run. When the mod starts after the click, the Fullscreen button appears after the theater mode button, and the right-aligned group shifts the theater mode button out from under the pointer. Firefox then closes the tooltip, and Chromium can show the Fullscreen tooltip instead. Moving the test to `openProbe` (decision 7), which waits for the probe's mount, removes this race.

**Fix:** after the click, the test waits until the tooltip is gone (`toHaveCount(0)`) before it moves the pointer away and back. Once the content is unmounted, leaving the button makes no grace area, and the hover opens the tooltip. The assertion can then only match a tooltip that opened again, so the test checks what the requirement asks for: the tooltip says "Theater mode" while the button is pressed. The wait costs about 3 ms in Chromium, where the tooltip was not open, and 170 to 190 ms in Firefox and WebKit, the exit animation.

**Before the fix, the cause is confirmed deterministically.** A throwaway spec, deleted afterwards, stretches the tooltip's exit animation to 2 s with a style tag (`[data-slot="tooltip-content"] { animation-duration: 2s !important }`), and asserts an open tooltip (`[data-slot="tooltip-content"]:not([data-state="closed"])`), so the closing content cannot satisfy it. The old steps must fail on every run where the tooltip was open at the click: every Firefox run and most WebKit runs. The fixed steps must pass on every run in all three engines. If the old steps pass with the tooltip open at the click, the cause is something else, and the fix is reconsidered before going on.

- Alternative: `disableHoverableContent` on the stage bar's tooltips. This removes the grace area, but users could no longer move the pointer onto the tooltip without it closing (WCAG 1.4.13). It also changes vendored-component behavior to work around a test. Rejected.
- Alternative: retry the gesture with `toPass`. This hides the race instead of removing it. Rejected.
- Alternative: a second pointer move after the hover, as a real mouse sends. The first move is still ignored, and the test passes for a reason it does not state. Rejected.
- Alternative: assert the open state (`data-state`) in the stage bar test. After the fix, only a reopened tooltip can match, and the test would depend on a Radix-internal attribute. Rejected.
- Alternative: wait for `data-ot-layout="theater"`. The race does not involve the layout. Rejected.

### 3. Two tags, named by what a test is

| Tag | Meaning |
|---|---|
| `@frames` | The test's result depends on how the engine treats frames: sandbox attributes and content policy, messages between the app and a frame, focus or pointer crossing into a frame, a frame's size and layout, fullscreen of a frame, rendering inside a frame (fonts, MathML, diagrams), or a frame's state across history. |
| `@sample` | The test is a shipped sample's own test. |

- Tags go on top-level `test.describe` blocks with `{ tag: … }`, so every test inside gets them. A single test gets its own tag only when its describe block is mixed.
- An untagged test needs a real browser but is not engine-specific.
- Tags name what a test is, and `playwright.config.ts` maps each tag to engines. A future change of the engines then edits the config, not dozens of tests.
- Alternative: engine-named tags like `@all-engines`. Rejected, because a change of policy would mean retagging tests.
- Alternative: a third tier, such as app-shell tests in Chromium and Firefox. Rejected: there is no reason for it that untagged UI doesn't share, and it adds a tag.

Playwright's `grep` matches the file path, the describe titles, the test title and the tags. Titles never contain `@`, so a tag cannot match a title by accident.

### 4. Three runs, chosen by `E2E_RUN`

`playwright.config.ts` reads `E2E_RUN` (unset means `default`) and builds each project's filters:

| Project | `default` | `samples` | `full` |
|---|---|---|---|
| chromium | everything but `@sample` | `@sample` | everything |
| firefox | `@frames` but `@sample` | `@sample` | everything |
| webkit | `@frames` but `@sample` | `@sample` | everything |

- Any other value of `E2E_RUN` throws an error that names the value and the three accepted ones.
- `package.json` gets these scripts:
  - `test:e2e`: `playwright test`
  - `test:e2e:samples`: `E2E_RUN=samples playwright test`
  - `test:e2e:full`: `E2E_RUN=full playwright test`
- A bare `npx playwright test` is the default run. The config's comment about engines is rewritten to state the policy.
- The samples run uses all three engines because samples are mods running in frames, and the run is rare.
- Alternative: filters on the command line (`--grep @sample`). Rejected: Playwright applies the command line's grep together with the project's, so the default `grepInvert: /@sample/` would make a samples run empty.
- Alternative: one project per run and engine (9 projects), selected with `--project`. Rejected: a bare `playwright test` would then run every project, which repeats the full run three times over.
- `VAR=value command` in npm scripts needs a POSIX shell. That holds in the dev container and on Linux and macOS, and the project has no Windows setup.

### 5. Initial `@frames` classification

The whole file is tagged when its subject is frame behavior:

- `mod_sandbox`, `mod_engine_api`, `mod_libraries`, `mod_tests`, `mod_check`, `mod_theme`, `stage_layout`
- `mod_app_actions`, `media_players`, `tile_bodies`, `tile_body_diagrams`, `tile_body_extras`
- `default_mods`: the app's own shipped UI, running in frames

In mixed files, only these describe blocks or tests are tagged. Everything else in them stays untagged:

| File | `@frames` |
|---|---|
| `stage_bar` | "Popovers and menus close on a click outside" (all of it); "New messages draw attention" › "Blocked request flashes"; "Messages from the mod in the stage bar" › "Hidden mod notifies" |
| `app_theme` | "The visible frame fills the stage area" |
| `mod_stage` | "Several sandboxes, at most one visible"; "Back and forward keep the sandbox state" |
| `site_consent` | "Allow grants the checked lines"; "Show without them refuses the listed lines" |

`app_pages`, `app_settings`, `app_sidebar`, `mod_api_version` and `app.spec.ts` stay untagged.

From the baseline, with the file-level tags alone, the default run costs about 1230 s of test time (-42%), and about 115 s of wall time. The stage bar's removed tests lower that further. The measured numbers are recorded at the end of the change.

### 6. The shipped samples leave the default run

- The top-level describe blocks of `sample_book_list.spec.ts` and `sample_flashcards.spec.ts` get `@sample`.
- The static check `src/lib/mod/sample_mod.test.ts` stays in the unit suite, which always runs everything. It is the cheap guard that a change of the mod file format or of the tile types breaks a sample visibly.
- The 16 other e2e files still use the book list sample until the follow-up change, so the default run keeps exercising it in the meantime.

### 7. The stage bar is tested on its own

**Off the sample.** The 18 tests that open the book list:
- open a probe mod instead (`openProbe`), or a typed probe mod with a collection (`openTypedProbe`) for the scenarios that need tiles
- replace `MISSING_MOD_REFERENCE` with a mod folder under `/test-mods/` that answers HTTP 404
- check the mod's name and version instead of `Book List` and `1.1.0`

After the change, `e2e/stage_bar.spec.ts` imports nothing from `e2e/sample_mod.ts`.

**Scenarios.** The delta of `stage-bar` rewords the steps that named the sample, its collection or `./samples/mods/missing` (see `specs/stage-bar/spec.md`). Scenario names stay the same: OpenSpec reads a renamed scenario in a modified requirement as a dropped one. So no test is renamed.

**One test per scenario.** A stage bar scenario keeps its e2e test only when jsdom cannot observe it: geometry, real Tab order, real pointer and tooltip, clipboard, content policy, frames, or reduced motion. These e2e tests are removed, because the listed test already covers the scenario:

| e2e test removed | Covered by |
|---|---|
| Plain text; Mod titled like the app; Reloaded issue on top; Warnings stay | `MessagePopover.test.tsx` |
| Items read on the last opening are plain; Unread items stand out; Message arriving while the popover is open; New message on top | `MessagePopover.test.tsx`, `StageView.test.tsx` |
| Read after opening, filled again on a new message; Dismiss one, then clear all | `StageView.test.tsx` ("Read after opening", "dismisses a notification and clears them all"), `MessageButton.test.tsx` |
| Many warnings | `MessageButton.test.tsx` ("Many errors"), `stage_messages.test.ts` |
| Mod sends too many; Notifications drop no error or warning | `stage_messages.test.ts`, `stage_sandboxes.test.ts` |
| Turn theater mode off; Shown for a failed sandbox; Failed sandbox; Waiting for an answer; No collection (one-row bar) | `StageView.test.tsx` |
| Missing mod file; Missing collection | `StageView.test.tsx`, `stage_sandboxes.test.ts` |
| Sample mod with its collection (information popover); Mod that did not load | `ModInfoPopover.test.tsx` |
| Copy refused; Keyboard (Share menu) | `ShareMenu.test.tsx` |
| Sample collection; No collection (loaded collection); Default source; Allowed and remembered | `stage_sandboxes.test.ts` |
| `mod_stage.spec.ts` › Sample mod has no issues | `StageView.test.tsx` |

That removes 30 e2e tests: 29 from `stage_bar.spec.ts` and 1 from `mod_stage.spec.ts`. These e2e tests stay, each for what only a real browser shows:

- One-row bar: "Sample mod with its collection", "Close button last", "Home mod without a close button" (layout)
- "Turn theater mode on" and "Running mod" (tooltip on hover)
- "Count grows", "Capsule clear of the close button", "Marks do not move items" (geometry)
- "Keyboard reaches an empty level" (Tab order)
- "Message from the app and from the mod" and "Errors popover" (a real mod and collection feeding the bar)
- "Blocked request flashes" (content policy) and "Reduced motion" (emulated media)
- "Reload done, then reload failed" (the button through the network)
- "Hidden mod notifies" and the click-outside tests (frames)
- "Escape" (the native dialog)
- "Copy the link" (real clipboard)

**Safeguard.** Before an e2e test is removed, the covering test is read, and it must assert every THEN and AND of the scenario. A missing assertion is added to the covering test first. If jsdom or Node cannot observe it, the e2e test stays and the task notes why.

### 8. Releases run the full checks

- `package.json` gets `release:check`: `npm run build && npm run test && npm run lint && npm run format:check && npm run test:e2e:full`.
- `version` becomes `npm run release:check && changeset version && npm install --package-lock-only`.
- A failure stops the release before any file changes.
- `docs/releasing.md` gets a section on the checks, and "Apply the changesets" says that `npm run version` runs them first.
- Alternative: only a step in `releasing.md`. Rejected: nothing would enforce it, and the full run is the only place where Firefox and WebKit check untagged UI.

### 9. OpenSpec task rules make the runs part of every change

`openspec/config.yaml`'s `rules.tasks` becomes:

- The changeset rule says "Before the final verification task, add a task that adds…" instead of "End tasks.md with…".
- A new rule: "End tasks.md with a verification task: on a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. When the change touches `public/samples/` or the specs of the mod API (`mod-engine-api`, `mod-loading`'s mod file format, `mod-api-version`, `mod-theme`'s mount context and events, `mod-app-actions`), it also runs `npm run test:e2e:samples`."

The mod API list is the same one the proposal rule uses, so the two rules agree.

This change's own tasks.md follows the rules as they are today: it ends with the changeset task, and the format check runs there.

## Risks / Trade-offs

- [An engine-specific bug in untagged UI shows up only in Firefox or WebKit] → `release:check` runs every test in every engine before a release. A tag added after such a bug pulls the test into the default run.
- [A frame-dependent test is left untagged] → The `@frames` rule in decision 3 is the test of record. The full run catches what the default run misses.
- [Removing an e2e test loses an assertion] → The safeguard of decision 7. Each removal names its covering test.
- [The samples can break through an API change without anyone running `test:e2e:samples`] → The new task rule adds the samples run to such changes, the static sample check always runs, and the full run covers them before a release.
- [Stage-bar scenario names still say "Sample"] → OpenSpec cannot rename a scenario in a modified requirement. The steps no longer name the sample. A later change can replace the requirement if the names matter.
- [`E2E_RUN=…` needs a POSIX shell] → The project is developed in a Linux dev container.
- [The release stops on a flaky test] → Rerun, or fix the flake. That is the intended trade.

## Migration Plan

- No data or user-facing migration.
- After the change, `npm run test:e2e` is the faster default run. `npm run test:e2e:full` gives today's behavior.
- Rollback is reverting the change's commit.
