# Tasks

## 1. Before starting

- [ ] 1.1 Confirm that `add-mosaics` is archived: `openspec list --json` no longer shows it, and `openspec/specs/mosaic-loading/` exists. Then confirm that `openspec validate rework-mod-file-format --strict` passes against the updated main specs.

## 2. Default mosaics in the mod file

- [ ] 2.1 Read the optional `default_mosaic` in `src/lib/mod/mod_format.ts`: a non-empty string, resolved against the mod file, never fetched. Carry it as `defaultMosaic` on `ModFile`, add it to `MOD_FILE_KEYS`, and answer it in `mods.inspect` (`mod_inspection.ts`). Keep `sample_collection` for now. Verify with unit tests for the scenarios "Default mosaic next to the mod file" and "Empty default mosaic", and the `defaultMosaic` of "Inspect the sample mod", including that `mosaic.yaml` is not requested.
- [ ] 2.2 Declare `defaultMosaic` on `ModInspection` in `default_mods/mod_api.d.ts`, and extend `mod_api_types.test.ts`. Verify with `tsc -b`.

## 3. Checks through mosaics

- [ ] 3.1 Refactor `runModBundleCheck` (`src/lib/core/engine/mod_bundle_check.ts`) to take a check target, `{ mod, collection }`, `{ mod }` or `{ mosaic }` (design D3):
  - load the mosaic and check that a default mosaic names its own mod;
  - refuse a switched-off mod as a `bundle` error;
  - apply the aliases before validation.

  A mod with `defaultMosaic` and no collection uses its default mosaic. A mod with only `sampleCollection` keeps using it until group 6. Verify with unit tests for the scenarios of "Check a mod", "Bundle check", "A default mosaic names its mod" and "Check a mosaic" (missing mosaic file, switched-off mod).
- [ ] 3.2 Add the mosaic findings (design D4): aliases for fields the tile type's `ref` definition does not declare, and config key paths the mod's config lacks. Verify with unit tests for every "Mosaic findings" scenario.
- [ ] 3.3 Give the mount check of `src/lib/core/stage/stage_checks.ts` the launch built for the target: merged config, aliased tiles, and grants with the mosaic's lines, where a foreign mosaic's lines count only with a remembered allow. Run tests only for a `mods.check`. Verify with an e2e test in `e2e/mod_check.spec.ts`, using a fixture mod whose default mosaic overrides config and declares `show` for a routed host: the scenario "Check with the default mosaic". Add another for "Foreign mosaic without decisions".
- [ ] 3.4 Add `mosaic` to the check report (`mod_check_report.ts`), and `mosaics.check` to `mosaics_methods.ts`, with the param, `open` and visible-only checks, through the stage's check hook. Verify with unit tests for "Mosaic check requests follow the open rules" and "Check report", and declare `mosaics.check` and the report's `mosaic` in `mod_api.d.ts` (`tsc -b`).
- [ ] 3.5 Document checks with mosaics in the engine README (Mod check, methods table) and in `docs/mod_plugin_spec.md` (Checking a mod). Verify that the documented report example has `mosaic` and matches a report from 3.4's tests.

## 4. Storage slots per context

- [ ] 4.1 Change `src/lib/core/storage/mod_storage.ts` to key values by `ModSlot` (`{ mod, context }`) as `JSON.stringify([mod, context, key])`. Make the session build the slot from its launch inputs (mosaic, collection, tile or `""`) and give it to `STORAGE_METHODS`. The check's throwaway storage stays unchanged. Verify with unit tests for every scenario of "Storage slots are separate per mod and context", including that a value under the former two-element key is not read.
- [ ] 4.2 Add an e2e test in `e2e/mod_engine_api.spec.ts`: a fixture mod stores a value with one collection, and gets `null` with another collection and from a mosaic. Document slots and contexts in `docs/modules/lib/core/storage/README.md` and the engine README's "Storage slots". Verify that the test passes and that the documented key format matches 4.1.

## 5. Mods move to default mosaics

- [ ] 5.1 Add a `mosaic.yaml` (`mod: "./"`, its collection, a `title`) and `default_mosaic: "./mosaic.yaml"` to each of these:
  - `public/samples/mods/book_list/`, `country_map/` and `flashcards/`;
  - `default_mods/tile_viewer/`, with collection `./fixtures/tiles_collection.yaml`;
  - `e2e/test_mods/tiles/`;
  - the `src/test/fixtures/mods/` mods;
  - the default mod fixtures that declare a sample collection.

  Move the `show` permissions of `book_list` and `country_map` into their default mosaics. Verify that `mods.check` of each of them passes (the e2e "Default mods ship their tests" and sample checks), and that the scenarios of the three sample "Mod file" deltas pass in `npm run test:e2e:samples`.
- [ ] 5.2 Mod viewer (`default_mods/mod_viewer/src/`):
  - drop the "Name" row and show "Default mosaic" with its address;
  - replace "Run with sample tiles" with "Open default mosaic", still the primary button, which sends `mosaics.open` with `defaultMosaic`;
  - update its fixtures (`listed_mod` with `default_mosaic`) and its cases (`run_cases.ts`), including "Open the default mosaic in a case".

  Verify that checking `mod_viewer` passes, and add an e2e test in `e2e/default_mods.spec.ts` for "Run with the sample tiles", where the viewed mod opens from its default mosaic with three tiles.
