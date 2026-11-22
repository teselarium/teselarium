# Tasks

The tasks use the names of `add-user-catalog` (`BrowserDatabase`, `planImport`, `applyReview`, the `userCatalog.*` handlers, `UserCatalogDialog`).

## 1. Comment-keeping edits of a mosaic file

- [x] 1.1 Add the `yaml` dependency. Add `src/lib/mosaic/mosaic_document.ts` with `applyMosaicEdits(content, edits)` (design, decision 1), which:
  - applies `title`, `description`, `mod`, `collection`, `aliases` and `show` with the document API;
  - removes keys set to `null`;
  - checks the result with `parseYaml` and `buildLoadedMosaic`;
  - refuses unknown keys and text that doesn't parse, with errors that name the key or the parse error.

  Write its unit tests first:
  - a title change touching one line, with a comment above `config` kept;
  - an alias added to a mosaic without aliases;
  - `show` lines replaced;
  - `description: null` removed;
  - quoted, unquoted and date-like strings kept;
  - an anchor left untouched;
  - unknown key and broken text errors.

  Verify with `npm run test -- src/lib/mosaic/mosaic_document`.
- [x] 1.2 Add `makeCopyDraft(content, original)` in the same module: it rewrites a relative `mod` and `collection` as the absolute addresses they resolve to from `original` (`mosaic-editing`, "Copies have absolute references"). Add `buildNewDraft(mod, collection, show)`, the "Untitled mosaic" skeleton with those edits. Write their tests first, including a copy of `nobel_books_list.yaml`'s text. Verify with `npm run test -- src/lib/mosaic`.
- [x] 1.3 Document the module in `docs/modules/lib/mosaic/README.md`: what an edit can set, what it keeps, and why loading still uses `js-yaml`. Verify that the README's example edit gives the text its test expects.

## 2. Validating drafts, and the engine's draft requests

- [x] 2.1 Add `validateMosaicDraft(content, address, options)` in `src/lib/core/engine/` (design, decision 2). It builds the draft from text, refuses a relative reference in a new draft, loads the mod, its tile type and the collection through the given fetch options, and returns errors with lines, the warnings of `checkMosaicAliases` and `checkMosaicConfig`, `typeFields`, sorted `collectionFields`, and `tiles` from `countMatchingTiles` after `applyMosaicAliases`. Add the 30-second load cache per session. Write the tests first with fetch fakes, one per scenario of `mosaic-editing`'s "Validating a draft" and "Hints of a draft", plus a cached second call making no request. Verify with `npm run test -- src/lib/core/engine/mosaic_draft`.
- [x] 2.2 Add the handlers of `mosaics.validate` (params, `open` for the mod's and the collection's origins with `-32002`) and `mosaics.edit` (params and `Draft edits` with `-32602`). Add `content` to `mosaics.inspect`'s answer. Write the handlers' tests first. Verify with `npm run test -- src/lib/core/engine`.
- [x] 2.3 Document `mosaics.validate`, `mosaics.edit` and the inspection's `content` in `docs/modules/lib/core/engine/README.md`: the methods table, and a "Validating and editing a mosaic draft" section. Add their types to `default_mods/mod_api.d.ts`, keeping `mod_api_types.test.ts` passing. Verify with `npm run build`.

## 3. Database version 2: versions

- [x] 3.1 Raise the `opentesela` database to version 2 (design, decisions 3 and 4):
  - the `versions` store, keyed by `[address, savedAt]` with an `address` index;
  - the upgrade writes one `"imported"` version per stored entry and sets its `syncedAt`;
  - a failed upgrade resolves `openBrowserDatabase` to `null`, as any failed opening does;
  - the connection closes on `versionchange`, and a `blocked` opening is reported, so the user catalog store can say that another tab must be closed or reloaded (design, "Risks").

  Extend `BrowserDatabase` with `readVersions(address)`, and let `apply` put and delete versions. Implement both in the memory database, and write its tests first: versions newest first, and deleting an entry's versions with the entry. Write the tests of `openBrowserDatabase` with a stubbed `IDBFactory` for the failed upgrade and for `blocked`. Verify with `npm run test -- src/lib/core/storage`.
- [x] 3.2 Add an e2e test tagged `@storage` in `e2e/user_catalog.spec.ts`: a version 1 database with one stored mosaic, written by the test with IndexedDB, opens at version 2 with the mosaic listed and its history holding one "Imported" version. Verify with `npm run test:e2e -- user_catalog` in all three engines.
- [x] 3.3 Document the store, the upgrade and the pruning in `docs/modules/lib/core/storage/README.md`. Verify that the documented key and index match `browser_database.ts`.

## 4. The user catalog: versions, sync state, conflicts, saves

