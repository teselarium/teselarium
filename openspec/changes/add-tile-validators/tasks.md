# Tasks

Each group writes its tests first (TDD) and names each test after the spec scenario it covers, so every scenario in `specs/tile-validation/spec.md` and `specs/collection-validation/spec.md` can be traced to a test.

## 1. Errors and shared test fixture (design D8, D10)

- [x] 1.1 Extend `src/lib/tile/tile_errors.test.ts` with the same checks the existing classes have, for `TileTypeError` and `TileValidationError`: `instanceof Error`, `name` equal to the class name, the `source` property, the D8 message format with source and reason, and `cause` kept when given. Then add both classes to `src/lib/tile/tile_errors.ts`. Verify that the test passes and that `npm run lint` is clean.
- [x] 1.2 Move `fetchTestFile`, its `testTexts` map and `readRequestedUrl` from `src/lib/tile/collection_loader.test.ts` into a new `src/test/test_files.ts` (named functions, explicit return types), and import them in `collection_loader.test.ts`. Leave every test case as it is. Verify that `collection_loader.test.ts` passes with the same number of tests as before, and that `npm run lint` and `npm run build` succeed (the build type-checks `src/test/` through `tsconfig.test.json`).

## 2. Schema checks and structural typing (design D3, D4)

- [x] 2.1 Write `src/lib/tile/tile_type_schema.test.ts` calling `readTileTypeSchema` and `applyStructuralTyping` directly with inline `ParsedMarkdown` values:
  - The parsed `samples/types/book.md` (through `readSampleText` and `parseMarkdown`) gives type name `"book"`, and its `book` definition keeps `additionalProperties: true`.
  - Each D3 reason raises `TileTypeError` with the source in `source` and in the message: `schema` missing (also for empty metadata), `schema: "book"`, `ref` missing, `ref: ""`, `ref: 3`, `ref: novel` with only a `book` definition, `definitions` missing, and `ref: toString` with no such own definition.
  - The walk adds `additionalProperties: true` at the root, in `definitions`, in nested `properties` and `optionalProperties`, under `elements`, under `values` and in each discriminator `mapping` schema. It keeps an explicit `false` and an explicit `true`. It leaves schemas without `properties` or `optionalProperties` (for example `type: string`) without `additionalProperties`.
  - A field named `properties` (`properties: { properties: { type: string } }`) gets no `additionalProperties` inside the map of fields. `metadata` content is copied unchanged.
  - The input schema deep-equals a copy taken before the call.

  Verify that the tests fail before 2.2.
- [x] 2.2 Implement `src/lib/tile/tile_type_schema.ts` (`TileTypeSchema`, `readTileTypeSchema`, `applyStructuralTyping`) following D3 and D4: checks in D3 order with `isYamlMapping`, `describeYamlValue` and `Object.hasOwn`, and a walk split into named functions for a schema and for a map of schemas, returning new values without changing the input. Verify that `tile_type_schema.test.ts` passes and that `npm run lint` is clean (depth limit included).

## 3. Tile validator (design D5, D6, D9, D11)

- [x] 3.1 Write `src/lib/tile/tile_validator.test.ts`, importing only from `./index.ts`, with the D10 fixtures (`fetchTestFile` from `src/test/test_files.ts` wrapped in `vi.fn`, `fetchSample` for the samples, `indexLocalFiles` with `Blob`s, and inline `Tile` objects). Cover every scenario of `specs/tile-validation/spec.md`:
  - Build: the sample book type (type name and source), a relative path with a base URL, a picked type file with fetch not called.
  - Build failures: HTTP 404, invalid frontmatter, no `schema`, no frontmatter, `schema: "book"`, no `ref`, `ref: novel`, `type: text`, `minLength`, and the three failure kinds told apart. Check each error's class and `source`, and that the `TileTypeError` message is short and keeps Ajv's error as `cause` for invalid JTD.
  - `metadata: { description }` accepted.
  - Structural typing through validation: omitted at the top level (the `simple_event` type from `docs/tesela_spec.md`), nested object, objects in a list (`uint16` year), explicit `false` (message mentions `pages`), and a field named `properties`.
  - Validation: Kallocain gives `"book"`, optional property absent, optional property with the wrong type.
  - Mismatches: missing `country` (source and message contents from the spec), `authors` as a string, several mismatches in one message, a tile without metadata, and a tile type error told apart from a tile validation error.
  - The tile deep-equals a copy taken before validation, for a match and a mismatch, and its `types` stays `[]`.
  - Reuse: a mismatch then a match with one validator, and two mismatches whose messages each name only their own missing field.

  Verify that the tests fail before 3.2.
