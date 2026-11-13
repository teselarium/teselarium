# Design

## Context

This change builds on `streamline-test-suite`, which must be applied first. That change gives this one:
- the "Tests" convention in `docs/code_conventions.md`
- the `@sample` and `@frames` tags, and the default, samples and full runs
- a stage bar that is already tested on its own, with the probe helpers it uses (`openProbe`, and `openTypedProbe` with a collection), both local to `stage_bar.spec.ts`
- five `stage-bar` scenarios with no test named after them, left to this change's duplicate audit (its task 5.3)

Where the coupling is today:

- **Imports.** `e2e/sample_mod.ts` holds the shipped samples' paths, run links and code (`SAMPLE_RUN_HASH`, `SAMPLE_COLLECTION_RUN_HASH`, `MISSING_MOD_REFERENCE`, `SAMPLE_ENTRYPOINT_CODE` and others). 16 spec files outside the sample specs import it. So does the shared helper `e2e/mod_routes.ts`, for:
  - `exposeSampleEngine`, which patches the sample's `main.js` to expose its engine
  - `serveColumnsReportingSample`
  - helpers built on `SAMPLE_TYPE_PATH` and `SAMPLE_COLLECTION_PATH`
- **Local helpers.** Three files define their own `openSample`: `app_sidebar`, `app_theme` and `stage_layout`.
- **Missing mod.** `MISSING_MOD_REFERENCE` is `./samples/mods/missing`, a path inside the samples folder.
- **Unit tests are already isolated.** They read `src/test/fixtures/`. Only `src/lib/mod/sample_mod.test.ts`, the samples' own check, reads `public/samples/`. `mod_check_report.test.ts` uses a sample address only as a string value and reads nothing.

Four kinds of sample mentions in the specs, which decide what this change touches:

| Kind | Example | This change |
|---|---|---|
| A. A requirement about a sample | `mod-stage` › "Sample book list mod" | moves to `sample-book-list` |
| B. App behavior that involves the shipped samples | `default-mods` › the vanilla explorer lists the samples | stays; its tests become `@sample` |
| C. A scenario whose e2e test opens a sample | `stage-layout` › "Default layout" | reworded; its test uses a test-owned mod |
| D. Unit scenarios where "sample" names test fixtures | `collection-validation` › "Validate the sample collection" (`fixtures/tiles/books_collection.yaml`) | unchanged |

D also covers the mod file's `sample_collection` key, a product term, and the default mods' own cases, which use `default_mods/*/fixtures/`.

## Goals / Non-Goals

**Goals:**

- No test of the engine, the stage, the default mods or the app needs the shipped samples. Removing `public/samples/` breaks only the `@sample` tests.
- The lint stops the coupling from coming back.
- Each scenario has one test, at the lowest level that can prove it.

**Non-Goals:**

- Renaming the D wording or the unit fixtures (`src/test/fixtures/mods/book_list`).
- Changing the samples, the default mods, the app or the mod API.
- Renaming scenarios. OpenSpec keeps a modified requirement's scenario names, so the C scenarios and their tests keep theirs, including the ones that say "Sample".
- Moving the sample flashcards' tests: they are already in `sample_flashcards.spec.ts`.

## Decisions

### 1. Three test-owned mods, chosen by what a scenario needs

| Mod | Holds | Used for |
|---|---|---|
| probe (exists, `buildProbeFiles`) | a mod file and a `main.js` that stores `{ engine, context }` on `globalThis.probe` | a running mod, a frame, the layout, the stage, requests sent as the mod |
| typed probe (exists in `stage_bar.spec.ts`) | the probe, plus a `note` tile type and two notes; each test writes its `collection.yaml` (`buildCollection`) | tiles of the mod's type, a collection, reloading the tiles |
| tiles mod (new) | a mod file with a tile type, a sample collection of three tiles, a `show` permission for `COVER_HOST`, a config key and `test_path`; a `main.js` that lists each tile as an `<li>` with its title and image, reads and writes one storage key, and also stores `globalThis.probe`; a test file of two passing cases | the mod viewer and the checker, the mod test API, declared permissions and covers, storage |

