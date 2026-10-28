# Mod Module

## Introduction

A mod is community JavaScript that OpenTesela runs in a sandbox (see [sandbox](../core/sandbox/README.md)). This library reads what a mod is, as plain data: its mod file, the references that name it, the permissions it declares and the code of its entrypoint. It decides nothing about trust: what a mod is granted lives in [permissions](../core/permissions/README.md).

### Mod file format

A mod is a folder with a `mod_conf.yaml` file. By default, a mod bundles its tile type, its sample collection and its test file in that folder, so it can be copied or shared as one folder, and its tests go with it. The sample book list mod (`public/samples/mods/book_list/`) holds `mod_conf.yaml`, `main.js`, `test.js` (its tests, see the [guide to writing mod tests](../../../mod_plugin_spec.md#mod-tests)), `book_type.md`, `book_collection.yaml` and the `books/` it lists. Its `mod_conf.yaml`:

```yaml
mod:
  name: "book_list"
  title: "Book List"
  version: "1.0.0"
  api: "^0.1.0"
  description: "A very simple list of books with their covers."
  entrypoint: "./main.js"
  type_path: "./book_type.md"
  sample_collection: "./book_collection.yaml"
  test_path: "./test.js"
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
| `api` | no | The range of [mod API versions](../core/engine/README.md#mod-api-version) the mod was written for, in npm's semver range syntax, e.g. `"^0.1.0"`. The loaded mod keeps it as written, or `null` without the key. Anything that is not a non-empty string holding a valid range, such as `"latest"`, `""` or the number `0.1`, is rejected with `"api" must be a semver range, such as "^0.1.0"`. The library only checks the syntax: the [engine](../core/engine/README.md) matches the range against the app's mod API version. |
| `type_path` | no | Path of the tile type file the mod's tiles must match. Without it, the mod receives every tile. |
| `sample_collection` | no | Path of the sample tiles the mod comes with. It is not fetched when the mod is loaded. |
| `test_path` | no | Path of the mod's JavaScript test file, which [`mods.check`](../core/engine/README.md#mod-check) runs (see the [guide to writing mod tests](../../../mod_plugin_spec.md#mod-tests)). It is fetched only by a check's tests, never when the mod is loaded, opened or inspected. Anything that is not a non-empty string is rejected with `"test_path" must be a non-empty string`. |
| `config` | no | Mapping given to the mod as `context.config`, defaults to `{}`. |
| `permissions` | no | The web hosts and mods the mod needs, see below. |
| `theme` | no | `"default"` (the default) or `"none"`. With `"none"`, the mod's frame gets neither the theme tokens nor the base stylesheet; the mod still receives the theme in its mount context and the `theme.changed` event. Any other value is rejected. See the [theme module](../core/theme/README.md). |

- `entrypoint`, `type_path`, `sample_collection` and `test_path` are resolved against the mod file's location.
- Bundling the tile type and the sample collection is a convention, not a rule: `type_path` and `sample_collection` may still point outside the mod folder (`../../types/book.md`) or to another site (`https://types.example.net/book.md`), so several mods can share one tile type.
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
- In `show`, `connect`, `embed` and `code`, the host can also be a wildcard host: an origin whose host name starts with `*.` as its whole leftmost label, followed by at least two labels, e.g. `https://*.us.archive.org` or `http://*.example.test:8080`. It covers every subdomain of that host name, at any depth, with the same scheme and port: `https://*.us.archive.org` covers `https://ia800100.us.archive.org` and `https://a.b.us.archive.org`. It does not cover the host name itself (`https://us.archive.org`), a host name that only ends the same (`https://evil-us.archive.org`), another scheme (`http://ia800100.us.archive.org`) or another port (`https://ia800100.us.archive.org:8443`).
- Paths (`https://example.org/images`, `https://*.example.org/images`), trailing slashes, queries, fragments, user info and other schemes (`wss://example.org`, `wss://*.example.org`) are rejected.
- A `*` anywhere else is rejected: inside a label (`https://cdn*.example.org`), after the first label (`https://a.*.example.org`), or over a single label (`https://*.org`). A wildcard over an IP address (`https://*.1.2.3.4`) is rejected too.
- In `open` only, the host can be `"*"`, meaning any site. Wildcard hosts are rejected in `open`.
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
- `loadModFile(reference, options?)`: resolves the reference, fetches and parses the mod file. Returns a `ModFile` (`source`, `name`, `title`, `version`, `api`, `description`, `entrypoint`, `typeSource`, `sampleCollection`, `testSource`, `config`, `permissions`, `theme`). `testSource` is the resolved address of the test file, or `null` without `test_path`. The entrypoint, the tile type, the sample collection and the test file are not fetched.
- `loadModCode(modFile, options?)`: fetches the entrypoint of a `ModFile`. Returns a `LoadedMod`: the `ModFile` with `code`, the entrypoint text. An entrypoint that cannot be fetched raises `FileFetchError`, whose `source` is the entrypoint. The engine's mod check uses it to tell a failing entrypoint apart from a failing mod file.
- `loadModTestCode(modFile, options?)`: fetches the test file of a `ModFile` and returns its text. Only the tests of a mod check call it. A test file that cannot be fetched raises `FileFetchError`, whose `source` is the test file, and a mod without `testSource` raises an `Error`.
- `loadMod(reference, options?)`: `loadModFile`, then `loadModCode`. Returns the `LoadedMod`.
- `ModLoadOptions`: the `FileFetchOptions` of the [files module](../files/README.md) plus `defaultModsFolder`. Relative references are resolved against `baseUrl`, by default the page's document base URL.
- Errors: `ModFormatError` (the file does not follow the mod file format). It exposes the failing `source`. A mod file, entrypoint or test file that cannot be fetched raises `FileFetchError`, and a mod file that is not plain YAML raises `YamlParseError`.
- `permissionHostCovers(host, origin)`: tells whether a permission host covers an origin, following the host rules above. An exact host covers only the origin equal to it, and `"*"` covers nothing, since it is the `open` category's own rule. The sandbox's blocked request reports use it.
- Constants: `MOD_FILE_KEYS`, the keys of the `mod` mapping the loader reads, and `PERMISSION_CATEGORIES`, the permission categories in their order. The engine's mod API surface guard reads both.
- Types: `ModFile`, `LoadedMod`, `ModLoadOptions`, `ModPermission` (`category`, `host`, `reason`), `PermissionCategory`, `ModThemeSetting` (`"default" | "none"`), `ModIssue` (`level`, `source`, `message`, the shape of a `TileIssue`).

Loaded mods are plain data, and two loads of the same mod never share objects.

Example:

```ts
import { loadMod, loadModCode, loadModFile } from "./lib/mod/index.ts";

const modFile = await loadModFile("./samples/mods/book_list", {
  baseUrl: "https://example.org/",
});
// modFile.source === "https://example.org/samples/mods/book_list/mod_conf.yaml"
// modFile.typeSource === "https://example.org/samples/mods/book_list/book_type.md"
// modFile.sampleCollection === "https://example.org/samples/mods/book_list/book_collection.yaml"
// modFile.testSource === "https://example.org/samples/mods/book_list/test.js", not fetched

const sampleMod = await loadModCode(modFile);
// sampleMod.code is the text of the sample's main.js

const mod = await loadMod("mod_viewer", {
  baseUrl: "https://example.org/",
  defaultModsFolder: "https://example.org/default_mods/",
});
// mod.source === "https://example.org/default_mods/mod_viewer/mod_conf.yaml"
// mod.code is the text of the viewer's main.js
```
