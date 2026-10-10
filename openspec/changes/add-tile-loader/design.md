# Design

## Context

See proposal.md (Why) for motivation and specs/tile-loading/spec.md for the required behavior.

Current state, from the archived change `setup-project-config`:

- `src/lib/tile/` exists and holds only `dependencies.test.ts`. Vitest runs `src/lib/**/*.test.ts` in the `lib` project with the `node` environment, so library tests have no `window` or `document`.
- `tsconfig.app.json` type-checks all of `src/` except tests and `src/test/`. It sets `verbatimModuleSyntax` (type-only imports use `import type`) and `erasableSyntaxOnly` (no constructor parameter properties, no enums). Imports use explicit `.ts` extensions. `src/test/` is type-checked by `tsconfig.test.json` with Node types and is not part of the app build.
- Oxlint enforces function declarations, named functions, explicit return types, explicit loops and a maximum depth of 3. The other conventions in [docs/code_conventions.md](../../../docs/code_conventions.md) are checked during review: no inline arrow callbacks, no returning anonymous object or list literals, no nested functions, domain naming, and errors with context.

Library behavior observed while preparing this design (`@11ty/gray-matter` 3.0.0, `js-yaml` 5.4.3):

- gray-matter called **without options** caches results by content and returns objects shared between calls. With any options object, it does not cache.
- gray-matter accepts a language after the opening delimiter (`---json` parses with `JSON.parse`, `---js` throws, unknown languages throw "engine not registered"). It treats a block with no closing delimiter as frontmatter running to the end of the file, with an empty body. It returns `{}` for an empty or comment-only block without calling the YAML engine. After the closing `---`, it removes exactly one line break (`\r\n` or `\n`).
- js-yaml `load` throws on empty input. In 5.x, even the default schema keeps `1953-10-19` a string, so the risk note in the archived design about `Date` objects is out of date. `CORE_SCHEMA` rejects `!!timestamp`, `!!binary` and `!!js/*` tags. Duplicate keys throw. A `__proto__` key stays an ordinary own key and does not pollute the prototype.
- Browsers do not let a page served over http(s) fetch `file:///` URLs. Local files can only be read from files the user picks (`File`/`Blob`).

## Goals / Non-Goals

**Goals:**

- Three small, separately tested building blocks (file fetcher, markdown parser, tile loader), which the next changes reuse without modification. The collection loader will reuse location resolution and the file fetcher. The tile validator builder will reuse the file fetcher and the markdown parser.
- Only the file fetcher does I/O. Parsing is pure and synchronous.
- Every library test runs in Node without network access, using an injected fetch and in-memory `Blob`s.

**Non-Goals:**

- Checking metadata beyond "the top level is a mapping". Field shapes are the tile validator's job.
- Exposing gray-matter extras (excerpts, sections, custom delimiters).
- Blocking URL schemes. `file:` is routed to the picked files and everything else goes to `fetch`, which rejects what it cannot load.
- Changing `src/lib/tile/dependencies.test.ts`. Its gray-matter case overlaps with the new tests, but its other two cases still cover assumptions that the next changes rely on.

## Decisions

### D1. Module layout

```
src/lib/tile/
  index.ts              # public entry point, re-exports only (D8)
  tile_errors.ts        # FileFetchError, MarkdownParseError (D7)
  local_files.ts        # PickedFile, LocalFiles, indexLocalFiles, readLocalFile (D5)
  file_fetcher.ts       # FetchedFile, FileFetchOptions, resolveLocation, fetchFile (D3, D4)
  markdown_parser.ts    # Metadata, ParsedMarkdown, parseMarkdown (D6)
  tile_loader.ts        # Tile, loadTile
  *.test.ts             # tests next to each file
src/test/
  sample_files.ts       # test-only: sample fetch and sample readers (D9)
```

Imports go one way: `tile_loader` → `file_fetcher`, `markdown_parser`. `file_fetcher` → `local_files`, `tile_errors`. `markdown_parser` → `tile_errors`. There are no cycles. Each type lives in the file that produces it, which avoids a catch-all `types.ts`, a name that would also be confused with *tile types*. File names are snake_case, like the docs' component names. Identifiers use standard TypeScript camelCase and PascalCase.

- Alternative considered: a single `tile_loader.ts`. Rejected because the next changes reuse the fetcher and the parser on their own, and Single Responsibility keeps each file small.

### D2. Data shapes (the downstream contract)

```ts
// markdown_parser.ts
type MetadataValue = string | number | boolean | null | MetadataValue[] | { [key: string]: MetadataValue };
type Metadata = { [key: string]: MetadataValue };
interface ParsedMarkdown { source: string; metadata: Metadata; body: string }

// file_fetcher.ts
interface FetchedFile { source: string; content: string }
interface FileFetchOptions {
  baseUrl?: string;                 // base for relative locations (D3)
  fetch?: typeof globalThis.fetch;  // reader for non-file: URLs, default globalThis.fetch (D4)
  localFiles?: LocalFiles;          // picked files, needed for file: locations (D5)
}

// local_files.ts
interface PickedFile { path: string; content: Blob }  // path inside the picked folder
type LocalFiles = ReadonlyMap<string, Blob>;          // key: file:/// URL href

// tile_loader.ts
interface Tile extends ParsedMarkdown { types: string[] }  // tile type names, [] when loaded
```

