# Design

## Context

See proposal.md, "Why". The code already keeps the two meanings apart. Only the names mix them:

- `src/lib/core/engine/app_catalog.ts` holds the instantiation's lists (`AppCatalog`) and resolves them once at start (`resolveAppCatalog`) into `ResolvedAppCatalog`, with the start errors (`Catalog <list>: …`).
- `src/lib/core/engine/catalog_listing.ts` builds the merged catalog (`CatalogListing`) from a `ResolvedAppCatalog` and the switch, adding the default mosaics after the "own mosaics".
- The stage keeps the resolved lists as `Stage.catalog` and `StageOptions.catalog`. Every `catalog.list` and the stage bar's lists read the merged catalog through `readStageCatalog`, so the stage bar and the mods already see one catalog.
- The stage bar's lists read the merged catalog through the combinations module, whose snapshot keeps the last one as `listing`. In the check cases, a `catalog.list` that a case did not script is answered by `readAppCatalog`.
- `src/main/app_catalog.ts` exports the vanilla `APP_CATALOG`. For the `e2e-test-catalog` instantiation, `vite.config.ts` swaps it for `src/test/registries/test_catalog.ts`, which exports the same name. `e2e/app_sidebar.spec.ts` and `e2e/mod_api_version.spec.ts` run against that build.
- `StartErrorScreen` shows the catalog's errors under "The app cannot start: the app catalog is invalid".

## Goals / Non-Goals

**Goals:**

- Every name for the instantiation's lists says "instance catalog", and every name for the merged result says "catalog", in code, tests, specs and docs.
- The later user catalog joins the catalog without another rename.

**Non-Goals:**

- Any change of behavior, of the mod API, or of what users see, apart from the start error wording.
- Introducing a type, module or setting for the user catalog. The docs only name it.
- Renaming names that already mean the merged catalog: `catalog.list`, `catalog.changed`, `CatalogEntry`, `CatalogMosaicEntry`, `readStageCatalog`, `catalogDefaultMosaics`, `changeStageCatalogDefaultMosaics`, and the Settings "Catalog" group.
- Renaming the combinations module's `CombinationCatalog`. It isn't a catalog: it holds the stage bar's summaries and tile-match counts. Under the naming rule (decision 5) its name is wrong, but renaming it belongs to the combinations module and is left for a change of its own.
- Prefixing domain names (decision 6).

## Decisions

### 1. The names

| Today | New |
|---|---|
| `src/lib/core/engine/app_catalog.ts` (and `.test.ts`) | `src/lib/core/engine/instance_catalog.ts` (and `.test.ts`) |
| `AppCatalog` | `InstanceCatalog` |
| `ResolvedAppCatalog` | `ResolvedInstanceCatalog` |
| `AppCatalogResolution` | `InstanceCatalogResolution` |
| `resolveAppCatalog` | `resolveInstanceCatalog` |
| `src/main/app_catalog.ts` (and `.test.ts`) | `src/main/instance_catalog.ts` (and `.test.ts`) |
| `APP_CATALOG` (vanilla and test registry) | `INSTANCE_CATALOG` |
| `StageOptions.catalog`, `Stage.catalog` | `StageOptions.instanceCatalog`, `Stage.instanceCatalog` |
| `src/lib/core/engine/catalog_listing.ts` (and `.test.ts`) | `src/lib/core/engine/catalog.ts` (and `.test.ts`) |
| `CatalogListing` (engine and `default_mods/mod_api.d.ts`) | `Catalog` |
| `buildCatalogListing` | `buildCatalog` |
| `CombinationSnapshot.listing` | `CombinationSnapshot.catalog` |
| `buildOwnMosaicEntries`, "the catalog's own mosaics" | `buildInstanceMosaicEntries`, "the instance catalog's mosaics" |
| `readAppCatalog` (check cases) | `readLiveCatalog` |
| `TEST_CATALOG` (`src/test/sample_mods.ts`) | `TEST_INSTANCE_CATALOG` |
| `src/test/registries/test_catalog.ts` | `src/test/registries/test_instance_catalog.ts` |
| "the app's catalog", "the app catalog" for the merged result | "the catalog" |
| "the app's catalog" for an unscripted `catalog.list` in mod tests | "the live catalog" |

- **Why "instance" and not "app" or "site".** "App catalog" next to "user catalog" reads like the app's whole catalog. "Site" already names the `sites` run link field, site consent and the site-owner rule. The docs already say "instance" and "instantiation" for whoever deploys the app.
- **Why the merged result keeps "catalog".** It is what mods already call it, through `catalog.list` and `catalog.changed`. Renaming would change the mod API for nothing, and the user catalog can join it unchanged.
- **Why the stage field changes.** `Stage.catalog` next to `readStageCatalog` would mean two catalogs under one word. `instanceCatalog` says it is the input the catalog is built from.
- **Why `CatalogListing` becomes `Catalog`.** It was called a listing only because `AppCatalog` held the word. The merged catalog is the domain's "catalog", so its type takes the name, and the user catalog joins a type called `Catalog` later. It is a TypeScript type name, not part of what mods send and receive (see proposal.md, the mod API paragraph). `mod_api_types.test.ts` checks that the declared and the engine's types still match after the rename.
- **Why "live catalog" in mod tests.** In the check cases, the test runner and the `mod-tests` spec, "the app's catalog" didn't mean the instance lists. It meant the catalog the app answers, as opposed to the catalog a case scripts. Plain "the catalog" would lose that contrast, and the parameter name `readCatalog` would also clash with the hook field it is bound into (`readCatalog: answerCaseCatalog.bind(…, readCatalog)`). "Live" names the contrast.
- **Test fixtures.** `TEST_CATALOG` is a resolved instance catalog, and `test_catalog.ts` is the test instantiation's instance catalog, so both say so. The `e2e-test-catalog` instantiation and `TEST_CATALOG_PREVIEW_URL` keep their names: they name an instantiation set up for tests, and renaming them would touch every e2e file that opens it for no gain in clarity.

