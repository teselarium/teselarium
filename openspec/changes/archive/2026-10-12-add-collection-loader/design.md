# Design

## Context

See proposal.md (Why) for motivation and specs/collection-loading/spec.md for the required behavior.

Current state, from the archived change `add-tile-loader`:

- `src/lib/tile/` has the file fetcher (`resolveLocation`, `fetchFile`), picked local files (`indexLocalFiles`, `readLocalFile`), the markdown parser (`parseMarkdown`) and the tile loader (`loadTile`), all re-exported from `index.ts`. Errors live in `tile_errors.ts` (`FileFetchError`, `MarkdownParseError`, each with a `source`) together with `describeErrorCause`.
- `markdown_parser.ts` holds the YAML reading rules that this change shares: js-yaml `load` with `CORE_SCHEMA`, a top-level mapping check (`isMapping`) and `describeYamlValue` for its error message.
- `fetchFile` calls the fetch function synchronously, before its first `await`. `loadTile` never shares objects between calls.
- Library tests run in Node (`lib` Vitest project, no `document`). `src/test/sample_files.ts` serves `samples/` under `https://example.org/samples/` through `fetchSample`. `samples/tiles/books_collection.yaml` lists three relative `path` entries.
- Oxlint enforces function declarations, named functions, explicit return types, no `forEach`/`reduce` and a maximum depth of 3. Review checks the other conventions in [docs/code_conventions.md](../../../docs/code_conventions.md).

js-yaml 5.4.3 with `CORE_SCHEMA`, as checked while preparing this design: empty or comment-only input throws ("expected a document, but the input is empty"), a stream with more than one document throws, duplicate keys throw, `!!binary` throws as an unknown tag, and unquoted dates stay strings. All the YAML scenarios in the spec are therefore covered by `load` plus the mapping check.

## Goals / Non-Goals

**Goals:**

- The collection loader is built from the existing pieces (`resolveLocation`, `fetchFile`, `loadTile`) plus one new parser. No change to their behavior or signatures.
- Every check that does not need the network (structure, entries, local rule, repeats) runs before any tile request, so malformed entries never cause requests.
- Tiles load in parallel, with at most 6 loads in progress at once (D6), but the result is deterministic: tiles and issues follow the order of the entries.

**Non-Goals:**

- A generic schema engine for collection files. The structure is small and checked by hand (D4).
- Catching every possible error. Only the two tile failure kinds become issues. Anything else is a bug and rejects the load (D6).
- Treating a `path` that holds an absolute URL as malformed. Strictness only applies to `url` (see Risks).

## Decisions

### D1. Module layout

```
src/lib/tile/
  yaml_parser.ts         # YamlValue, YamlMapping, ParsedYaml, readPlainYaml, isYamlMapping, describeYamlValue, parseYaml (D3)
  markdown_parser.ts     # now reads frontmatter through readPlainYaml (D3)
  tile_errors.ts         # + YamlParseError, CollectionFormatError (D7)
  tile_issues.ts         # IssueLevel, TileIssue (D2)
  collection_format.ts   # CollectionFormat, TileEntry, readCollectionFormat, readTileEntry (D4)
  collection_loader.ts   # TileCollection, loadTileCollection (D5, D6)
```

Imports go one way: `collection_loader` → `file_fetcher`, `yaml_parser`, `collection_format`, `tile_loader`, `tile_issues`, `tile_errors`. `collection_format` → `yaml_parser` (types), `tile_errors`. `markdown_parser` → `yaml_parser`. `yaml_parser` → `tile_errors`, `file_fetcher` (type only). There are no cycles.

- Alternative considered: putting the structure check inside `collection_loader.ts`. Rejected: the check is pure and has many cases, so a separate file keeps it small and lets it be tested without fetching anything.

### D2. Data shapes (the downstream contract)

```ts
// yaml_parser.ts
type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };
type YamlMapping = { [key: string]: YamlValue };
interface ParsedYaml { source: string; content: YamlMapping }

// markdown_parser.ts (public names unchanged)
type MetadataValue = YamlValue;
type Metadata = YamlMapping;

// tile_issues.ts
type IssueLevel = "warning" | "error";
interface TileIssue { level: IssueLevel; source: string; message: string }

// collection_loader.ts
interface TileCollection {
  source: string;       // resolved absolute URL of the collection file
  name: string;
  description: string;  // "" when the file has none
  tiles: Tile[];
  issues: TileIssue[];
}
```

Functions:

```ts
parseYaml(file: FetchedFile): ParsedYaml
loadTileCollection(location: string, options?: FileFetchOptions): Promise<TileCollection>
```

`loadTileCollection` matches the README pseudo-code `load_tile_collection` and takes the same `FileFetchOptions` as `loadTile`. All shapes are plain data, like `Tile`, so a collection can be passed to a sandboxed mod with `postMessage`. `TileIssue` is named for the domain (an issue about a tile), not a generic `Issue`. The collection validator will reuse it.

