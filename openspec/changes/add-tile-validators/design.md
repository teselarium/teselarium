# Design

## Context

See proposal.md (Why) for motivation, and specs/tile-validation/spec.md and specs/collection-validation/spec.md for the required behavior.

Current state:

- `src/lib/tile/` has the file fetcher (`fetchFile`, `resolveLocation`), picked local files, the markdown parser (`parseMarkdown`), the YAML parser, the tile loader (`loadTile`) and the collection loader (`loadTileCollection`), all re-exported from `index.ts`. `Tile` is `{ source, metadata, body, types }` with `types: []`. `TileCollection` is `{ source, name, description, tiles, issues }`, and `TileIssue` is `{ level, source, message }`, whose doc comment already covers "loading or validating".
- Errors live in `tile_errors.ts`. Each class takes `(source, reason, options?)`, builds its message in the constructor and exposes `readonly source`.
- `yaml_parser.ts` exports `isYamlMapping` and `describeYamlValue`, which the schema checks reuse.
- `ajv` 8.20.0 is installed, and `dependencies.test.ts` already imports `Ajv from "ajv/dist/jtd"`, so that import type-checks and runs under Vitest. The app does not import `src/lib/tile` yet, so `npm run build` type-checks the module but does not bundle it.
- Oxlint enforces function declarations, named functions, explicit return types, no `forEach`/`reduce` and a maximum depth of 3. Review checks the other conventions in [docs/code_conventions.md](../../../docs/code_conventions.md): no nested or anonymous functions, no returning object or list literals, domain naming and errors with context.
- `add-tile-loader` and `add-collection-loader` are archived, so `tile-loading` and `collection-loading` are main specs under `openspec/specs/`.

Ajv JTD behavior, as checked while preparing this design with the installed version:

- The sample `book` schema compiles, and the Kallocain metadata (with extra `pages` and `image`) passes. Validation does not change the data, and compiling does not change the schema.
- Error objects carry `instancePath` (`""`, `/authors`, `/genres/1`), `keyword`, `params` and `message`. A missing property gives `instancePath: ""`, `params.missingProperty` and the message `must have property 'country'`. An extra property under `additionalProperties: false` gives `params.error: "additional"` with `instancePath` pointing at the extra field.
- An invalid schema (`type: text`, an unknown keyword, `ref` next to `properties`, a non-boolean `nullable`) throws "schema is invalid: …" followed by every JTD form the schema failed to match, often thousands of characters. `ref` to a missing definition throws `MissingRefError` ("No definition novel"). A `null` schema throws a `TypeError`. `{}` compiles and accepts anything.
- In strict mode (the default), free-form keys under `metadata` (for example `description`) throw "unknown keyword". With `strictSchema: false` they compile, while `type: text`, unknown keywords and a non-boolean `nullable` are still rejected by the JTD meta-schema.
- An Ajv instance keeps every compiled schema object in its cache. A new instance costs about 60 ms on its first compile (it compiles its meta-schema). A shared instance with `removeSchema` after each compile costs about 2 ms per compile, and the compiled function keeps working after removal.

## Goals / Non-Goals

**Goals:**

- Reuse `fetchFile` and `parseMarkdown` for type files, and `TileCollection` and `TileIssue` for the collection validator, without changing their behavior or signatures.
- Keep the schema checks and the structural typing walk pure and separate from Ajv and from fetching, so they can be tested with inline values and later reused for schemas that are not in their own file (Open Questions).
- Make the validators deterministic: the same tile, collection and validator always give the same result, whatever was validated before.

**Non-Goals:**

- Reporting mismatches as structured data (field path, rule). The error message lists them. Structured mismatches can be added to the error later without changing these specs.
- Checking that `ref` describes an object. A type whose definition is, for example, `type: string` is valid JTD. No tile matches it, and each one gets a mismatch.
- Removing a type name from a tile that no longer matches. The collection validator only adds names.

## Decisions

### D1. Module layout

```
src/lib/tile/
  tile_type_schema.ts      # TileTypeSchema, readTileTypeSchema, applyStructuralTyping (D3, D4)
  tile_validator.ts        # TileValidator, buildTileValidator, validateTile (D5, D6)
  collection_validator.ts  # validateTileCollection (D7)
  tile_errors.ts           # + TileTypeError, TileValidationError (D8)
```

Imports go one way: `collection_validator` → `tile_validator`, `tile_errors`, and types from `collection_loader`, `tile_issues` and `tile_loader`. `tile_validator` → `file_fetcher`, `markdown_parser`, `tile_type_schema`, `tile_errors`, and the `Tile` type from `tile_loader`. `tile_type_schema` → `yaml_parser`, `tile_errors`, and the `ParsedMarkdown` type. There are no cycles.