- [x] 4.1 In `src/lib/user_catalog/`, add `syncedAt` to stored entries and compute `changedSinceExport` (`user-catalog`, "Changed since export"). Add `pruneVersions(versions, syncedAt)`, keeping 20 newest plus the synced one. Write the tests first, including the "Twenty-second save" scenario. Verify with `npm run test -- src/lib/user_catalog`.
- [x] 4.2 Extend `planImport` with the statuses of "Status of a matching file", from the file, the stored text and the synced text. Extend `applyReview` with the conflict choices "Keep mine", "Take the file" and "Keep both" (the `<name> (from file).yaml` entry), a version for every replaced text, and the update warning of "Updating keeps local changes in history". Write the tests first, one per scenario of those requirements. Verify with `npm run test -- src/lib/user_catalog`.
- [x] 4.3 Add `planSave(draft, entry | null, copiedFrom, now, kind)`, which returns the `BrowserDatabaseChanges` of a save or a restore: a new root and a file name from the title for a new mosaic (`mosaic-editing`, "Saving a new mosaic"), a version, the update time, and pruning. Write the tests first: title to file name, the `mosaic.yaml` fallback, the copy's provenance, and a restore's `"restored"` kind. Verify with `npm run test -- src/lib/user_catalog`.
- [x] 4.4 Add the `fflate` dependency and `buildFolderArchive(entries, folder)`, which returns the `.zip` bytes with each entry at its path, and the changes that set `syncedAt` (design, decision 7). Write its tests first: unzip the bytes with `fflate` and compare the paths and texts. Verify with `npm run test -- src/lib/user_catalog`.
- [x] 4.5 Add the new provenance keys `changedSinceExport` and `copiedFrom` to the catalog entries (`buildCatalog`), to `default_mods/mod_api.d.ts`, and to the test runner's scripted catalog, which completes them as `mod-tests`, "Scripted catalog", says. Write the tests first in `catalog.test.ts` and the runner's tests. Verify with `npm run test -- src/lib/core/engine` and `npm run test:e2e -- mod_tests`.
- [x] 4.6 Update `docs/modules/lib/user_catalog/README.md` with the sync state, the statuses, the conflict choices, saves, restores and the folder archive. Verify that every status it names matches `planImport`.

## 5. Dialog requests and the mod API version

- [x] 5.1 Add the handlers of `userCatalog.save`, `userCatalog.history` and `userCatalog.exportFolder`, with their params (`-32602`), stored-entry and folder checks, and the visible-mod rule (`-32002`). Add the app actions `catalogSave` and `catalogHistory`. Folder export builds a `SaveFileAction` from `buildFolderArchive`. Write the handlers' tests first. Verify with `npm run test -- src/lib/core/engine/user_catalog_methods`.
- [x] 5.2 Bump `MOD_API_VERSION` to `0.1.19`. Add the surface guard's `0.1.19` entry with `mosaics.validate`, `mosaics.edit`, `userCatalog.save`, `userCatalog.history` and `userCatalog.exportFolder`. Add the engine README's version note: additions, so a patch. Verify with `npm run test -- src/lib/core/engine/mod_api_surface`.
- [x] 5.3 Let `answer` queue `userCatalog.history` and `userCatalog.exportFolder` with a boolean, and `userCatalog.save` with a mosaic address or `null`, refusing other values (`mod-tests`, "Scripted answers"). Document them in `docs/mod_plugin_spec.md`. Verify with new `e2e/mod_tests.spec.ts` cases for "Save answered" and "Wrong save answer": `npm run test:e2e -- mod_tests`.
- [x] 5.4 Add to `e2e/mod_engine_api.spec.ts`: `mosaics.edit`'s unknown edit, `mosaics.validate` without `open`, `userCatalog.save` without `content`, and `userCatalog.exportFolder` for an unknown folder. Add to `e2e/mod_app_actions.spec.ts` the hidden mod's `userCatalog.save`. Verify with `npm run test:e2e -- mod_engine_api mod_app_actions`.

## 6. App dialogs

