# Tasks

## 1. Catalog value and start checks (engine)

- [ ] 1.1 Add `src/lib/core/engine/app_catalog.ts` with `AppCatalog`, `ResolvedAppCatalog` and `resolveAppCatalog(catalog, baseUrl, defaults)`: resolves each list with its kind's resolver, drops switched-off default mods (`findSwitchedOffMod`), and returns an error for an empty entry, an entry that cannot be resolved, and an entry that repeats an earlier one of its list, each naming the list and the entry as written. Export it from the engine's `index.ts`. Verify with `app_catalog.test.ts`, which covers the `app-catalog` scenarios "Entries are resolved by kind", "Default mod name", "Two references to one mod", "Empty entry" and "Switched-off tile viewer".
- [ ] 1.2 Document the catalog in the engine README, in a "App catalog" section next to "Default mod settings" (what the instantiation sets, how each kind resolves, the start errors). Verify that the section's example matches the vanilla catalog of task 5.1.

## 2. `catalog.list` and the mod API (engine)

- [ ] 2.1 Add `buildCatalogListing(catalog, includesDefaultMosaics, fetchOptions)` (design: "One listing builder…"). With the switch off it fetches nothing. With it on, it loads each catalog mod file without its entrypoint, in parallel, keeps catalog order, skips failed mods and mods without `default_mosaic`, dedupes by source, and marks each added mosaic with `{ source, title }` of its mod. Verify with unit tests for the "Vanilla default mosaics", "Mod that cannot be loaded" and "Default mosaic also in the catalog" scenarios, using a fake fetch that records requests (no `main.js` or `mosaic.yaml` requested).
- [ ] 2.2 Add `readCatalog` to `ModMethodContext` and `ModSessionOptions`, and add `catalog_methods.ts` (`CATALOG_METHODS` with `catalog.list`, no permission check, params ignored) to `ENGINE_METHODS`. Verify with `catalog_methods.test.ts` covering "Vanilla catalog", "Default mosaic entry" and "Mod without permissions", called with a plain context as the other handler tests are.
- [ ] 2.3 Add `pushCatalogChanged(session, listing)` in `mod_session.ts`, next to `pushThemeChanged`. Verify with a `mod_session.test.ts` case that a running session posts one `catalog.changed` with the listing as params, and a stopped session posts nothing.
- [ ] 2.4 Bump `MOD_API_VERSION` to `0.1.15`. Add the `0.1.15` surface guard entry with `catalog.list` and `catalog.changed`. Type the request, the event and `CatalogListing` in `default_mods/mod_api.d.ts` and check them in `mod_api_types.test.ts`. Update the scenarios of `mod-api-version` tests that pin the version. Verify `npm run test` passes the surface guard, the type test and the version tests, and `tsc -b` passes.
- [ ] 2.5 Update the engine README: `catalog.list` in the methods table, `catalog.changed` in the events table, `catalog_methods.ts` in "Request handlers", and a `0.1.15` version note (addition: patch). Verify each new name appears in the README and links resolve.

## 3. Stage wiring and the switch's push

- [ ] 3.1 Add `catalog: ResolvedAppCatalog` and `catalogDefaultMosaics: boolean` to `StageOptions`. Store them on `Stage`, and pass a `readCatalog` built on `buildCatalogListing` through `SandboxServices` and `CheckServices` to every session, checks included. Verify with a `stage_controller.test.ts` case where a running sandbox's `catalog.list` gets the stage's catalog, and one where a check's session gets it too.
- [ ] 3.2 Add `changeStageCatalogDefaultMosaics(stage, isOn)`. It stores the flag, builds the listing once, and pushes `catalog.changed` to every running sandbox, visible or hidden, through a new `pushSandboxCatalog`. A generation counter drops a listing that finished after a newer change. Export it from the stage's `index.ts`. Verify with stage tests for "Switched on while a mod runs", "Hidden mod", a later `catalog.list` giving the same catalog, and two quick toggles ending on the second value.
- [ ] 3.3 Document the catalog and the switch's push in the stage README, next to the tile-linked-media setting. Verify the section names `changeStageCatalogDefaultMosaics` and `catalog.changed`.

## 4. Scripted `catalog.list` answers (test API)

- [ ] 4.1 In `sandbox_test_runner.js`, add the `catalog` answer kind for `catalog.list`. Its check normalizes missing lists and `defaultOf`, and throws `the answer to catalog.list must be a catalog` with the bad key. Widen `AnswerMethod` and the queued value in `sandbox_messages.ts` and `stage_check_cases.ts`, so the case queue answers `catalog.list` before `readCatalog`, and an unanswered one reaches `readCatalog`. Update the error text that lists the answerable methods. Verify with unit tests of the stage's case queue, and with e2e cases in `e2e/mod_tests.spec.ts` for "Fixture catalog", "Wrong catalog" and "Case without a scripted catalog".
- [ ] 4.2 Document `answer("catalog.list", catalog)` and the unanswered behavior in "Scripted answers" of `docs/mod_plugin_spec.md`, with the API version it was added in. Verify that the text matches the `mod-tests` delta.

