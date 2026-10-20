# Files Module

## Introduction

This library fetches and parses any file, for tiles, mods and later mosaics. It does not know what a tile or a mod is. It implements the following components, moved from the [tile module](../tile/README.md):

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

## Module Details

Implemented in `src/lib/files/`. Other modules import only from the public entry point `src/lib/files/index.ts`.

### File fetcher

- `fetchFile(location, options?)`: file fetcher. Returns a `FetchedFile` (`source`, `content`).
- `resolveLocation(location, baseUrl)`: resolves a path or URL to an absolute `URL`. Raises `FileFetchError` when it cannot.
- `indexLocalFiles(pickedFiles)`: turns the files the user picked (`PickedFile`: `path` inside the picked folder and `content` as a `Blob`) into `LocalFiles`, keyed by their virtual `file:///` URL.
- `FileFetchOptions`: `baseUrl` for relative locations, `fetch` to replace `globalThis.fetch`, `localFiles` for `file:` locations.
- Errors: `FileFetchError` (file cannot be fetched or read). It exposes the failing `source`.
- Types: `FetchedFile`, `FileFetchOptions`, `PickedFile`, `LocalFiles`.

Example:

```ts
import { fetchFile } from "./lib/files/index.ts";

const file = await fetchFile("./tiles/books_collection.yaml", {
  baseUrl: "https://example.org/samples/",
});
// file.source === "https://example.org/samples/tiles/books_collection.yaml"
// file.content starts with "collection:"
```

Hosting note: files loaded from another origin are fetched by the browser with CORS. If the host does not send CORS headers (`Access-Control-Allow-Origin`), loading fails with a `FileFetchError`. Shared files must be hosted with CORS enabled.

### Md parser

- `parseMarkdown(fetchedFile)`: md parser. Returns a `ParsedMarkdown` (`source`, `metadata`, `body`).
- Errors: `MarkdownParseError` (invalid frontmatter). It exposes the failing `source`.
- Types: `ParsedMarkdown`, `Metadata`, `MetadataValue`.

Example:

```ts
import { fetchFile, parseMarkdown } from "./lib/files/index.ts";

const file = await fetchFile("./tiles/books/kallocain.md", {
  baseUrl: "https://example.org/samples/",
});
const parsedMarkdown = parseMarkdown(file);
// parsedMarkdown.metadata.title === "Kallocain"
```

### Yaml parser

- `parseYaml(fetchedFile)`: yaml parser. Returns a `ParsedYaml` (`source`, `content`), where `content` is a mapping.
- `isYamlMapping(value)`: true when the value is a mapping (an object that is not a list).
- `describeYamlValue(value)`: describes a value that is not a mapping for error messages, e.g. `a list` or `a single number value`.
- Errors: `YamlParseError` (not valid plain YAML, or no mapping at the top level). It exposes the failing `source`.
- Types: `ParsedYaml`, `YamlMapping`, `YamlValue`.

Example:

```ts
import { fetchFile, parseYaml } from "./lib/files/index.ts";

const file = await fetchFile("./tiles/books_collection.yaml", {
  baseUrl: "https://example.org/samples/",
});
const parsedYaml = parseYaml(file);
// parsedYaml.content.collection is a mapping
```
