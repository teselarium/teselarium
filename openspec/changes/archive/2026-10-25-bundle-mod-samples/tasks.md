# Tasks

## 1. Fixtures and test file serving

- [x] 1.1 Create `src/test/fixtures/` from `git show b292d78^:public/samples/<path>` for `types/book.md`, `tiles/books_collection.yaml`, `tiles/books/{farenheit_451,fictions,kallocain}.md`, `mods/book_list/mod_conf.yaml` and `mods/book_list/main.js`. Verify each file is byte-identical to its git source with `git show b292d78^:<path> | cmp - src/test/fixtures/<path>`, and that the fixture `mod_conf.yaml` declares `type_path: "../../types/book.md"` and `sample_collection: "../../tiles/books_collection.yaml"`
- [x] 1.2 In `.prettierignore`, replace `public/samples/tiles/` and `public/samples/types/` with `public/samples/mods/book_list/books/` and `src/test/fixtures/`. Verify that `npm run format:check` reports no file under either folder
- [x] 1.3 In `src/test/sample_files.ts`, add `FIXTURES_BASE_URL` (`https://example.org/fixtures/`) and the fixtures directory, rename `fetchSample` to `fetchFixture` and `readSampleText` to `readFixtureText` so both serve `src/test/fixtures/`, make `fetchAppFile` serve fixture URLs from `src/test/fixtures/` before `public/`, remove `SAMPLES_BASE_URL`, and update the doc comments. Verify by reading the file that no export still refers to `public/samples/`
- [x] 1.4 In `src/test/sample_mods.ts`, derive every constant and served source from `FIXTURES_BASE_URL`, keeping the `SAMPLE_*` names. Verify `SAMPLE_TYPE_SOURCE` is `https://example.org/fixtures/types/book.md` and `SAMPLE_COLLECTION_SOURCE` is `https://example.org/fixtures/tiles/books_collection.yaml`
- [x] 1.5 Switch `src/lib/tile/dependencies.test.ts` to `readFixtureText`, removing its own `public/samples/` path. Verify `npx vitest run src/lib/tile/dependencies.test.ts` passes

## 2. Library tests on fixtures

- [x] 2.1 Update the `src/lib/files/` tests (`file_errors`, `file_fetcher`, `markdown_parser`, `yaml_parser`) to the fixture URLs and helpers. Verify `npx vitest run src/lib/files` passes
- [x] 2.2 Update the `src/lib/tile/` tests (`collection_format`, `collection_loader`, `collection_validator`, `tile_errors`, `tile_loader`, `tile_type_schema`, `tile_validator`) so they match the `collection-loading`, `collection-validation`, `tile-loading` and `tile-validation` scenarios under `https://example.org/fixtures/`. Verify `npx vitest run src/lib/tile` passes
- [x] 2.3 Update the `src/lib/mod/` tests (`mod_errors`, `mod_format`, `mod_loader`, `mod_reference`) so they match the `mod-loading` scenarios, including `typeSource` `https://example.org/fixtures/types/book.md` and `sampleCollection` `https://example.org/fixtures/tiles/books_collection.yaml` resolved outside the mod folder. Verify `npx vitest run src/lib/mod` passes
- [x] 2.4 Update the `src/lib/core/` tests (`engine/*`, `permissions/mod_grants`, `sandbox/sandbox_policy`, `stage/*`, `storage/mod_storage`) and `src/test/test_stages.ts` from `./samples/` and `https://example.org/samples/` to `./fixtures/` and `https://example.org/fixtures/`, including percent-encoded run links such as `.%2Fsamples%2F…` in the `stage` tests, matching the `mod-engine-api` scenarios. Verify `npx vitest run --project lib` passes

## 3. App tests on fixtures

- [x] 3.1 Update `src/App.test.tsx`, `src/main/default_mods.test.ts`, `src/main/pages/page_links.test.ts`, `src/main/stage/ActionDialog.test.tsx` and `src/main/stage/StageView.test.tsx` to the fixture references. Verify `npx vitest run --project app` passes
- [x] 3.2 Confirm unit tests no longer read the shipped sample. Verify that `grep -rnE "samples(/|%2F)" src` matches only the smoke test (added in 4.1) and the `fetchAppFile` comment, and that `npm run build` (type check included) succeeds

## 4. Sample smoke test

- [x] 4.1 Add `src/lib/mod/sample_mod.test.ts`, which loads `https://example.org/samples/mods/book_list/` with `fetchAppFile`, builds the validator from its `typeSource`, loads its `sampleCollection` and validates it. It asserts that both paths are set, that there is at least one tile, that every tile's types is `[type name]` and that there are no issues, and it does not assert sample content. Verify it passes, and that it fails when a book's `country` in `public/samples/mods/book_list/books/` is temporarily removed (then restore the file)

## 5. e2e on the bundled sample

- [x] 5.1 Update the run links, `**/samples/...` route globs and tile paths in `e2e/app_theme`, `default_mods`, `mod_app_actions`, `mod_engine_api`, `mod_sandbox`, `mod_stage` and `mod_theme` specs to `./samples/mods/book_list/book_collection.yaml` and `./samples/mods/book_list/books/*.md`, matching the `mod-stage` scenarios. Verify that `grep -rnE "samples(/|%2F)(tiles|types)" e2e` is empty and `npm run test:e2e` passes

## 6. Docs

- [x] 6.1 Update the sample paths in the READMEs under `docs/modules/lib/{core/engine,core/sandbox,core/stage,files,mod,tile}/` and `docs/modules/mods/viewer/`, including percent-encoded links. Verify that `grep -rnE "samples(/|%2F)(tiles|types)" docs` is empty
- [x] 6.2 In `docs/modules/lib/mod/README.md`, state that a mod bundles its tile type and sample collection by default, and that `type_path` and `sample_collection` may still point outside the mod folder or to another site. Verify that both statements are present
- [x] 6.3 In `docs/mod_plugin_spec.md`, replace the inline `schema:` in the `mod_conf.yaml` example with `type_path` and `sample_collection`, and adjust the surrounding text. Verify that the example has no `schema:` key and that its paths point inside the mod folder

## 7. Integration check

- [x] 7.1 Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`, and verify all pass. Also run `openspec validate bundle-mod-samples` and verify it reports the change as valid

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed.