- [x] 6.1 Add `SaveMosaicDialog` in `src/main/user_catalog/`, rendered by `UserCatalogDialog` for `catalogSave`. It validates the draft, diffs it with the saved version (title, description, mod, collection, aliases by field, config by key, `show` lines), shows added hosts as warning badges and removed ones as outline badges, offers only "Close" with errors, and on "Save" runs the steps of design, decision 5. First write the RTL tests: a new host highlighted, a draft with errors, Cancel and Escape, the address resolved for a new mosaic, and the Allow decisions written to the site decisions store. Verify with `npm run test -- src/main/user_catalog`.
- [x] 6.2 Add `HistoryDialog`, rendered by `UserCatalogDialog` for `catalogHistory`: versions newest first, with time and kind, "Restore" for all but the current one, opening `SaveMosaicDialog` with kind `"restored"`. First write its RTL tests: the list's order and kinds, and restoring the imported version. Verify with `npm run test -- src/main/user_catalog`.
- [x] 6.3 Extend `ImportDialog` and `UpdateDialog` with the new statuses, their badge variants in `review_statuses.ts` (`user-catalog`, "User catalog dialog colors"), the conflict choices as a radio group per conflict ("Import" stays disabled until each conflict has a choice, or until something else is checked), and the update warning. First update their RTL tests for each scenario of `user-catalog`'s new requirements. Verify with `npm run test -- src/main/user_catalog`.
- [x] 6.4 Add to `e2e/user_catalog.spec.ts`:
  - save a copy, then open it: no site consent dialog for its lines, and Settings lists them as allowed;
  - a conflict on re-import with "Keep both";
  - export the folder and check the download's name, and the zip's paths and texts;
  - at `SMALL_PHONE_VIEWPORT` (360×740), the save confirmation with eight changes and the history dialog, without sideways scrolling and with 32px buttons;
  - the added-host badge, and the "Changed here only" and "Changed here and in the file" status badges, in the light and the dark color scheme, at a contrast of at least 4.5:1.

  Verify with `npm run test:e2e -- user_catalog`.
- [x] 6.5 Document the save confirmation, consent at save, history and conflicts in `docs/modules/main/README.md`. Add consent at save to `docs/modules/mosaics/README.md`'s "Trust" and `docs/modules/lib/core/sandbox/README.md`'s "Permissions of a mosaic". Verify that every label the docs name matches the UI.

## 7. The stage bar's edit button

- [x] 7.1 Replace the pinned edit row with the stage bar's edit button (design, decision 9). Remove the row from `src/main/stage/mosaic_list.ts`, `combination_rows.ts` and `CombinationList.tsx`, and its tests from `list_rows.test.ts`, `CombinationList.test.tsx` and `CombinationLists.test.tsx`. Move its name and link logic into a pure helper, and render the button in `StageBar.tsx` between `SitesChip` and `MoreActionsMenu`. First write the tests: the three names ("Edit mosaic", "Edit a copy", "Edit as a new mosaic"), no button for a tile link or a plain title, the links of `stage-bar`, "Edit button links", with `draft_sites`, and the button's place in the bar. Verify with `npm run test -- src/main/stage`.
- [x] 7.2 Move the edit button into "More actions" under 288px of bar width (design, decision 9, "Down to a phone"): `useNarrowStageBar` also answers whether the content width is under 262px, `StageBar` drops the button and passes the action to `MoreActionsMenu`, which shows it with the pencil, and the bar's content key follows. First write the tests in `use_narrow_stage_bar.test.tsx` and `MoreActionsMenu.test.tsx`: the item under 288px with the button's name, choosing it opens the viewer's link, no item on a wider bar. Verify with `npm run test -- src/main/stage`.
- [x] 7.3 Align the "More actions" items (design, decision 10): "Theater mode" gets the other items' padding, and its check sits at the item's end, without editing `src/vendor/`. First add to `MoreActionsMenu.test.tsx` that the check of a checked "Theater mode" comes after its label. Verify with `npm run test -- src/main/stage`.
- [x] 7.4 Keep the folded capsule's mosaic look (design, decision 10): in `CombinationTitle.tsx`, the folded capsule always has the mosaic icon and the mosaic capsule's title, dashed for a combination, named "Combination: <title>", and its menu rows say "Mosaic: <title>", "Mod: <title>" and "Collection: <title>". First update the tests in `CombinationLists.test.tsx` or `StageView.test.tsx` for an unsaved combination and the rows' names. Verify with `npm run test -- src/main/stage`.
- [x] 7.5 Update `e2e/stage_bar.spec.ts`: "Edit as a new mosaic" from Flashcards with the laureates opens the mosaic viewer in edit mode, and back returns to Flashcards; the mosaic list has no edit row; at 360×740, the button is at least 32px and inside the bar, the capsule is at least 80px wide and shows the start of its title, and a tap opens the viewer. Update the stage bar's other tests to the specs:
  - "The title is readable on a phone": at least 80px;
  - the icons-only step at 660px in "Each step of the ladder" and "Folding follows the space left", and "Capsules never break" at 630px;
  - the folded menu's rows named "Mosaic: <title>", "Mod: <title>" and "Collection: <title>", here and in every e2e file that opens them;
  - at 320×640, no edit button, "Edit a copy" in "More actions" opens the viewer, and no sideways scroll;
  - at 360×740 with theater mode on, the menu's icons share their left edge within 1 pixel;
  - from "Nobel laureates on the map" folded at 400px, choosing Flashcards in the mod list leaves a folded capsule with the mosaic icon, "Unsaved combination" and its dashed border.

  Verify with `npm run test:e2e -- stage_bar`, then `npm run test:e2e`.