### 2. The start errors name the instance catalog

- The title becomes "The app cannot start: the instance catalog is invalid".
- Each error starts with `Instance catalog <list>:`, for example `Instance catalog mods: "./samples/mods/book_list/mod_conf.yaml" repeats an earlier entry (…)`.
- These texts are for whoever deploys the app, and they should name the thing to fix. This is the only visible change, and the spec states it (see `catalog`, "The instance catalog is checked at start").
- Alternative: keep `Catalog <list>:`. Rejected, because the catalog is now the merged result, which the deployer doesn't edit.

### 3. The capability moves from `app-catalog` to `catalog`

- OpenSpec has no capability rename. The delta removes each `app-catalog` requirement, with a reason and a migration, and adds the reworded requirements to a new `catalog` spec. If archiving leaves an `app-catalog` spec with no requirements, its folder is deleted when the change is archived, so no empty capability stays (see "Risks / Trade-offs").
- The `catalog` spec gains one requirement, "The catalog and its parts". It states what the code already does: the catalog is the instance catalog plus the default mosaics. This gives the user catalog a place to join later.
- References to `app-catalog` in other specs (`app-settings`, `mod-engine-api`) point to `catalog`.
- Specs that already say "the catalog" for the merged result (`combination-pickers`, `recently-used`, `stage-bar`, `app-sidebar`) are right as they are and don't change.

### 4. Mechanical renames, one layer at a time

The rename goes from the bottom up: the engine, then the stage, then `src/main`, then tests and docs. TypeScript catches every missed code reference at each step. A final repository search for the old names, outside archived changes, `CHANGELOG.md` and `.changeset/`, catches what TypeScript can't see:

- comments and docs;
- the e2e test mod's strings in `e2e/mod_tests.spec.ts` (`listsAppCatalog`, "lists the app's catalog");
- the regular expression of the alias in `vite.config.ts`.

Files are moved with `git mv`, so their history follows them.

### 5. The naming rule for the catalog

The docs state it where the catalog is introduced (the main README's "The instance catalog" section and the engine README's "Instance catalog" and "Reading the catalog"):

- The **catalog** lists the things the app can open: mods, collections and mosaics. Each is a **catalog entry** of a **catalog kind**, words the code already uses (`CatalogEntry`, `catalog_icons.ts`, the sidebar's "Catalog kind icons").
- "Catalog" alone always means the merged whole. A part is always qualified (*instance catalog*, *user catalog*), or has its own name (*default mosaics*).
- "Live catalog" is not a part. It is the whole catalog, named so only where tests contrast it with a scripted one.

Alternatives considered:

- A prefix that says what the catalog holds, such as `content_catalog` or `object_catalog`. Rejected: no single domain word names "a mod, a collection or a mosaic". The docs call them objects, which is more generic than "catalog". The catalog is what gives them a common name.
- Another head noun. *Index* collides with the collection index and `index.ts`, *registry* with the section registry, *library* with mod libraries, and *collection* is a tile collection.

### 6. Prefixes only where namespaces are shared

A new subsection of `docs/code_conventions.md`, under "Code":

- Domain names in code take no prefix. TypeScript modules already keep them apart, and an import alias resolves a clash with a vendored name.
- A name in a namespace shared with code the project doesn't own starts with `opentesela.`, `opentesela-` or `ot-`, as the namespace's syntax allows. These namespaces are storage keys, databases, URL schemes, and CSS variables and data attributes in mod frames.

This writes down what the code already does: the storage keys (`opentesela.theme-choice`, `opentesela.catalog-default-mosaics`, `opentesela.mod-storage:…`), the theme tokens (`--ot-*`) and the badge attribute (`data-ot-variant`). Engine methods are namespaced by area (`catalog.`, `mods.`, `mosaics.`), and only the engine defines them, so they need no prefix. The rule matters for the next change, whose browser file store adds a database and a URL scheme.

- Alternative: prefix the domain names (`ot_catalog`, `OtCatalog`). Rejected: it adds noise to every name and protects against nothing, since domain names never share a namespace with mods or vendored code.

## Risks / Trade-offs

- [The `vite.config.ts` alias matches the old path `./main/app_catalog.ts` with a regular expression. If it isn't updated, the `e2e-test-catalog` build silently uses the vanilla catalog instead of the test registry's.] → The task that renames `src/main/app_catalog.ts` also updates the alias, and checks it with the e2e tests that run against that build (`app_sidebar`, `mod_api_version`).
- [Missed wording in docs, which no compiler checks.] → The final search for `app catalog`, `app's catalog`, `AppCatalog`, `APP_CATALOG`, `app_catalog`, `app-catalog`, `CatalogListing`, `catalog_listing` and `TEST_CATALOG\b` must come back empty outside history.
- [Renaming `CatalogListing` in `default_mods/mod_api.d.ts` breaks the compile of a mod that imports it by name.] → No such mod exists outside this repository, and the default mods are updated in the same task. The proposal records why this is no mod API bump.
- [Archiving may keep `openspec/specs/app-catalog/spec.md` with its purpose and no requirements, since every requirement is removed and none is left.] → When archiving, check the folder, and delete it if it is left without requirements.
- [A future reader of an archived change sees the old names.] → Accepted. Archived changes and `CHANGELOG.md` are history and keep them.
