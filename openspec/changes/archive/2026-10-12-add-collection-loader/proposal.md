# Proposal

## Why

Mods and mosaics use tiles as collections, not one tile at a time. A mosaic points to a tile collection file, and the collection validator (the last change in this series) works on a loaded collection. The tile loader is done (archived change `add-tile-loader`), so the next step is loading a whole collection: read the collection YAML, load each listed tile, and report the tiles that fail without stopping the rest. This change is the third of five in the tile module series: project config (done), tile loader (done), **collection loader**, tile validator, collection validator.

## What Changes

- Add the two remaining building blocks of the collection loader, as described in [docs/modules/lib/tile/README.md](../../../docs/modules/lib/tile/README.md), under `src/lib/tile/`:
  - **YAML parser**: turns a fetched YAML file into `source` and `content` (the parsed YAML). It uses the same plain-data rules as the frontmatter: only strings, numbers, booleans, null, lists and mappings, unquoted dates stay strings, and other YAML tags are rejected. The top level must be a mapping. The frontmatter parser and the YAML parser share this YAML reading code.
  - **Collection loader**: takes a path or URL, fetches and parses the collection file, checks its structure, then loads every listed tile with the tile loader. It returns a tile collection: `source`, `name`, `description`, `tiles` and `issues`.
- Collection file rules (from [docs/tesela_spec.md](../../../docs/tesela_spec.md)): a `collection` mapping with a required `name`, an optional `description` and a required `tiles` list. Each tile entry has exactly one of `path` (resolved against the collection file's location) or `url` (must be an absolute URL).
- Failure handling:
  - **Collection-level failures throw.** A collection file that cannot be fetched, is not valid YAML or does not have the collection structure rejects the load with an error that names the collection's source.
  - **Tile-level failures become issues.** A malformed entry, a tile that cannot be fetched or a tile with invalid frontmatter is left out of `tiles` and reported as an `error` issue. The loader still goes through the whole list.
  - **Repeated tiles are loaded once.** When two entries resolve to the same tile source, the first one is kept and each repeat gets a `warning` issue.
- **Parallel requests are limited.** Tiles load in parallel, at most 6 at a time, so a large collection does not start hundreds of requests at once. The limit does not change the result or its order.
- Add the **issue** object from the README: `level` (`warning` or `error`), `source` and `message`. The collection validator will add its own issues in the same shape.
- **Local files stay local.** A collection loaded from a remote URL cannot list `file:` tiles. Such entries are reported as error issues and never read. Collections loaded from picked local files can list local and remote tiles. This closes the risk recorded in `add-tile-loader`'s design.
- Export the new functions and types from `src/lib/tile/index.ts`.
- Update `docs/modules/lib/tile/README.md` with the decisions made here and a "Collection loader" entry under *Module Details*.

## Capabilities

### New Capabilities

- `collection-loading`: loads a tile collection file from a relative path, an absolute URL or a picked local file into a tile collection (source, name, description, tiles, issues). Covers the collection file format, how tile entries are resolved, which failures throw and which become issues, repeated entries, the limit on parallel tile requests, and the local-files rule.

### Modified Capabilities

None. `tile-loading` keeps its behavior. The frontmatter parser only starts sharing its YAML reading code with the new YAML parser, and its existing tests must keep passing unchanged.

## Impact

- **New code**: `src/lib/tile/` gets `yaml_parser.ts`, `tile_issues.ts`, `collection_format.ts` and `collection_loader.ts`, with tests next to them. `tile_errors.ts` gets two new error classes. `markdown_parser.ts` uses the shared YAML reading code from `yaml_parser.ts`. `index.ts` exports the new API.
- **Dependencies**: none added. Uses `js-yaml`, already installed.
- **Docs**: `docs/modules/lib/tile/README.md` (see What Changes).
- **Downstream contract**: the collection validator takes the tile collection and issue shapes defined here as input. Mosaics will call the collection loader with the collection path from the mosaic file.
- **Out of scope**: tile type validation and filling in `types`, the collection validator, caching, retries, cancellation, a configurable request limit, nested collections (a collection listing other collections), and any UI (collection explorer or file picker).
