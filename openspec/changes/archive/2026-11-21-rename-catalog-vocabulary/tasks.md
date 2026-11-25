# Tasks

## 1. Engine: the instance catalog and the catalog

- [x] 1.1 Move `src/lib/core/engine/app_catalog.ts` and its test to `instance_catalog.ts` and `instance_catalog.test.ts` with `git mv`. Rename `AppCatalog`, `ResolvedAppCatalog`, `AppCatalogResolution` and `resolveAppCatalog` to `InstanceCatalog`, `ResolvedInstanceCatalog`, `InstanceCatalogResolution` and `resolveInstanceCatalog` (design, decision 1), with their doc comments saying "instance catalog". Update the exports of `src/lib/core/engine/index.ts` and the export list in `index.test.ts`. Verify with `npm run test -- src/lib/core/engine/instance_catalog src/lib/core/engine/index`.
- [x] 1.2 Make each start error start with `Instance catalog <list>:` in place of `Catalog <list>:` (design, decision 2). First update the expected messages in `instance_catalog.test.ts` and see them fail, then change `describeEntryError`. Verify with `npm run test -- src/lib/core/engine/instance_catalog`.
- [x] 1.3 Move `src/lib/core/engine/catalog_listing.ts` and its test to `catalog.ts` and `catalog.test.ts` with `git mv`. Rename `CatalogListing` to `Catalog` and `buildCatalogListing` to `buildCatalog`, take a `ResolvedInstanceCatalog`, rename `buildOwnMosaicEntries` to `buildInstanceMosaicEntries`, and say "the instance catalog's mosaics" for the "catalog's own mosaics" in comments. Carry the type rename to every user, so the build stays whole:
  - in the engine: `index.ts`, `index.test.ts`, `catalog_methods.ts`, `mod_methods.ts`, `mod_session.ts` and their tests, and `mod_api_types.test.ts`;
  - in the stage: `stage_controller.ts`, `stage_sandboxes.ts`, `stage_checks.ts` and `stage_check_cases.ts`;
  - in `src/lib/core/combinations/combination_catalog.ts` and its test, where `CombinationSnapshot.listing` becomes `catalog`, and in the stage bar components that read it;
  - in `src/test/method_contexts.ts`;
  - in `default_mods/mod_api.d.ts` and the three explorers' sources.

  In the engine's comments, say "the catalog" for "the app's catalog". Verify with `npm run build`, which type-checks the app and builds the default mods, and with `npm run test -- src/lib/core/engine src/lib/core/combinations src/main/stage`, including `mod_api_types.test.ts`, which checks that the declared `Catalog` and the engine's match.
- [x] 1.4 Update `docs/modules/lib/core/engine/README.md`:
  - the "App catalog" section becomes "Instance catalog", with the new names, file and error examples;
  - "Reading the catalog" and the `catalog.list` row say "the catalog", made of the instance catalog and the default mosaics, and later the user catalog, with the naming rule of design, decision 5;
  - `Catalog`, `buildCatalog` and `catalog.ts` replace `CatalogListing`, `buildCatalogListing` and `catalog_listing.ts`;
  - links to `#app-catalog` point to the new anchor;
  - the `0.1.15` history entry keeps its wording, since it is history.

  Verify that `git grep -n -E "AppCatalog|app_catalog|app catalog|app's catalog|#app-catalog|CatalogListing|catalog_listing" docs/modules/lib/core/engine/README.md` finds only the `0.1.15` entry.

## 2. Stage

- [x] 2.1 Rename `StageOptions.catalog` and `Stage.catalog` to `instanceCatalog`, typed `ResolvedInstanceCatalog`, in `src/lib/core/stage/stage_controller.ts`. Rename `readAppCatalog` to `readLiveCatalog` in `stage_check_cases.ts` (design, decision 1), and say "the live catalog" in its comments and "the catalog" in those of `stage_checks.ts` and `stage_sandboxes.ts`. In `src/test/sample_mods.ts`, rename `TEST_CATALOG` to `TEST_INSTANCE_CATALOG`, typed `ResolvedInstanceCatalog`, and update its users. Update the stage tests that build a stage: `stage_controller.test.ts`, whose "app catalog" describe becomes "catalog", and `stage_check_cases.test.ts`, whose `answersAppCatalog` becomes `answersLiveCatalog`. Verify with `npm run test -- src/lib/core/stage` and that `git grep -n "TEST_CATALOG\b" -- src` finds nothing.
- [x] 2.2 Update `docs/modules/lib/core/stage/README.md`:
  - the "App catalog" section becomes "Catalog";
  - `StageOptions.instanceCatalog` in the `createStage` options;
  - the example's `instanceCatalog: resolveInstanceCatalog(INSTANCE_CATALOG, …).catalog`;
  - `buildCatalog` for `buildCatalogListing`;
  - the check cases answer an unscripted `catalog.list` with the live catalog;
  - links to `#app-catalog` follow.

  Verify that `git grep -n -E "AppCatalog|APP_CATALOG|app catalog|app's catalog|#app-catalog|CatalogListing" docs/modules/lib/core/stage/README.md` finds nothing.

## 3. App: the vanilla instance catalog and the start errors

