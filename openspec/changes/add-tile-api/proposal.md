# Proposal

## Why

`tile_api` is the first building block that will serve as foundation for the other OpenTesela features (tile viewer/explorer, mod API, mosaics, etc). This API will provide tools for: reading tiles (markdown + YAML frontmatter), checking them against tile types (JTD schemas), and loading tile collections from paths or URLs.

## What Changes

- Scaffold the OpenTesela SPA project at the repo root (Vite + React + TypeScript, Vitest + React Testing Library, ESLint, Prettier) following `docs/stack.md`, so library code can be built and tested.
- Add the `tile_api` library under the `lib` module, with no rendering code:
  - **Tile parser**: turns markdown text with frontmatter into a tile object made of a source, metadata and body. It also parses tile type files, which are tiles whose metadata holds a `schema`.
  - **Tile validator**: checks a tile's metadata against the JTD schema taken from a tile type. It reports whether the metadata matches and, if not, why.
  - **Tile loader**: loads one tile from a path or URL, and loads a tile collection YAML by resolving and loading every listed tile. Tiles that fail are skipped and reported. They never abort the whole collection.
- Use the `samples/` tiles, type and collection as test fixtures.
- Replace the placeholder in `docs/modules/lib/tile_api/README.md` with documentation of the public API.

## Capabilities

### New Capabilities

- `tile-parsing`: turns tile and tile type markdown documents into structured tile objects (source, metadata, body). Covers frontmatter rules and malformed input.
- `tile-validation`: checks tile metadata against tile types defined as JTD schemas (structural typing) and reports the mismatches.
- `tile-loading`: loads single tiles and tile collections from relative paths or URLs, including resolving locations and reporting failures for each entry.

### Modified Capabilities

None. No specs exist yet.

## Impact

- **New code**: `src/lib/tile_api/` (public entry point plus parser, validator, loader and shared types), with unit tests next to the code.
- **New project files**: `package.json`, `vite.config.ts`, `tsconfig*.json`, ESLint/Prettier config, `index.html`, a minimal `src/` app shell. `package-lock.json` is regenerated.
- **New dependencies**: `react`, `react-dom`, `vite`, `typescript`, `vitest`, `@testing-library/react`, `jsdom`, `eslint`, `prettier`, `ajv`, `@11ty/gray-matter` (or a YAML parser if gray-matter does not work in the browser; see design.md).
- **Downstream**: `mod_api`, `mosaic_api` and the tiles UI modules will consume this library's tile object and results. Their shape becomes a contract.
- **Out of scope**: mosaic metadata aliases, mod tile-type declarations, UI, caching or persistence, and the remaining stack items (Tailwind, shadcn/ui, TanStack Router, react-i18next). Those come with the first UI change.
