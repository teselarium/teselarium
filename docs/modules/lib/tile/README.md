# Tile Module

## Introduction

This library implements the following components based on [tesela_spec.md](../../../tesela_spec.md):

- A file fetcher. It will load in memory any file (path or URL). Relative paths are resolved against a base URL (by default the page's document base URL in a browser). Output object properties:
  - Source: the resolved absolute URL of the input file as a string (e.g. `./books/kallocain.md` with base `https://example.org/samples/` gives `https://example.org/samples/books/kallocain.md`). The same file always has the same source.
  - Content of the file
  - Local files: a page served over http(s) cannot fetch `file:///` paths, so files or folders picked by the user are read directly. Each picked file gets a virtual `file:///<path inside the picked folder>` URL as source (e.g. `file:///library/books/kallocain.md`), so relative paths resolve inside the picked folder in the same way as for remote files.
- A md parser. It takes as input the output of the file fetcher. It will read a markdown with frontmatter and transform it in an object with properties. Output object properties:
  - Source path of the input as a string.
  - Metadata for the yaml parsed from the frontmatter as an object.
  - Body parsed as a simple string that contains the markdown original text.
  - Frontmatter is YAML only (other languages like `---json` or `---js` are rejected). Metadata is plain data: strings, numbers, booleans, null, lists and mappings; unquoted dates stay strings.
  - Files without frontmatter load with empty metadata and the whole text as body.
- A yaml parser. It takes as input the output of the file fetcher. It will read a yaml and transform it in an object with properties. Output object properties:
  - Source path of the input as a string.
  - Content is the yaml parsed as an object.
  - It uses the same plain-data rules as the frontmatter: a single document holding only strings, numbers, booleans, null, lists and mappings; unquoted dates stay strings and other YAML tags are rejected. The top level must be a mapping.
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

- `loadTile(location, options?)`: fetches and parses a tile. Returns a `Tile` (`source`, `metadata`, `body`, `types`), with `types` empty.
- `fetchFile(location, options?)`: file fetcher. Returns a `FetchedFile` (`source`, `content`).
- `resolveLocation(location, baseUrl)`: resolves a path or URL to an absolute `URL`.
- `parseMarkdown(fetchedFile)`: md parser. Returns a `ParsedMarkdown` (`source`, `metadata`, `body`).
- `indexLocalFiles(pickedFiles)`: turns the files the user picked (`PickedFile`: `path` inside the picked folder and `content` as a `Blob`) into `LocalFiles`, keyed by their virtual `file:///` URL.
- `FileFetchOptions`: `baseUrl` for relative locations, `fetch` to replace `globalThis.fetch`, `localFiles` for `file:` locations.
- Errors: `FileFetchError` (file cannot be fetched or read) and `MarkdownParseError` (invalid frontmatter). Both expose the failing `source`.
- Types: `Tile`, `FetchedFile`, `FileFetchOptions`, `ParsedMarkdown`, `Metadata`, `MetadataValue`, `PickedFile`, `LocalFiles`.

Example:

```ts
import { loadTile } from "./lib/tile/index.ts";

const tile = await loadTile("./books/kallocain.md", {
  baseUrl: "https://example.org/samples/",
});
// tile.source === "https://example.org/samples/books/kallocain.md"
// tile.metadata.title === "Kallocain"
// tile.types is []
```

Hosting note: tiles loaded from another origin are fetched by the browser with CORS. If the host does not send CORS headers (`Access-Control-Allow-Origin`), loading fails with a `FileFetchError`. Shared tiles must be hosted with CORS enabled.

### Collection loader

Also exported from `src/lib/tile/index.ts`:

- `loadTileCollection(location, options?)`: fetches and parses a collection file, then loads every tile it lists, at most 6 at a time. Takes the same `FileFetchOptions` as `loadTile`. Returns a `TileCollection` (`source`, `name`, `description`, `tiles`, `issues`).
- `parseYaml(fetchedFile)`: yaml parser. Returns a `ParsedYaml` (`source`, `content`), where `content` is a mapping.
- Errors: `YamlParseError` (not valid plain YAML, or no mapping at the top level) and `CollectionFormatError` (not the collection structure). Both expose the failing `source`. A collection file that cannot be fetched raises `FileFetchError`.
- Types: `TileCollection`, `TileIssue` (`level`, `source`, `message`), `IssueLevel` (`"warning"` or `"error"`), `ParsedYaml`, `YamlMapping`, `YamlValue`.

Example:

```ts
import { loadTileCollection } from "./lib/tile/index.ts";

const collection = await loadTileCollection("./tiles/books_collection.yaml", {
  baseUrl: "https://example.org/samples/",
});
// collection.source === "https://example.org/samples/tiles/books_collection.yaml"
// collection.name === "Science fiction books"
// collection.tiles[1].source === "https://example.org/samples/tiles/books/kallocain.md"
// collection.issues is []
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

const options = { baseUrl: "https://example.org/samples/" };
const bookValidator = await buildTileValidator("./types/book.md", options);
// bookValidator.source === "https://example.org/samples/types/book.md"
// bookValidator.typeName === "book"

const tile = await loadTile("./tiles/books/kallocain.md", options);
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

const options = { baseUrl: "https://example.org/samples/" };
const bookValidator = await buildTileValidator("./types/book.md", options);
const collection = await loadTileCollection(
  "./tiles/books_collection.yaml",
  options,
);

const validatedCollection = validateTileCollection(collection, bookValidator);
// validatedCollection.tiles[0].types is ["book"]
// validatedCollection.issues is []
// collection.tiles[0].types is still []
```
