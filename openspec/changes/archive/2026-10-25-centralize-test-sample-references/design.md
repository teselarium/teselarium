# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `src/test/sample_files.ts` defines `FIXTURES_BASE_URL` (`https://example.org/fixtures/`), and `src/test/sample_mods.ts` derives `SAMPLE_MOD_SOURCE`, `SAMPLE_ENTRYPOINT`, `SAMPLE_TYPE_SOURCE`, `SAMPLE_COLLECTION_SOURCE` and `SAMPLE_TILE_SOURCES` from it. The `src/lib/files`, `tile` and `mod` tests mostly use these already, with 18 literals left.
- Engine, stage and app tests name the sample by app-relative references (`./fixtures/mods/book_list`, `./fixtures/tiles/books_collection.yaml`), resolved against `APP_BASE_URL`. No shared constant exists for those, so they are written inline 40 times. `src/test/test_stages.ts` and `mod_launch.test.ts` each build their own `SAMPLE_LINK` from these literals.
- Run links appear in two forms. Unencoded hashes such as `#/run?mod=./fixtures/mods/book_list` are inputs that the stage parses. Percent-encoded hashes such as `#/run?mod=.%2Ffixtures%2Fmods%2Fbook_list` are mostly expected outputs: `run_links.test.ts` builds a link from the two references and expects the encoded hash.
- The e2e specs run the built app, which serves `public/` only, so they name the shipped sample (`./samples/mods/book_list`, `/samples/mods/book_list/...`). Five specs define the same run-link constant, four rebuild the mod file URL with `new URL("/samples/mods/book_list/mod_conf.yaml", page.url())`, and `mod_routes.ts` routes `**/samples/mods/book_list/main.js`.

## Goals / Non-Goals

**Goals:**
- Unit tests: the fixtures root (`./fixtures/`, `https://example.org/fixtures/` and their encoded forms) is written only in `src/test/`. Moving or renaming `src/test/fixtures/`, or changing its base URL, edits only files in `src/test/`.
- e2e: the shipped sample's location is written only in `e2e/sample_mod.ts`.
- Each test still reads as the scenario it checks, and expected values are not computed by the code under test.

**Non-Goals:**
- Paths below the fixtures root (`tiles/books/kallocain.md`, `mods/bad_yaml/mod_conf.yaml`) stay in the tests that need them, built on a shared root. The fixture layout is frozen on purpose (see `bundle-mod-samples`), so a constant for each fixture file adds names without saving edits.
- Renaming existing constants or helpers, or merging the two `SAMPLE_LINK` constants.
- Spec scenarios, docs and the sample smoke test. Spec scenarios keep their literal paths as examples for readers.

## Decisions

### The fixtures root has two forms, both in `src/test/sample_files.ts`

Next to `FIXTURES_BASE_URL`, add `FIXTURES_REFERENCE = "./fixtures/"`: the app-relative form, which resolves to `FIXTURES_BASE_URL` against `APP_BASE_URL`. Every app-relative fixture reference in a test is built from it, for example `${FIXTURES_REFERENCE}mods/bad_yaml`. Both forms sit next to `FIXTURES_DIRECTORY`, so the three facts about where fixtures live sit together.

*Alternative:* deriving the reference from `FIXTURES_BASE_URL` by stripping `APP_BASE_URL`. Rejected: it is harder to read than the literal and gains nothing, since both constants sit three lines apart.

### The sample's references are named constants in `src/test/sample_mods.ts`

Add `SAMPLE_MOD_REFERENCE` (`./fixtures/mods/book_list`), `SAMPLE_COLLECTION_REFERENCE` (`./fixtures/tiles/books_collection.yaml`), `MISSING_MOD_REFERENCE` (`./fixtures/mods/missing`) and `MISSING_MOD_SOURCE`, all built from `FIXTURES_REFERENCE` or `FIXTURES_BASE_URL`. These cover 44 of the 106 literals. Tests replace absolute literals that equal an existing `SAMPLE_*` constant (for example the seven copies of `SAMPLE_MOD_SOURCE`) with that constant. Every doc comment states the value, so a reader does not have to resolve it by hand.

Unencoded run-link inputs are built where they are used: `` `#/run?mod=${SAMPLE_MOD_REFERENCE}` ``.

### Encoded run links are hand-written literals, written once

`src/test/sample_mods.ts` defines `SAMPLE_RUN_HASH`, `SAMPLE_COLLECTION_RUN_HASH` and `SAMPLE_VIEWER_RUN_HASH` as literal strings, such as `"#/run?mod=.%2Ffixtures%2Fmods%2Fbook_list"`. Tests that need a suffix append it: `` `${SAMPLE_COLLECTION_RUN_HASH}&from=explorer` ``.

*Alternative:* computing them with `encodeURIComponent(SAMPLE_MOD_REFERENCE)`. Rejected: `run_links.test.ts` checks that building a link encodes the references. An expected value produced by the same kind of encoding would agree with an encoding bug. A hand-written value keeps the check independent, and writing it once keeps the move cost at one file.

The literals can drift from the references: someone moves the fixtures, updates `FIXTURES_REFERENCE` and forgets the hashes. `run_links.test.ts` guards against that already. It builds a link from `SAMPLE_MOD_REFERENCE` and `SAMPLE_COLLECTION_REFERENCE` and expects `SAMPLE_COLLECTION_RUN_HASH`, so a stale literal fails a test.

### One e2e module for the shipped sample: `e2e/sample_mod.ts`

The module holds:

- the paths: the mod folder path, the mod file path, the collection path and the books folder path
- the app-relative references for the sample mod, its collection, and a missing mod and collection
- the run hashes: mod only, and mod with collection
- the route globs for the sample's `main.js` and collection
- `readSampleModSource(page)`, which replaces the four `new URL(…, page.url())` copies

The specs and `mod_routes.ts` import them. Hashes are exported without the leading `/`, and specs write `` page.goto(`/${SAMPLE_RUN_HASH}`) ``, as `mod_stage.spec.ts` already does. Text that embeds a reference, such as a served YAML file or a home page's markdown, interpolates the constant.

The module is named for the domain object, like `src/test/sample_mods.ts`. `mod_routes.ts` is about routing and probes, and `app_layout.ts` about locators, so neither fits.

*Alternative:* adding the constants to `mod_routes.ts`. Rejected: that module is already 550 lines and mixes many concerns, and sample paths would be one more.

### A path that only names a host is made path-neutral

`sandbox_policy.test.ts` passes `http://localhost:5173/fixtures/mods/book_list/mod_conf.yaml` to `collectContentHosts`, which reads only its origin. It becomes `http://localhost:5173/mods/book_list/mod_conf.yaml`. This is the one input whose value changes, and its expected value (`http://localhost:5173`) does not.

## Risks / Trade-offs

- [Tests read `SAMPLE_MOD_REFERENCE` instead of a path, which is less concrete] → Constants are named after the domain, their doc comments show the value, and the spec scenarios keep the literal paths.
- [A literal is missed] → `grep -rnE "fixtures(/|%2F)" src --exclude-dir=test` must be empty, and `grep -rnE "samples(/|%2F)" e2e` must match only `e2e/sample_mod.ts`.
- [A refactor quietly changes what a test checks] → The unit and e2e test counts must stay the same (834 and 696). A move rehearsal (tasks 2.6) proves the goal: rename the fixtures folder, edit only `src/test/`, and the whole suite passes.
- [e2e moves still touch more than one file] → Moving the shipped sample also changes the explorer config under `public/default_mods/`, the docs and the spec scenarios. Those are product content and readers' examples, not test code. This change only removes the duplication inside the tests.
