# Tasks

## 1. Shared unit-test references

- [ ] 1.1 In `src/test/sample_files.ts`, add `FIXTURES_REFERENCE` (`./fixtures/`) next to `FIXTURES_BASE_URL`, with a doc comment saying that it resolves to `FIXTURES_BASE_URL` against `APP_BASE_URL`. Verify `npx tsc -p tsconfig.test.json --noEmit` succeeds
- [ ] 1.2 In `src/test/sample_mods.ts`, add `SAMPLE_MOD_REFERENCE`, `SAMPLE_COLLECTION_REFERENCE`, `MISSING_MOD_REFERENCE` and `MISSING_MOD_SOURCE`, built from `FIXTURES_REFERENCE` and `FIXTURES_BASE_URL`. Also add `SAMPLE_RUN_HASH`, `SAMPLE_COLLECTION_RUN_HASH` and `SAMPLE_VIEWER_RUN_HASH` as hand-written percent-encoded literals. Each constant gets a doc comment stating its value. Make `SAMPLE_LINK` in `src/test/test_stages.ts` use `SAMPLE_MOD_REFERENCE`. Verify `npm test` passes with 834 tests

## 2. Unit tests use the shared references

- [ ] 2.1 Update the `src/lib/core/stage/` tests (`run_links`, `stage_controller`, `stage_routes`, `stage_sandboxes`) to the shared references and hashes, appending suffixes such as `&from=explorer` to a shared hash. Keep `run_links.test.ts` building a link from `SAMPLE_MOD_REFERENCE` and `SAMPLE_COLLECTION_REFERENCE` and expecting `SAMPLE_COLLECTION_RUN_HASH`. Verify `npx vitest run src/lib/core/stage` passes. Then change one character of `SAMPLE_COLLECTION_RUN_HASH`, verify that `run_links.test.ts` fails, and restore it
- [ ] 2.2 Update the other `src/lib/core/` tests (`engine/mod_inspection`, `mod_launch`, `mod_session`, `mods_methods`, `storage_methods`, `permissions/mod_grants`, `sandbox/sandbox_policy`, `storage/mod_storage`). Replace absolute literals that equal a `SAMPLE_*` constant with that constant, and build other fixture locations on `FIXTURES_REFERENCE` or `FIXTURES_BASE_URL`. Make the `localhost` input of `sandbox_policy.test.ts` path-neutral (`http://localhost:5173/mods/book_list/mod_conf.yaml`). Verify `npx vitest run src/lib/core` passes
- [ ] 2.3 Update the `src/lib/files/`, `src/lib/tile/` and `src/lib/mod/` tests that still write the fixtures root: `file_errors`, `yaml_parser`, `tile_errors`, `collection_format`, `collection_loader`, `mod_errors`, `mod_format` and `mod_reference`. Use `FIXTURES_BASE_URL`, `FIXTURES_REFERENCE` or the `SAMPLE_*` constants. Verify `npx vitest run src/lib/files src/lib/tile src/lib/mod` passes
- [ ] 2.4 Update `src/App.test.tsx`, `src/main/pages/page_links.test.ts`, `src/main/stage/ActionDialog.test.tsx` and `src/main/stage/StageView.test.tsx` to the shared references. Verify `npx vitest run --project app` passes
- [ ] 2.5 Confirm the fixtures root is written only in `src/test/`. Verify that `grep -rnE "fixtures(/|%2F)" src --exclude-dir=test` is empty, that `npm test` still runs 834 passing tests, and that `npm run build` succeeds
- [ ] 2.6 Rehearse a fixtures move. Rename `src/test/fixtures/` to `src/test/test_fixtures/`, and edit only `src/test/` so that fixtures are served at `https://example.org/test_fixtures/`: `FIXTURES_DIRECTORY`, `FIXTURES_BASE_URL`, `FIXTURES_REFERENCE` and the three hashes. Verify `npm test` passes with 834 tests and `git status --short` lists no changed file outside `src/test/` beyond those changed by tasks 1.1–2.5. Then undo exactly the rehearsal's edits and folder rename, and verify `grep -rn "test_fixtures" src` is empty and `npm test` passes

## 3. e2e tests use one sample module

- [ ] 3.1 Add `e2e/sample_mod.ts` with the shipped sample's paths (mod folder, mod file, collection, books folder) and its references. Include a missing mod and a missing collection, the run hashes without a leading `/`, the route globs for `main.js` and the collection, and `readSampleModSource(page)`. Each export gets a doc comment stating its value. Make `e2e/mod_routes.ts` import its sample route glob from it. Verify `npm run build` (which type-checks `e2e/`) succeeds
- [ ] 3.2 Update the `app_pages`, `app_settings`, `app_sidebar`, `app_theme`, `default_mods`, `mod_app_actions`, `mod_engine_api`, `mod_sandbox`, `mod_stage` and `mod_theme` specs. Drop their own sample constants and the `new URL("/samples/…", page.url())` copies, and interpolate the constants into served YAML and markdown. Verify that `grep -rnE "samples(/|%2F)" e2e` matches only `e2e/sample_mod.ts`, and that `npm run test:e2e` still runs 696 passing tests

## 4. Integration check

- [ ] 4.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all pass. Also run `openspec validate centralize-test-sample-references` and verify it reports the change as valid

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed.
