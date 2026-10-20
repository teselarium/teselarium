# Mod Module

## Introduction

A mod is community JavaScript that OpenTesela runs in a sandbox (see [sandbox](../core/sandbox/README.md)). This library reads what a mod is, as plain data: its mod file, the references that name it, the permissions it declares and the code of its entrypoint. It decides nothing about trust: what a mod is granted lives in [permissions](../core/permissions/README.md).

### Mod file format

A mod is a folder with a `mod_conf.yaml` file. The sample book list mod (`public/samples/mods/book_list/mod_conf.yaml`):

```yaml
mod:
  name: "book_list"
  title: "Book List"
  version: "1.0.0"
  description: "A very simple list of books with their covers."
  entrypoint: "./main.js"
  type_path: "../../types/book.md"
  sample_collection: "../../tiles/books_collection.yaml"
  config:
    show_covers: true
  permissions:
    show:
      - host: "https://upload.wikimedia.org"
        reason: "Shows the book covers"
```

Every key lives under a `mod` mapping:

| Key | Required | Meaning |
|---|---|---|
| `name` | yes | Non-empty string chosen by the author. It is not the mod's identity: the source is. |
| `version` | yes | Non-empty string, e.g. `"1.0.0"`. A number such as `1` is rejected. |
| `entrypoint` | yes | Path of the ES module that default-exports `mount(engine, context)`. |
| `title` | no | String, defaults to `name`. |
| `description` | no | String, defaults to `""`. |
| `type_path` | no | Path of the tile type file the mod's tiles must match. Without it, the mod receives every tile. |
| `sample_collection` | no | Path of the sample tiles the mod comes with. It is not fetched when the mod is loaded. |
| `config` | no | Mapping given to the mod as `context.config`, defaults to `{}`. |
| `permissions` | no | The web hosts and mods the mod needs, see below. |

- `entrypoint`, `type_path` and `sample_collection` are resolved against the mod file's location, so they can leave the mod folder (`../../types/book.md`).
- Other keys are ignored. An inline `schema` is rejected for now: use `type_path` with the path of a tile type file.
- The file follows the same plain YAML rules as a collection file.

### Permission categories

`permissions` is a mapping from a category to a list of `{ host, reason }` entries. Both are non-empty strings, and `reason` is the text a user will see when asked.

| Category | Lets the mod |
|---|---|
| `show` | show content from the host: images, video, audio, fonts and stylesheets |
| `connect` | exchange data with the host: `fetch`, XMLHttpRequest, WebSocket, EventSource |
| `embed` | embed pages from the host in frames |
| `code` | load scripts from the host at runtime |
| `open` | inspect and open mods from the host through the engine |

Host rules:

- A host is an origin: `http:` or `https:`, a host name and an optional port, e.g. `https://upload.wikimedia.org` or `http://localhost:8080`.
- Paths (`https://example.org/images`), trailing slashes, queries, fragments, user info, wildcards (`https://*.example.org`) and other schemes (`wss://example.org`) are rejected.
- In `open` only, the host can be `"*"`, meaning any site.
- The loaded permissions are listed in the order `show`, `connect`, `embed`, `code`, `open`, whatever the order in the file, then in entry order.

### Mod references

A mod is named by a reference. Every reference to one mod file gives the same source, which is the mod's identity.

| Reference | Read as | Mod file (app at `https://example.org/`) |
|---|---|---|
| `mod_viewer` | a default mod name: no `/` and matches `^[a-z][a-z0-9_]*$` | `https://example.org/default_mods/mod_viewer/mod_conf.yaml` |
| `./samples/mods/book_list` | a folder (a `/` is added) | `https://example.org/samples/mods/book_list/mod_conf.yaml` |
| `./samples/mods/book_list/` | a folder | `https://example.org/samples/mods/book_list/mod_conf.yaml` |
| `./samples/mods/book_list/mod_conf.yaml` | the mod file (path ends in `.yaml` or `.yml`) | `https://example.org/samples/mods/book_list/mod_conf.yaml` |
| `https://mods.example.net/clock/clock.yml` | the mod file | `https://mods.example.net/clock/clock.yml` |
| `Book-List` | a folder (not a default mod name) | `https://example.org/Book-List/mod_conf.yaml` |

- A relative path that should be read as a location must contain a `/`: `./book_list`, not `book_list`, which is a default mod name.
- A folder's query and fragment are dropped.

## Module Details

Implemented in `src/lib/mod/`. Other modules import only from the public entry point `src/lib/mod/index.ts`.

### Mod loader

- `resolveModReference(reference, options)`: resolves a mod reference to the URL of its mod file. `options` are `{ baseUrl?, defaultModsFolder? }`. Raises `FileFetchError` when it cannot, for example for a default mod name without a default mods folder.
- `loadModFile(reference, options?)`: resolves the reference, fetches and parses the mod file. Returns a `ModFile` (`source`, `name`, `title`, `version`, `description`, `entrypoint`, `typeSource`, `sampleCollection`, `config`, `permissions`). The entrypoint, the tile type and the sample collection are not fetched.
- `loadMod(reference, options?)`: `loadModFile`, then fetches the entrypoint. Returns a `LoadedMod`: a `ModFile` with `code`, the entrypoint text.
- `ModLoadOptions`: the `FileFetchOptions` of the [files module](../files/README.md) plus `defaultModsFolder`. Relative references are resolved against `baseUrl`, by default the page's document base URL.
- Errors: `ModFormatError` (the file does not follow the mod file format). It exposes the failing `source`. A mod file or entrypoint that cannot be fetched raises `FileFetchError`, and a mod file that is not plain YAML raises `YamlParseError`.
- Types: `ModFile`, `LoadedMod`, `ModLoadOptions`, `ModPermission` (`category`, `host`, `reason`), `PermissionCategory`, `ModIssue` (`level`, `source`, `message`, the shape of a `TileIssue`).

Loaded mods are plain data, and two loads of the same mod never share objects.

Example:

```ts
import { loadMod, loadModFile } from "./lib/mod/index.ts";

const modFile = await loadModFile("./samples/mods/book_list", {
  baseUrl: "https://example.org/",
});
// modFile.source === "https://example.org/samples/mods/book_list/mod_conf.yaml"
// modFile.typeSource === "https://example.org/samples/types/book.md"
// modFile.sampleCollection === "https://example.org/samples/tiles/books_collection.yaml"

const mod = await loadMod("mod_viewer", {
  baseUrl: "https://example.org/",
  defaultModsFolder: "https://example.org/default_mods/",
});
// mod.source === "https://example.org/default_mods/mod_viewer/mod_conf.yaml"
// mod.code is the text of the viewer's main.js
```
