# Tasks

## 1. Collection references name folders

- [x] 1.1 Add `resolveCollectionReference` to `src/lib/tile/`, used first by `loadTileCollection` and `readCollectionIndex`, through a shared `resolveFileReference` in `src/lib/files/`, which `resolveModReference` also uses:
  - a path ending in `.yaml` or `.yml` is the file;
  - any other path is a folder: `/` added, query and fragment dropped, `collection.yaml` in it.

  Verify with unit tests for the "Resolve the collection location" scenarios (folder, trailing slash with a query, index of a folder), and check that the existing collection tests still pass.
- [x] 1.2 Document the folder rule in `docs/modules/lib/tile/README.md` (collection loader and index reader), and in the run link section of `docs/modules/lib/core/stage/README.md` (`collection` may name a folder). Verify that each example address in the docs resolves as the unit tests of 1.1 do.

## 2. Mosaic library

- [x] 2.1 Export the `show` host checks of `src/lib/mod/mod_permissions.ts` (origin or wildcard host) from `src/lib/mod/index.ts`, with no change to mod file loading. Verify that the existing mod permission tests pass unchanged.
- [x] 2.2 Create `src/lib/mosaic/` with its public entry `index.ts`:
  - `resolveMosaicReference`: file, or folder with `mosaic.yaml`;
  - `loadMosaicFile`: fetch, plain YAML, the `mosaic` mapping with `title`, `description`, `mod`, `collection`, `config`, `aliases` and `permissions` (`show` only); `mod` and `collection` resolved against the mosaic file, with a default mod name kept as one;
  - `MosaicFormatError`, carrying the source and naming the key;
  - the `LoadedMosaic` type, as plain data.

  Verify with unit tests for every "mosaic-loading" scenario, including the alias format errors and the refusal of `connect`, and that only the mosaic file is requested.
- [x] 2.3 Add `mergeMosaicConfig`, which deep-merges mappings and replaces lists, scalars and `null`, and `applyMosaicAliases`, which renames top-level keys in place, where the canonical field wins and the first listed name wins. Both are pure and change no input. Verify with unit tests for the "A mosaic's config overrides the mod's config" and "A mosaic's aliases rename tile fields" scenarios, including key order and unchanged inputs.
- [x] 2.4 Write `docs/modules/lib/mosaic/README.md` (format, references, merge and alias rules, module details, example), following the layout of `docs/modules/lib/mod/README.md`. Rewrite the Mosaic sections of `docs/opentesela_spec.md` (glossary, architecture diagram, format example), dropping the mod `version` range and `tile_collection`. Verify that the documented YAML examples load in a unit test of 2.2.

## 3. Run links to mosaics

- [x] 3.1 In `src/lib/core/stage/run_links.ts`:
  - add the optional `mosaic` to `RunLink`;
  - read the reserved link names from one constant, `RUN_LINK_RESERVED_NAMES` (`mod`, `collection`, `tile`, `mosaic`), declared beside `RunLink` in `src/lib/core/engine/mod_launch.ts`;
  - make the route a run link when `mod` or `mosaic` is non-empty;
  - make `buildRunLink` write `mosaic` first.

  Verify with unit tests: `#/run?mosaic=x&from=y` parses with params `{ from: "y" }`, `#/run?mosaic=` is Home, and building then reading a mosaic link round-trips.
- [x] 3.2 Add a mosaic link conflict error beside `RunLinkConflictError`, raised before any request when a link has a `mosaic` with a `mod`, `collection` or `tile`, and shown by the sandbox. Verify with a unit test of the launch inputs and an e2e test in `e2e/mod_stage.spec.ts` for "A mosaic link has no mod, collection or tile" (no file requested, no frame).
- [x] 3.3 Document `#/run?mosaic=…` in `docs/modules/lib/core/stage/README.md` (routes, run links, examples table, conflicts). Verify against the tests of 3.1 and 3.2.

## 4. Launching a mosaic

