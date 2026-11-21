# Tasks

The tasks use the names of `rename-catalog-vocabulary` (`Catalog`, `buildCatalog`, `instanceCatalog`, `readLiveCatalog`).

## 1. Browser file addresses and reading

- [ ] 1.1 Add `browser_files.ts` to `src/lib/files/`: `BROWSER_FILE_PROTOCOL` (`"opentesela-browser:"`), `isBrowserFileAddress(source)`, `buildBrowserFileAddress(root, path)`, which encodes each path segment as `indexLocalFiles` does, and the `BrowserFileReader` type (`readText(address): Promise<string | null>`) (design, decisions 1 and 2). Export them from `index.ts`. First write unit tests: a folder path, a single file, a segment with a space, and that `new URL("../tiles/laureates/", <address>)` stays inside the root. Verify with `npm run test -- src/lib/files/browser_files`.
- [ ] 1.2 Add `browserFiles?: BrowserFileReader` to `FileFetchOptions`, and read `opentesela-browser:` addresses through it in `fetchFile`, never through `fetch`. A `null` text, or no reader, raises `FileFetchError` with the reason `it is not stored in this browser`. First write the tests in `file_fetcher.test.ts`: read from the reader, no `fetch` call, a relative location against a browser base, a missing file, and no reader. Verify with `npm run test -- src/lib/files`.
- [ ] 1.3 Make sure a browser address is neither a content host nor the app's origin (`browser-files`, "Stored files are not content hosts"). Add a case to `collectContentHosts`'s tests in `src/lib/core/sandbox/` and to the grants tests in `src/lib/core/permissions/`: a mosaic at a browser address gets its `show` lines asked, not granted. Change the code only if a test fails. Verify with `npm run test -- src/lib/core/sandbox src/lib/core/permissions`.
- [ ] 1.4 Document the scheme, the reader and the error in `docs/modules/lib/files/README.md`, and in `docs/modules/lib/core/sandbox/README.md` that stored files add no content host. Verify that the README's example of a browser address resolves as its test in 1.1 does.

## 2. The browser database

- [ ] 2.1 Add `browser_database.ts` to `src/lib/core/storage/`: the `BrowserDatabase` interface (`readText`, `readEntries`, `apply(changes)`, `clear`) and the `BrowserDatabaseChanges` type (files to put, entries to put, addresses to delete), with `createMemoryBrowserDatabase()` (design, decision 3). First write its unit tests: put and read a file, entries in order of addition, `apply` deleting a file and its entry together, and `clear`. Verify with `npm run test -- src/lib/core/storage`.
- [ ] 2.2 Add `openBrowserDatabase()`: IndexedDB database `opentesela`, version 1, with the object stores `files` and `user-catalog`. `apply` uses one `readwrite` transaction over both. It resolves to `null` when IndexedDB is missing or refuses to open. Export it and `createMemoryBrowserDatabase` from `index.ts`. It is tested in the browsers in 7.6, since jsdom has no IndexedDB. Verify with `npm run build`.
- [ ] 2.3 Document the database, its stores, versions and the memory version in `docs/modules/lib/core/storage/README.md`. Verify that the documented store names match `browser_database.ts`.

## 3. The user catalog module

- [ ] 3.1 Create `src/lib/user_catalog/` with `index.ts`. Add `UserCatalogEntry` (`address`, `place`, `root`, `provenance`), `UserCatalogProvenance` (`folder`, `path`, `addedAt`, `updatedAt`), and `buildUserMosaicEntries(entries)` (design, decision 4). Write unit tests for both kinds of entry. Verify with `npm run test -- src/lib/user_catalog`.
- [ ] 3.2 Add `planImport(picked, folderName, entries, readMosaic)`, following `user-catalog`, "Import review", "Entries missing from a picked folder" and "References that will not open". Write its unit tests first, with `createMemoryBrowserDatabase` and picked files read through `indexLocalFiles` and the real mosaic loader:
  - new, changed and unchanged files;
  - an invalid mosaic with the loader's message;
  - a file above 1 MB;
  - ignored non-YAML files counted;
  - the root reused for a folder name imported before;
  - "Not in the folder" rows;
  - a relative collection outside the store and the picked files, and one inside the picked files.

  Verify with `npm run test -- src/lib/user_catalog`.