## 5. App: vanilla catalog, start errors and the Settings switch

- [ ] 5.1 Add `src/main/app_catalog.ts` with `APP_CATALOG`, the vanilla catalog of the `app-catalog` "Vanilla catalog" requirement: the explorers' current config lists, moved. In `src/main.tsx`, run `resolveAppCatalog` next to `validateRegistry`, and pass the resolved catalog to `createStage`. Verify with a unit test that the vanilla catalog resolves with no errors and holds no fixture, default mod or default mosaic.
- [ ] 5.2 Replace `RegistryErrorScreen` with `StartErrorScreen`, which lists the registry's and the catalog's errors under their own titles, and use it in `main.tsx`. Verify with a component test that shows catalog errors with the catalog title and registry errors with the registry title, and that the existing registry error tests still pass.
- [ ] 5.3 Add `src/main/settings/catalog_setting.ts`, mirroring `tile_media_setting.ts`. Key `opentesela.catalog-default-mosaics`, on only when the stored value is `true`. It calls `changeStageCatalogDefaultMosaics` on change. Pass its start value to `createStage` in `main.tsx`. Verify with `catalog_setting.test.ts` for "Kept after a reload", "Unknown stored value" and "Storage cannot be written".
- [ ] 5.4 Add the Catalog group to `SettingsPage.tsx`, after the Sidebar group, with the switch "List the default mosaics of mods" and the sentence that it helps when writing a mod. Verify with `SettingsPage.test.tsx` for the "Vanilla settings page" scenario's Catalog line, and with an `e2e/app_settings.spec.ts` test for the group's place and default.
- [ ] 5.5 Document the catalog for instantiators in `docs/modules/main/README.md` (where `APP_CATALOG` lives, the start errors, switched-off mods), and the Catalog group in the Settings docs. Verify the README's example matches `APP_CATALOG`.

## 6. Explorers list the catalog

- [ ] 6.1 Mod explorer: read the mods from `catalog.list` instead of `config.mods`, show the source of a mod that cannot be inspected, re-list on `catalog.changed` (latest list wins, busy while loading), and remove `mods` from `mod_conf.yaml`. Update its cases to answer `catalog.list` with its fixture mod before mounting, including a missing fixture source for the alert case. Verify the mod explorer's check passes in `e2e/default_mods.spec.ts`, and update the e2e "Mod explorer" and "Mod explorer vanilla config" tests to the vanilla catalog and resolved sources.
- [ ] 6.2 Collection explorer: the same for `collections`. Verify that its cases pass in its check and that the e2e "Collection explorer" tests pass, "Explorer requests no tile" included.
- [ ] 6.3 Mosaic explorer: the same for `mosaics`. Also draw `Default mosaic of <title>` as a `<small>` under a card's `<h2>` when the entry has `defaultOf`. Add a case for the mark with a fixture `defaultOf`. Verify that its cases pass in its check. Add e2e tests for "Vanilla default mosaics" (switch on), "Only the sample mosaics" (switch off) and "Switch turned on behind the explorer" (the frame is not reloaded).
- [ ] 6.4 Update the explorers' component docs (`docs/modules/mods/explorer/`, `docs/modules/tiles/explorer/`, `docs/modules/mosaics/explorer/`) and the Tests paragraph of `default_mods/README.md`: entries come from the catalog, cases script `catalog.list`. Verify that no doc still names the removed config keys (`grep` for `config.mods`, `collections:` and `mosaics:` under the explorers' docs).
- [ ] 6.5 Check the "Default mod test fixtures" scenarios: in an app built without `samples/`, the three explorers' checks pass. Verify with the existing e2e test of default mods' checks in that build.

## 7. Release note

- [ ] 7.1 Add `.changeset/add-app-catalog.md` with a `patch` bump for `opentesela`: the mod API patch `0.1.15` means an app patch, and no instantiation option exists yet to break. Its summary: "The app has one catalog of the mods, collections and mosaics it offers, which the Mods, Tiles and Mosaics explorers list, with a Settings switch to also list mods' default mosaics (mod API 0.1.15: `catalog.list`, `catalog.changed`)." Verify the file follows the format of the other changesets.

## 8. Verification

- [ ] 8.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and, because the change touches the mod API specs, `npm run test:e2e:samples`. Verify that each passes.