- [x] 4.1 In `src/lib/core/engine/mod_launch.ts`:
  - make `loadModLaunchInputs` load the mosaic file first when `link.mosaic` is set, then continue with its `mod` and `collection`;
  - add `mosaic` to `ModLaunchInputs`;
  - report mosaic file failures as errors whose source is the mosaic file.

  Verify with unit tests: a missing mosaic file and a mosaic without `title` request no mod file, and a switched-off mod named by a mosaic is refused before any request.
- [x] 4.2 When building the launch:
  - merge the config into `context.config`;
  - apply the aliases to the loaded tiles before building and running the validator;
  - add the mosaic file's origin to the content hosts;
  - add `mosaic: { source, title, description } | null` to the mount context.

  Verify with unit tests for the "Mount context" scenarios (`mosaic` null or filled), "Only the tiles given to mods are resolved" (validation after aliases), and the content host scenario of `mod-sandbox`.
- [x] 4.3 Make "Reload tiles" for a mosaic sandbox reload the collection, apply the stored aliases and validate again, without requesting the mosaic file. Verify with a unit test of the stage's reload, and an e2e test in `e2e/mod_stage.spec.ts` using a fixture mosaic with aliases under the e2e test mods, so the renamed tiles arrive in `tiles.changed`.
- [x] 4.4 Add e2e tests in `e2e/mod_engine_api.spec.ts` with fixture mosaics and collections of their own, not the samples:
  - a mosaic of a fixture mod receives the merged config and the aliased tiles;
  - a missing collection of a mosaic names the collection;
  - a mosaic of a mod for another API asks the API question.

  Verify that the tests pass in `npm run test:e2e`.
- [x] 4.5 Document the mosaic launch in `docs/modules/lib/core/engine/README.md` (mount context table, Tiles, Launch: `loadModLaunchInputs` with a mosaic). Verify that the docs match the context keys asserted in 4.2.

## 5. Mosaic methods and the mod API version

- [x] 5.1 Add `"mosaics"` to `OpenSubject` in `src/lib/core/permissions/mod_grants.ts`. Add `src/lib/core/engine/mosaics_methods.ts` with `MOSAICS_METHODS`:
  - `mosaics.inspect`: params check, `open` for the mosaic file's origin, `-32001` with the load error's message, and the result with `permissions` granted and denied as if opened without asking;
  - `mosaics.open`: params check with the reserved names, `open`, the visible-only rule, `replace`, and the home mod refusal, all through `onOpenLink`.

  Register the table in the session. Verify with unit tests for every `mosaics.*` scenario of the `mod-engine-api` delta, and the `site-consent` scenario "Inspect a foreign mosaic without decisions".
- [x] 5.2 Make `mods.open` refuse `params.mosaic` as reserved, using the constant of 3.1. Verify with the unit test for the "Mosaic is a reserved parameter" scenario.
- [x] 5.3 Set `MOD_API_VERSION` to `0.1.13`, add the surface guard's `0.1.13` entry (the methods `mosaics.inspect` and `mosaics.open`, the context key `mosaic` and its keys), and add the `0.1.13` version note to the engine README. Verify that `mod_api_surface.test.ts` and the `mod-api-version` scenarios pass.
- [x] 5.4 Declare `MosaicInspection`, the typed `mosaics.inspect` and `mosaics.open` requests and `context.mosaic` in `default_mods/mod_api.d.ts`, and extend `src/lib/core/engine/mod_api_types.test.ts` to check them against the engine's types. Verify with `tsc -b`.
- [x] 5.5 Document the methods in the engine README (methods table, an "Inspecting and opening mosaics" section with the `open` rule of design D8) and in `docs/mod_plugin_spec.md`. The guide replaces "Mods need a Mosaic… default mosaic" with what a mosaic is, and adds a section on opening a mosaic with `mosaics.inspect`, `mosaics.open` and `context.mosaic`. Add an e2e test in `e2e/mod_engine_api.spec.ts` where the visible probe opens a fixture mosaic with `mosaics.open` and the address becomes its run link. Verify that the test passes and that the documented requests match it.

## 6. Mosaic permissions and consent