- Alternative considered: putting the schema checks inside `tile_validator.ts`. Rejected: the checks and the walk are pure and have many cases, so a separate file keeps both files small and lets the checks be tested without fetching or compiling. This is the same split as `collection_format.ts` and `collection_loader.ts`.

### D2. Data shapes and functions (the downstream contract)

```ts
// tile_type_schema.ts (internal)
interface TileTypeSchema {
  typeName: string;     // schema.ref
  schema: YamlMapping;  // with additionalProperties: true added where omitted (D4)
}

// tile_validator.ts
interface TileValidator {
  source: string;                       // resolved absolute URL of the tile type file
  typeName: string;                     // schema.ref
  validateMetadata: ValidateFunction;   // compiled by Ajv; use validateTile, not this
}

buildTileValidator(location: string, options?: FileFetchOptions): Promise<TileValidator>
validateTile(tile: Tile, tileValidator: TileValidator): string

// collection_validator.ts
validateTileCollection(tileCollection: TileCollection, tileValidator: TileValidator): TileCollection
```

The names follow the README pseudo-code (`build_tile_validator`, `validate_tile_collection`). `buildTileValidator` takes the same `FileFetchOptions` as `loadTile`, so type files can be relative, remote or picked locally.

The README pseudo-code calls the validator as a function (`tile_type = tile_validator(tile)`). Here the validator is a record, and `validateTile(tile, tileValidator)` is the call:

- Alternative considered: `buildTileValidator` returning a closure. Rejected: the conventions forbid functions defined inside functions.
- Alternative considered: returning `validateTile.bind(null, compiledType)`. Rejected: harder to read, and it hides the type name and source that the collection validator and later callers (mod API, UI) need.
- Alternative considered: a `TileValidator` class with a `validate` method. Rejected: the rest of the module is plain functions over plain records. The record is not plain data anyway (it holds a compiled function), so a class would not gain anything there.

The validator stays in the main app. Mods receive validated tiles, never validators, so the compiled function never needs to be structured-cloned. Tiles and collections stay plain data.

### D3. Reading the schema from a type file

`readTileTypeSchema(parsedMarkdown): TileTypeSchema` checks, in order, and raises `TileTypeError(source, reason)` at the first failure:

1. `metadata.schema` is missing → `"schema" is missing`.
2. `schema` is not a mapping → `"schema" must be a mapping, found <describeYamlValue>`.
3. `schema.ref` is not a non-empty string → `"schema.ref" must be a non-empty string naming the tile type`.
4. `schema.definitions` is not a mapping, or has no own key equal to `ref` (checked with `Object.hasOwn`, so names such as `toString` are not found on the prototype) → `"schema.ref" is "<ref>", which is not one of the schema's definitions`.

It returns the type name and `applyStructuralTyping(schema)`. Everything else about JTD validity is left to Ajv (D5).

- Why check `ref` here instead of letting Ajv do it: a schema without `ref` is valid JTD but has no type name, which the README defines as `schema.ref`. A missing definition gives Ajv's "No definition novel", which does not say which file or key is wrong.
- Alternative considered: accepting a schema without `ref` and naming the type after the file. Rejected: a file name is not part of the type, and the README and all examples use `definitions` plus `ref`.

### D4. Structural typing walk

`applyStructuralTyping(schema): YamlMapping` returns a new schema. The parsed metadata it reads from is not changed. In every schema that has `properties` or `optionalProperties` and no `additionalProperties`, it adds `additionalProperties: true`. An explicit value (`true` or `false`) is kept.

The walk follows the JTD forms, so it only visits schemas:

- Keywords whose value is a map of schemas: `definitions`, `properties`, `optionalProperties` and `mapping` (discriminator). The walk visits each value of the map, never the map itself.
- Keywords whose value is one schema: `elements` and `values`.
- Every other keyword (`type`, `enum`, `ref`, `nullable`, `discriminator`, `metadata`) is copied as it is.
- A value that should be a schema but is not a mapping is copied as it is, and Ajv rejects it in D5.

Visiting only schemas is what makes a metadata field named `properties` safe. In `properties: { properties: { type: string } }`, the inner `properties` key is a field name inside a map of schemas, so it is never treated as a schema keyword and never gets `additionalProperties`. A walk over every mapping would add `additionalProperties: true` to that map, which would then describe a field named `additionalProperties` whose schema is `true`, and Ajv would reject the type.