- **Files.** The tiles mod is real files in `e2e/test_mods/tiles/`. A route serves them at `/test-mods/tiles/` on the preview origin, so the mod is on the app's origin.
- **Shared helpers.** A new `e2e/test_mods.ts` holds the shared helpers:
  - its path, run links and reference constants
  - `serveTilesMod`
  - `openProbe` and `openTypedProbe`, with the typed probe's builders, lifted from `stage_bar.spec.ts`
  - `MISSING_TEST_MOD_REFERENCE` (`./test-mods/missing`, answered with HTTP 404)
- **`mod_routes.ts`.** It stops importing `sample_mod.ts`:
  - `exposeSampleEngine` and `serveColumnsReportingSample` give way to the tiles mod, which exposes its engine itself
  - the helpers on `SAMPLE_TYPE_PATH` and `SAMPLE_COLLECTION_PATH` use the typed probe's or the tiles mod's files
- **Local helpers.** The three local `openSample` helpers become `openProbe` or `openTypedProbe`.

Alternatives considered:
- Build the tiles mod in code like the probe. Rejected: a mod with eight files, a test file and a list renderer reads better as files.
- Serve `src/test/fixtures/mods/book_list` to e2e. Rejected: it shares one suite's fixtures with another, and it is a copy of the sample, so it would keep the sample's shape in the core's tests.
- Keep patching the sample's `main.js` (`exposeSampleEngine`). Rejected: it ties a helper to one line of the sample's code.

### 2. Scenario rewording

The deltas reword only kind C. Each reworded step names the property the test needs, such as "a mod whose sample collection has three tiles of its type", and not a concrete mod. Where a reworded scenario also has a unit test with the same name, the wording still holds for that test's fixture. The concrete values that the tests own stay (`./test-mods/two_books.yaml`, `https://upload.wikimedia.org`).

The deltas copy each requirement from the main spec, and only the listed lines differ.

### 3. Requirements about the sample move to `sample-book-list`

| From | To |
|---|---|
| `mod-stage` › "Sample book list mod" (removed) | `sample-book-list` › "Mod file" › "Books with covers" |
| `mod-tests` › "Sample mod tests" (removed) | `sample-book-list` › "Mod tests" › "Sample tests" |
| `mod-theme` › "Sample and default mods take the theme's look" (removed) | "Default mods take the theme's look" (added, keeps "Dark default mods"); `sample-book-list` › "Theme look" (keeps "Dark sample mod" and "Sample mod's own styles") |
| `mod-api-version` › "Sample and default mods declare the API range" (removed) | "Default mods declare the API range" (added, "Default mods match"); `sample-book-list` › "Mod file" (`api: "^0.1.5"`, "Sample matches the app's API") |

- **Dropped duplicates.** Two scenarios repeat ones `sample-book-list` already has, so they are dropped rather than moved:
  - "Selection is remembered" = "Remembered books per row" › "Choice kept across starts"
  - "Raised book uses the theme's shadow" = "Raised book" › "Raised on hover"
- **Why remove and add.** The mixed requirements are removed and new ones added, instead of modified. OpenSpec refuses a MODIFIED requirement that drops scenarios.

The tests follow the requirements:
- "Books with covers", "Sample tests", "Dark sample mod" and "Sample mod's own styles" move to `e2e/sample_book_list.spec.ts`, under `@sample`. If "Sample mod's own styles" has no test named after it, the test that checks it is renamed.
- "Sample matches the app's API" is added there, with the sample's part of `mod_api_version` › "Shipped mods match".
- "Shipped mods match" becomes "Default mods match", for the explorer and the viewer only.
- The two dropped duplicates' e2e tests are removed.
- `mod_check` › "Shipped mods pass" (a test with no scenario) drops the sample from its list. The sample's check is "Sample tests".

The mod API version bump is none. No method, event, context key, mod file key or permission changes, and what a mod can observe is the same.

### 4. Kind B tests stay where they are, tagged `@sample`

- These tests describe how the app ships the samples, so they need the shipped samples:
  - the vanilla explorer's list (its titles and descriptions)
  - selecting the flashcards sample in it