- [x] 6.1 Add `grantMosaicPermissions` beside `grantModPermissions`, and give the launch the mosaic with its grants (`grantLaunchMosaic`):
  - a mosaic from the app's origin gets all its `show` lines;
  - a mosaic from another origin gets the lines allowed by remembered mosaic decisions;
  - the sandbox's grants list the mod's lines, then the mosaic's;
  - each refused mosaic line is reported with the host, the reason and the mosaic file.

  The content policy then gets the mosaic's granted hosts. Verify with unit tests for the "Grant a mosaic's show permissions", "Report a mosaic's refused lines" and "Mosaic grants last only for its sandbox" scenarios.
- [x] 6.2 Make `listConsentLines` return lines with a subject (`"mod"` or `"mosaic"`), and make the stage ask once for both. Make `SiteConsentDialog` draw one group per subject with its title and address, where Allow, Show without them, Escape and Remember act on every line. Verify with e2e tests in `e2e/site_consent.spec.ts` for the `site-consent` delta's scenarios, using a fixture mosaic served from another origin.
- [x] 6.3 Store mosaic decisions in `src/main/settings/site_decisions.ts` as `{ mosaic, title, category, host, allowed }`, where the validator accepts exactly one of `mod` or `mosaic` and lookups match the subject. Verify with unit tests: an existing stored mod decision still reads, a mosaic decision applies only to its mosaic file, and an entry with both keys is dropped.
- [x] 6.4 Make `describeBlockedRequest` in `src/lib/core/sandbox/sandbox_reports.ts` name the mosaic file as a second place for `show`-category blocks in a mosaic sandbox, and say "the mosaic declares it" for a refused host the mosaic declares. Verify with unit tests for the "Blocked show requests point to the mosaic file" scenarios, and check that the existing report tests are unchanged.
- [x] 6.5 Document mosaic grants in `docs/modules/lib/core/sandbox/README.md` (content hosts, a "Permissions of a mosaic" section), in `docs/modules/lib/core/permissions/README.md`, and in the site consent dialog paragraph of `docs/modules/main/README.md`. Verify that the documented dialog text matches the e2e assertions of 6.2.

## 7. Settings

- [x] 7.1 Make `SiteDecisionList` group decisions by subject and address, sort mosaic groups with the mod groups by title and then address, and label each mosaic group as a mosaic, with the same checkbox, counts and Remove all. Verify with e2e tests in `e2e/app_settings.spec.ts` for the "Remembered mosaic decisions in Settings" scenarios.
- [x] 7.2 Document mosaic decisions in `docs/modules/main/settings/README.md`. Verify that it describes the labels the tests of 7.1 assert.

## 8. Stage bar

- [x] 8.1 Show the mosaic's title before the mod's muted name in `StageBar`. Add "Loading mosaic…" and "Mosaic not loaded" before the mosaic file is loaded. List the mosaic file's address first in `ModInfoPopover`. Verify with e2e tests in `e2e/stage_bar.spec.ts` for the `stage-bar` delta's scenarios, including that the bar stays one row.
- [x] 8.2 Document the mosaic stage bar in `docs/modules/lib/core/stage/README.md` (or the stage bar section that describes the name and the information popover). Verify that it matches 8.1.

## 9. Overview docs

- [x] 9.1 Fill `docs/modules/mosaics/README.md` with what a mosaic is, its file, how it opens and its trust, linking to the lib, engine, stage and sandbox READMEs. Leave the explorer, viewer and maker stubs for `add-mosaic-explorer`. Update the Mosaics line of `docs/modules/README.md`. Verify that every link in the new text resolves to an existing file and heading.

## 10. Release note

- [x] 10.1 Add `.changeset/add-mosaics.md` with a `patch` bump, since the mod API patch bump means an app patch bump while both are `0.x`, and a one-line summary such as: "Mosaics: `#/run?mosaic=…` opens a mod with a collection, config overrides, field aliases and the media hosts its data needs, with new `mosaics.inspect` and `mosaics.open` requests for mods (mod API 0.1.13)." Verify that the file follows the format of the other `.changeset/*.md` files.

## 11. Verification

- [x] 11.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify that every command passes. This change modifies the mod API specs.

## Workflow follow-up

- Archive the change once it is reviewed and verified.
- Propose `rework-mod-file-format` next, then `add-mosaic-explorer`.