- [x] 7.6 Replace the edit row and "Save as mosaic" with the edit button, its names and its place in "More actions" under 288px in `docs/modules/main/README.md`'s stage bar section, `docs/modules/mosaics/viewer/README.md` and `docs/modules/mosaics/maker/README.md`. In the main README, also update the folded capsule's description (the mosaic's look, the rows' names) and the menu's items. Verify with a search that no doc names "Save as mosaic" or the edit row, and that the documented names match the bar.

## 8. Mosaic viewer edit mode and the explorer's mark

- [x] 8.1 In `default_mods/mosaic_viewer/`, add the "Edit" and "Edit a copy" buttons and the modes of the `mode` parameter, with the alert for a mode it cannot use (`default-mods`, "Mosaic viewer edits mosaics" and "Mosaic viewer modes from the link"). Drafts start from `mosaics.inspect`'s `content`, `mosaics.edit` and the skeleton (design, decision 8). First add the cases for each mode to `test/`. Verify with `npm run build` and `npm run test:e2e -- default_mods`.
- [x] 8.2 Add the edit page, whose form shows the `draft` fields of the latest `mosaics.validate` answer: the "Form" tab (fields, alias rows with the collection's names as suggestions, `show` rows, read-only config beside the mod's defaults), the "YAML" tab (textarea, problems with "Line <n>", the form disabled while the text can't be read), and the hints, validated half a second after typing with the newest answer winning. First add the cases: an alias from a suggestion through `mosaics.edit`, broken YAML, and a stale validation answer ignored. Verify with `npm run test:e2e -- default_mods`.
- [x] 8.3 Add the kept draft (`draft_store.ts`): "Restore draft" and "Discard", "Cancel" asking with `ui.confirm` when there are changes, and a draft dropped when its stored target no longer inspects, never because an early `catalog.list` lacks it (design, decision 8, "Stored or not"). Add saving: "Save", Ctrl+S and Cmd+S, `copiedFrom` for a copy, `mods.open` with `replace: true` to the saved address, and `null` keeping edit mode. First add the cases, including "Save in a viewer case". Verify with `npm run test:e2e -- default_mods`.
- [x] 8.4 Extend the "Where it comes from" section with "History…", "Export folder" and "Changed since export" (`default-mods`, "Mosaic viewer updates, exports and removes user mosaics"). In `mosaic_explorer`, add the "Changed since export" warning badge. First add the cases. Verify with `npm run test:e2e -- default_mods`.
- [x] 8.5 Add to `e2e/default_mods.spec.ts`:
  - edit a copy of a sample, change an alias, save, and see the explorer list it with "Changed since export";
  - at 360×740, the edit form in one column without sideways scrolling;
  - the "Changed since export" badge in the light and the dark color scheme.

  Verify with `npm run test:e2e -- default_mods`.
- [x] 8.6 Update `docs/modules/mosaics/viewer/README.md` (edit mode, its parameters, requests and cases) and `docs/modules/mosaics/explorer/README.md` (the mark). Point `docs/modules/mosaics/maker/README.md` to the viewer's edit mode, which takes the maker's role. Verify that the requests the READMEs name match the sources.
- [x] 8.7 Title a new draft after its combination (`mosaic-editing`, "Title of a mosaic from a combination"; design, decision 8): in `edit_start.ts`, read the mod's and the collection's titles with `mods.inspect` and `collections.inspect`, and send `title` with the draft's first `mosaics.edit`, keeping "Untitled mosaic" when either fails. First update the `mode=new` case and add one where the collection cannot be inspected. Update the new mosaic's title in `docs/modules/mosaics/viewer/README.md`. Verify with `npm run test:e2e -- default_mods stage_bar`.

## 9. Release and verification

- [x] 9.1 Add `.changeset/add-mosaic-editing.md` with a `patch` bump, since the mod API bump is a patch and nothing breaks for users or instantiations ("Bump rule" in `docs/releasing.md`). Add a one-line summary: users can edit mosaics stored in this browser, save copies of any mosaic or an unsaved combination as a mosaic, see their history, resolve conflicts on re-import and export a folder as a `.zip`. Verify the file follows the format of the other files in `.changeset/`.
- [x] 9.2 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and, since the change touches the specs of the mod API (`mod-engine-api`, `mod-api-version`, `mod-app-actions`), `npm run test:e2e:samples`. Verify each passes.