Functions:

```ts
resolveLocation(location: string, baseUrl: string | undefined): URL
fetchFile(location: string, options?: FileFetchOptions): Promise<FetchedFile>
indexLocalFiles(pickedFiles: Iterable<PickedFile>): LocalFiles
parseMarkdown(file: FetchedFile): ParsedMarkdown
loadTile(location: string, options?: FileFetchOptions): Promise<Tile>
```

`loadTile` is `fetchFile`, then `parseMarkdown`, then a new `Tile` object with `types: []`, stored in a variable before it is returned (convention). All data is plain (no class instances), so it can be passed to sandboxed mod iframes with `postMessage` (structured clone) without conversion. `Tile extends ParsedMarkdown` is interface extension, not class inheritance.

### D3. Location resolution

- `resolveLocation(location, baseUrl)` returns `new URL(location, baseUrl)`. If that throws, it raises `FileFetchError` with the location as `source`. The message says either that a base URL is required (no base was given) or that the location cannot be resolved against the given base. The collection loader will call it with the collection's `source` as base.
- `fetchFile` passes `options.baseUrl`, or, when that is absent, `document.baseURI` if `typeof document !== "undefined"`. The browser uses the same base for a relative `fetch`. In Node there is no default, so relative locations need an explicit base.
- The `source` of the result is the resolved `URL.href`. It is normalized: dot segments are removed and characters such as spaces are percent-encoded.

### D4. Reading remote files

- The fetch function is `options.fetch ?? globalThis.fetch`. It is stored in a local variable and **called as a plain function** (`fetchFunction(url)`, never `options.fetch(url)`), because browsers throw "Illegal invocation" when `window.fetch` is called with another `this`. A test checks that the fetch mock was called with `this` set to `undefined`.
- If the call rejects (network, CORS), the result is a `FileFetchError` with `cause` set to the original error. If `response.ok` is false, the result is a `FileFetchError` whose message includes `HTTP <status> <statusText>`. Failures while reading the body (`response.text()`) are wrapped the same way.
- `source` is the requested URL, not `response.url`. It stays deterministic when the server redirects, and test responses built with `new Response(...)` have an empty `url`.
- Alternative considered: a fetch-like "reader" interface for both remote and local files. Rejected for now: `typeof fetch` lets tests inject `vi.fn()` directly, and local files need a lookup, not a request.

### D5. Picked local files

- A picked file is `{ path, content }`. The path is the file's path inside the picked folder, such as `library/books/kallocain.md` (from `File.webkitRelativePath` for folder inputs) or `/library/books/kallocain.md` (from `FileSystemEntry.fullPath` for drag-and-drop). For a single file it is just `kallocain.md`. The UI change builds these pairs. The library accepts plain `Blob`s, so Node tests do not need `File`.
- `indexLocalFiles` stores each picked file under `new URL(path, "file:///").href`. Resolution uses the same function, so lookups match exactly, with or without a leading slash and with percent-encoding. If the same path appears twice, the later file replaces the earlier one.
- `fetchFile` sends any resolved URL with protocol `file:` to `readLocalFile(url, options.localFiles)` and never calls fetch for it. A missing `localFiles`, a missing key, or a rejected `blob.text()` raises `FileFetchError`. `blob.text()` decodes UTF-8 and removes a BOM, like `response.text()`.
- The `file:///` root is virtual. It stands for "the picked folder", not a path on disk, which browsers never reveal. Dot segments cannot go above `file:///`, and a path outside the picked files simply fails as not picked.
- Alternative considered: the File System Access API (`showDirectoryPicker`). Rejected (user decision) because it only works in Chromium. It can be added later as another way of building `LocalFiles`.

### D6. Markdown parsing: gray-matter with three checks

`parseMarkdown(file)` steps:

