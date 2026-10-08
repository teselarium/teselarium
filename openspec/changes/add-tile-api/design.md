# Design

## Context

The repo has only documentation (`docs/`), sample data (`samples/`) and a devcontainer. There is no `package.json`, no `src/`, and no tooling. See proposal.md for why `tile_api` comes first.

Constraints that shape the design:

- **Static SPA**: there is no server. Everything runs in the browser, and tiles and collections are fetched over HTTP (same origin or cross-origin URLs). Node-only APIs (`fs`, `Buffer`, `path`) are not available at runtime.
- **Stack** (`docs/stack.md`): TypeScript, React, Vite, Vitest, React Testing Library, ESLint, Prettier, `ajv`, `@11ty/gray-matter`.
- **Code conventions** (`docs/code_conventions.md`): pure functions; explicit `for…of` loops instead of `map`/`forEach` callbacks; no anonymous functions; no functions defined inside functions; at most 3 levels of indentation; assign the output to a named variable and return that single variable; TDD.
- **Tile types are JTD**: `samples/types/book.md` holds a JTD root schema (`definitions` + `ref`) under `schema`, which is exactly the input that Ajv's JTD mode accepts.
- **Untrusted content**: tiles, types and collections may come from any URL. Parsing must never execute code.

## Goals / Non-Goals

**Goals:**

- A React-free, side-effect-free `tile_api` module that later modules (`mod_api`, `mosaic_api`, tiles UI) import through one entry point.
- Separate pure parsing and validation from I/O (fetching), so the pure parts can be tested without network mocks.
- A working project scaffold where `npm run test`, `npm run lint` and `npm run build` pass.

**Non-Goals:**

- Applying mosaic `aliases` to metadata. That belongs to `mosaic_api`, which passes already-aliased metadata to the validator.
- Filtering tile lists by mod compatibility, or showing warnings in a UI. Callers combine `validateMetadata` themselves.
- Caching, retries, concurrency limits, offline storage.
- Rendering markdown bodies.
- Setting up Tailwind, shadcn/ui, TanStack Router or react-i18next. That is left to the first UI change.

## Decisions

### D1. Module layout

```
src/lib/tile_api/
  index.ts              # public API, re-exports only
  tile_types.ts         # Tile, ValidationResult, CollectionLoadResult, … (type-only)
  tile_errors.ts        # TileParseError, TileTypeError, TileLoadError, CollectionError
  yaml_parser.ts        # safe YAML → JSON-compatible value (shared by parser + loader)
  tile_parser.ts        # parseTile(text, source): Tile
  tile_validator.ts     # compileTileType, validateMetadata
  tile_loader.ts        # loadTile, loadCollection, resolveLocation
  *.test.ts             # colocated Vitest tests
```

Folder and file names are snake_case so they match `docs/modules/lib/tile_api`. Identifiers use standard TS camelCase/PascalCase. Rationale: one responsibility per file (parse, validate, load), and `yaml_parser` is shared so that collection YAML and frontmatter follow the same safety rules (DRY).

### D2. Data shapes (the downstream contract)

```ts
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type TileMetadata = { [key: string]: JsonValue };

interface Tile {
  source: string;
  metadata: TileMetadata;
  body: string;
}

interface TileValidationIssue {
  path: string; // path = JSON pointer into metadata
  rule: string;
  message: string;
}
interface TileValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface TileCollectionEntryError {
  index: number;
  location: string | null;
  reason: string;
}
interface TileCollection {
  name: string;
  description: string | null;
  source: string;
  tiles: Tile[];
  errors: TileCollectionEntryError[];
}
```

All the data is plain and JSON-compatible, with no classes, so later on it can be sent to sandboxed mod iframes via `postMessage` without conversion. Error classes are used only for thrown failures.

### D3. Frontmatter parsing: `@11ty/gray-matter`, restricted to YAML, with a fallback

