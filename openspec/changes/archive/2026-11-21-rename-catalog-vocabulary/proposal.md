# Proposal

## Why

"App catalog" and "the app's catalog" name two different things today:

- the three lists the instantiation sets (`APP_CATALOG`, `AppCatalog`, `ResolvedAppCatalog`);
- the merged catalog that `catalog.list`, the explorers and the stage bar's lists read, which also holds the default mosaics of the listed mods while "List the default mosaics of mods" is on.

The next changes add a user catalog: mosaics, and later collections and mods, that the user adds and keeps in the browser. They join the merged catalog next to the instantiation's lists. Next to a "user catalog", "app catalog" reads like the whole catalog, so the two meanings have to be split first, while no instantiation depends on the names.

## What Changes

The vocabulary, from this change on:

- **catalog**: the merged catalog, what `catalog.list` answers and `catalog.changed` pushes, and what the explorers and the stage bar's lists show. It lists the things the app can open: mods, collections and mosaics. Each is a **catalog entry** of a **catalog kind**, terms the code already uses. Today it is the instance catalog plus the default mosaics. Later it also holds the user catalog.
- **instance catalog**: the three lists of references that the instantiation sets, and nothing else.
- **default mosaics**: unchanged. The default mosaic of each listed mod, which joins the catalog's mosaics while the switch is on, marked with `defaultOf`.
- **user catalog**: named in the docs as the part a later change adds. Nothing of it is built here.
- **live catalog**: in mod tests, the catalog as the app answers it, as opposed to a catalog a case scripts with `answer("catalog.list", …)`. It is the same catalog; the word only marks that contrast.

The naming rule: "catalog" alone always means the merged whole, and each part is always qualified (*instance catalog*, *user catalog*), or has its own name (*default mosaics*). "Catalog" takes no prefix: it lives only in namespaces the project owns, and the namespaces it shares with code the project doesn't own already have prefixes (see the new convention below).

What is renamed:

- **BREAKING (instantiations)** `src/main/app_catalog.ts` becomes `src/main/instance_catalog.ts`, and `APP_CATALOG` becomes `INSTANCE_CATALOG`. An instantiation edits this file to set what the app offers.
- In the engine, `app_catalog.ts` becomes `instance_catalog.ts`:
  - `AppCatalog` becomes `InstanceCatalog`;
  - `ResolvedAppCatalog` becomes `ResolvedInstanceCatalog`;
  - `AppCatalogResolution` becomes `InstanceCatalogResolution`;
  - `resolveAppCatalog` becomes `resolveInstanceCatalog`.
- The stage's option and field `catalog`, which holds the resolved instance catalog, becomes `instanceCatalog`. `readStageCatalog` and `catalogDefaultMosaics` keep their names, since they are about the merged catalog.
- The merged catalog takes the domain word, free now that `AppCatalog` is gone:
  - `CatalogListing` becomes `Catalog`, in the engine and in `default_mods/mod_api.d.ts`;
  - `buildCatalogListing` becomes `buildCatalog`;
  - `catalog_listing.ts` and its test become `catalog.ts` and `catalog.test.ts`;
  - the stage bar's snapshot field `listing` becomes `catalog`.
  `CatalogEntry` and `CatalogMosaicEntry` keep their names.
- In `catalog.ts`, the "own mosaics" of the catalog become the instance catalog's mosaics.
- In mod tests, `readAppCatalog` becomes `readLiveCatalog`, and the specs, docs and test names say "the live catalog" where "the app's catalog" meant the catalog of an unscripted `catalog.list`.
- Test fixtures follow the vocabulary: `TEST_CATALOG` becomes `TEST_INSTANCE_CATALOG`, and `src/test/registries/test_catalog.ts` becomes `test_instance_catalog.ts`. The `e2e-test-catalog` instantiation and `TEST_CATALOG_PREVIEW_URL` keep their names: they name an instantiation set up for tests, not a part of the catalog.
- **New convention** in `docs/code_conventions.md`: domain names in code take no prefix, and names in a namespace shared with code the project doesn't own (storage keys, databases, URL schemes, CSS variables and data attributes in mod frames) start with `opentesela.`, `opentesela-` or `ot-`, as the namespace allows. This writes down what the storage keys (`opentesela.*`) and the theme (`--ot-*`, `data-ot-variant`) already do.
- The start errors name the instance catalog:
  - the screen's title becomes "The app cannot start: the instance catalog is invalid";
  - each error starts with `Instance catalog <list>:` in place of `Catalog <list>:`.
