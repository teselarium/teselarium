# Tasks

Each group writes its tests first (TDD) and names each test after the spec scenario it covers, so every scenario in `specs/tile-loading/spec.md` can be traced to a test.

## 1. Errors and test fixtures (design D7, D9)

- [x] 1.1 Write `src/lib/tile/tile_errors.test.ts`. For `FileFetchError` and `MarkdownParseError` it checks: `instanceof Error`, `name` equal to the class name, the `source` property, the message format from D7 including source and reason, and `cause` kept when given. Then implement `src/lib/tile/tile_errors.ts`, assigning `source` in the constructor (no parameter properties). Verify that the test passes under the `lib` project and that `npm run lint` is clean.
- [x] 1.2 Add `src/test/sample_files.ts` with `SAMPLES_BASE_URL` (`https://example.org/samples/`), `readSampleText(relativePath)` and `fetchSample(input)`. `fetchSample` is a named function that returns the file under `samples/` for URLs below the base, and a `404 Not Found` `Response` otherwise. Verify that `npm run build` (which type-checks `tsconfig.test.json`) and `npm run lint` pass. Its behavior is exercised by the tests in groups 3 and 5.

## 2. Picked local files (design D5)

- [x] 2.1 Write `src/lib/tile/local_files.test.ts`. `indexLocalFiles` keys `library/books/kallocain.md` and `/library/books/kallocain.md` both as `file:///library/books/kallocain.md`, keys `library/my books/kallocain.md` as `file:///library/my%20books/kallocain.md`, and keeps the later file when a path repeats. `readLocalFile` returns the text of a picked `Blob`. It raises `FileFetchError` with the source when the file was not picked ("not among the picked files") or when no local files were given, and keeps the cause when `text()` rejects (an object with a rejecting `vi.fn()` as `text`). Verify that the tests fail before 2.2.
- [x] 2.2 Implement `src/lib/tile/local_files.ts` (`PickedFile`, `LocalFiles`, `indexLocalFiles`, `readLocalFile`). Verify that `local_files.test.ts` passes and that `npm run lint` is clean.

## 3. File fetcher (design D3, D4)

- [x] 3.1 Write `src/lib/tile/file_fetcher.test.ts` covering the spec scenarios for location resolution, fetch failures and local files at the fetcher level:
  - `resolveLocation`: relative path with a base, dot segments, absolute URL ignores the base, a relative path without a base gives a `FileFetchError` mentioning the base URL, and `https://[bad/kallocain.md` gives a `FileFetchError` including the location.
  - `fetchFile`: the sample is served through `fetchSample` with `source` equal to the resolved URL and `content` equal to `readSampleText`; the fetch mock receives the resolved URL and is called with `this` set to `undefined` (`mock.contexts`).
  - The browser default base is used through `vi.stubGlobal("document", …)`, with `vi.unstubAllGlobals()` afterwards; outside a page, a relative location without a base never calls fetch.
  - HTTP 404 gives an error with the source and `404`; a network rejection is kept as the cause; a failing `response.text()` is wrapped.
  - A `file:` location is read from `localFiles` and the fetch mock is not called, including `./my books/kallocain.md` against `file:///library/`.

  Verify that the tests fail before 3.2.
- [x] 3.2 Implement `src/lib/tile/file_fetcher.ts` (`FetchedFile`, `FileFetchOptions`, `resolveLocation`, `fetchFile`). It sends `file:` URLs to `readLocalFile` and calls the fetch function as a plain local variable. Verify that `file_fetcher.test.ts` passes and that `npm run lint` is clean.

## 4. Markdown parser (design D6)

- [x] 4.1 Write `src/lib/tile/markdown_parser.test.ts` covering every frontmatter and body scenario in the spec, called directly with `{ source, content }`:
  - Sample `farenheit_451.md` metadata: title, genres and `pages` as a number.
  - The sample body equals the fixture text after the closing `---` line and starts with `\nFahrenheit 451 is a 1953 dystopian novel`.
  - Markdown syntax is kept unchanged; CRLF input works.
  - An empty block and a comment-only block give `{}`.
  - No frontmatter, a delimiter not on the first line, an empty file and a `----` first line all give empty metadata and the whole content as body.
  - An unquoted date stays a string.
  - `!!binary` is rejected. `!!js/function` and `---js` are rejected, and a global marker that the embedded code would set stays unset.
  - `---json` is rejected as "must be YAML"; `---yaml` and `---yml` are accepted.
  - Invalid YAML gives a `MarkdownParseError` with the source in `source` and in the message, and the cause kept.
  - List and scalar frontmatter are rejected as "must be a mapping"; an unclosed block is rejected as "not closed"; a repeated key is rejected.
  - Parsing the same content twice gives independent metadata objects.

  Verify that the tests fail before 4.2.
- [x] 4.2 Implement `src/lib/tile/markdown_parser.ts` (`MetadataValue`, `Metadata`, `ParsedMarkdown`, `parseMarkdown`) following the D6 steps: the no-frontmatter early return, the YAML-language check through `matter.language`, the closed-block check, gray-matter with the `CORE_SCHEMA` engine and the mapping check, and errors from gray-matter wrapped in `MarkdownParseError`. Verify that `markdown_parser.test.ts` passes and that `npm run lint` is clean.

## 5. Tile loader, entry point and docs (design D2, D8, D10)

- [x] 5.1 Write `src/lib/tile/tile_loader.test.ts`, importing only from `./index.ts` so the public entry point is covered. It checks:
  - Loading Kallocain via `fetchSample` gives exactly the keys `source`, `metadata`, `body` and `types`, with `types` equal to `[]` and the expected source and metadata.
  - A relative path with a base.
  - The picked-folder scenario (a `Blob` from `readSampleText`, source `file:///library/books/kallocain.md`, fetch mock not called).
  - A 404 rejects with `FileFetchError` and invalid YAML rejects with `MarkdownParseError`, each with its resolved `source`.
  - `structuredClone(tile)` deep-equals the tile.
  - Loading the same file twice, then changing the first tile's title, leaves the second unchanged.

  Verify that the tests fail before 5.2.
- [x] 5.2 Implement `src/lib/tile/tile_loader.ts` (`Tile`, `loadTile`) and `src/lib/tile/index.ts` with the D8 exports (types through `export type`, `readLocalFile` not exported). Verify that `tile_loader.test.ts` passes, and that `npm run lint` and `npm run build` succeed.
- [x] 5.3 Update `docs/modules/lib/tile/README.md` as described in D10:
  - The file fetcher's `source` is the resolved absolute URL.
  - Picked local files use virtual `file:///<path inside the picked folder>` URLs.
  - Frontmatter is YAML only, and files without frontmatter load with empty metadata.
  - A "Tile loader" entry under *Module Details* lists the `index.ts` API with one usage example, and adds the CORS hosting note.

  Verify that every function and type named in the README is exported from `src/lib/tile/index.ts`, and that the example's call matches the `loadTile` signature.

## 6. Integration check

- [x] 6.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed, that each scenario in `specs/tile-loading/spec.md` has a test named after it, and that `git status` shows only the files listed in the proposal's Impact section plus this change's folder.

## Workflow follow-up

- Archive the change once reviewed, so that `openspec/specs/tile-loading/spec.md` becomes the main spec.
- Next change in the tile module series: collection loader. It reuses `resolveLocation` and `fetchFile`, adds the YAML file parser with the same `CORE_SCHEMA` rules as the frontmatter engine (move the shared part into its own file at that point), and must only allow `file:` tile entries in collections that were themselves loaded from `file:` (design.md, Risks).
