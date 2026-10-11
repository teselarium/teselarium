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
- A tile loader that takes as input a path or URL and chains the file fetcher and the md parser. The output is called a tile. It has additional properties:
  - Types. A list of types for which the tile has been validated against. When first loaded this list is empty.
- A tile validator builder that takes as input a path or URL and chains the file fetcher and the md parser, then uses the schema inside the metadata (yaml frontmatter) as reference schema for validation. It produces as output a tile validator. Raises an error if schema is missing or isn't valid JTD. In order to follow structural typing, it adds `additionalProperties: true` when it is omitted, an explicit `additionalProperties: false` is kept.
- A tile validator. It will validate a tile object based on its metadata and a reference schema. It will return the tile type if valid (i.e. schema.ref property), if not it will raise an error.
- A collection loader that takes as input a path or URL and chains the file fetcher and the yaml parser, for generating the tile path list, and then calls the tile loader for each path. Relative paths for tile are resolved against the collection file's location. Tile related errors are captured, so it traverses the whole tile list. Tiles that fail to load are excluded from tiles and reported as issues. Output properties:
  - Tiles is a list of tile objects.
  - Issues, containing warnings and errors.
- A collection validator. It takes a tile collection and a tile validator as input, and produces a tile collection with the types assigned to each tile and the collection's issues property updated if validation issues were found. Tiles that are not validated are still kept in the collection but without the type updated. This validator should follow idempotency so validating the same collection twice does not create duplicates.
- An issue is an object containing the properties:
  - Level: warning, error
  - Source: tile path
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