### D3. YAML parser and shared YAML reading

`yaml_parser.ts` takes over the YAML reading rules from `markdown_parser.ts`:

- `readPlainYaml(text): YamlValue` calls `load(text, { schema: CORE_SCHEMA })` and lets js-yaml errors through unchanged.
- `isYamlMapping(value)` and `describeYamlValue(value)` move here unchanged (from `isMapping` and `describeYamlValue`).
- `parseYaml(file)` calls `readPlainYaml`, wraps any error in `YamlParseError(file.source, error message, { cause })`, raises `YamlParseError` with "YAML must be a mapping, found <description>" when the top level is not a mapping, and returns `{ source, content }` through a named variable.

`markdown_parser.ts` keeps its own engine `parseFrontmatterYaml`, now built from `readPlainYaml`, `isYamlMapping` and `describeYamlValue`, with its current message ("frontmatter must be a mapping, …"). Its tests stay as they are and must keep passing, which shows the move changed no behavior. This is the "move the shared part into its own file" step recorded in `add-tile-loader`'s tasks.

- Alternative considered: `parseYaml` returning any `YamlValue`, with the mapping check left to callers. Rejected: every OpenTesela YAML file (collection, `mod_conf.yaml`, mosaic) has a mapping at its top level, so the check belongs in one place.

### D4. Collection structure check

`readCollectionFormat(parsedYaml): CollectionFormat` (`{ name, description, entries: YamlValue[] }`) checks the structure by hand and raises `CollectionFormatError(source, reason)` with one reason per rule: `a "collection" mapping is required`, `"name" must be a non-empty string`, `"description" must be a string`, `"tiles" must be a list`. Unknown keys are not read.

`readTileEntry(entry, position)` checks one entry without resolving it. It returns a discriminated union: a `TileEntry` (`{ kind: "path" | "url", location }`) or a malformed entry with a reason (`must be a mapping`, `must have exactly one of "path" or "url"`, `"path" must be a non-empty string`). Malformed entries are an expected result, not an exception, so the loader handles them with a plain branch.

- Alternative considered: a JTD schema run through Ajv. Rejected for the same reason as the discarded draft: JTD cannot express "exactly one of `path` or `url`", and hand-written messages are more precise.

### D5. Planning the tile loads (no requests)

Before any tile request, the loader goes through the entries in order and turns each one into a **slot**: either an issue or a tile URL to load.

1. `readTileEntry`. Malformed → error issue.
2. Resolve. `path` → `resolveLocation(location, collection.source)`. A `FileFetchError` from it becomes a malformed-entry issue with the error's reason. `url` → `URL.canParse(location)` without a base. If false → malformed-entry issue ("`url` must be an absolute URL, found "<location>""). Otherwise `new URL(location)`.
3. Local rule. If the tile URL's protocol is `file:` and the collection's is not → error issue with the tile URL as source ("a remote collection cannot list local files").
4. Repeats. A `Map` from tile href to the first entry's position. A repeat → warning issue with the tile href as source, naming both positions. Otherwise the href is recorded and the slot is a load.

Malformed-entry issues use the collection's source, because the entry has no usable tile location. Their message is `Tile entry <position> in collection "<source>": <reason>`, with positions counted from 1.

As defense in depth, tiles are loaded with `localFiles` only when the collection itself is `file:`. A remote collection's tiles never receive the picked files, even if step 3 were bypassed.

### D6. Loading and assembling

- For each load slot, a named async function `loadCollectionTile(href, tileOptions)` calls `loadTile`. It returns the tile, or catches `FileFetchError` and `MarkdownParseError` and returns an error issue with `error.source` and `error.message`. It rethrows any other error.
- **Parallel limit.** A module constant `MAX_PARALLEL_TILE_LOADS = 6` caps the loads in progress. The loader starts `min(6, number of loads)` load workers, each a call to a named async function `runTileLoadWorker(loadQueue, tileOptions)`. `loadQueue` holds the load slots, a `next` cursor and a results array indexed like the slots. Each worker loops with `while`: it takes the slot at `next`, advances the cursor, awaits `loadCollectionTile` and stores the result at that slot's index. JavaScript runs one task at a time and the cursor only moves between awaits, so no slot is taken twice. Slots start in entry order, and a new one starts as soon as any load finishes.
- The workers are awaited with `Promise.all`. An unexpected error (a bug) rejects the whole load instead of being hidden as an issue. `Promise.allSettled` is not needed because tile failures never reject. After such a rejection, the other workers finish their current loads and their results are dropped.
- The mutable queue is the one exception to the functional style of the module. It never leaves `loadTileCollection`, and the returned collection is built fresh from it.
- Why 6: over HTTP/1.1, browsers open at most 6 connections per host, so more parallel requests would only wait inside the browser. HTTP/2 hosts such as GitHub could take more, but a single fixed value keeps the API unchanged (see Risks).
- Assembly walks the slots in entry order with `for…of` and pushes each tile or issue into its list. The result is a new `TileCollection` built in a named variable. This gives the order the spec requires, whatever order the responses arrive in.
- `tileOptions` is `{ fetch: options.fetch, localFiles }` (see D5). No `baseUrl` is needed because every tile href is already absolute.

