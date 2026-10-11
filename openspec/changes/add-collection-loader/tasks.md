# Tasks

Each group writes its tests first (TDD) and names each test after the spec scenario it covers, so every scenario in `specs/collection-loading/spec.md` can be traced to a test.

## 1. Errors and issues (design D2, D7)

- [ ] 1.1 Extend `src/lib/tile/tile_errors.test.ts` with the same checks the existing classes have, for `YamlParseError` and `CollectionFormatError`: `instanceof Error`, `name` equal to the class name, the `source` property, the D7 message format with source and reason, and `cause` kept when given. Then add both classes to `src/lib/tile/tile_errors.ts`. Verify that the test passes and that `npm run lint` is clean.
- [ ] 1.2 Add `src/lib/tile/tile_issues.ts` with the `IssueLevel` and `TileIssue` types (types only, no runtime code). Verify that `npm run build` type-checks it.

## 2. YAML parser and shared YAML reading (design D3)

- [ ] 2.1 Write `src/lib/tile/yaml_parser.test.ts` calling `parseYaml` directly with `{ source, content }`:
  - The sample `tiles/books_collection.yaml` (through `readSampleText`) gives `content.collection.name` `"Science fiction books"` and `source` unchanged.
  - An unquoted date stays a string.
  - Empty input, a comment-only input, invalid YAML (`collection: [unclosed`), two documents, a repeated key, `!!binary` and `!!js/function` each raise `YamlParseError` with the source in `source` and in the message. For invalid YAML the cause is kept, and a global marker that the `!!js/function` code would set stays unset.
  - A list or a scalar at the top level is rejected as "YAML must be a mapping".
  - Parsing the same content twice gives independent objects.

  Verify that the tests fail before 2.2.
- [ ] 2.2 Implement `src/lib/tile/yaml_parser.ts` (`YamlValue`, `YamlMapping`, `ParsedYaml`, `readPlainYaml`, `isYamlMapping`, `describeYamlValue`, `parseYaml`). Move `isMapping` and `describeYamlValue` out of `markdown_parser.ts`. Rebuild `parseFrontmatterYaml` from the shared functions, keeping its message, and make `MetadataValue`/`Metadata` aliases of `YamlValue`/`YamlMapping`. Verify that `yaml_parser.test.ts` passes, that `markdown_parser.test.ts` and `tile_loader.test.ts` pass without any change, and that `npm run lint` and `npm run build` succeed.

## 3. Collection structure check (design D4)

- [ ] 3.1 Write `src/lib/tile/collection_format.test.ts` calling `readCollectionFormat` and `readTileEntry` directly:
  - The parsed sample collection gives its name, description and three entries.
  - A missing description gives `""`, and unknown keys such as `license` are not in the result.
  - A missing `collection` mapping, a missing, empty or numeric `name`, a non-string `description`, and a missing or non-list `tiles` each raise `CollectionFormatError` with the source and the D4 reason.
  - `readTileEntry` returns `{ kind: "path", location }` and `{ kind: "url", location }` for valid entries. It returns a malformed result with the D4 reason for a plain string entry, both keys, neither key, `path: 42` and `path: ""`. An extra key next to `path` is ignored.

  Verify that the tests fail before 3.2.
- [ ] 3.2 Implement `src/lib/tile/collection_format.ts` (`CollectionFormat`, `TileEntry`, the malformed-entry result, `readCollectionFormat`, `readTileEntry`). Verify that `collection_format.test.ts` passes and that `npm run lint` is clean.

## 4. Collection loader, entry point and docs (design D5, D6, D8, D9, D10)

- [ ] 4.1 Write `src/lib/tile/collection_loader.test.ts`, importing only from `./index.ts`, with the D9 fixtures (`fetchSample`, a module-level `fetchTestFile` wrapped in `vi.fn`, and `indexLocalFiles` with `Blob`s). Cover every scenario of the spec:
  - Load the sample collection: exact keys, name, description, title order, empty types and issues. A collection without tiles.
  - Collection location: relative with a base, and without any base (no request).
  - Collection-level failures: 404, invalid YAML, empty file, top-level list, `!!binary`, `!!js/function`, two documents, missing `collection`, numeric `name`, missing `tiles`. For each, check the error class and its `source`, and that no tile is requested. Also check that the three failure kinds can be told apart.
  - Entries: relative and parent-folder `path`, absolute `url`, relative `url`, both keys at entry 2 (the other entries still load), neither key, plain string, `path: 42`. Check the issue source, message and position, and that malformed entries are never requested.
  - Tile failures: one 404 among three, one invalid frontmatter, every tile failing.
  - Order kept when the first response arrives last.
  - Parallel limit: with 10 entries and pending responses, only the first 6 are requested; resolving one starts the 7th. A collection of 10 tiles that all load gives 10 tiles in entry order with no issues.
  - The same tile by `path` and by `url`: one request, one tile at the first position, one warning.
  - Local rule: a remote collection listing a `file:` URL (picked file not read, error issue), a collection in a picked folder (three tiles, `file:///library/books/farenheit_451.md`, fetch not called), and a local collection listing a remote tile.
  - The issue for a failed tile has exactly `level`, `source` and `message`.
  - `structuredClone` of the sample collection deep-equals it, and two loads of the same collection do not share tiles.

  Verify that the tests fail before 4.2.
- [ ] 4.2 Implement `src/lib/tile/collection_loader.ts` (`TileCollection`, `loadTileCollection`) following D5 and D6: slots planned in entry order before any request, `localFiles` passed to tiles only for `file:` collections, `loadCollectionTile` turning only `FileFetchError` and `MarkdownParseError` into issues, at most `MAX_PARALLEL_TILE_LOADS` (6) loads in progress through the D6 load workers, results stored by slot index, and assembly in slot order. Add the D8 exports to `src/lib/tile/index.ts`, with types through `export type` and the internal helpers not exported. Verify that `collection_loader.test.ts` passes and that `npm run lint` and `npm run build` succeed.
- [ ] 4.3 Update `docs/modules/lib/tile/README.md` as described in D10: the YAML parser bullet, the collection loader bullet (including the parallel limit), the issue source rule, and a "Collection loader" entry under *Module Details* with the D8 additions and one usage example that loads `./tiles/books_collection.yaml`. Verify that every function and type named in the README is exported from `src/lib/tile/index.ts` and that the example's call matches the `loadTileCollection` signature.

## 5. Integration check

- [ ] 5.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed, that each scenario in `specs/collection-loading/spec.md` has a test named after it, that the tile-loading tests are unchanged, and that `git status` shows only the files listed in the proposal's Impact section plus this change's folder.

## Workflow follow-up

- Archive the change once reviewed, so that `openspec/specs/collection-loading/spec.md` becomes a main spec.
- Next change in the tile module series: tile validator. It builds a validator from a type file with the markdown parser, adds `additionalProperties: true` when it is omitted, and reuses `TileIssue` only if the collection validator needs it there.
