# Tasks

## 1. Before starting

- [ ] 1.1 Confirm that `add-mosaics` and `rework-mod-file-format` are archived. `openspec list --json` must show neither, and `openspec/specs/mosaic-loading/` must exist. Then confirm that `openspec validate add-mosaic-explorer --strict` passes against the updated main specs.

## 2. Sample mosaics

- [ ] 2.1 Add `public/samples/mosaics/nobel_books_list.yaml` and `public/samples/mosaics/nobel_laureates_map.yaml`, as design D5 describes: titles, descriptions, `mod` and `collection` folder references, `columns: 8`, the aliases, and the `show` lines with their reasons. Verify that each opens at `#/run?mosaic=…` in `npm run dev` with no dialog and no warning, and that `mosaics.check` of each reports `"pass"`. For the check, use the mod viewer's probe, or a unit test of the bundle check with the files as fixtures copied into the test's own fixtures.
- [ ] 2.2 Add `e2e/sample_mosaics.spec.ts`, tagged `@sample`, with covers and portraits routed by `routeCovers`, for every `sample-mosaics` scenario:
  - the 51 books at 8 per row;
  - the redirected Open Library cover;
  - the 17 laureates on the map;
  - Bob Dylan's card without `name` or `birth_country`;
  - both checks passing.

  Verify with `npm run test:e2e:samples`.

## 3. Mosaic explorer

- [ ] 3.1 Create `default_mods/mosaic_explorer/` on the model of `collection_explorer`:
  - `mod_conf.yaml` with title "Mosaics", `api: "^0.1.0"`, `test_path`, config `viewer: "mosaic_viewer"` and the two sample `mosaics`, and `open` for `"*"`;
  - `src/` with the page, the busy list, the cards (title, description, a primary "Open" and an outline "View", named "Open <title>" and "View <title>"), the alerts and the `role="status"` region for refusals.

  Verify that `npm run build` serves `dist/default_mods/mosaic_explorer/main.js`, and that `#/run?mod=mosaic_explorer` lists the two samples.
- [ ] 3.2 Add its `fixtures/` (`listed_mosaic.yaml`, `other_mosaic.yaml`) and its `test/` cases for the "Mosaic explorer and viewer cases" scenarios:
  - listing the fixtures;
  - a location that cannot be inspected;
  - "Open" sending `mosaics.open`;
  - "View" sending `mods.open` with `target`;
  - its look (cards, alert, busy list).

  Verify that checking `mosaic_explorer` in the mod viewer reports `"pass"` with every case passed.
- [ ] 3.3 Add e2e tests in `e2e/default_mods.spec.ts` for the "Mosaic explorer" and "Mosaic explorer opens and views mosaics" scenarios: no mod, collection or tile requested; the Mosaics item current after "Open" and "View"; a switched-off `mosaic_viewer`. Also add "Mosaic explorer passes its check". Verify with `npm run test:e2e`.
- [ ] 3.4 Write `docs/modules/mosaics/explorer/README.md` (what it does, config, tests, links), on the model of `docs/modules/tiles/explorer/README.md`. Verify that its links table matches the addresses the tests of 3.3 assert.

## 4. Mosaic viewer

- [ ] 4.1 Create `default_mods/mosaic_viewer/`:
  - `mod_conf.yaml` with title "Mosaic Viewer", `api: "^0.1.0"`, `test_path`, config `mod_viewer: "mod_viewer"` and `collection_viewer: "collection_viewer"`, and `open` for `"*"`;
  - `src/` drawing the sections of design D3 from `mosaics.inspect`, then `mods.inspect` and `collections.inspect` in parallel, each failure in its own section's alert;
  - the "no mosaic was given" page.

  Verify at `#/run?mod=mosaic_viewer&target=./samples/mosaics/nobel_laureates_map.yaml` that the "Mosaic viewer" and "Mosaic viewer shows its mod and collection" scenarios hold.
- [ ] 4.2 Add the actions:
  - "Open mosaic" (`mosaics.open`), the primary action;
  - the mod and collection title buttons (`mods.open` with `target`);
  - "Check mosaic" (`mosaics.check`), disabled while it runs, with a `role="status"` message.

  Render the report with `src/check_report.ts`, copied from `mod_viewer`'s rendering without the tests list (design D4), and note the copy in both mods' READMEs. Verify the "Mosaic viewer opens and checks the mosaic" and "Mosaic viewer links its mod and collection" scenarios in `npm run dev`.
- [ ] 4.3 Add its `fixtures/` (design D7) and its `test/` cases for the viewer half of "Mosaic explorer and viewer cases":
  - the metadata, the mod and collection, and a failing collection;
  - a missing, empty or untitled `target`;
  - both links, "Open mosaic", and "Check mosaic" with an answered `"warn"` report;
  - its look.

  Verify that checking `mosaic_viewer` reports `"pass"` with every case passed, also in an app built without `samples/` ("Mosaic cases without the samples").
- [ ] 4.4 Add e2e tests in `e2e/default_mods.spec.ts`:
  - opening the mosaic, from which the country map runs with the aliased laureates;
  - opening the mod viewer and the collection viewer from the titles;
  - a real "Check mosaic" with a fixture mosaic whose alias names an unknown field;
  - "Mosaic viewer passes its check".

  Verify with `npm run test:e2e`.
- [ ] 4.5 Write `docs/modules/mosaics/viewer/README.md` (what it does, the app's look, config, tests, links), on the model of `docs/modules/mods/viewer/README.md`. Verify that its links table matches the addresses the tests of 4.4 assert.

## 5. The Mosaics section

- [ ] 5.1 Give `mosaics` in `src/main/sections/vanilla_sections.ts` the target `{ mod: { mod: "mosaic_explorer", collection: null, params: {} } }` and `comingSoon: false`. Move the coming-soon tests to a test registry with an `Atlas` section marked coming soon:
  - `Sidebar.test.tsx`, `SidebarItem` and `section_registry.test.ts`;
  - `SettingsPage.test.tsx`;
  - the e2e tests in `e2e/app_sidebar.spec.ts` and `e2e/app_settings.spec.ts`.

  Verify the `app-sidebar` and `app-settings` delta scenarios: Mosaics opens `#/run?mod=mosaic_explorer`; no vanilla item or switch says "Coming soon"; `Atlas` does; switching off `mosaic_explorer` removes Mosaics.
- [ ] 5.2 Update the section docs:
  - the registry table and coming-soon text in `docs/modules/main/README.md`, with Mosaics as a mod section;
  - the coming-soon example in `docs/modules/main/settings/README.md`, now an instantiation's section;
  - the shipped components in `docs/modules/README.md`;
  - the default mods list and tests list in `default_mods/README.md`;
  - the explorer and viewer links in `docs/modules/mosaics/README.md`.

  Verify that `grep -rn -i 'coming soon' docs default_mods` names Mosaics nowhere.

## 6. Release note

- [ ] 6.1 Add `.changeset/add-mosaic-explorer.md` with a `patch` bump, since the change adds features with no mod API change and breaks no user or instantiation. Give a one-line summary such as: "The Mosaics section lists the sample mosaics, opens them, and shows each one's mod, collection, overrides, aliases and permissions in a mosaic viewer that can check it." Verify that the file follows the format of the other `.changeset/*.md` files.

## 7. Verification

- [ ] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify that every command passes. This change touches `public/samples/`.

## Workflow follow-up

- Archive the change once it is reviewed and verified.
