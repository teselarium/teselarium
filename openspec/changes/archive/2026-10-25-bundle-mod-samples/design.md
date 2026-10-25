# Design

## Context

See proposal.md - Why. The sample move is already committed (`b292d78`): `public/samples/mods/book_list/` holds the bundle and `mod_conf.yaml` uses `./book_type.md` and `./book_collection.yaml`. What breaks is the test support code and the paths that name the old files:

- `src/test/sample_files.ts` has two fetchers. `fetchSample` serves `public/samples/` at `SAMPLES_BASE_URL` (`https://example.org/samples/`) and answers 404 for anything else; library tests use it. `fetchAppFile` serves all of `public/` at `APP_BASE_URL` (`https://example.org/`); engine, stage and app tests use it, often through `fetchTestFile`, which serves in-memory `testTexts` first. `readSampleText` reads `public/samples/` from disk.
- `src/test/sample_mods.ts` derives `SAMPLE_*` constants and the in-memory `four_books`, `two_books` and `untyped` sources from `SAMPLES_BASE_URL`.
- Engine and stage tests do not go through `SAMPLES_BASE_URL`. They write references such as `./samples/mods/book_list` and resolve them against the app's address, so they reach `public/` through `fetchAppFile`.
- `src/lib/tile/dependencies.test.ts` reads `public/samples/` with its own relative path.
- The e2e specs run against the built app and use `./samples/...` run links and `**/samples/...` route globs.

## Goals / Non-Goals

**Goals:**
- Unit tests read only `src/test/fixtures/`. The one exception is a single smoke test that reads the shipped sample.
- Fixture URLs sit on the app's origin, so origin-based permission tests behave as they do now.
- Each test changes only its URLs, and keeps its assertions.

**Non-Goals:**
- Renaming the `SAMPLE_*` test constants or reworking test helpers beyond the base URL. The specs still call the fixture mod "the sample book list mod".
- Making fixtures follow the bundle convention. They keep the old layout on purpose.
- Any change to loaders, the engine or the app.

## Decisions

### Fixtures are served at `https://example.org/fixtures/` by both fetchers

`sample_files.ts` gets a `FIXTURES_BASE_URL` (`${APP_BASE_URL}fixtures/`) and a `FIXTURES_DIRECTORY` (`src/test/fixtures/`).

- `fetchSample` becomes `fetchFixture`. It serves `src/test/fixtures/` below `FIXTURES_BASE_URL` and answers 404 for anything else, so library tests keep a strict fetcher.
- `fetchAppFile` checks `FIXTURES_BASE_URL` first and serves fixtures from `src/test/fixtures/`. Every other URL under `APP_BASE_URL` still comes from `public/`. A reference such as `./fixtures/mods/book_list` then works in engine and stage tests in the same way that `./samples/mods/book_list` works today.
- `readSampleText` becomes `readFixtureText` and reads `src/test/fixtures/`.
- `SAMPLES_BASE_URL` is removed, so any use that was missed fails to compile instead of silently reading `public/`.

*Alternatives:* (a) a separate fixtures origin such as `https://fixtures.example`. Rejected: the mount-context, `mods.inspect` and grant scenarios rely on the fixture mod being on the app's origin. (b) Keeping `/samples/` URLs but mapping them to fixtures in tests. Rejected: the same URL would mean different files in unit and e2e tests, and the smoke test needs the real `/samples/` path.

### Fixtures are restored from git, byte-identical

The fixtures are created with `git show b292d78^:<path>` for `public/samples/types/book.md`, `tiles/books_collection.yaml`, `tiles/books/*.md`, `mods/book_list/mod_conf.yaml` and `mods/book_list/main.js`. They are written to the same relative paths under `src/test/fixtures/`. `mod_conf.yaml` therefore keeps `type_path: "../../types/book.md"` and `sample_collection: "../../tiles/books_collection.yaml"`, which is what the `mod-loading` scenarios about paths outside the mod folder need. `main.js` is taken from `HEAD`, because the move commit did not change it. Prettier ignores `src/test/fixtures/` so the copies stay identical to their sources.

*Alternative:* copying from the current bundle and editing paths. Rejected: it is easy to get wrong, and git already holds the exact previous files.

### Fixtures stay out of the build

`src/test/` is not under `public/`, and no app module imports it, so Vite does not ship it. No config change is needed. oxlint already lints the sample `main.js`, so its fixture copy passes without a new ignore pattern.

### One smoke test for the shipped sample

`src/lib/mod/sample_mod.test.ts` (library project, no DOM) uses `fetchAppFile` to load `https://example.org/samples/mods/book_list/`. It builds the validator from the loaded `typeSource`, loads `sampleCollection` and validates it. It asserts that `typeSource` and `sampleCollection` are set, that the collection has at least one tile, that every tile has types `[validator type name]` and that issues is empty. It does not assert titles, counts or config, so the sample's content can change without breaking it.

*Alternative:* placing it under `src/test/`. Rejected: that folder runs in the app (jsdom) project and holds helpers, not tests.

### Mechanical path rewrite in tests and docs

- Unit tests: `https://example.org/samples/` → `https://example.org/fixtures/` and `./samples/` → `./fixtures/`. Fixture-relative paths (`tiles/...`, `types/...`, `mods/...`) do not change. `dependencies.test.ts` uses `readFixtureText`.
- e2e: the built app serves `public/` only, so e2e specs keep `./samples/mods/book_list`. Collection and tile paths move to `./samples/mods/book_list/book_collection.yaml` and `.../books/*.md`, and route globs follow them.
- Docs: READMEs use the bundle paths. `docs/mod_plugin_spec.md` swaps the inline `schema:` for `type_path` and `sample_collection`.

## Risks / Trade-offs

- [A `/samples/` URL is missed in a unit test and quietly reads `public/` through `fetchAppFile`] → After the rewrite, grep `src/` for `samples/` and its percent-encoded form `samples%2F`. The only hits allowed are the smoke test and `fetchAppFile`'s comment.
- [Fixtures and the shipped sample diverge, so unit tests no longer catch a broken sample] → The smoke test covers that the sample is consistent. The e2e run links cover that the app runs it.
- [`fetchAppFile` serving a path that is not under `public/` surprises readers] → Its doc comment states the fixtures exception. `public/` has no `fixtures/` folder, so nothing is hidden.
- [Docs are excluded from Prettier, so a doc path that was missed fails no check] → Grep `docs/` for `samples/types` and `samples/tiles`, plain and percent-encoded, as a task step.
