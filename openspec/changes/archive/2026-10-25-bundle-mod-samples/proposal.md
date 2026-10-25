# Proposal

## Why

`docs/opentesela_spec.md` defines a mod as a bundle: the plugin, the tile type it needs, its default configuration and a sample collection. The sample `book_list` mod did not follow it: its type sat in `public/samples/types/` and its sample collection in `public/samples/tiles/`, reached with `../../` paths, so the mod could not be copied or shared as one folder. The files have now been moved into `public/samples/mods/book_list/`, and the app still runs the mod, but 113 unit tests, the e2e run links, the formatting check, seven READMEs and seven specs still point at the old paths.

The move also showed that unit tests depend on the shipped sample: any change to it breaks tests that only need some book data. Tests should own their data, and the sample should be checked by a single test.

## What Changes

- **Sample mod is a bundle**: keep the move. `public/samples/mods/book_list/` holds `mod_conf.yaml`, `main.js`, `book_type.md`, `book_collection.yaml` and `books/*.md`, and `mod_conf.yaml` declares `type_path: "./book_type.md"` and `sample_collection: "./book_collection.yaml"`. The files are moved unchanged. `public/samples/types/` and `public/samples/tiles/` are gone.
- **Convention, not rule**: the docs state that a mod bundles its tile type and sample collection by default. `type_path` and `sample_collection` may still point outside the mod folder or to another site, so mods can share a type. The loader does not change.
- **Test fixtures**: unit tests stop reading `public/samples/` and read `src/test/fixtures/` instead, served at `https://example.org/fixtures/`, on the app's origin. The fixtures are a copy of the previous sample layout (`types/book.md`, `tiles/books_collection.yaml`, `tiles/books/*.md` and `mods/book_list/` with `../../` paths), so tests keep their assertions and keep covering paths that leave the mod folder. The fixtures are not part of the build. The fixtures and the sample may diverge from then on.
- **Sample smoke test**: one unit test loads the shipped `book_list` mod from `public/`, builds its type, loads its sample collection and validates it: every tile loads and matches, with no issues. It checks that the sample is consistent, not its content.
- **e2e tests** keep running the shipped sample, with the collection at `./samples/mods/book_list/book_collection.yaml`.
- **Formatting**: `.prettierignore` ignores `public/samples/mods/book_list/books/` and `src/test/fixtures/` instead of `public/samples/tiles/` and `public/samples/types/`, so the moved and copied files stay byte-identical.
- **Docs**: the module READMEs use the new sample paths. `docs/modules/lib/mod/README.md` states the convention and keeps saying that paths may leave the mod folder. `docs/mod_plugin_spec.md` replaces its inline `schema:` example, which the loader rejects, with `type_path` and `sample_collection`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

No requirement text changes. Only the scenarios that name sample files change, to the fixture URLs for library and engine behavior and to the bundled sample for app run links:

- `collection-loading`: scenarios load the fixture collection and resolve tiles under `https://example.org/fixtures/`.
- `collection-validation`: the scenario that validates the sample collection uses the fixtures.
- `tile-loading`: scenarios load fixture tiles.
- `tile-validation`: scenarios build the validator from the fixture book type and validate fixture tiles.
- `mod-loading`: scenarios load the fixture `book_list` mod, whose `type_path` and `sample_collection` still resolve outside its folder.
- `mod-engine-api`: the `mods.inspect` scenario and the other scenarios that name sample files use the fixture URLs.
- `mod-stage`: run-link scenarios open the shipped sample with `collection=./samples/mods/book_list/book_collection.yaml`.

## Impact

- **Samples**: `public/samples/mods/book_list/` (already moved). No app code names sample paths, so the app and the mod viewer's "Run with sample tiles" keep working.
- **Tests**:
  - `src/test/sample_files.ts`: serves `src/test/fixtures/` at the fixtures base URL, next to `fetchAppFile` for `public/`.
  - `src/test/sample_mods.ts` and `src/test/test_files.ts`: constants derived from the fixtures base URL.
  - About 30 unit test files that use `https://example.org/samples/...` or `readSampleText`, including `src/lib/tile/dependencies.test.ts`, which reads `public/samples/` from disk.
  - New `src/test/fixtures/` and the new smoke test.
  - e2e: `app_theme`, `default_mods`, `mod_app_actions`, `mod_engine_api`, `mod_sandbox`, `mod_stage` and `mod_theme` specs.
- **Docs**: `docs/mod_plugin_spec.md` and the READMEs under `docs/modules/lib/{core/engine,core/sandbox,core/stage,files,mod,tile}/` and `docs/modules/mods/viewer/`.
- **Config**: `.prettierignore`.
- **Mods**: no API or format change.
- **Out of scope**: an API version for mods, a "Check mod" action, and tests shipped inside a mod bundle. Each is a later change.