- [ ] 3.3 Add `planUpdate(picked, entry, readMosaic)` and `applyReview(review, checked, now)`, returning `BrowserDatabaseChanges`. Write the tests first:
  - an update keeps the address and `addedAt` and sets `updatedAt`;
  - a new file gets a browser address under its root;
  - a checked "Not in the folder" row deletes the entry and its file;
  - an unchecked one changes nothing.

  Verify with `npm run test -- src/lib/user_catalog`.
- [ ] 3.4 Add `docs/modules/lib/user_catalog/README.md`: the entries, provenance, matching by folder name and path, the review statuses and the planning functions. List it in `docs/modules/lib/README.md`. Verify that every status and function the README names exists in the module.

## 4. The catalog with user mosaics

- [ ] 4.1 Extend `buildCatalog` (`src/lib/core/engine/catalog.ts`) to take the user catalog's entries, put their mosaics after the default mosaics, keep a mosaic listed earlier at its first place, and set `listedBy`, `place` and `provenance` on every entry (design, decision 5). Update `CatalogEntry` and `CatalogMosaicEntry`. First write the tests in `catalog.test.ts` for the scenarios of the `catalog` delta and "Read the catalog". Verify with `npm run test -- src/lib/core/engine/catalog`.
- [ ] 4.2 Add the keys to `default_mods/mod_api.d.ts`, and keep `mod_api_types.test.ts` passing. Make the test runner's scripted catalog accept, check and complete `listedBy`, `place` and `provenance` as `mod-tests`, "Scripted catalog", says, with tests for a completed fixture, a fixture user mosaic, and the wrong mark `mosaics[0].place`. Verify with `npm run test -- src/lib/core/engine` and `npm run test:e2e -- mod_tests`.
- [ ] 4.3 Generalize the push of `changeStageCatalogDefaultMosaics` into `refreshStageCatalog(stage)`, which builds the catalog with the current switch and user entries and pushes `catalog.changed` to every running mod. Keep the generation guard. Test it in `stage_controller.test.ts`, with a hidden mod receiving the push. Verify with `npm run test -- src/lib/core/stage`.
- [ ] 4.4 Update "Reading the catalog" and "Catalog changed event" in `docs/modules/lib/core/engine/README.md`, the catalog answer in `docs/mod_plugin_spec.md`, and the stage README's "Catalog" section. Verify that the documented entry shape matches `mod_api.d.ts`.

## 5. Engine requests and the mod API version

- [ ] 5.1 Add `user_catalog_methods.ts` in `src/lib/core/engine/` with the handlers of `userCatalog.import`, `userCatalog.update`, `userCatalog.add`, `userCatalog.export` and `userCatalog.remove`:
  - the param checks of "User catalog request params", with `-32602`;
  - the stored or user entry checks of `user-catalog`, with `-32602`;
  - the visible-mod rule, with `-32002`.

  Add the `AppAction` kinds `catalogImport`, `catalogUpdate`, `catalogAdd` and `catalogRemove` (design, decision 6). Export builds a `SaveFileAction` from the stored text (design, decision 8). Write the handlers' unit tests first, with a memory database. Verify with `npm run test -- src/lib/core/engine/user_catalog_methods`.
