# Tile Module

## Introduction

This library implements the following components based on [tesela_spec.md](../../../tesela_spec.md). The file fetcher, the md parser and the yaml parser it uses live in the [files module](../files/README.md).

- A tile loader that takes as input a path or URL and chains the file fetcher and the md parser. The output is called a tile. It has additional properties:
  - Types. A list of types for which the tile has been validated against. When first loaded this list is empty.
- A tile validator builder that takes as input a path or URL and chains the file fetcher and the md parser, then uses the schema inside the metadata (yaml frontmatter) as reference schema for validation. It produces as output a tile validator. Raises an error if schema is missing or isn't valid JTD. In order to follow structural typing, it adds `additionalProperties: true` when it is omitted, an explicit `additionalProperties: false` is kept.
  - The schema must have a `ref` that names one of its `definitions`. The tile type name is `schema.ref`.
  - Free-form content under the JTD `metadata` keyword (for example a `description`) is accepted, as RFC 8927 allows.
  - `additionalProperties: true` is added to every object description (a schema with `properties` or `optionalProperties`) at any depth: definitions, nested objects, objects in `elements` or `values`, and discriminator `mapping` schemas. Field names (such as a field called `properties`) and `metadata` content are never changed. The type file itself is not changed.
- A tile validator. It will validate a tile object based on its metadata and a reference schema. It will return the tile type if valid (i.e. schema.ref property), if not it will raise an error.
  - The error message names the tile's source, the type name, the type file's source and every mismatching metadata field, not only the first one (e.g. `metadata must have property 'country'; metadata/genres must be array`).
  - The tile is not changed: its `types` is not updated, and no defaults are added, no fields removed and no values converted.
  - A validator can check any number of tiles, and the result for a tile does not depend on the tiles checked before it.