- The `app-catalog` spec becomes the `catalog` spec. Its requirements say "instance catalog" where they mean the instantiation's lists and "catalog" where they mean the merged one.
- Specs, docs, code comments, test names and the mod API's type comments that say "the app's catalog" for the merged catalog say "the catalog".

What stays:

- `catalog.list` and `catalog.changed`, their params and their results.
- What the explorers, the stage bar and Settings do and show.
- The mosaic viewer and every other default mod keep their names.

The mod API version is not bumped:

- The only mod API spec that changes is `mod-engine-api`, and only in wording: "Read the catalog" says "the catalog" and points to the `catalog` spec.
- `default_mods/mod_api.d.ts` renames the type `CatalogListing` to `Catalog`. The mod API's version rules cover the engine's methods, events, params and results, the mount context, the mod file format and the test API. A TypeScript type's name is none of these: what a mod sends and receives is unchanged, and the surface guard records no type names. A mod that imports the type by name must rename its import. No mod exists outside this repository, and the default mods are updated in this change.
- No method, event, param, result or error of a mod changes.

Phones and color schemes: nothing changes in layout or color. The only visible change is the wording of the start error screen, which keeps its layout.

## Capabilities

### New Capabilities

- `catalog`: the catalog and its parts. It takes the requirements of `app-catalog`, reworded with the instance catalog, the default mosaics and the catalog.

### Modified Capabilities

- `app-catalog`: every requirement is removed and moves to `catalog`.
- `app-settings`: "List the default mosaics of mods" points to `catalog`.
- `default-mods`: the mod, collection and mosaic explorers list "the catalog".
- `mod-engine-api`: "Read the catalog" answers "the catalog" and points to `catalog`.
- `mod-tests`: "Unanswered catalog" is answered with "the live catalog".

## Impact

- **Code**: `src/lib/core/engine/` (`app_catalog.ts`, `catalog_listing.ts` and their tests, `catalog_methods.ts`, `index.ts`, `mod_api_types.test.ts`, the session and method files), `src/lib/core/stage/` (`stage_controller.ts`, `stage_sandboxes.ts`, the checks and check cases), `src/lib/core/combinations/combination_catalog.ts`, `src/main.tsx`, `src/main/app_catalog.ts` and its test, `src/main/StartErrorScreen.tsx`, `src/test/registries/test_catalog.ts`, `src/test/sample_mods.ts`, `src/test/method_contexts.ts` and the alias in `vite.config.ts`.
- **Default mods**: the `Catalog` type and comments in the explorers' sources and in `default_mods/mod_api.d.ts`, and `default_mods/README.md`.
- **Tests**: renamed imports and names, the start error texts, and the case names of `e2e/mod_tests.spec.ts`.
- **Docs**: the engine, stage, main and settings READMEs, the three explorers' READMEs, `docs/mod_plugin_spec.md`, and the new convention in `docs/code_conventions.md`.
- **Release**: a minor changeset. An instantiation edits `src/main/app_catalog.ts` and `APP_CATALOG`, which move, and that is a breaking change for instantiations under the bump rule. No instantiation exists yet. Users see no change.
- **Out of scope**: the user catalog, the browser files store, badges, import and export, and mosaic editing, which come in later changes. Archived changes and `CHANGELOG.md` keep the old names as history.
