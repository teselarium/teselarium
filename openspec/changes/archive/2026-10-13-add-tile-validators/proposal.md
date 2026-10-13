# Proposal

## Why

Mods show only the tiles that have the fields they need (structural typing), so OpenTesela must be able to tell whether a tile belongs to a tile type. Tiles and collections already load (`add-tile-loader` and `add-collection-loader` are archived), but every tile still has an empty `types` list. This change adds the last two parts of the tile module series: project config (done), tile loader (done), collection loader (done), **tile validator**, **collection validator**. They are one change because the collection validator is built on the tile validator and both share the same tile type rules.

## What Changes

- Add the tile validator and the collection validator described in [docs/modules/lib/tile/README.md](../../../docs/modules/lib/tile/README.md), under `src/lib/tile/`:
  - **Tile validator builder**: takes the path or URL of a tile type file (markdown whose frontmatter holds a `schema`) and returns a tile validator. It reuses the file fetcher and the markdown parser. It rejects a type file whose `schema` is missing, has no `ref` naming one of its `definitions`, or is not valid JSON Type Definition (JTD).
  - **Structural typing**: wherever the schema omits `additionalProperties` on an object description, the builder sets it to `true`, so extra metadata fields never make a tile fail. An explicit `additionalProperties: false` is kept. The type file itself is not changed.
  - **Tile validator**: checks a tile's metadata against the validator's schema. It returns the tile type name (`schema.ref`) when the tile matches. When it does not match, it raises a validation error that names the tile, the type and each mismatching field.
  - **Collection validator**: takes a loaded tile collection and a tile validator, and returns a new collection. It adds the type name to the `types` of each matching tile. Each tile that does not match stays in the collection with its `types` unchanged and adds a `warning` issue. The input collection is not changed.
- **Idempotency**: running the collection validator again on its own result with the same validator gives the same collection, with no repeated type names and no repeated issues. Validating with several validators in turn adds each type name once.
- **Validation mismatches are warnings, not errors.** A tile that does not match a type is still a valid tile, and [docs/tesela_spec.md](../../../docs/tesela_spec.md) says mods ignore such tiles "with a warning".
- Add two error types that name the failing source: one for tile type files that cannot be used, and one for tiles that do not match a type.
- Export the new functions and types from `src/lib/tile/index.ts`.
- Update `docs/modules/lib/tile/README.md` with the decisions made here, and add "Tile validator" and "Collection validator" entries under *Module Details*.

## Capabilities

### New Capabilities

- `tile-validation`: builds a tile validator from a tile type file (path, URL or picked local file) and validates a single tile against it. Covers the tile type file rules, the `additionalProperties` default for structural typing, the returned type name, and the validation error for a tile that does not match.
- `collection-validation`: validates every tile of a loaded tile collection with a tile validator. Covers how type names are added to matching tiles, the warning issues for tiles that do not match, idempotency, and leaving the input collection unchanged.

### Modified Capabilities

None. `tile-loading` keeps its behavior: a newly loaded tile still has an empty `types` list. The collection loader's tile collection and issue shapes are reused as they are.

## Impact

- **New code**: `src/lib/tile/` gets `tile_type_schema.ts`, `tile_validator.ts` and `collection_validator.ts`, with tests next to them. `tile_errors.ts` gets two new error classes. `index.ts` exports the new API.
- **Test fixtures**: the inline-file fetch used by the collection loader tests moves to `src/test/test_files.ts`, so the new tests can share it. The public export list pinned in `tile_loader.test.ts` gains the new exports.
- **Dependencies**: none added. Uses `ajv` (JTD mode), already installed.
- **Docs**: `docs/modules/lib/tile/README.md` (see What Changes).
- **Downstream contract**: the mod API will use a tile validator to keep only the tiles of a mod's type. Mosaics will load a collection, then validate it.
- **Out of scope**: mosaic metadata aliases, tile types written inline in other files (for example the `schema` of a `mod_conf.yaml`), caching validators, removing a type from a tile, a tile type registry or catalog, and any UI.