- A collection loader that takes as input a path or URL and chains the file fetcher and the yaml parser, for generating the tile path list, and then calls the tile loader for each path. Relative paths for tile are resolved against the collection file's location. Tile related errors are captured, so it traverses the whole tile list. Tiles that fail to load are excluded from tiles and reported as issues. Output properties:
  - Source: the resolved absolute URL of the collection file.
  - Name and description of the collection (description is empty when the file has none).
  - Tiles is a list of tile objects, in the order of the entries.
  - Issues, containing warnings and errors, in the order of the entries.
  - Each tile entry has exactly one of `path` (resolved against the collection file's location) or `url` (must be an absolute URL).
  - A collection file that cannot be fetched, is not valid YAML or does not have the collection structure makes the load fail. A malformed entry, a tile that cannot be fetched or a tile with invalid frontmatter becomes an error issue.
  - When several entries resolve to the same tile, it is loaded once at the first entry's position, and each repeat adds a warning issue.
  - Tiles load in parallel, at most 6 at a time. The limit does not change the result or its order.
  - Local files stay local: only a collection loaded from a picked `file:` location can list `file:` tiles. In a remote collection, such entries become error issues and are never read.
- A collection index reader that takes as input a path or URL and reads the collection file alone: it chains the file fetcher and the yaml parser, and plans the entries as the collection loader does, but requests no tile. The index and a loaded collection never disagree about which tiles a collection lists or which entry issues it has. Output properties:
  - Source, name and description, as for a loaded collection.
  - Tiles is the list of resolved addresses of the tiles that loading the collection would request, in the order of the entries, with a repeated tile listed once.
  - Issues holds the entry issues found before any tile request: malformed entries, relative `url`s, local files in a remote collection and repeated tiles. A tile that would fail to load is still listed, with no issue, since it is never requested.
  - The collection file fails as for the collection loader.
- A collection validator. It takes a tile collection and a tile validator as input, and produces a tile collection with the types assigned to each tile and the collection's issues property updated if validation issues were found. Tiles that are not validated are still kept in the collection but without the type updated. This validator should follow idempotency so validating the same collection twice does not create duplicates.
  - The type name is added at the end of each matching tile's types, after the names it already has.
  - A tile that does not match keeps its position and its types, and adds a `warning` issue whose source is the tile's source and whose message is the tile validator's error message. A mismatch is a warning, not an error: the tile is still a valid tile.
  - New issues are added after the collection's existing issues, in tile order.
  - Idempotency: a type name a tile already has is not added again, and an issue equal to an existing one (same level, source and message) is not added again. Validating with several validators in turn adds each type name once.
  - The input collection is not changed, and the result shares no objects with it.
- An issue is an object containing the properties:
  - Level: warning, error
  - Source: the tile's source, or the collection's source for an entry with no usable tile location
  - Message

### Examples in pseudo-code (not real code):

Single tile creation:

```
tile = load_tile(tile_path)
```

Tile validator creation:

```
tile_validator = build_tile_validator(tile_type_path)
```

Single tile validation:

```
tile_type = tile_validator(tile)
```

Tile collection creation

```
tile_collection = load_tile_collection(tile_collection_path)
```

Tile collection validation:

```
validated_tile_collection = validate_tile_collection(tile_collection, tile_validator)
```

## Module Details

### Tile loader

Implemented in `src/lib/tile/`. Other modules import only from the public entry point `src/lib/tile/index.ts`:

- `loadTile(location, options?)`: fetches and parses a tile. Returns a `Tile` (`source`, `metadata`, `body`, `types`), with `types` empty. `options` are the `FileFetchOptions` of the [files module](../files/README.md).
- Errors: a tile that cannot be fetched or parsed raises `FileFetchError` or `MarkdownParseError`, exported from `src/lib/files/index.ts`.
- Types: `Tile`.

Example:

```ts
import { loadTile } from "./lib/tile/index.ts";

const tile = await loadTile("./books/kallocain.md", {
  baseUrl: "https://example.org/samples/mods/book_list/",
});
// tile.source === "https://example.org/samples/mods/book_list/books/kallocain.md"
// tile.metadata.title === "Kallocain"
// tile.types is []
```

Hosting note: tiles loaded from another origin are fetched by the browser with CORS. If the host does not send CORS headers (`Access-Control-Allow-Origin`), loading fails with a `FileFetchError` whose message says that the site may be unreachable or may not allow this app to read its files. Shared tiles must be hosted with CORS enabled (see the [files module](../files/README.md)).

### Collection loader

Also exported from `src/lib/tile/index.ts`:

- `loadTileCollection(location, options?)`: fetches and parses a collection file, then loads every tile it lists, at most 6 at a time. Takes the same `FileFetchOptions` as `loadTile`. Returns a `TileCollection` (`source`, `name`, `description`, `tiles`, `issues`).
- Errors: `CollectionFormatError` (not the collection structure). It exposes the failing `source`. A collection file that cannot be fetched raises `FileFetchError`, and one that is not valid plain YAML raises `YamlParseError` (both from the files module).
- Types: `TileCollection`, `TileIssue` (`level`, `source`, `message`), `IssueLevel` (`"warning"` or `"error"`).

Example:

```ts
import { loadTileCollection } from "./lib/tile/index.ts";

const collection = await loadTileCollection("./book_collection.yaml", {
  baseUrl: "https://example.org/samples/mods/book_list/",
});
// collection.source === "https://example.org/samples/mods/book_list/book_collection.yaml"
// collection.name === "Science fiction books"
// collection.tiles[1].source === "https://example.org/samples/mods/book_list/books/kallocain.md"
// collection.issues is []
```

### Collection index

Also exported from `src/lib/tile/index.ts`:

- `readTileCollectionIndex(location, options?)`: fetches and parses a collection file and plans its entries, without requesting any tile. Takes the same `FileFetchOptions` as `loadTile`. Returns a `TileCollectionIndex` (`source`, `name`, `description`, `tiles`, `issues`), where `tiles` is a list of addresses (strings), not of tile objects. The result is plain data.
- It reads only the collection file: it never requests a tile, and so never reports a tile that cannot be fetched or parsed.
- Errors: the same as `loadTileCollection` for the collection file itself, `FileFetchError`, `YamlParseError` or `CollectionFormatError`, each with the collection's `source`.
- Types: `TileCollectionIndex`.

Example:

```ts
import { readTileCollectionIndex } from "./lib/tile/index.ts";

const collectionIndex = await readTileCollectionIndex(
  "./book_collection.yaml",
  { baseUrl: "https://example.org/samples/mods/book_list/" },
);
// collectionIndex.name === "Science fiction books"
// collectionIndex.tiles[1] === "https://example.org/samples/mods/book_list/books/kallocain.md"
// collectionIndex.issues is []
// no tile file was requested
```

### Tile validator

Also exported from `src/lib/tile/index.ts`:

- `buildTileValidator(location, options?)`: fetches and parses a tile type file, reads its `schema` and compiles it. Takes the same `FileFetchOptions` as `loadTile`. Returns a `TileValidator` (`source`, `typeName`, `validateMetadata`). Use `validateTile` rather than calling `validateMetadata` directly.
- `validateTile(tile, tileValidator)`: checks the tile's metadata and returns the tile type name. The README pseudo-code `tile_validator(tile)` is this call.
- Errors: `TileTypeError` (the type file has no `schema` mapping, no `ref` naming one of its definitions, or a schema that is not valid JTD; Ajv's own error is kept as `cause`) and `TileValidationError` (the tile does not match the type). Both expose the failing `source`: the type file for `TileTypeError`, the tile for `TileValidationError`. A type file that cannot be fetched or parsed raises `FileFetchError` or `MarkdownParseError`.
- Types: `TileValidator`.

Example:

```ts
import { buildTileValidator, loadTile, validateTile } from "./lib/tile/index.ts";

const options = { baseUrl: "https://example.org/samples/mods/book_list/" };
const bookValidator = await buildTileValidator("./book_type.md", options);
// bookValidator.source === "https://example.org/samples/mods/book_list/book_type.md"
// bookValidator.typeName === "book"

const tile = await loadTile("./books/kallocain.md", options);
const tileType = validateTile(tile, bookValidator);
// tileType === "book"
// tile.types is still []
```

Hosting note: Ajv compiles each schema into JavaScript with `new Function`. A page served with a Content-Security-Policy that does not allow `unsafe-eval` cannot build tile validators. Static hosts such as GitHub Pages send no Content-Security-Policy by default.

### Collection validator

Also exported from `src/lib/tile/index.ts`:

- `validateTileCollection(tileCollection, tileValidator)`: validates every tile of a loaded collection with a tile validator. Returns a new `TileCollection` with the type name added to the matching tiles and a `warning` issue for each tile that does not match.

Example:

```ts
import {
  buildTileValidator,
  loadTileCollection,
  validateTileCollection,
} from "./lib/tile/index.ts";

const options = { baseUrl: "https://example.org/samples/mods/book_list/" };
const bookValidator = await buildTileValidator("./book_type.md", options);
const collection = await loadTileCollection(
  "./book_collection.yaml",
  options,
);

const validatedCollection = validateTileCollection(collection, bookValidator);
// validatedCollection.tiles[0].types is ["book"]
// validatedCollection.issues is []
// collection.tiles[0].types is still []
```