- [x] 3.1 Move `src/main/app_catalog.ts` and its test to `src/main/instance_catalog.ts` and `instance_catalog.test.ts`, and `src/test/registries/test_catalog.ts` to `test_instance_catalog.ts`, with `git mv`. Rename `APP_CATALOG` to `INSTANCE_CATALOG` in both, with the test registry's comment pointing to the new files. Update `src/main.tsx`: imports, `resolveInstanceCatalog`, the `instanceCatalog` stage option. Update the `e2e-test-catalog` alias in `vite.config.ts` to match `./main/instance_catalog.ts` and replace it with `test_instance_catalog.ts`. Verify with:
  - `npm run build`;
  - `npm run test -- src/main/instance_catalog`;
  - `npm run test:e2e -- app_sidebar mod_api_version default_mods`, which run against the test catalog build.
- [x] 3.2 Change the start error title in `src/main/StartErrorScreen.tsx` to "The app cannot start: the instance catalog is invalid", with its comments saying "instance catalog". First update `StartErrorScreen.test.tsx` (the title, and the error text that now starts with `Instance catalog collections:`) and see it fail. Verify with `npm run test -- src/main/StartErrorScreen`.
- [x] 3.3 Update `docs/modules/main/README.md`:
  - "The app catalog" section becomes "The instance catalog". It says that the catalog is made of it and the default mosaics, and later the user catalog, and states the naming rule of design, decision 5;
  - `INSTANCE_CATALOG`, `resolveInstanceCatalog`, and `instance_catalog.ts` in the files table;
  - the start error title;
  - the links to `#the-app-catalog`.

  Update `docs/modules/main/settings/README.md`'s "Catalog" bullet to say "the catalog" and link to the new section. Verify that `git grep -n -E "APP_CATALOG|app_catalog|app catalog|app's catalog|#the-app-catalog" docs/modules/main` finds nothing.

## 4. Default mods, mod docs and e2e names

- [x] 4.1 Say "the catalog" for "the app's catalog" in the comments of `default_mods/mod_api.d.ts` and of the explorers' sources (`mod_explorer`, `collection_explorer` and `mosaic_explorer`, their `main.ts` and `*_entries.ts`). In `default_mods/README.md`, say "the catalog" and point to `src/main/instance_catalog.ts` as the instance catalog. Verify with `npm run build`, which builds the default mods, and that `git grep -n -E "app's catalog|app_catalog|CatalogListing" default_mods` finds nothing.
- [x] 4.2 Update the three explorers' READMEs (`docs/modules/mods/explorer/`, `docs/modules/tiles/explorer/`, `docs/modules/mosaics/explorer/`): they list "the catalog", whose lists the instantiation sets in the instance catalog (`src/main/instance_catalog.ts`), and their links point to the main README's "The instance catalog". Update `docs/mod_plugin_spec.md`: an unscripted `catalog.list` gets the live catalog, as in the app. Verify that `git grep -n -E "app_catalog|app catalog|app's catalog|#the-app-catalog" docs/modules/mods docs/modules/tiles docs/modules/mosaics docs/mod_plugin_spec.md` finds nothing.
- [x] 4.3 In `e2e/mod_tests.spec.ts`, rename the test mod's case `listsAppCatalog` to `listsLiveCatalog`, its name "lists the app's catalog" to "lists the live catalog", and the test function `answersAppCatalog` to `answersLiveCatalog`. Verify with `npm run test:e2e -- mod_tests`.

## 5. Naming convention

- [x] 5.1 Add the prefix rule of design, decision 6, to `docs/code_conventions.md` as a subsection of "Code":
  - domain names in code take no prefix;
  - names in a namespace shared with code the project doesn't own start with `opentesela.`, `opentesela-` or `ot-`, as the namespace's syntax allows. These are storage keys, databases, URL schemes, and CSS variables and data attributes in mod frames;
  - one example per namespace already in use: `opentesela.theme-choice`, `--ot-*` and `data-ot-variant`.

  Verify that every storage key in `src` starts with `opentesela.` (`git grep -n -h -o -E "\"opentesela\.[a-z.-]+" -- src` lists them, and no other `localStorage` key is set), so the rule matches the code.

## 6. Release and verification

- [x] 6.1 Search the repository: `git grep -n -E "AppCatalog|APP_CATALOG|app_catalog|appCatalog|app-catalog|[Aa]pp catalog|[Aa]pp's catalog|CatalogListing|catalog_listing|TEST_CATALOG\b|test_catalog\.ts" -- ':!openspec' ':!CHANGELOG.md' ':!.changeset'`. Verify it finds only the engine README's `0.1.15` history entry. The main specs under `openspec/specs/` keep the old wording until the change is archived (see "Workflow follow-up").
- [x] 6.2 Add `.changeset/rename-catalog-vocabulary.md` with a `minor` bump, because an instantiation's `src/main/app_catalog.ts` and `APP_CATALOG` become `src/main/instance_catalog.ts` and `INSTANCE_CATALOG`, which breaks instantiations under the "Bump rule" of `docs/releasing.md`. Add a one-line summary for instantiations: the catalog the instantiation sets is now the instance catalog, in `src/main/instance_catalog.ts` as `INSTANCE_CATALOG`, and the mod API type `CatalogListing` is now `Catalog`; users see no change. Verify the file follows the format of the other files in `.changeset/`.
- [x] 6.3 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and, since the change touches a spec of the mod API (`mod-engine-api`), `npm run test:e2e:samples`. Verify each passes.

## Workflow follow-up

- Archive the change after review. When archiving, check whether `openspec/specs/app-catalog/` is left without requirements, and delete it if so (design, "Risks / Trade-offs").
- Then run `git grep -n -E "app-catalog|[Aa]pp catalog|[Aa]pp's catalog" -- openspec/specs` and verify it finds nothing.