- [ ] 5.2 Bump `MOD_API_VERSION` to `0.1.18`, add the surface guard's `0.1.18` entry with the five method names, and add the version note to the engine README's "Mod API version": additions, so a patch. Add the methods to the README's methods table. Verify with `npm run test -- src/lib/core/engine/mod_api_surface`.
- [ ] 5.3 Let `answer` queue a boolean for the five `userCatalog.*` methods, answered without a dialog or a change, and let an unanswered one resolve with `false` in a case, as `mod-tests`, "Scripted answers", says. Document them in `docs/mod_plugin_spec.md`. Verify with the new `e2e/mod_tests.spec.ts` cases for an answered import and an unanswered removal: `npm run test:e2e -- mod_tests`.
- [ ] 5.4 Add to `e2e/mod_engine_api.spec.ts` the param errors (`userCatalog.export` without `mosaic`), and to `e2e/mod_app_actions.spec.ts` the hidden-mod refusal of `userCatalog.import`. Verify with `npm run test:e2e -- mod_engine_api mod_app_actions`.

## 6. Stage and start

- [ ] 6.1 Add `userCatalog` (the entries) and `browserFiles` (the reader) to `StageOptions`. Put the reader in the stage's `fetchOptions`, and give `readStageCatalog` the entries. Add `changeStageUserCatalog(stage, entries)`, which keeps the new entries and calls `refreshStageCatalog`. Test that a stored mosaic, in a memory database, launches with its mod and collection and makes no request for its own address. Verify with `npm run test -- src/lib/core/stage`.
- [ ] 6.2 In `main.tsx`, open the browser database and read its entries before creating the stage (design, decision 7). With `null`, start with an empty, read-only user catalog. Test with a start whose database is `null`: the app renders and the catalog has no user mosaic. Verify with `npm run build` and `npm run test -- src/main`.
- [ ] 6.3 Document the new stage options, `changeStageUserCatalog` and `refreshStageCatalog` in `docs/modules/lib/core/stage/README.md`, and the start order in `docs/modules/main/README.md`. Verify that the documented option names match `StageOptions`.

## 7. App dialogs and the user catalog store

