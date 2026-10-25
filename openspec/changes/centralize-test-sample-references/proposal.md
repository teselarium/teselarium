# Proposal

## Why

`bundle-mod-samples` moved the sample mod and switched unit tests to fixtures, and that touched 62 files. Most of the edits were the same few paths, written out again in each test. Unit tests outside `src/test/` hold 106 literal fixture paths, such as `"./fixtures/mods/book_list"` 27 times, even where `SAMPLE_MOD_SOURCE` already exists. Twelve e2e files hold 38 sample paths, and five of them define their own copy of the same run link. The next move of the shipped sample or the fixtures would cost the same again. Each test layer should name its sample files in one place.

## What Changes

- **Unit tests name fixture locations through `src/test/`**: `src/test/sample_mods.ts` gets the app-relative references (the sample mod folder, its collection, and `./fixtures/` for other fixture paths) and the sample run links. Tests under `src/lib/` (`core`, `files`, `tile`, `mod`), `src/main/` and `src/App.test.tsx` use them, together with the existing `SAMPLE_*` constants and `FIXTURES_BASE_URL`, instead of literal paths.
- **Encoded run links stay literal, written once**: the percent-encoded hashes are written by hand as strings in `src/test/sample_mods.ts`, not computed with `encodeURIComponent`. Tests that check how links are encoded still compare against an independent value.
- **e2e tests name the shipped sample through one module**: a new `e2e/sample_mod.ts` holds the sample's run links, mod and collection references, file paths and route globs. The specs and `e2e/mod_routes.ts` import them.
- **Unchanged**: every test keeps its assertions and the values it uses. Only the place where a path is written changes. The one exception is an example URL whose path the test never reads (see design.md). No app, library, engine, loader, sample, fixture or doc file changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a test refactor with no spec-level behavior change, so the change sets `skip_specs: true`. The spec scenarios keep their literal paths: they are examples for readers, not test code.

## Impact

- **Unit test support**: `src/test/sample_mods.ts` (new constants) and `src/test/test_stages.ts` (uses them).
- **Unit tests**: about 25 files under `src/lib/core/`, `src/lib/files/`, `src/lib/tile/`, `src/lib/mod/`, `src/main/` and `src/App.test.tsx`. These are the files that hold literal fixture paths today.
- **e2e**: the new `e2e/sample_mod.ts`, and `app_pages`, `app_settings`, `app_sidebar`, `app_theme`, `default_mods`, `mod_app_actions`, `mod_engine_api`, `mod_sandbox`, `mod_stage` and `mod_theme` specs plus `mod_routes.ts`.
- **Out of scope**: docs, spec scenarios, the shipped explorer config, and the sample smoke test, which already names the shipped sample in one constant.