The walk is split into named functions per level (a schema, a map of schemas) to stay within the depth limit and avoid nested functions.

- Alternative considered: setting only the `ref` definition. Rejected: structural typing applies to nested objects too (spec: nested object and objects in a list).
- Alternative considered: Ajv's `removeAdditional` option. Rejected: it changes the validated data, and the spec requires that validation never changes the tile.

### D5. Compiling with Ajv

- One module-level instance: `new Ajv({ allErrors: true, strictSchema: false })` from `ajv/dist/jtd`.
  - `allErrors: true` reports every mismatch, as the spec requires, instead of only the first one.
  - `strictSchema: false` accepts free-form content under `metadata`, which RFC 8927 allows. The JTD meta-schema still rejects unknown types and keywords (checked, see Context).
- `buildTileValidator(location, options)` runs `fetchFile` → `parseMarkdown` → `readTileTypeSchema` → compile, and returns `{ source, typeName, validateMetadata }` through a named variable. Fetch and parse errors propagate unchanged (`FileFetchError`, `MarkdownParseError`).
- Compiling calls `compile(schema)` inside `try`, and `removeSchema(schema)` in `finally`, so the shared instance does not keep every type it has ever compiled. Any error thrown by `compile` becomes `TileTypeError(source, '"schema" is not valid JSON Type Definition', { cause })`. Ajv's own message stays in `cause`, because it lists every JTD form the schema failed and can be thousands of characters long.
- Alternative considered: a new Ajv instance per type. Rejected: about 60 ms per build for the meta-schema compile, against about 2 ms with a shared instance.

### D6. Validating one tile

`validateTile(tile, tileValidator)` calls `tileValidator.validateMetadata(tile.metadata)`:

- `true` → returns `tileValidator.typeName`.
- `false` → reads `validateMetadata.errors` right away. Ajv stores the errors of the last call on the function. Validation is synchronous, so no other call can run in between, which keeps a reused validator independent of earlier tiles.

Each Ajv error becomes one mismatch, described by `describeMetadataMismatch(error)`. The location is `metadata` followed by `instancePath`, for example `metadata` or `metadata/genres/1`.

- When `params.error` is `"additional"`, the description is `<location> is not allowed by the type`, for example `metadata/pages is not allowed by the type`.
- Otherwise the description is `<location> <Ajv message>`, for example `metadata must have property 'country'` or `metadata/authors must be array`.

The mismatches are joined with `"; "` and raised as `TileValidationError(tile.source, reason)`. The reason is `"<typeName>" (<type source>): <mismatches>` (D8 adds the prefix). Including the type file's source keeps warnings from two type files that share a type name distinct.

### D7. Validating a collection

`validateTileCollection(tileCollection, tileValidator)` is synchronous:

1. `structuredClone(tileCollection)`. The copy is the starting point, so the result never shares objects with the input and the input is never changed. Collections are plain data (collection-loading spec), so the clone is exact.
2. Collect the issue keys of the copied issues in a `Set`. A key is `JSON.stringify` of `[level, source, message]`, which cannot collide the way joined strings could.
3. For each copied tile, in order, call `checkCollectionTile(tile, tileValidator)`. It returns the type name, or catches `TileValidationError` and returns a `warning` issue with `error.source` and `error.message`. Any other error is a bug and propagates.
   - Type name → push the tile with `types` extended by the name when it is not already there (`addTileType`, a new tile built in a named variable).
   - Issue → push the tile unchanged, and push the issue only when its key is not in the set yet.
4. Return a new `TileCollection` with the copied `source`, `name` and `description`, the new tiles, and the copied issues followed by the new ones.

Tiles that already list the type name are validated anyway. The result is the same for a matching tile, and a tile that no longer matches gets a warning instead of passing silently on a name it was given earlier.

Idempotency follows from steps 2 and 3. A second run with the same validator finds every type name already present and every warning already in the set.

- Alternative considered: returning tiles that share `metadata` and `body` with the input and only replacing `types`. Rejected: a caller changing the result would change the input, which the spec forbids, and the copying would be spread over several fields.
- Alternative considered: making issue checks part of `TileIssue` (an `id`). Rejected: it changes the shape defined by the collection loader for no gain.

### D8. Errors

`tile_errors.ts` gets two classes with the existing pattern (extend `Error`, set `name`, assign `readonly source` in the constructor):

```ts
new TileTypeError(source, reason, { cause })   // message: Invalid tile type "<type source>": <reason>
new TileValidationError(source, reason)        // message: Tile "<tile source>" is not of tile type <reason>
```