- They stay in `e2e/default_mods.spec.ts`, get `@sample`, and name the samples by literal reference, not through `sample_mod.ts`.
- "Select a mod" is kind C. Its test serves the explorer's mod file with a `config.mods` that lists the tiles mod, through a route on the default mods' address.
- If the default mods' files cannot be routed that way, "Select a mod" stays on the vanilla list as a B test, and the task says why.

### 5. The lint guards the imports

`.oxlintrc.json` gets two overrides:
- For `e2e/**`: `no-restricted-imports` on `./sample_mod.ts`, with the message "Only the shipped samples' own tests use e2e/sample_mod.ts (docs/code_conventions.md, Tests)."
- For `e2e/sample_*.spec.ts`: the rule off again. The later override wins.

This follows the existing `no-restricted-imports` overrides for `src/vendor/**` and `default_mods/*`.

The lint cannot see a literal `samples/mods` address. That case is covered by a check in the tasks: `grep -rn "samples/mods" e2e`, outside the sample specs, finds only `@sample` tests.

- Alternative: a lint rule on the string. Rejected: oxlint has no rule for string contents short of `no-restricted-syntax` on every literal, which is noisy for a case the grep covers.

### 6. Duplicate audit: one test per scenario

The rule and the check before each removal are the ones `streamline-test-suite` used for the stage bar:
- A scenario keeps its e2e test only when jsdom or Node cannot observe it: frames, the sandbox and the content policy, layout and geometry, real focus and pointer, navigation and history, storage across reloads, fullscreen, clipboard or native dialogs.
- Before an e2e test is removed, its covering unit test must assert every THEN and AND of the scenario. A missing assertion is added to the unit test first. If it cannot be observed there, the e2e test stays, and the task notes why.

The 172 overlapping titles, per file:

| File | Overlaps / tests | File | Overlaps / tests |
|---|---|---|---|
| app_sidebar | 28 / 37 | mod_api_version | 7 / 11 |
| mod_sandbox | 25 / 55 | stage_layout | 5 / 24 |
| mod_stage | 24 / 31 | mod_engine_api | 4 / 12 |
| app_settings | 14 / 24 | tile_body_extras | 4 / 7 |
| app_pages | 12 / 22 | app_theme, media_players, mod_app_actions, mod_libraries | 3 each |
| mod_tests | 12 / 24 | default_mods, mod_theme | 2 each |
| mod_check | 10 / 12 | tile_bodies, tile_body_diagrams | 1 each |
| site_consent | 9 / 14 | | |

The audit is expected to keep most overlaps in the files tagged `@frames` (`mod_sandbox`, `mod_check`, `mod_tests`), where the e2e test checks the real frame and the unit test checks the logic. It is expected to remove most of them in the app-shell files (`app_sidebar`, `app_settings`, `app_pages`). A few titles are generic ("Escape", "Cancel", "Index page"), and the same title can mean different scenarios: the audit compares scenarios, not titles.

`streamline-test-suite` left five `stage-bar` scenarios with no test named after them: "App errors stay", "Blocked request while the mod runs", "Cancelled API question", "Message from the app" and "Message from the mod". The last two share the e2e test "Message from the app and from the mod". Each gets a test named after it, at the lowest level that can prove it, by the same rule: a unit test is named after it, or the shared e2e test is split. The `stage-bar` spec does not change.

## Risks / Trade-offs

- [Test-owned mods drift from what real mods do] → They use only the mod API, as any mod does. The samples run still exercises the real samples end to end, and the full run before a release includes it.
- [A rewording changes what a scenario means] → Each delta copies its requirement from the main spec and changes only the listed lines. The review compares each changed line with the original.
- [The audit removes coverage] → Each removal names its covering test and passes the check before it is removed.
- [The lint misses a literal address] → The grep check in the tasks, and the B tests are tagged.
- [The change is large: about 100 tests move, 172 overlaps are judged] → The tasks go file by file, and each file's group ends green.

## Migration Plan

- No data or user-facing migration.
- The tasks keep the suite passing after each group, so the change can stop between groups.
- Rollback is reverting the change's commit.