- Call gray-matter with an explicit `engines` option whose `yaml` engine is our `yaml_parser`. Any `language` other than `yaml` (for example `---js`) is rejected with `TileParseError`. Passing options also turns off gray-matter's content-keyed result cache, which otherwise returns shared, mutable objects.
- `yaml_parser` uses `js-yaml` `load` with `CORE_SCHEMA`. This means no timestamp type, so `1953-10-19` stays a string, and unknown or custom tags throw. Then it checks that the top level is a mapping.
- **Fallback, decided up front**: the first task is a browser-build spike. If `@11ty/gray-matter` needs Node built-ins (`fs`/`Buffer`) in the Vite build, we replace it with a small frontmatter splitter in `tile_parser.ts`: a leading `---` line, then the content up to the next `---` line, and everything after it is the body. Combined with the same `yaml_parser`, observable behavior is identical, so the specs do not change.
- Alternatives considered: the `yaml` package (fine, but `js-yaml` is already gray-matter's engine, so one YAML library is enough); gray-matter defaults (rejected because they parse timestamps into `Date` and allow the `js` engine).

### D4. Validation: Ajv JTD mode, compile once and validate many times

- A module-level `Ajv` instance from `ajv/dist/jtd` with `allErrors: true` and the default strict mode, so unknown keywords and types in a schema throw at compile time and become `TileTypeError`.
- `compileTileType(tileType: Tile): CompiledTileType` reads `metadata.schema` and compiles it. A missing or non-object schema, or a compile failure, throws `TileTypeError`. `validateMetadata(metadata, compiled): ValidationResult` runs the compiled validator and maps Ajv errors to `ValidationIssue` (`instancePath` → `path`, `schemaPath` → `rule`, plus a readable message that names the missing property when there is one). Non-matching metadata never throws.
- We follow JTD semantics with the principle of minimal properties. When `additionalProperties` is omitted, add it with true as default value `additionalProperties: true`.
- `CompiledTileType` is a plain record that holds the Ajv validate function. No closure is defined inside our functions, which respects the "no functions inside functions" convention.
- Alternatives considered: JSON Schema mode (rejected because the docs specify JTD); a hand-written validator (rejected because it violates DRY and has no stack support).

### D5. Loading: injectable fetch, URL-based location resolution, settle all entries

- `loadTile(location, options?)` and `loadCollection(location, options?)` accept `options.fetch` (default `globalThis.fetch`) and `options.baseUrl` (default `document.baseURI`, falling back to `globalThis.location.href`). Tests inject a fetch that serves `samples/` from disk.
- Locations are resolved with `new URL(location, base)`. A collection entry's `path` resolves against the collection's own resolved URL. A `url` must be absolute: we parse it with `new URL(url)`, and a failure means the entry is malformed.
- A non-2xx response or a fetch rejection becomes `TileLoadError` (single tile) or a `TileCollectionEntryError` (collection entry).
- Collection entries are fetched concurrently with `Promise.allSettled`, which takes named per-entry functions rather than inline lambdas. Results are then assembled with a `for…of` loop over the indices, so the original order is kept and each failure is recorded at its index.
- The collection structure (`collection.name`, `collection.tiles` array, each entry an object with exactly one of `path`/`url` as a string) is checked by a hand-written structural check in `tile_loader.ts`. It is small and gives precise messages. Alternative considered: an internal JTD schema for collections run through Ajv. That is possible later, but JTD cannot express "exactly one of path/url".

### D6. Project scaffold

- Vite `react-ts` template generated in a temporary directory and copied to the repo root, because the root is not empty (`docs/`, `samples/`, `README.md` must be kept). The existing placeholder `package-lock.json` is replaced.
- Vitest is configured in `vite.config.ts` with the `jsdom` environment by default, ready for React Testing Library. `tile_api` tests opt into the `node` environment (`// @vitest-environment node`), where `fs` is available to read the `samples/` fixtures.
- ESLint uses the flat config from the template plus `eslint-config-prettier`. The conventions that have built-in rules are enforced on `src/lib/**`: `max-depth: ["error", 3]` and `func-style: ["error", "declaration"]`. The remaining conventions (no anonymous callbacks, single-variable return) are checked during review. Use explicit return types.
- npm scripts: `dev`, `build`, `test`, `lint`, `format`.

## Risks / Trade-offs

- [`@11ty/gray-matter` may need Node polyfills in the browser] → spike in task group 1, with the D3 fallback (own splitter + `js-yaml`). Specs are unaffected either way.
- [Ajv compiles schemas with `new Function`, so a strict Content-Security-Policy without `unsafe-eval` would break validation] → acceptable for GitHub Pages-style hosting, which sends no CSP by default. Documented in the tile_api README. Revisit if a CSP is adopted.
- [Tile type schemas come from untrusted sources and are compiled into code] → Ajv JTD strict mode rejects unknown keywords, and JTD has no `$data` or regex keywords. Large or deeply recursive schemas could still be slow (a self-inflicted DoS limited to the viewer's own tab).
- [Cross-origin `url` entries fail if the host lacks CORS headers] → this surfaces as a normal per-entry error (the "skip and report" policy). Documented as a hosting requirement for shared tiles.
- [Concurrent fetches of very large collections could flood the network] → acceptable for now (non-goal). A concurrency limit can be added inside `loadCollection` without changing the API.
- [Using `CORE_SCHEMA` differs from typical YAML tooling, because dates stay strings] → intentional. This keeps metadata JSON-compatible and lets it validate against `type: string`, as the samples expect.

## Open Questions

- Whether loaded tiles should be cached across views (for example by the tiles explorer) can be decided when a caller needs it. It would sit on top of `loadTile`.
