# Tasks

## 1. Collection index

- [ ] 1.1 Move the entry planning out of `src/lib/tile/collection_loader.ts` into `src/lib/tile/collection_plan.ts`, unchanged: the slots, `planEntrySlot`, `checkRepeatedTile` and `planCollectionSlots`, and the shared fetch-parse-plan step of design.md, decision 1. Make `loadTileCollection` use it. Verify that `collection_loader.test.ts` passes unchanged (`npx vitest run src/lib/tile`).
- [ ] 1.2 Add `readTileCollectionIndex(location, options)` and the `TileCollectionIndex` type (`source`, `name`, `description`, `tiles`, `issues`, and nothing else), and export them from `src/lib/tile/index.ts`. Write the tests first, in `collection_index.test.ts`, with the module's own fixtures, one per scenario of the `collection-loading` delta:
  - the sample index with no tile requested (assert on the fetch mock's calls);
  - an empty collection;
  - a repeated tile listed once with a warning;
  - a malformed entry;
  - a tile that would 404 listed with no issue;
  - the three failures with their error kinds and sources.

  Add a test that, for one fixture with every kind of entry, the index's `tiles` equal the sources `loadTileCollection` requests and its `issues` equal the loaded collection's entry issues. Verify with `npx vitest run src/lib/tile`.
- [ ] 1.3 Document `readTileCollectionIndex` in `docs/modules/lib/tile/README.md`: what it reads, what it never requests, its result and its errors, with a short example. Verify that the example matches the exported names.

## 2. Hint for rejected requests

- [ ] 2.1 In `src/lib/files/file_fetcher.ts`, add the sentence of design.md, decision 5, after the cause in the message of a rejected request. Leave the messages for HTTP statuses and unreadable bodies unchanged. Write the tests first in `file_fetcher.test.ts`: "Hint for a rejected request" and "No hint for an HTTP status". Then run `npm run test` and update every other test that matches the whole old message, and only those. Verify that `npm run test` passes.
- [ ] 2.2 Update the fetch error's description in `docs/modules/lib/files/README.md`, and in the parts of the tile, mod and stage module READMEs that quote a rejected request's message. Verify that every message they quote matches the code.

## 3. Engine: `collections.inspect`

- [ ] 3.1 Give `checkOpenGrant` in `src/lib/core/permissions/mod_grants.ts` the subject of the request (design.md, decision 3). `mods.*` keeps its messages word for word, and collections get "Inspecting collections from `<origin>` …" in both the undeclared and the "not granted" forms. Add tests in `mod_grants.test.ts` for both collection forms, and verify that the existing tests pass unchanged.
- [ ] 3.2 Add `src/lib/core/engine/collections_methods.ts` with `COLLECTIONS_METHODS` (design.md, decision 2) and register it in `ENGINE_METHODS` in `mod_session.ts`. Write `collections_methods.test.ts` first, covering the `mod-engine-api` delta's scenarios at this level:
  - the sample index with no tile requested;
  - entry issues;
  - the structured clone;
  - `-32001` for a 404 and for a missing `tiles`;
  - `-32602` for `{}` and for a location that cannot be resolved;
  - `-32002` with nothing fetched for a mod without the grant and for a declared but not granted `open`;
  - `"*"` reaching another site;
  - a declared origin (the `mod-sandbox` scenario "Declared open covers collections");
  - a relative location resolved against the app's address;
  - a hidden mod's request answered.

  Verify with `npx vitest run src/lib/core/engine`.
- [ ] 3.3 Bump `MOD_API_VERSION` to `0.1.11` in `src/lib/core/engine/mod_api_version.ts`. Then:
  - add the `0.1.11` entry to the surface guard in `mod_api_surface.test.ts` with `collections.inspect`, editing no older entry;
  - update `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`;
  - leave the `^0.1.10` and `^0.1.0` ranges as they are (patch bump).

  Verify with `npx vitest run src/lib/core/engine` and with `grep -rn '"0.1.10"' src e2e`, which should leave only ranges and the guard's older entry.
- [ ] 3.4 Type the method in `default_mods/mod_api.d.ts` (`CollectionInspection` and the `"collections.inspect"` entry of `ModApiMethods`, design.md, decision 4). Make `mod_api_types.test.ts` check that the engine's index type fits it. Verify with `npx vitest run src/lib/core/engine/mod_api_types.test.ts` and `npx tsc -p tsconfig.default_mods.json --noEmit`.
- [ ] 3.5 Document `collections.inspect` in `docs/modules/lib/core/engine/README.md`:
  - a new "Inspecting collections" part next to "Inspecting and opening mods", with the checks it runs, its result, its errors and an example;
  - `-32001` in the error codes;
  - version `0.1.11` wherever the README states the current version.

  Also describe `open` as covering collections in `docs/modules/lib/core/permissions/README.md` and in the permissions part of `docs/mod_plugin_spec.md`. Add a short example of `collections.inspect` to the guide, and keep its `api` ranges. Verify that every method name, field and code in these docs matches the code.

## 4. Default mod `collection_viewer`

- [ ] 4.1 Create `default_mods/collection_viewer/` with `mod_conf.yaml`:
  - `name: "collection_viewer"`, `title: "Collection Viewer"`, `version: "0.1.0"`, `api: "^0.1.0"`;
  - a description;
  - `entrypoint: "./main.js"`, `test_path: "./test.js"`;
  - `open` for `"*"` with a reason.

  Add the `src/` modules of design.md, decision 7. Write the pure modules `tile_labels.ts` and `tile_filter.ts` test-first, through the mod's cases (4.2), covering file names, decoding, a failed decode, shared file names and letter case. Follow `docs/code_conventions.md`, and set only layout in the mod's own CSS. Verify that `npm run build` emits `dist/default_mods/collection_viewer/main.js` with no `import`.
- [ ] 4.2 Add `test/test.ts` and the fixture collections and tiles in `default_mods/collection_viewer/fixtures/`, covering the cases of "Collection viewer cases":
  - name, description, source and tiles;
  - entry issues;
  - shared file names;
  - an encoded file name;
  - the filter and its count;
  - missing, empty and failing `target` (404 and wrong structure).

  Add the look cases (own styles layout only, the card on `--ot-card`, issue badges). Verify that the mod viewer's "Check mod" for `collection_viewer` passes, with every case passed.
- [ ] 4.3 Add the e2e tests in `e2e/default_mods.spec.ts` that a case cannot see:
  - "View a sample collection" through its run link, with no tile requested (`@sample`);
  - "Collection whose site refuses the app", with a route that aborts the request;
  - "Collection viewer passes its check";
  - "Collection cases without the samples": extend "Cases without the samples", which answers `**/samples/**` with 404, to check `collection_viewer` too (and `collection_explorer` once group 5 exists).

  Verify with `npx playwright test e2e/default_mods.spec.ts`.

## 5. Default mod `collection_explorer`

- [ ] 5.1 Create `default_mods/collection_explorer/` with `mod_conf.yaml`:
  - `name: "collection_explorer"`, `title: "Tiles"`, `version: "0.1.0"`, `api: "^0.1.0"`;
  - a description;
  - `entrypoint`, `test_path`;
  - `open` for `"*"` with a reason;
  - `config: { viewer: "collection_viewer", collections: ["./samples/tiles/literature_nobel_laureates/collection.yaml", "./samples/tiles/literature_nobel_laureates_books/collection.yaml"] }`.

  Add the `src/` modules of design.md, decision 6, with layout-only CSS. Verify that `npm run build` emits `dist/default_mods/collection_explorer/main.js` with no `import`.
- [ ] 5.2 Add `test/test.ts` and fixture collections in `default_mods/collection_explorer/fixtures/`, covering the cases of "Collection explorer cases": listing as cards with name, description and number of tiles, a location that cannot be inspected as an alert, and selecting a collection (`mods.open` answered with `null`, then the request's `mod` and `params.target`). Add the look cases. Verify that "Check mod" for `collection_explorer` passes.
- [ ] 5.3 Add the e2e tests in `e2e/default_mods.spec.ts`:
  - "Vanilla explorer lists the Nobel laureates" and "Vanilla explorer lists the books after the laureates" (`@sample`);
  - "Explorer requests no tile";
  - "Select a collection" (the viewer is visible, the address carries `mod=collection_viewer` and the source as `target`, and Tiles stays current);
  - "Collection explorer passes its check";
  - the look scenarios "Collection explorer lists collections as cards" and "Collection explorer shows a failure as an alert";
  - "Own styles are layout only" extended to the two new mods.

  For "Viewer switched off", add `collection_viewer` to the switched-off list of `src/test/registries/explorer_off_mods.ts` and test it in the `e2e-explorer-off` project. Check that the tests already in that project still pass, and update the doc comment in `e2e/app_servers.ts`. Verify with `npx playwright test e2e/default_mods.spec.ts`.
- [ ] 5.4 Write `docs/modules/tiles/explorer/README.md` (today TODO), modeled on `docs/modules/mods/explorer/README.md`. Describe:
  - the collection explorer and the collection viewer: what each shows, its config or `target`, its permission, its tests;
  - its links, including that shared viewer links are in no section;
  - that tiles do not open yet.

  List both mods in `default_mods/README.md` (its intro, the "Tests" part and how to check them) and in `docs/modules/README.md` (what this version ships). Verify that every path, config key and link in these docs exists.

## 6. Tiles in the sidebar

- [ ] 6.1 In `src/main/sections/vanilla_sections.ts`, make Tiles the mod link `collection_explorer` (`collection: null`, `params: {}`) with `comingSoon: false`, keeping it optional, with the same icon and label (design.md, decision 8). Update the unit tests in `src/main/sidebar/Sidebar.test.tsx` (the vanilla items, and "Mosaics is coming soon" instead of Tiles) and in `src/main/settings/SettingsPage.test.tsx`:
  - only Mosaics says "Coming soon";
  - "Hide a coming-soon section" uses Mosaics;
  - add "Hide Tiles".

  Add a unit test in `src/main/sections/` that a registry built with `collection_explorer` switched off has no Tiles section and no Tiles switch ("Collection explorer switched off"). Verify with `npm run test`.
- [ ] 6.2 Update the e2e tests that rely on Tiles being coming soon, in `e2e/app_sidebar.spec.ts` and `e2e/app_settings.spec.ts`. Add "Tiles opens the collection explorer" (a click on Tiles shows the explorer at `#/run?mod=collection_explorer` with Tiles current) and the run-link part of "Hide Tiles". Verify with `npx playwright test e2e/app_sidebar.spec.ts e2e/app_settings.spec.ts`.
- [ ] 6.3 Update `docs/modules/main/README.md` (the vanilla registry table and example, and that Tiles is no longer coming soon), `docs/modules/main/settings/README.md` where it names coming-soon sections, and the homepage text if it calls Tiles coming soon. Verify with `grep -rn -i "coming soon" docs src/main/pages`, which should show only Mosaics, or general rules.

## 7. Release

- [ ] 7.1 Add `.changeset/add-collection-explorer.md` with an `"opentesela": patch` bump. It's a new feature with no breaking change for users or instantiations, and the mod API's patch bump to `0.1.11` asks for at least a patch (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "The Tiles section lists the sample tile collections and shows each one's name, description and tiles, with a new `collections.inspect` request for mods (mod API 0.1.11)." Verify the file follows the format of the other files in `.changeset/`.

## 8. Verification

- [ ] 8.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify all pass. Run `openspec validate add-collection-explorer --strict` and verify it is valid.
