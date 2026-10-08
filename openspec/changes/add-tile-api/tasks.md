# Tasks

## 1. Project scaffold

- [ ] 1.1 Generate a Vite `react-ts` app in a temp dir and copy it into the repo root, keeping `docs/`, `samples/`, `README.md`, `.devcontainer/`, `.claude/` and `openspec/` and replacing the placeholder `package-lock.json`. Verify with `npm install && npm run build`, which must succeed.
- [ ] 1.2 Add Vitest, `jsdom` and React Testing Library. Configure `test` in `vite.config.ts` (default environment `jsdom`) and add an `npm run test` script. Verify that one smoke test rendering `App` with RTL passes via `npm run test`.
- [ ] 1.3 Add Prettier and `eslint-config-prettier`, plus `format` and `lint` scripts, and add `max-depth: 3` and `func-style: declaration` for `src/lib/**`. Verify that `npm run lint` and `npx prettier --check .` pass on the scaffold.
- [ ] 1.4 Install `ajv`, `@11ty/gray-matter` and `js-yaml` (+ `@types/js-yaml`). Spike: import gray-matter in a throwaway module used by `App`, run `npm run build`, and check the bundle for Node built-in errors or warnings. Record the result in design.md D3 (keep gray-matter, or switch to the fallback splitter and uninstall it), then remove the spike.
- [ ] 1.5 Create `src/lib/tile_api/` with `index.ts`, `tile_types.ts` (the D2 shapes) and `tile_errors.ts` (`TileParseError`, `TileTypeError`, `TileLoadError`, `CollectionError`, each carrying the source/location). Verify with `npx tsc --noEmit`, which must pass.

## 2. Tile parsing (`specs/tile-parsing`)

- [ ] 2.1 Write `yaml_parser.test.ts` (node env) first: mapping parses; unquoted `1953-10-19` stays a string; invalid YAML throws; list or scalar at top level throws; a custom tag (for example `!!js/function`) throws. Then implement `yaml_parser.ts` with `js-yaml` `CORE_SCHEMA`. Verify that the tests pass.
- [ ] 2.2 Write `tile_parser.test.ts` covering every scenario in `specs/tile-parsing/spec.md` (sample `farenheit_451.md` and `book.md` read from `samples/` via `fs`; body unchanged; no frontmatter; invalid YAML names the source; list frontmatter; `---js` rejected without running code). Verify that the tests fail before 2.3.
- [ ] 2.3 Implement `parseTile(text, source)` in `tile_parser.ts` following D3 (gray-matter with a yaml-only engine, or the fallback splitter, depending on the 1.4 result). Export it from `index.ts`. Verify that `tile_parser.test.ts` passes and `npm run lint` is clean.

## 3. Tile validation (`specs/tile-validation`)

- [ ] 3.1 Write `tile_validator.test.ts` covering every scenario in `specs/tile-validation/spec.md`: schema taken from parsed `samples/types/book.md`; missing schema and malformed schema raise `TileTypeError`; all three sample tiles are valid; extra field and missing optional field are valid; missing `country` and string `authors` give issues whose path/message refer to the field; metadata deep-equals a pre-validation copy. Verify that the tests fail before 3.2.
- [ ] 3.2 Implement `compileTileType` and `validateMetadata` in `tile_validator.ts` with Ajv JTD (`allErrors`, strict), mapping Ajv errors to `ValidationIssue` as in D4. Export both from `index.ts`. Verify that `tile_validator.test.ts` passes and `npm run lint` is clean.

## 4. Tile loading (`specs/tile-loading`)

- [ ] 4.1 Add a test helper `create_sample_fetch.ts`: a named fetch implementation that serves files under `samples/` for `https://example.org/...` URLs, returns 404 for unknown paths, and allows per-test overrides (network failure, custom bodies). Verify through its own small test.
- [ ] 4.2 Write `tile_loader.test.ts` covering every scenario in `specs/tile-loading/spec.md`: load a single tile by URL; 404 and network failure raise `TileLoadError` with the location; sample collection name/description/order with empty errors; missing `tiles` raises `CollectionError`; relative `path` resolution and absolute `url`; 404 entry skipped at index 1; invalid-frontmatter entry skipped; entry with both or neither of `path`/`url` reported as malformed with no fetch attempted. Verify that the tests fail before 4.3.
- [ ] 4.3 Implement `resolveLocation`, `loadTile` and `loadCollection` in `tile_loader.ts` following D5 (injectable `fetch`/`baseUrl`, `Promise.allSettled` with named functions, order-preserving `for…of` assembly). Export them from `index.ts`. Verify that `tile_loader.test.ts` passes and `npm run lint` is clean.

## 5. Documentation and integration check

- [ ] 5.1 Replace `docs/modules/lib/tile_api/README.md` with the public API: the functions, the D2 data shapes, the error types, the "skip and report" policy, the CORS and CSP notes, and a usage example that loads `samples/tiles/books_collection.yaml` and validates it against `samples/types/book.md`. Verify that the example's calls and field names match the exports in `src/lib/tile_api/index.ts`.
- [ ] 5.2 Add an integration test `tile_api.integration.test.ts` that goes only through `index.ts` exports: load the sample collection with the sample fetch, load and compile the book type, and validate every tile. Verify that it passes, that 3 tiles are all valid, and that `npm run test`, `npm run lint` and `npm run build` all succeed together.

## Workflow follow-up

- Archive the change once reviewed, so that `openspec/specs/tile-parsing`, `tile-validation` and `tile-loading` become the main specs.