- [ ] 7.1 Add `src/main/user_catalog/user_catalog_store.ts`. It holds the entries, applies changes through the `BrowserDatabase`, then calls `changeStageUserCatalog`, tells recently used to forget removed addresses (`recently-used`, "Removed user mosaics are forgotten"), and after the first stored file asks `navigator.storage.persist()` and keeps the answer. Unit-test it with a memory database and a fake `navigator.storage`. Verify with `npm run test -- src/main/user_catalog src/main/settings/recently_used`.
- [ ] 7.2 Add `ImportDialog`: "Choose files…", "Choose folder…", the drop zone (`webkitGetAsEntry` for folders), the review list with its status badges (success, warning, outline, destructive), checkboxes, the ignored-files count, the warnings and "Import". Render it from `ActionDialog` for `catalogImport` (design, decision 6). First write React Testing Library tests: picking files, the review statuses, "Import" disabled with nothing checked, applying, Cancel and Escape resolving with `false`, and the store-refused error. Verify with `npm run test -- src/main/user_catalog`.
- [ ] 7.3 Add `UpdateDialog`, `AddMosaicDialog`, with its suggested address, reading the file and the "already listed", 404 and wrong-scheme messages, and `RemoveMosaicDialog`, with title and place in its message. Write their RTL tests first, one per scenario of `user-catalog`'s "Update one entry", "Add by URL" and "Remove an entry". Verify with `npm run test -- src/main/user_catalog`.
- [ ] 7.4 Lay out the dialogs for a phone (`user-catalog`, "User catalog dialogs on a phone"): full width up to the viewport, a scrolling list, buttons and checkboxes at least 32px. Add `e2e/user_catalog.spec.ts` checks at `SMALL_PHONE_VIEWPORT` (360×740) from `e2e/layout_probes.ts` with a twelve-file review. Verify with `npm run test:e2e -- user_catalog`.
- [ ] 7.5 Check the review's status badges in the light and the dark color scheme with the theme probes, asserting the variants and a contrast of at least 4.5:1. Verify with `npm run test:e2e -- user_catalog`.
- [ ] 7.6 Add the `@storage` tag to `playwright.config.ts`, run in Firefox and WebKit as `@frames` is (design, decision 9), and document it in the config's comment. In `e2e/user_catalog.spec.ts`, tagged `@storage`:
  - import a folder with `setInputFiles` on the folder input, open the stored mosaic, and reload: it is still listed and opens;
  - drop a folder;
  - update, export (the download's name and text), remove, and opening a removed address;
  - the refused store, with IndexedDB made to fail.

  Verify with `npm run test:e2e -- user_catalog` in all three engines.
- [ ] 7.7 Document the dialogs, the store and the persistence request in `docs/modules/main/README.md`, and the trust of stored and added mosaics in `docs/modules/mosaics/README.md`'s "Trust". Verify that every dialog label the docs name matches the UI.

## 8. Settings

- [ ] 8.1 Add the user's mosaics to the Catalog group (`app-settings`, "Settings page" and "Your mosaics in Settings"): the counts, the persistence state with the export suggestion, and "Remove all" with its confirmation. First update `SettingsPage.test.tsx` for the empty state, the counts, the not-persisted text and "Remove all". Verify with `npm run test -- src/main/settings`.
- [ ] 8.2 Add to `e2e/app_settings.spec.ts`: "Remove all" empties the mosaic explorer without reloading its frame, and the group at 360×740. Verify with `npm run test:e2e -- app_settings`.
- [ ] 8.3 Update `docs/modules/main/settings/README.md`'s "Catalog" bullet. Verify that it names the same texts as the UI.

## 9. Mosaic explorer and viewer

- [ ] 9.1 In `mosaic_explorer`, add the place badge ("Browser" secondary, "Remote" outline), `Added by you`, and the "Import…" and "Add by URL…" outline buttons with their status region (`default-mods`, "Mosaic explorer shows where mosaics live" and "Mosaic explorer imports and adds mosaics"). First add the cases of "Mosaic explorer and viewer cases" to `default_mods/mosaic_explorer/test/`, with a fixture mosaic marked `place: "browser"` and a `provenance`. Verify with `npm run build` and by checking `mosaic_explorer` in the mod viewer, or with `npm run test:e2e -- default_mods`.
- [ ] 9.2 In `mosaic_viewer`, read `catalog.list` for the target, and follow `catalog.changed`. Show "Where it comes from" for a user mosaic, with "Update from file…", "Export" and "Remove", or "Remove" only, and the status after a removal (`default-mods`, "Mosaic viewer shows where a user mosaic comes from" and "Mosaic viewer updates, exports and removes user mosaics"). First add its cases. Verify with `npm run build` and `npm run test:e2e -- default_mods`.
- [ ] 9.3 Add to `e2e/default_mods.spec.ts`:
  - importing through the explorer lists the mosaic with "Browser" without reloading the frame;
  - the viewer of a stored mosaic, and "Remove" there;
  - at 360×740, the explorer's badges and buttons and the viewer's section, without sideways scrolling;
  - the place badges in the light and the dark color scheme.

  Verify with `npm run test:e2e -- default_mods`.
- [ ] 9.4 Update `docs/modules/mosaics/explorer/README.md` and `docs/modules/mosaics/viewer/README.md` with the badges, the buttons, the section, the requests they send and their cases. Verify that the requests they name match the sources.

## 10. Release and verification

- [ ] 10.1 Add `.changeset/add-user-catalog.md` with a `patch` bump, since the mod API bump is a patch and nothing breaks for users or instantiations ("Bump rule" in `docs/releasing.md`). Add a one-line summary: users can import mosaics from their files into this browser, add mosaics by URL, and update, export and remove them, and the mosaic explorer shows where each mosaic lives. Verify the file follows the format of the other files in `.changeset/`.
- [ ] 10.2 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and, since the change touches the specs of the mod API (`mod-engine-api`, `mod-api-version`, `mod-app-actions`), `npm run test:e2e:samples`. Verify each passes.