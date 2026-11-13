# Proposal

## Why

The shipped samples are examples that could be removed, yet the tests of the engine, the stage, the default mods and the app use the book list sample as their default mod:
- 16 e2e spec files and the shared helper `e2e/mod_routes.ts` import from `e2e/sample_mod.ts`
- about 100 e2e tests outside the sample specs open the sample
- the specs of those modules describe the sample in their scenarios, and four requirements describe the samples themselves

A change to an example can break the core's tests, and the core's specs make claims about the examples. Nothing stops this from coming back. `streamline-test-suite` did this work for the stage bar only.

## What Changes

- The e2e tests of the engine, the stage, the default mods and the app use test-owned mods instead of the shipped samples:
  - the existing probe mods
  - a typed probe mod with a collection
  - a test-owned tiles mod with a type, a sample collection, a declared `show` host, a storage key and a test file
- The scenarios that name the shipped book list mod, its collection or `./samples/mods/missing` are reworded to name any mod with the needed property. The behavior they describe does not change.
- The four requirements about the samples move into `sample-book-list`, and their tests become `@sample` tests in `e2e/sample_book_list.spec.ts`:
  - "Sample book list mod" leaves `mod-stage`.
  - "Sample mod tests" leaves `mod-tests`.
  - "Sample and default mods take the theme's look" leaves `mod-theme`. "Default mods take the theme's look" keeps the default mods' part.
  - "Sample and default mods declare the API range" leaves `mod-api-version`. "Default mods declare the API range" keeps the default mods' part.
  - Two of their scenarios repeat ones `sample-book-list` already has, and are dropped.
- The tests of the vanilla explorer's list of the samples stay in `e2e/default_mods.spec.ts`, tagged `@sample`, because they test how the samples ship.
- An oxlint `no-restricted-imports` rule: only `e2e/sample_*.spec.ts` may import `e2e/sample_mod.ts`.
- The remaining tests that repeat a scenario at two levels (172 e2e titles also used by a unit test, in 20 spec files) are audited. Each scenario keeps one test, at the lowest level that can prove it.
- Five `stage-bar` scenarios that `streamline-test-suite` left without a test named after them get one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sample-book-list`: gains the sample's mod file, test and theme requirements that leave the core specs.
- `mod-stage`: scenarios no longer name the sample; "Sample book list mod" is removed.
- `mod-tests`: scenarios no longer name the sample; "Sample mod tests" is removed.
- `mod-theme`: "Sample and default mods take the theme's look" is replaced by "Default mods take the theme's look".
- `mod-api-version`: a scenario no longer names the sample; "Sample and default mods declare the API range" is replaced by "Default mods declare the API range".
- `mod-check`, `mod-engine-api`, `mod-sandbox`, `mod-libraries`, `mod-app-actions`, `stage-layout`, `default-mods`, `site-consent`, `app-pages`, `app-sidebar`, `theme`: scenarios no longer name the sample.

Scenario names stay the same: a modified requirement keeps its scenarios' names.

`mod-tests`, `mod-theme` and `mod-api-version` are specs of the mod API. The mod API version bump is **none**:
- No method, event, mount context key, mod file key or permission changes.
- The behavior a mod can observe is the same.
- The moved requirements describe what the shipped sample declares and how it looks, not what the API offers.
- The default mods keep their API range and look.

## Impact

- e2e:
  - the 16 spec files that use the sample: `app_pages`, `app_settings`, `app_sidebar`, `app_theme`, `default_mods`, `mod_api_version`, `mod_app_actions`, `mod_check`, `mod_engine_api`, `mod_libraries`, `mod_sandbox`, `mod_stage`, `mod_tests`, `mod_theme`, `site_consent` and `stage_layout`
  - `e2e/mod_routes.ts`, `e2e/sample_book_list.spec.ts`, and a new home for the test-owned mods
  - `e2e/stage_bar.spec.ts`, whose probe helpers move to that home
  - the files that the duplicate audit touches
- Unit tests named after reworded scenarios keep their names, and their assertions may get the ones a removed e2e test had.
- `.oxlintrc.json`
- The specs listed above, through their deltas.
- No change to the app, its mods or the mod API. A patch changeset says that the tests no longer depend on the shipped samples.
