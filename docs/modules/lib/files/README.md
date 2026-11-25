# Files Module

## Introduction

This library fetches and parses any file, for tiles, mods and later mosaics. It does not know what a tile or a mod is. It implements the following components, moved from the [tile module](../tile/README.md):

- A file fetcher. It will load in memory any file (path or URL). Relative paths are resolved against a base URL (by default the page's document base URL in a browser). Output object properties:
  - Source: the resolved absolute URL of the input file as a string (e.g. `./books/kallocain.md` with base `https://example.org/samples/mods/book_list/` gives `https://example.org/samples/mods/book_list/books/kallocain.md`). The same file always has the same source.
  - Content of the file
  - Local files: a page served over http(s) cannot fetch `file:///` paths, so files or folders picked by the user are read directly. Each picked file gets a virtual `file:///<path inside the picked folder>` URL as source (e.g. `file:///library/books/kallocain.md`), so relative paths resolve inside the picked folder in the same way as for remote files.
  - Browser files: files the user imported are kept in the browser, at addresses of the scheme `teselarium-browser:`, of the form `teselarium-browser:///<root>/<path>` (e.g. `teselarium-browser:///7f3a…/maps/nobel_map.yaml`). They are read through an injected reader and never requested from the network. Relative paths resolve inside the store as for remote files. The module knows the scheme, not the storage that holds the files.
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
- `resolveFileReference(reference, folderFileName, baseUrl)`: resolves a reference to a file that a folder holds by convention to the file's absolute URL, as a string. A path ending in `.yaml` or `.yml` is the file itself. Any other path is a folder: a `/` is added when the path does not end with one, the query and fragment are dropped, and `folderFileName` is resolved in it. Mod, collection and mosaic references use it with `mod_conf.yaml`, `collection.yaml` and `mosaic.yaml`. Raises `FileFetchError` when the reference cannot be resolved.
- `readDocumentBaseUrl()`: the page's document base URL, or `undefined` outside a browser page. The default base of `fetchFile`.
- `indexLocalFiles(pickedFiles)`: turns the files the user picked (`PickedFile`: `path` inside the picked folder and `content` as a `Blob`) into `LocalFiles`, keyed by their virtual `file:///` URL.
- `BROWSER_FILE_PROTOCOL`: `"teselarium-browser:"`, the scheme of stored files.
- `isBrowserFileAddress(source)`: true for an absolute `teselarium-browser:` address.
- `buildBrowserFileAddress(root, path)`: the address of a stored file, `teselarium-browser:///<root>/<path>`. `root` stands for one imported folder or single file. Each segment of `path` is encoded as `indexLocalFiles` encodes a picked path (a space becomes `%20`), and `#` and `?` are encoded too, so they stay in the path.
- `BrowserFileReader`: `readText(address)` resolves with the stored text, or `null` when the store does not hold the address. The stage passes one built on the browser database (see [the storage module](../core/storage/README.md)).
- `FileFetchOptions`: `baseUrl` for relative locations, `fetch` to replace `globalThis.fetch`, `localFiles` for `file:` locations, `browserFiles` for `teselarium-browser:` locations.
- Errors: `FileFetchError` (file cannot be fetched or read). It exposes the failing `source`. Its message is `Cannot load file "<source>": <reason>`, where the reason is:
  - `HTTP <status> <status text>` when the server answers outside 200–299, for example `HTTP 404 Not Found`;
  - `the request failed: <cause>. The site may be unreachable or may not allow this app to read its files.` when the request is rejected, for example by a network failure or a CORS block, with the original error kept as `cause`. The browser does not tell the page which one it was, so the hint names both;
  - `the response body cannot be read: <cause>` when the body cannot be read;
  - `it is not stored in this browser` for a `teselarium-browser:` address the reader does not hold, or when no reader is given.
- Types: `FetchedFile`, `FileFetchOptions`, `PickedFile`, `LocalFiles`, `BrowserFileReader`.

Example:

```ts
import { fetchFile } from "./lib/files/index.ts";

const file = await fetchFile("./book_collection.yaml", {
  baseUrl: "https://example.org/samples/mods/book_list/",
});
// file.source === "https://example.org/samples/mods/book_list/book_collection.yaml"
// file.content starts with "collection:"
```

Stored file example:

```ts
import { buildBrowserFileAddress, fetchFile } from "./lib/files/index.ts";

const address = buildBrowserFileAddress("r1", "maps/nobel_map.yaml");
// address === "teselarium-browser:///r1/maps/nobel_map.yaml"
const collection = await fetchFile("../tiles/laureates/collection.yaml", {
  baseUrl: address,
  browserFiles,
});
// collection.source === "teselarium-browser:///r1/tiles/laureates/collection.yaml"
// it fails with "it is not stored in this browser" when browserFiles lacks it
```

Hosting note: files loaded from another origin are fetched by the browser with CORS. If the host does not send CORS headers (`Access-Control-Allow-Origin`), loading fails with a `FileFetchError` for a rejected request, whose message says that the site may not allow this app to read its files. Shared files must be hosted with CORS enabled.

### Md parser

- `parseMarkdown(fetchedFile)`: md parser. Returns a `ParsedMarkdown` (`source`, `metadata`, `body`).
- Errors: `MarkdownParseError` (invalid frontmatter). It exposes the failing `source`.
- Types: `ParsedMarkdown`, `Metadata`, `MetadataValue`.

Example:

```ts
import { fetchFile, parseMarkdown } from "./lib/files/index.ts";

const file = await fetchFile("./books/kallocain.md", {
  baseUrl: "https://example.org/samples/mods/book_list/",
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

const file = await fetchFile("./book_collection.yaml", {
  baseUrl: "https://example.org/samples/mods/book_list/",
});
const parsedYaml = parseYaml(file);
// parsedYaml.content.collection is a mapping
```