1. **No frontmatter**: if the content does not start with `---`, or its fourth character is `-` (the same opening rule as gray-matter), return empty metadata and the content unchanged as body. gray-matter is not called.
2. **YAML only**: `matter.language(content).name` must be `""`, `"yaml"` or `"yml"`. Otherwise raise `MarkdownParseError` ("frontmatter must be YAML, found `json`"). This runs before parsing, so other languages are never evaluated and the message stays clear.
3. **Closed block**: the content must contain `\n---` after the opening line (gray-matter's own closing rule). Otherwise raise `MarkdownParseError` ("frontmatter is not closed").
4. **Parse**: call `matter(content, FRONTMATTER_OPTIONS)` with `engines: { yaml: parseFrontmatterYaml }`. Passing options also turns off gray-matter's shared cache, which gives "independent tiles" from the spec. `parseFrontmatterYaml` runs js-yaml `load(text, { schema: CORE_SCHEMA })` and checks that the result is a mapping (not `null`, not an array, not a scalar), so it returns an `object` as gray-matter's engine type requires. Any error thrown inside gray-matter becomes `MarkdownParseError(source, error.message, { cause })`.
5. Return `{ source, metadata: parsed.data, body: parsed.content }` through a named variable.

`CORE_SCHEMA` is set explicitly even though the js-yaml 5 default behaves the same today, so a future default cannot quietly change metadata types.

- Alternative considered: our own frontmatter splitter of about 30 lines, with js-yaml and no gray-matter. It is simpler and fully under our control, but gray-matter is the frontmatter library listed in `docs/stack.md` and was checked in the browser by the previous change. We keep it, and steps 1 and 3 copy its delimiter rules. Tests cover these rules, so a gray-matter upgrade that changes them fails a test first. If the checks grow beyond this, switching to an own splitter changes no spec.

### D7. Errors

`tile_errors.ts` defines two classes. Each extends `Error` (the one inheritance the platform requires, for `instanceof` and stack traces), sets `name`, and assigns a `readonly source: string` in the constructor (no parameter properties, because of `erasableSyntaxOnly`):

```ts
new FileFetchError(source, reason, { cause })      // message: Cannot load file "<source>": <reason>
new MarkdownParseError(source, reason, { cause })  // message: Cannot parse markdown "<source>": <reason>
```

The constructor builds the message, so every error includes its source (convention: errors with context). `loadTile` does not wrap again: callers get the specific class. The collection loader will map `error.source` and `error.message` to an issue. Later changes add their own errors (for example for tile types) to the same file.

### D8. Public entry point

`index.ts` re-exports `loadTile`, `fetchFile`, `resolveLocation`, `parseMarkdown`, `indexLocalFiles`, both error classes and the D2 types (`export type`). `readLocalFile` stays internal. These are the components the tile module README lists, and other modules (mod, mosaic, UI) import only from here.

### D9. Tests

- `src/test/sample_files.ts` (test-only, Node types) exports `SAMPLES_BASE_URL = "https://example.org/samples/"`, `readSampleText(relativePath)` and `fetchSample(input)`, a named fetch that serves files under `samples/` for URLs under that base and returns a 404 `Response` otherwise. Tests build failure cases with `vi.fn()` and `mockRejectedValue`/`mockResolvedValue` instead of inline functions.
- The browser default base is tested with `vi.stubGlobal("document", { baseURI: "https://example.org/app/" })` and cleaned up with `vi.unstubAllGlobals()`.
- Local files are tested with `new Blob([...])`. An unreadable file is an object whose `text` is a rejecting `vi.fn()`.
- Tests are written before the code for each file (TDD, per the project principles). Each spec scenario maps to at least one test.

### D10. Docs

`docs/modules/lib/tile/README.md` gets three updates: the file fetcher's `source` is the resolved absolute URL, picked local files use virtual `file:///` URLs, and files without frontmatter load with empty metadata (only YAML frontmatter). A short "Tile loader" entry under *Module Details* lists the D8 API with one example. `docs/` is excluded from Prettier, so the formatting stays as written.

## Risks / Trade-offs

- [In the browser, the default base is the current page URL, which changes with client-side routes] → only a convenience for direct calls. The UI change should pass an explicit `baseUrl`, such as the app root (see Open Questions).
- [A remote collection could list a `file:///` URL and pull a picked local file into tiles shown by a mod] → the collection loader change must only allow `file:` entries in collections that were themselves loaded from `file:`. Recorded here so that change picks it up.
- [The gray-matter checks in D6 copy its delimiter rules] → tests cover them (four dashes, delimiter not on the first line, unclosed block, language tag, CRLF), so an upgrade that changes them fails first.
- [Cross-origin tiles fail when the host sends no CORS headers] → this is reported as a normal `FileFetchError` with the browser's `TypeError` as cause. It is a hosting requirement for shared tiles, noted in the README.
- [No timeout, size limit or cancellation] → acceptable for now. An `AbortSignal` can be added to `FileFetchOptions` later without breaking callers.
- [YAML aliases can make metadata objects share references, and a malicious tile can use them to make `JSON.stringify` output explode] → loading stays linear and structured clone keeps the references. The impact is limited to the viewer's own tab. Accepted.
- [Virtual `file:///` sources include the picked folder's name, so two different picks with the same folder name get the same sources] → callers index one pick at a time. Source stability across sessions is not promised for local files.

## Open Questions

- Which `baseUrl` the app passes for relative paths (app root, `import.meta.env.BASE_URL`, or the page) is decided by the first UI change. It is an input here and does not change this spec.
- Whether to cache loaded tiles is decided when a caller needs it. Caching would sit on top of `loadTile`.