- [ ] 5.3 Update `docs/modules/mods/viewer/README.md`, `default_mods/README.md` (the tile viewer's default mosaic, fixtures) and the mod module README's sample list to say "default mosaic". Verify that no doc outside `openspec/` still tells authors to write `sample_collection`, except where it is called a former key (`grep -rn sample_collection docs default_mods public`).

## 6. Former mod file keys are removed

- [ ] 6.1 In `src/lib/mod/`:
  - require `title`;
  - stop reading `name` and `sample_collection`;
  - drop `name` and `sampleCollection` from `ModFile` and `MOD_FILE_KEYS`.

  In the engine, drop `name` from `mods.inspect` and from the mount context's `mod` (`mod_inspection.ts`, `mod_launch.ts`), and drop `sampleCollection` from the check pipeline. Make every mod file in the repository, the ones tests write inline included, carry a `title`. Verify with unit tests for the scenarios of "Mod file format", "Reject mod files with the wrong structure", "Load a mod from a location", "Sample collection outside the mod folder" and the mount context's "Sample mount context".
- [ ] 6.2 Remove `name` and `sampleCollection` from `default_mods/mod_api.d.ts`, and from the context's `mod`. Verify with `tsc -b` and `npm run lint`, and check that the e2e probes that read `context.mod` (`e2e/theme_probes.ts`, `e2e/layout_probes.ts`, `e2e/mod_routes.ts`) no longer read `name`.
- [ ] 6.3 Update the mod file docs:
  - the format table and examples in `docs/modules/lib/mod/README.md`;
  - every `mod_conf.yaml` example in `docs/mod_plugin_spec.md`, `docs/opentesela_spec.md`, the engine and theme READMEs and `docs/modules/mods/explorer/README.md`;
  - the mount context table.

  Verify that no example still has `name:` under `mod` (`grep -rn -A3 '^mod:' docs`).

## 7. Collections use title

- [ ] 7.1 In `src/lib/tile/collection_format.ts` and the index reader, read `collection.title`, which is required, and ignore `name`. Carry `title` on loaded collections and indexes, and answer it in `collections.inspect`. Rewrite every collection file in the repository to use `title`:
  - samples, `default_mods/*/fixtures/`, `src/test/fixtures/`, `e2e/test_mods/`;
  - the collections tests build inline.

  Verify with unit tests for the `collection-loading` delta's scenarios and "Inspect a collection".
- [ ] 7.2 Read `inspection.title` in the collection explorer (`collection_cards.ts`), the collection viewer (`collection_card.ts`) and the tile viewer (`collection_place.ts`), and update `CollectionInspection` in `mod_api.d.ts`. Verify that checking each of the three default mods passes, and that `e2e/default_mods.spec.ts` passes for "Collection explorer", "Collection viewer" and "Tile viewer shows its place in a collection".
- [ ] 7.3 Update the collection examples and field names in `docs/modules/lib/tile/README.md`, `docs/opentesela_spec.md`, the engine README ("Inspecting collections"), `docs/modules/tiles/explorer/README.md` and `docs/modules/tiles/viewer/README.md`. Verify that no collection example still has `name:` under `collection`.

## 8. Mod API 0.1.14

- [ ] 8.1 Set `MOD_API_VERSION` to `0.1.14`, and add the surface guard's `0.1.14` entry: no `mod.name` context key, no `name` or `sample_collection` file key, and with `default_mosaic` and `mosaics.check`. Verify that `mod_api_surface.test.ts` passes and that the `mod-api-version` delta's scenarios pass.
- [ ] 8.2 Set `api: "^0.1.14"` in the three sample mod files (`book_list`, `country_map`, `flashcards`). Leave the default mods on `^0.1.0`, and `TEST_MOD_API_RANGE` and the `^0.2.0` "another API" examples as they are. Verify that `npm run test:e2e:samples` passes for the sample "Mod file" scenarios, with no API dialog and no API issue.
- [ ] 8.3 Add the `0.1.14` version note to the engine README's "Mod API version":
  - what breaks: `title` required, `name` and `sample_collection` ignored, the `mods.inspect` and `collections.inspect` fields, storage contexts;
  - what was added;
  - why it was taken as a patch, as `0.1.12` was: no mod or collection exists outside the repository, and all of them move in this change.

  Verify that the README's stated version matches `MOD_API_VERSION`.

## 9. Release note

- [ ] 9.1 Add `.changeset/rework-mod-file-format.md` with a `patch` bump. The mod API patch bump means an app patch bump while both are `0.x`, and no user or instantiation exists to break. Give a one-line summary such as: "Mod and collection files use `title` instead of `name`, `sample_collection` becomes `default_mosaic`, mods are checked with their default mosaic or with `mosaics.check`, and stored mod values are kept per mosaic or collection, so values stored before start over (mod API 0.1.14)." Verify that the file follows the format of the other `.changeset/*.md` files.

## 10. Verification

- [ ] 10.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify that every command passes. This change touches `public/samples/` and the mod API specs.

## Workflow follow-up

- Archive the change once it is reviewed and verified.
- Propose `add-mosaic-explorer` next.