For example: `Tile "https://example.org/tiles/no_country.md" is not of tile type "book" (https://example.org/samples/types/book.md): metadata must have property 'country'`.

`TileValidationError` is an expected result of validation, not a bug. It is thrown because the README defines the tile validator as raising an error, and so that `validateTile` returns a plain type name.

### D9. Public entry point

`index.ts` adds `buildTileValidator`, `validateTile`, `validateTileCollection`, `TileTypeError`, `TileValidationError` and the type `TileValidator` (`export type`). `readTileTypeSchema`, `applyStructuralTyping`, `TileTypeSchema` and `describeMetadataMismatch` stay internal.

The "exports the public API" test in `tile_loader.test.ts` pins the exact runtime export list. It gets the five new runtime exports, as it did for the collection loader.

### D10. Tests

- `tile_type_schema.test.ts` calls `readTileTypeSchema` and `applyStructuralTyping` directly with inline `ParsedMarkdown` values: every D3 reason, the walk at every keyword from D4 (root, `definitions`, nested `properties` and `optionalProperties`, `elements`, `values`, discriminator `mapping`), an explicit `false` kept, a field named `properties`, `metadata` copied without changes, and the input schema left unchanged.
- `tile_validator.test.ts` and `collection_validator.test.ts` import only from `./index.ts`.
  - Type files are served by `fetchTestFile`, inline texts keyed by URL with a fallback to `fetchSample`. It moves from `collection_loader.test.ts` into `src/test/test_files.ts` (with its `testTexts` map), so the three test files share it (DRY). The collection loader tests import it from there and otherwise stay unchanged. Vitest isolates modules per test file, so each file has its own map, which `afterEach` clears.
  - Picked type files use `indexLocalFiles` with `Blob`s, as in the loader tests.
  - Tiles and collections for validation are inline plain objects, or loaded from the samples with `loadTile` and `loadTileCollection`.
- Tests are written before the code for each file (TDD). Each spec scenario maps to at least one test named after it.

### D11. Docs

`docs/modules/lib/tile/README.md`:

- The tile validator builder bullet says that `schema.ref` is required and names a definition, that free-form `metadata` is accepted, and that `additionalProperties: true` is added at any depth.
- The tile validator bullet says what the error message contains and that the tile is not changed.
- The collection validator bullet says that mismatches are `warning` issues, added after the existing issues, explains idempotency (no repeated type names or equal issues), and says that the input is not changed.
- "Tile validator" and "Collection validator" entries under *Module Details* list the D9 additions, with one example each that uses `./types/book.md` and `./tiles/books_collection.yaml`.
- A hosting note: building a validator needs a Content-Security-Policy that allows `unsafe-eval` (see Risks).

## Risks / Trade-offs

- [Ajv compiles each schema into JavaScript with `new Function`, so a Content-Security-Policy without `unsafe-eval` breaks `buildTileValidator`] → static hosts such as GitHub Pages send no CSP by default. Documented in the README (D11). Ajv's standalone code generation does not help, because type files are only known at runtime.
- [Type files come from untrusted sources and are turned into code] → Ajv checks the schema against the JTD meta-schema before generating code and escapes every name it embeds. JTD has no regex, `$data` or format keywords. A huge schema can still be slow to compile, which only affects the user's own tab. Keep `ajv` up to date.
- [Tile types are identified by name only (`ref`), so two different type files that both use `ref: book` add the same name] → accepted. `types` is a list of names (tile-loading spec). Warnings name the type file, so they stay distinct.
- [A tile that already lists a type and no longer matches it keeps the name and also gets a warning] → removing names is out of scope. The warning makes the conflict visible.
- [Issues are compared by exact message, so if an Ajv update changes its wording, revalidating an old collection could add a second warning with the new wording] → collections are not saved yet. Revisit when they are.
- [`TileValidator` exposes Ajv's `ValidateFunction` in a public type] → its doc comment points callers to `validateTile`. Hiding it behind an own type can be done later without changing the specs.
- [`structuredClone` copies the whole collection for each validation] → a collection of hundreds of tiles holds kilobytes of metadata per tile, so the copy is cheap compared to fetching.

## Open Questions

- Whether to build validators from a schema written inside another file (the `schema` of a `mod_conf.yaml` in [docs/mod_plugin_spec.md](../../../docs/mod_plugin_spec.md)) is decided when the mod API needs it. `readTileTypeSchema` and the compile step are already separate from fetching, so they can be exported then without changing these specs.
