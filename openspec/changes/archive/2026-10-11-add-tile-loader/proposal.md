# Proposal

## Why

The tile module ([docs/modules/lib/tile/README.md](../../../docs/modules/lib/tile/README.md)) is OpenTesela's first component. Everything else (collections, validation, mods, mosaics, the tiles UI) works on tile objects. The project scaffold is ready (archived change `setup-project-config`), so the next step is to load a single tile from a path or URL into a tile object. This change is the second of five in the tile module series: project config (done), **tile loader**, collection loader, tile validator, collection validator.

## What Changes

- Add the three building blocks the tile loader chains, as described in the tile module README, under `src/lib/tile/`:
  - **File fetcher**: resolves a path or URL to an absolute URL and loads the file's text. Its output has `source` (the resolved absolute URL) and `content`. It should also work with local files in the user's computer.
    - Local files are files or a folder that the user picks in the browser. A page served over http(s) cannot fetch `file:///` paths, so the app reads the picked files directly. Each picked file gets a virtual `file:///<path inside the picked folder>` URL as its source, so relative paths resolve inside the picked folder in the same way as for remote files. This change adds the library side. The file and folder picker UI comes with the tiles UI.
  - **Markdown parser**: turns fetched markdown with YAML frontmatter into `source`, `metadata` (the parsed frontmatter) and `body` (the original markdown text after the frontmatter, unchanged). A file without frontmatter gives empty metadata and the whole text as body.
  - **Tile loader**: chains the file fetcher and the markdown parser and returns a tile, which is the parsed markdown plus a `types` list that starts empty.
- Use a tile's resolved absolute URL as its `source`, so the same file always has the same source. The collection loader can then resolve relative tile paths against a collection's source, and viewers can resolve relative metadata links (such as `image: "./cover.jpg"`) against a tile's source.
- Keep metadata as plain data (strings, numbers, booleans, null, lists and mappings): frontmatter is YAML only, unquoted dates stay strings, and YAML tags that build other objects are rejected. Untrusted tiles from any URL are never executed.
- Add two error types that name the failing source: one for files that cannot be fetched and one for markdown that cannot be parsed. The collection loader (next change) will catch them and turn them into issues.
- Add a public entry point `src/lib/tile/index.ts`.
- Update `docs/modules/lib/tile/README.md` with the decisions made here: `source` is the resolved absolute URL, files without frontmatter load with empty metadata, and the tile loader's API.

## Capabilities

### New Capabilities

- `tile-loading`: loads a single tile from a relative path, an absolute URL or a local file the user picked, into a tile object (source, metadata, body, types). Covers location resolution, fetch failures, frontmatter parsing rules and the shape of the loaded tile.

### Modified Capabilities

None. No specs exist yet.

## Impact

- **New code**: `src/lib/tile/` gets `tile_errors.ts`, `local_files.ts`, `file_fetcher.ts`, `markdown_parser.ts`, `tile_loader.ts` and `index.ts`, with tests next to them. A test-only fetch that serves `samples/` from disk goes in `src/test/`.
- **Dependencies**: none added. Uses `@11ty/gray-matter` and `js-yaml`, which were installed and checked by `setup-project-config`.
- **Docs**: `docs/modules/lib/tile/README.md` (see What Changes).
- **Downstream contract**: the collection loader, tile validator builder and collection validator will reuse the file fetcher, the markdown parser and the tile object. The shapes defined here become their inputs.
- **Out of scope**: the YAML file parser and collection loading, tile type validation, issues, filling in `types`, caching, retries, cancellation, UI wiring (including the file and folder picker), and rendering the markdown body.