- [x] 3.2 Implement `src/lib/tile/tile_validator.ts` (`TileValidator`, `buildTileValidator`, `validateTile`, `describeMetadataMismatch`) following D5 and D6: one module-level `Ajv` from `ajv/dist/jtd` with `allErrors: true` and `strictSchema: false`, `removeSchema` in `finally` after each compile, compile errors wrapped in `TileTypeError` with the D5 reason and `cause`, errors read right after the call, and the D6 mismatch descriptions joined with `"; "`. Add `buildTileValidator`, `validateTile`, `TileTypeError`, `TileValidationError` and `export type { TileValidator }` to `src/lib/tile/index.ts`, and add the four runtime names to the export list pinned by the "exports the public API" test in `tile_loader.test.ts`. Verify that `tile_validator.test.ts` and `tile_loader.test.ts` pass, and that `npm run lint` and `npm run build` succeed.
- [x] 3.3 Update `docs/modules/lib/tile/README.md` as described in D11 for the tile validator: the tile validator builder and tile validator bullets, a "Tile validator" entry under *Module Details* with the D9 additions and one example that builds a validator from `./types/book.md` and validates a loaded tile, and the Content-Security-Policy hosting note. Verify that every function and type the entry names is exported from `src/lib/tile/index.ts` and that the example's calls match the `buildTileValidator` and `validateTile` signatures.

## 4. Collection validator (design D7, D9, D11)

- [x] 4.1 Write `src/lib/tile/collection_validator.test.ts`, importing only from `./index.ts`, with the sample collection loaded through `loadTileCollection` and `fetchSample`, inline `TileCollection` objects, and validators built from the sample book type and inline `simple_event` and `country_location` types (from `docs/tesela_spec.md`) served by `fetchTestFile`. Cover every scenario of `specs/collection-validation/spec.md`:
  - The sample collection: same source, name, description and tile order, each tile with types `["book"]`, no issues. A collection with no tiles and no issues.
  - Type names: appended after an existing `simple_event`, not repeated when `book` is already there.
  - Mismatches: the second of three tiles without `country` (kept in place with types `[]`, one warning with its source, message naming `book` and `country`), two tiles without frontmatter (two warnings in tile order), and the issue shape (exactly `level`, `source`, `message`).
  - Existing issues: a loaded HTTP 404 error stays first, then the new warning.
  - Idempotency: validating the result again with the same validator deep-equals the first result. A mismatch validated again with a validator built again from the same file gives exactly one warning.
  - Several types: `book` then `simple_event` gives `["book", "simple_event"]`, and `book` then `country_location` on a tile without `country` gives two warnings in that order.
  - The input deep-equals a copy taken before validation, changing a result tile's `metadata.title` leaves the input tile unchanged, and `structuredClone` of the result deep-equals it.

  Verify that the tests fail before 4.2.
- [x] 4.2 Implement `src/lib/tile/collection_validator.ts` (`validateTileCollection`, `checkCollectionTile`, `addTileType`) following D7: `structuredClone` of the input first, issue keys from `JSON.stringify([level, source, message])` in a `Set`, only `TileValidationError` turned into a `warning` issue, type names added only when missing, and the result built fresh in a named variable with the existing issues first. Add `validateTileCollection` to `src/lib/tile/index.ts` and to the export list in `tile_loader.test.ts`. Verify that `collection_validator.test.ts` and `tile_loader.test.ts` pass, and that `npm run lint` and `npm run build` succeed.
- [x] 4.3 Update `docs/modules/lib/tile/README.md` as described in D11 for the collection validator: the collection validator bullet (warning level, issues added after the existing ones, idempotency, input unchanged) and a "Collection validator" entry under *Module Details* with one example that loads `./tiles/books_collection.yaml` and validates it with the book validator. Verify that `validateTileCollection` is exported from `src/lib/tile/index.ts` and that the example's call matches its signature.

## 5. Integration check

- [x] 5.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed, that each scenario in both spec files has a test named after it, that the tile-loading and collection-loading test cases are unchanged (apart from the export list and the fixture import from 1.2), and that `git status` shows only the files listed in the proposal's Impact section, `src/test/test_files.ts`, `collection_loader.test.ts`, `tile_loader.test.ts` and this change's folder.

## Workflow follow-up

- Archive this change once reviewed, so that `tile-validation` and `collection-validation` become main specs.
- Next steps outside the tile module: the mod API keeps only the tiles of a mod's type, and may need validators built from a `schema` inside `mod_conf.yaml` (design, Open Questions).