Full flow of `loadTileCollection`: `fetchFile(location, options)` → `parseYaml` → `readCollectionFormat` → plan (D5) → load (D6) → assemble. Collection-level failures come from the first three steps and propagate as `FileFetchError`, `YamlParseError` or `CollectionFormatError`.

- Alternative considered: loading tiles one after another. Simpler, but a collection of 100 remote tiles would take 100 round trips.
- Alternative considered: starting every load at once with a single `Promise.all`. Rejected (user decision): a large collection would create hundreds of pending requests at once.
- Alternative considered: batches of 6 with one `Promise.all` per batch. Simpler than workers, but one slow tile holds up its whole batch.
- Alternative considered: the `p-limit` package. Rejected: it adds a dependency for about 20 lines of code.

### D7. Errors

`tile_errors.ts` gets two classes with the same pattern as the existing ones (extend `Error`, set `name`, assign `readonly source` in the constructor):

```ts
new YamlParseError(source, reason, { cause })      // message: Cannot parse YAML "<source>": <reason>
new CollectionFormatError(source, reason)          // message: Invalid tile collection "<source>": <reason>
```

### D8. Public entry point

`index.ts` adds `parseYaml`, `loadTileCollection`, `YamlParseError`, `CollectionFormatError` and the types `YamlValue`, `YamlMapping`, `ParsedYaml`, `IssueLevel`, `TileIssue` and `TileCollection` (`export type`). `readPlainYaml`, `isYamlMapping`, `describeYamlValue`, `readCollectionFormat` and `readTileEntry` stay internal.

### D9. Tests

- `yaml_parser.test.ts` and `collection_format.test.ts` call the pure functions directly with inline strings and values.
- `collection_loader.test.ts` imports only from `./index.ts`.
  - The sample collection loads through `fetchSample`.
  - Inline collections and tiles for remote cases are served by a module-level named function in the test file, `fetchTestFile(input)`, which looks the URL up in a module-level `Map` of test texts and otherwise falls back to `fetchSample`. It is wrapped with `vi.fn(fetchTestFile)` so tests can check the requested URLs. Responses therefore do not depend on call order.
  - Local-collection cases use `indexLocalFiles` with `Blob`s built from `readSampleText` or inline text.
  - Out-of-order arrival uses a fetch mock whose response for the first tile is a pending promise that the test resolves after the others.
  - The parallel limit uses a fetch mock that answers every tile request with a pending promise and keeps its resolver in a module-level list. The test checks that the mock has 6 calls, resolves one response, waits for pending promise callbacks to run (for example `await vi.waitFor(...)` on the call count), and checks that a 7th call was made for the 7th entry's URL.
- Tests are written before the code for each file (TDD). Each spec scenario maps to at least one test named after it.

### D10. Docs

`docs/modules/lib/tile/README.md`:

- The YAML parser bullet says that it uses the frontmatter's plain-data rules and requires a mapping at the top level.
- The collection loader bullet lists the output properties (`source`, `name`, `description`, `tiles`, `issues`) and covers which failures throw and which become issues, the `path`/`url` rule, repeated tiles, the limit of 6 parallel tile loads and the local-files rule.
- The issue bullet says that the source is the tile's source, or the collection's source for an entry with no usable location.
- A "Collection loader" entry under *Module Details* lists the D8 additions with one example.

## Risks / Trade-offs

- [A fixed limit of 6 can be slower than needed on HTTP/2 hosts, and tiles spread over several hosts share the same 6 loads] → acceptable for collections of tens to hundreds of tiles. The limit can become a collection option later, with 6 as its default, without breaking callers.
- [The limit applies per collection, so loading several collections at once multiplies the requests] → mosaics load one collection each. A shared limit can be added if a caller loads many collections.
- [Repeats are detected by normalized href, so URLs that differ only by query string or letter case count as different tiles] → accepted. The same rule makes `source` stable, which the collection validator relies on.
- [A `path` holding an absolute URL (for example `path: "https://…"`) resolves to itself and is accepted] → harmless, because the local rule still applies to the resolved URL. Rejecting it would add a rule the format does not need.
- [A remote collection can list tiles from any host] → tiles are plain data and never run. Safe rendering of the markdown body is the viewer's job.
- [`URL.canParse` needs a recent browser (2023+)] → it is in every browser that supports the ES2023 target already used by the build.
- [Malformed-entry issues use the collection's source, not a tile path as the README first said] → the README is updated (D10). The message still names the entry and its raw value.

## Open Questions

- Whether to cache tiles shared by several collections is decided when mosaics need it. A cache would sit on top of `loadTile` and would not change this spec.
