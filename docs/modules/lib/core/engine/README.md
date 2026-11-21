# Core Engine API

## Introduction

The core engine is a running mod's backend inside the browser tab. Each mod runs in its own sandboxed frame (see the [sandbox module](../sandbox/README.md)) and talks to the engine only through a private `MessageChannel` created for it when its frame starts. The engine pushes events and answers requests. It never listens on `window`, so messages a frame posts to the app's window are ignored.

### Protocol

Messages are [JSON-RPC 2.0](https://www.jsonrpc.org/specification) objects of plain data.

A request from a mod has `jsonrpc: "2.0"`, a string or number `id`, a string `method` and optional `params`, which must be a mapping:

```json
{ "jsonrpc": "2.0", "id": 7, "method": "storage.get", "params": { "key": "selected" } }
```

Each request gets exactly one response with the same `id`, and either a `result`:

```json
{ "jsonrpc": "2.0", "id": 7, "result": "https://example.org/samples/mods/book_list/books/kallocain.md" }
```

or an `error` with a numeric `code` and a `message`:

```json
{ "jsonrpc": "2.0", "id": 8, "error": { "code": -32601, "message": "Unknown method \"tiles.delete\"" } }
```

Events are notifications: a `method`, `params` and no `id`. They are never answered:

```json
{ "jsonrpc": "2.0", "method": "tiles.changed", "params": { "tiles": [], "issues": [] } }
```

Data that is not a valid request but has a string or number `id` is answered with `-32600`. Any other data is ignored.

### Error codes

| Code | Meaning |
|---|---|
| `-32600` | Not a valid JSON-RPC request (it has an `id`, so it is answered). |
| `-32601` | Unknown method. The message names the method. |
| `-32602` | Wrong params. The message names the method and the problem. |
| `-32000` | The browser storage failed. The message is the storage error's message. |
| `-32001` | A mod file, a collection file (see [Inspecting collections](#inspecting-collections)), or a file of a declared library, could not be loaded. The message is the load error's message, after `libs.load: ` for a library file (see [Libraries](#libraries)). |
| `-32002` | Permission denied. The message says which permission is missing. |
| `-32003` | The requested default mod is switched off. The message names the mod. |
| `-32603` | An error the method did not expect, such as a tile body whose library cannot be loaded. The message is the method's name, `: ` and the error's message, as in `tiles.renderBody: Failed to fetch dynamically imported module: …`. |

### Reserved names

Methods starting with `sandbox.` belong to the frame loader, which uses them to connect the channel and to report blocked requests, blocked browser dialogs and mount failures (see the [sandbox module](../sandbox/README.md)). Mods must not use them.

Method names are looked up as own properties of the engine's handler tables, so names such as `toString` or `__proto__` are unknown methods.

### Methods and events

| Method | Params | Result |
|---|---|---|
| `storage.get` | `{ key }`, a non-empty string | The value stored under `key` in the mod's slot for what it was opened with (see [Storage slots](#storage-slots)), or `null`. Slots per mosaic or collection since mod API `0.1.14`. |
| `storage.set` | `{ key, value }`, with `value` plain data (strings, finite numbers, booleans, null, lists and mappings) | `null`. Storing `null` removes the key. |
| `mods.inspect` | `{ mod }`, a mod reference | The mod's metadata, without running it (see below). |
| `mods.open` | `{ mod, collection?, tile?, params?, replace? }`, where `params` cannot hold `mod`, `collection`, `tile`, `mosaic` or `sites` | `null`, once the stage opened the mod in a new sandbox. With `replace: true`, the requester is replaced and gets no answer (see [Inspecting and opening mods](#inspecting-and-opening-mods)). `tile` and `replace` added in mod API `0.1.12`. |
| `mods.check` | `{ mod, collection? }` | The check report of the mod, once the check is done (see below). Without `collection`, the mod is checked with its default mosaic. Added in mod API `0.1.1`; default mosaics since `0.1.14`. |
| `collections.inspect` | `{ collection }`, a collection reference: the collection file, or a folder holding `collection.yaml` | The collection's index, without loading any tile (see [Inspecting collections](#inspecting-collections)). Added in mod API `0.1.11`; folders since `0.1.13`. |
| `mosaics.inspect` | `{ mosaic }`, a mosaic reference | The mosaic file's content, without opening it (see [Inspecting and opening mosaics](#inspecting-and-opening-mosaics)). Added in mod API `0.1.13`. |
| `mosaics.open` | `{ mosaic, params?, replace? }` | `null`, once the stage opened the mosaic in a new sandbox. With `replace: true`, the requester is replaced and gets no answer (see [Inspecting and opening mosaics](#inspecting-and-opening-mosaics)). Added in mod API `0.1.13`. |
| `mosaics.check` | `{ mosaic }`, a mosaic reference | The check report of the mosaic's mod, checked as the mosaic opens it, without the mod's tests (see [Checking a mosaic](#checking-a-mosaic)). Added in mod API `0.1.14`. |
| `catalog.list` | none, params are ignored | The catalog, `{ mods, collections, mosaics }`, each list in catalog order with resolved addresses, without any permission (see [Reading the catalog](#reading-the-catalog)). Added in mod API `0.1.15`; `listedBy`, `place` and `provenance` since `0.1.18`. |
| `links.open` | `{ url }`, an absolute `http:` or `https:` address | `true` once the user opened it in a new tab, `false` if the user cancelled (see below). |
| `files.save` | `{ name, content, encoding?, type? }` | `true` once the user saved the file, `false` if the user cancelled. |
| `ui.confirm` | `{ message, confirmLabel?, cancelLabel? }` | `true` if the user confirmed, `false` if the user cancelled or pressed Escape. |
| `userCatalog.import` | none, params are ignored | `true` once the user imported the reviewed files, `false` if the user cancelled or nothing changed (see [The user catalog](#the-user-catalog)). Added in mod API `0.1.18`. |
| `userCatalog.update` | `{ mosaic }`, the address of a stored user mosaic | `true` once the user updated it from a file, `false` otherwise. Added in mod API `0.1.18`. |
| `userCatalog.add` | `{ mosaic? }`, an address that fills the dialog's field | `true` once the user added a mosaic by URL, `false` otherwise. Added in mod API `0.1.18`. |
| `userCatalog.export` | `{ mosaic }`, the address of a stored user mosaic | `true` once the user saved its file, `false` otherwise. Added in mod API `0.1.18`. |
| `userCatalog.remove` | `{ mosaic }`, the address of a user mosaic, stored or remote | `true` once the user confirmed and it is removed, `false` otherwise. Added in mod API `0.1.18`. |
| `ui.notify` | `{ message, level?, source? }` | `null`, once the message is in the mod's stage bar (see [Telling the user something](#telling-the-user-something)). Added in mod API `0.1.8`. |
| `tiles.renderBody` | `{ source }`, the `source` of one of the mod's tiles | `{ html }`: the tile's body rendered to safe HTML (see [Tile bodies](#tile-bodies)). Added in mod API `0.1.5`; formulas as MathML, highlighted code and emoji since `0.1.7`. |
| `players.open` | `{ url }`, a player address of the mod's tiles | `true` once the player was shown and closed, `false` if the user cancelled (see [Players](#players)). Added in mod API `0.1.5`. |
| `libs.load` | `{ name, version }`, a library the app ships and its major version, such as `{ name: "mermaid", version: "12" }`, or `{ name, version? }`, a library the mod declares in its mod file, such as `{ name: "leaflet" }` | `{ name, version }`, with the full version installed, once the library is ready in the mod's frame; for a declared library, `{ name, version, files }`, with the declared version or `null` and the data files' texts by path (see [Libraries](#libraries)). Added in mod API `0.1.6`, declared libraries in `0.1.10`. |

| Event | Params |
|---|---|
| `tiles.changed` | `{ tiles, issues }`: the reloaded tiles, with the same rules as the mount context. Pushed when the user presses "Reload tiles" for a mod opened with a collection. |
| `theme.changed` | `{ colorScheme, tokens }`: the new theme, the same shape as `context.theme`. Pushed to every running mod, visible or hidden, once each time the app's resolved color scheme changes. A new theme choice that resolves to the same color scheme pushes nothing. The frame loader updates the frame's `data-ot-color-scheme` attribute before the mod's handlers run. |
| `layout.changed` | `{ layout }`: the frame's new layout, `"contained"`, `"theater"` or `"fullscreen"`, the same value as `context.layout` (see [Frame layout](#frame-layout)). Pushed to a running mod, visible or hidden, once each time its layout changes. A change of theater mode that leaves the mod's layout the same, such as for a fullscreen mod, pushes nothing. The frame loader updates the frame's `data-ot-layout` attribute before the mod's handlers run. Added in mod API `0.1.9`. |
| `catalog.changed` | `{ mods, collections, mosaics }`: the new catalog, the same shape as the result of `catalog.list`. Pushed to every running mod, visible or hidden, once each time "List the default mosaics of mods" or the user catalog changes (see [Reading the catalog](#reading-the-catalog)). Added in mod API `0.1.15`; also pushed when the user catalog changes since `0.1.18`. |

Inside the frame, a mod uses them through its engine API object:

```js
const selected = await engine.request("storage.get", { key: "selected" });
await engine.request("storage.set", { key: "selected", value: tile.source });
engine.on("tiles.changed", function showTiles(params) {
  render(params.tiles);
});
```

`request` resolves with the `result`, or rejects with an `Error` whose `message` and `code` are the response's. `on` calls each handler of an event in registration order.

### Mount context

The second argument of `mount(engine, context)`. Plain data:

| Field | Content |
|---|---|
| `mod` | `source`, `title`, `version`, `description`. `name` was removed in mod API `0.1.14`. |
| `mosaic` | `source`, `title`, `description` of the mosaic the mod was opened from (see the [mosaic module](../../mosaic/README.md)), or `null` for a mod opened from a mod link. It never holds the mosaic's `config`, `aliases` or `permissions`: the mod receives their effect in `config`, `tiles` and `permissions`. Added in mod API `0.1.13`. |
| `collection` | `source`, `title`, `description` of the collection the mod's tiles were loaded from, or `null` for a mod opened with a tile or without a collection. A collection without a `description` gives `""`. A mod opened from a mosaic gets the mosaic's collection. It does not change when the tiles are reloaded, so `tiles.changed` does not carry it. Added in mod API `0.1.17`. |
| `api` | `version`: the app's mod API version as a string, `"0.1.18"` (see [Mod API version](#mod-api-version)). Every mod gets it, whether it declares an `api` range or not. |
| `config` | The mod's `config`. For a mod opened from a mosaic, the mod's config merged with the mosaic's: mappings are merged key by key, and any other mosaic value, `null` included, replaces the mod's (see [Config merge](../../mosaic/README.md#config-merge)). `mods.inspect` still gives the mod's own config. |
| `params` | The link's parameters other than `mod`, `collection`, `tile` and `mosaic`, as a mapping of strings. |
| `tiles` | The tiles of the link's collection, or its one tile, that match the mod's tile type. Metadata strings starting with `./` or `../` arrive resolved against the tile's `source` (see [Tiles](#tiles)). |
| `issues` | The issues from loading and validating the collection or the tile. |
| `permissions` | `granted` and `denied` lists of `{ category, host, reason }`. |
| `theme` | `colorScheme` (`"light"` or `"dark"`) and `tokens`, a mapping from each theme token name to its value for that color scheme (see the [theme module](../theme/README.md)). It is the theme current when the frame connects, not when the mod started loading, so a mod opened while the user switches still mounts with the right one. |
| `layout` | The frame's layout as a string: `"contained"`, `"theater"` or `"fullscreen"` (see [Frame layout](#frame-layout)). It is the layout current when the frame connects, so a mod opened while the user turns theater mode on still mounts with the right one. The frames of mod checks and test cases always get `"contained"`. Added in mod API `0.1.9`. |

### Frame layout

Each mod frame has one of three layouts:

- `fullscreen` while the frame is the app page's fullscreen element, whether the stage bar's fullscreen button or the mod itself asked for it;
- otherwise `theater` while the user's theater mode is on;
- otherwise `contained`, the default.

In `contained`, the base stylesheet keeps the frame's `<body>` at most `--ot-content-width` wide and centered; `theater` and `fullscreen` set no width limit (see the [theme module](../theme/README.md#write-html-get-the-apps-look)). The frame itself fills the stage area in `contained` and `theater` alike. A mod learns its layout three ways: the `data-ot-layout` attribute on its `<html>`, set before `mount` and before the `layout.changed` handlers run, also for mods with `theme: "none"`; `context.layout`; and the `layout.changed` event. The stage decides the layout (see the [stage module](../stage/README.md#frame-layout)).

### Tiles

A collection is optional. A link may name a `tile` instead, the location of one tile file: the engine loads it before the frame starts and handles it as a collection holding only that tile, whose source is the tile's (`loadModTile`, see [Launch](#launch)), so what follows applies to it too, and a tile of another type gives no tiles and one warning. Without a collection or a tile, `tiles` and `issues` are empty and no collection or tile file is requested. With one:

- For a mod opened from a mosaic with `aliases`, the engine first renames each tile's top-level metadata keys (`applyMosaicAliases`, see [Aliases](../../mosaic/README.md#aliases)): a laureate tile with `name` and `birth_country` reaches a type that requires `title` and `country` with those keys instead. The tiles of `tiles.changed` after "Reload tiles" are renamed the same way. A tile's `source` and `body` never change.
- When the mod has a `type_path`, the engine builds the tile validator, validates the collection, after the aliases for a mosaic, and keeps only the tiles whose `types` include the type name. Tiles that do not match are left out of `tiles` and appear as warnings in `issues`.
- Without a `type_path`, the mod receives every tile, each with `types` `[]`.
- The validator is built again on each load, so "Reload tiles" picks up a changed type file too.
- Each metadata string that starts with `./` or `../`, also inside lists and nested mappings, arrives as the absolute URL it names, resolved against the tile's `source`: `image: "./cover.jpg"` in `https://example.org/books/kallocain.md` arrives as `"https://example.org/books/cover.jpg"`. Only that prefix counts: strings such as `/r/books`, `cover.jpg` or absolute URLs, other values and mapping keys arrive as written. The tiles of `tiles.changed` and of a checked mod are resolved the same way; tiles a test passes to `mount(options)` are used as given. The loaded tile, which the collection is validated against, and the tile's `body` stay as written. A mod that shows such a string as text shows the absolute URL.

### Tile bodies

A tile's `body` reaches the mod as written. The engine can render it for the mod, so no mod has to bundle a markdown parser or sanitize what tile authors write. What the rendered HTML holds is described in the [tile bodies module](../tile_bodies/README.md): GitHub-flavored markdown and the HTML GitHub allows, `<video>`, `<audio>` and `<picture>`, paths resolved against the tile, alerts, heading ids, formulas rendered as MathML, code labeled with a common language highlighted, emoji shortcodes such as `:tada:` turned into emoji, and a placeholder for each player.

**`tiles.renderBody { source }`** answers `{ html }`, the body of the mod's tile whose `source` is `source`. The tiles are those the mod currently receives, after "Reload tiles" too. An empty body gives `""`. A `source` that is not a string is `-32602` (`tiles.renderBody: "source" must be a string`), and so is one that names no tile of the mod (`tiles.renderBody: the source https://example.org/other.md is not one of the mod's tiles`). A body renders on its first request and is kept, and two requests for one body render it once. A body that fails to render, such as when the library a formula, a code block or a shortcode needs cannot be loaded, is `-32603` with a message starting with `tiles.renderBody`; the failure is not kept, so the next request renders the body again.

**`<ot-tile-body>`** is an element the frame loader defines in every mod frame, the frames of a check's tests included. Setting its `tile` property to a tile sends `tiles.renderBody` with the tile's `source`, and shows the result as the element's children, in the light DOM, so the theme and the mod's CSS style it. It then fires `ot-rendered`, which bubbles. When the request fails, the element shows the error's message as text with `role="alert"`. When `tile` is set again before the answer, the newest tile wins. After showing a body, the element draws its mermaid blocks as diagrams in the mod's frame, with the [mermaid library](#libraries), and fires `ot-diagrams-drawn`; `diagrams = "source"` keeps them as code (see [Diagrams](../tile_bodies/README.md#diagrams) in the tile bodies module).

```js
const body = document.createElement("ot-tile-body");
body.addEventListener("ot-rendered", function markShown() {
  body.dataset.shown = "true";
});
body.tile = tile;
document.body.append(body);
```

**Clicks in rendered bodies.** The frame loader listens to `click` on `window`, in the bubbling phase, so a mod writes no code for the links and players of a body. For a click the mod did not cancel:

- on an element with `data-ot-player`: it sends `players.open` with the attribute's value (see [Players](#players));
- on a link with `data-ot-link`: it cancels the navigation and sends `links.open` with the link's `href`, so the action dialog asks to open it and the mod keeps running;
- on a link with `data-ot-fragment` (`#notes`): it cancels the navigation and scrolls to the heading `user-content-notes` nearest to the link. It looks inside the link's ancestors from the nearest outward, so with several bodies on a page, a link reaches the heading of its own body. A fragment without such a heading does nothing.

A rejected request is logged with `console.warn`. To handle a body's clicks yourself, call `preventDefault()` on the click in your own listener: the frame loader then does nothing. Stopping the click's propagation without cancelling it lets a link navigate the frame, which stops the mod.

The engine also reads the bodies at launch and after "Reload tiles": their images, video, audio, sources, posters and `srcset` candidates count as media linked by tiles (see the [sandbox module](../sandbox/README.md#media-linked-by-tiles)), and their players are the mod's player addresses. Bodies without `<`, `![` or `://` are skipped then, so plain-text bodies cost nothing until the mod asks for them. A body with media takes about 2 ms to read: 500 such tiles add about a second to a mod's start.

### Inspecting and opening mods

References in requests are resolved against the app's address, so a reference means the same in a request, in the address bar and after a reload. A default mod name (`mod_viewer`) means its folder in the default mods folder.

Before any file is requested, the engine checks:

1. The request's params. `mods.open` needs `mod` as a non-empty string, `collection` and `tile` each absent, `null` or a non-empty string, but not both a collection and a tile, `params` absent or a mapping of strings without the reserved names `mod`, `collection`, `tile`, `mosaic` and `sites`, and `replace` absent or a boolean. `mods.check` needs `mod` and `collection` the same way. Otherwise `-32602`, e.g. `mods.open: "params.target" must be a string`, `mods.open: a link cannot have both "collection" and "tile"`, `mods.open: "params.tile" is reserved`, `mods.open: "replace" must be a boolean` or `mods.check: "mod" must be a non-empty string`.
2. The `open` permission: the requesting mod needs a **granted** `open` permission for `"*"` or the origin of the target mod file. Otherwise `-32002` (see the [permissions module](../permissions/README.md)). Mods served from the app's origin are granted their permissions, and mods from other origins the ones the user allowed.
3. The switched-off list: a switched-off default mod is refused with `-32003`, whatever reference names it.

Then:

- `mods.inspect` loads the mod file, without its entrypoint, and answers `source`, `title`, `version`, `description`, `api` (the mod's `api` range as written, or `null` when it declares none), `apiCompatible` (`true` when the range matches the mod API version, `false` when it does not, `null` without a range), `typeSource`, `defaultMosaic` (the resolved address of the mod's default mosaic file, or `null`; it is not requested; added in mod API `0.1.14`), `testSource` (the resolved address of the mod's test file, or `null` when it declares none; the test file is not requested), `config`, `libraries` (the mod's declared libraries, each `{ name, package, version, files }` with every file's `path`, `source` and `kind`; no library file is requested; added in mod API `0.1.10`) and `permissions` (the `granted` and `denied` lists that mod would get if it were opened without being asked: for a mod from another origin, what the user allowed and remembered). Inspecting a mod for another API asks the user nothing. A load failure is `-32001` with the load error's message.
- `mods.open` asks the stage to open the link in a new sandbox, with the requesting sandbox as its opener, and answers `null`. Only the visible mod can open mods: a hidden one gets `-32002` with `mods.open: only the visible mod can open mods`. The new mod's load failures belong to its own sandbox, not to the response, so a missing `tile` is an error of the new sandbox that names the tile's address.
- `mods.open` with `replace: true` opens the link in place of the requesting sandbox instead: the new sandbox takes the requester's history entry, opener and section, and the stage closes the requester (see the [stage module](../stage/README.md#replacing-a-sandbox)). The requester's session is stopped before the handler returns, so it gets no answer. The Home mod shown at `#/` cannot be replaced: it gets `-32002` with `mods.open: the home mod cannot be replaced`, and nothing opens. The handler gets the stage's answer from `onOpenLink(link, { replace })`, an `OpenLinkOutcome` (`"opened"`, `"not-visible"` or `"home-mod"`), and maps each refusal to its message.
- `mods.check` asks the stage to check the mod without running it for the user, and answers the report once the check is done. `collection`, resolved against the app's address, gives the tiles to mount, with the mod's own config and permissions. Without it, the mod is checked as its default mosaic (`default_mosaic`) opens it: with the mosaic's collection, merged config, aliases and `show` lines. A default mosaic that names another mod is a `bundle` error, and a mod without a default mosaic is mounted with no tiles. Only the visible mod can check mods: a hidden one gets `-32002` with `mods.check: only the visible mod can check mods`. A mod file that cannot be loaded is a report with status `"fail"`, not an error response. Checking a mod for another API asks the user nothing.

The check has three steps. The bundle check loads the mosaic file when the check uses one, the mod file, the entrypoint, the files of the declared libraries, the tile type and the collection, and validates the tiles, after the mosaic's aliases (see [Mod check](#mod-check)). When it found no error, the mount check mounts the mod in a hidden frame, with the content policy, config and permissions it would get if it were opened, the mosaic's included, the tiles of its type and a throwaway storage slot, and records what happens until 1 second after `mount` finished (see the [stage module](../stage/README.md#mod-checks)). When the mod declares `test_path` and the mount check found no error either, the test step fetches the test file and runs each of its cases in a fresh hidden frame of its own (see the [guide to writing mod tests](../../../../mod_plugin_spec.md#mod-tests)). The report is plain data:

```json
{
  "source": "https://example.org/samples/mods/book_list/mod_conf.yaml",
  "mosaic": "https://example.org/samples/mods/book_list/mosaic.yaml",
  "status": "warn",
  "mountChecked": true,
  "testsChecked": true,
  "tests": [
    { "name": "lists the sample books", "status": "pass", "message": null },
    { "name": "highlights the remembered book", "status": "pass", "message": null }
  ],
  "findings": [
    {
      "step": "bundle",
      "level": "warning",
      "source": "https://example.org/samples/mods/book_list/mod_conf.yaml",
      "message": "the mod declares no \"api\" range, so it may not work with mod API 0.1.11"
    }
  ]
}
```

`source` is the checked mod file's address, and `null` only when a mosaic check failed before its mod was known. `mosaic` is the address of the mosaic file the check used, loaded or not, and `null` when it used none: a check with `collection`, or of a mod without a default mosaic. `status` is `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none. `mountChecked` is `false` when a bundle error skipped the mount. `testsChecked` is `true` when the mod's cases ran, and `false` for a mod without `test_path`, when a bundle or mount error skipped the tests, or when the test file could not be loaded. `tests` lists each case the test file registers, in order, as `{ name, status, message }`, with `status` `"pass"` or `"fail"` and `message` `null` for a passing case and the failure's message otherwise; it is empty when the cases did not run. Findings are in the order they were found, and `step` is `"bundle"`, `"mount"` or `"test"`. A `test` finding comes from the tests: a test file that cannot be loaded or registers no valid case, a failed case (`The test "<name>" failed: <message>`, whose source is the test file), or what a case's mod did that the mount check would record, with the message prefixed by `In the test "<name>": `.

Mods never build app addresses: they send what to run, and only the stage turns it into a run link and a history entry (see the [stage module](../stage/README.md)).

### Inspecting collections

`collections.inspect { collection }`, where `collection` is the collection file or a folder holding `collection.yaml`, reads a tile collection's file alone, without requesting any of its tiles, and answers its index. A mod uses it to list collections, or to show what one holds, without being opened with it.

Before any file is requested, the engine checks:

1. The params: `collection` must be a non-empty string (`-32602`, `collections.inspect: "collection" must be a non-empty string`). It is resolved against the app's address, as the references of `mods.*` are, and a location that cannot be resolved is `-32602` too.
2. The `open` permission: the requesting mod needs a **granted** `open` permission for `"*"` or the origin of the collection file. Otherwise `-32002`, with `Inspecting collections from <origin> is not allowed. Add it to permissions.open in mod_conf.yaml.`, or `Inspecting collections from <origin>: the mod declares it in permissions.open, but the permission was not granted.` for a mod from another origin whose `open` the user did not allow. The request never shows a dialog.

Collections are not default mods, so there is no switched-off check. Hidden mods may inspect collections, as they may inspect mods.

Then the engine reads the index (see the [tile module](../../tile/README.md#collection-index)) and answers it as plain data:

- `source`: the resolved address of the collection file;
- `title` and `description` (`""` when the file has none). Before mod API `0.1.14`, `title` was `name`;
- `tiles`: the resolved address of each tile entry that loading the collection would request, in entry order, with a repeated tile listed once;
- `issues`: the entry issues, each `{ level, source, message }` with level `"warning"` or `"error"`: malformed entries, relative `url`s, local files in a remote collection, and repeated tiles. A tile that would fail to load is listed with no issue, since it is never requested.

A collection file that cannot be fetched or read, is not plain YAML, or does not have the collection structure is `-32001`, with the load error's message, which names the collection's source, such as `Cannot load file "https://example.org/samples/tiles/missing.yaml": HTTP 404 Not Found`.

```js
const inspection = await engine.request("collections.inspect", {
  collection: "./samples/tiles/literature_nobel_laureates/collection.yaml",
});
// inspection.source === "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml"
// inspection.title === "Nobel Prize in Literature laureates"
// inspection.tiles[0] === "https://example.org/samples/tiles/literature_nobel_laureates/2010__mario_vargas_llosa.md"
// inspection.issues is []
```

### Inspecting and opening mosaics

A mosaic is a file that opens a mod with a collection, the mosaic's config, aliases and `show` lines (see the [mosaic module](../../mosaic/README.md)). `mosaics.inspect { mosaic }` reads a mosaic file without opening it, and `mosaics.open { mosaic, params?, replace? }` opens it as if the user had followed its run link `#/run?mosaic=…`. A mosaic explorer or viewer uses them to list mosaics, show what one holds, and open it.

Before any file is requested, the engine checks:

1. The params: `mosaic` must be a non-empty string (`-32602`, `mosaics.inspect: "mosaic" must be a non-empty string`, or the same for `mosaics.open`). It is resolved against the app's address, as the references of `mods.*` and `collections.*` are: a folder means the `mosaic.yaml` in it. For `mosaics.open`, `params` must be a mapping of strings without `mod`, `collection`, `tile`, `mosaic` or `sites` (`mosaics.open: "params.mod" is reserved`), and `replace` a boolean (`mosaics.open: "replace" must be a boolean`), each `-32602`.
2. The `open` permission: the requesting mod needs a **granted** `open` permission for `"*"` or the origin of the mosaic file. Otherwise `-32002`, with `Opening mosaics from <origin> is not allowed. Add it to permissions.open in mod_conf.yaml.`, or `Opening mosaics from <origin>: the mod declares it in permissions.open, but the permission was not granted.`. The request never shows a dialog.

**The `open` rule of a mosaic:** `open` is checked against the mosaic file's origin only. The mod the mosaic names is not checked against the requester's `open`: checking it would mean loading the mosaic file before answering. Opening a mosaic is the same act as a user following its link, and the mod opened still gets its own mod API question and site consent. So a mod with `open` for `https://example.org` only can open a mosaic at `https://example.org/m.yaml` whose mod is at `https://mods.example.net/clock/`.

`mosaics.inspect` then loads the mosaic file, requesting neither its mod, its collection nor any tile, and answers plain data:

- `source`: the resolved address of the mosaic file;
- `title` and `description`;
- `mod`: the resolved address of the mosaic's mod file, and `collection`: the resolved address of its collection file, or `null`;
- `config` and `aliases`: the mosaic's own, not merged with the mod's;
- `permissions`: the `granted` and `denied` lists the mosaic's `show` lines would get if it were opened without asking: every line for a mosaic from the app's origin, and for one from another origin, the lines with a remembered allow for that mosaic file granted and every other line denied. Inspecting a mosaic never shows the site consent dialog.

A mosaic file that cannot be fetched or read, is not plain YAML or does not follow the mosaic file format is `-32001`, with the load error's message, which names the mosaic file, such as `Cannot load file "https://example.org/samples/mosaics/missing.yaml": HTTP 404 Not Found`.

`mosaics.open` hands the stage the link `{ mod: "", collection: null, tile: null, mosaic, params }`, where `mosaic` is the resolved address of the mosaic file, through the same `onOpenLink(link, { replace })` as `mods.open`, and answers `null`. So the app's address becomes `#/run?mosaic=<resolved address>&<params>`. Its outcomes map to the same refusals, with their own messages: `mosaics.open: only the visible mod can open mosaics` for a hidden mod, and `mosaics.open: the home mod cannot be replaced` for the Home mod at `#/` with `replace: true`, both `-32002`. The mosaic's load failures belong to the new sandbox, not to the response, so a missing mosaic file is an error of the new sandbox that names the file's address.

```js
const inspection = await engine.request("mosaics.inspect", {
  mosaic: "./samples/mosaics/nobel_map",
});
// inspection.source === "https://example.org/samples/mosaics/nobel_map/mosaic.yaml"
// inspection.mod === "https://example.org/samples/mods/country_map/mod_conf.yaml"
// only the mosaic file was requested

await engine.request("mosaics.open", { mosaic: inspection.source });
// the mosaic's mod is now the visible mod, and the address is its run link
```

A mod opened from a mosaic reads it in `context.mosaic` (`source`, `title`, `description`), and `null` otherwise (see [Mount context](#mount-context)).

#### Checking a mosaic

`mosaics.check { mosaic }` checks a mosaic's mod as the mosaic opens it, and answers the report once the check is done. Its params and its `open` rule are those of `mosaics.inspect`: `mosaic` must be a non-empty string (`-32602`), and the requester needs a granted `open` permission for `"*"` or the mosaic file's origin (`-32002`, with the same `Opening mosaics from <origin> …` messages), checked before any request. Only the visible mod can check mosaics: a hidden one gets `-32002` with `mosaics.check: only the visible mod can check mosaics`.

The check runs the bundle check and the mount check of [`mods.check`](#inspecting-and-opening-mods), and not the mod's tests, which belong to the mod and use its own fixtures:

- The bundle check loads the mosaic file first. A mosaic file that cannot be loaded is a `bundle` error whose source is the file, in a report whose `source` is `null`. The mosaic's `mod` is resolved as when the mosaic opens, so a default mod name means its folder, and a switched-off default mod is a `bundle` error, with none of its files requested. Then the mod's files are checked with the mosaic's collection, whose tiles are renamed by the mosaic's aliases before they are validated.
- The mount check mounts the mod with the merged config, the aliased tiles and the mosaic's `show` lines. A mosaic from another origin gets only the lines the user allowed and remembered for that mosaic file, and nothing is asked. A request the mosaic declared but was not granted is a `mount` warning that says so.
- The report has `testsChecked` `false`, and the mosaic file's address as `mosaic`.

Two `bundle` warnings, whose source is the mosaic file, are specific to checks with a mosaic, by `mosaics.check` or by `mods.check` with a default mosaic:

- an alias for a field the tile type's `ref` definition does not declare, among its `properties` and `optionalProperties`, such as `The mosaic gives aliases for "contry", a field the tile type "book" does not declare.` A mod without a tile type accepts every field, so it gets none;
- a key of the mosaic's config, at any depth of nested mappings, that the mod's config does not have at the same path, such as `The mosaic sets "config.map.zom", a key the mod's config does not have.` A list or a scalar the mosaic sets in place of a mapping replaces it, and is not reported.

```js
const report = await engine.request("mosaics.check", {
  mosaic: "./samples/mosaics/nobel_map",
});
// report.mosaic === "https://example.org/samples/mosaics/nobel_map/mosaic.yaml"
// report.source === "https://example.org/samples/mods/country_map/mod_conf.yaml"
// report.testsChecked === false
```

### Reading the catalog

`catalog.list` answers the catalog as `{ mods, collections, mosaics }`, each list in catalog order. The catalog lists the things the app can open: mods, collections and mosaics, each a catalog entry of a catalog kind. It is made of the [instance catalog](#instance-catalog), the lists the instantiation sets, of the default mosaics while "List the default mosaics of mods" is on, and of the user catalog's mosaics (see the [user catalog module](../../user_catalog/README.md)). "Catalog" alone always means this whole; each part is qualified (*instance catalog*, *user catalog*) or has its own name (*default mosaics*). It needs no permission: any mod, visible or hidden, gets it. Its params are ignored.

| Entry | Keys |
| --- | --- |
| Mod and collection | `{ source, listedBy, place }` |
| Mosaic | `{ source, listedBy, place, defaultOf, provenance }` |

- `source`: the resolved address of the entry's file.
- `listedBy`: who listed it: `"instance"` for an entry of the instance catalog, `"default"` for a default mosaic, `"user"` for a user catalog entry. Added in mod API `0.1.18`.
- `place`: where its file lives: `"browser"` for an `opentesela-browser:` address, a file stored in this browser, or `"remote"` for any other address. Added in mod API `0.1.18`.
- `defaultOf`: `{ source, title }` of the mod whose default mosaic it is, or `null`.
- `provenance`: where a user mosaic came from, `{ folder, path, addedAt, updatedAt }`, or `null` unless `listedBy` is `"user"`. For a stored mosaic, `folder` is the picked folder's name or `null` for a single file, `path` its path inside the folder or its file name, `addedAt` when it was first imported, and `updatedAt` when it was last updated, or `null`. For a mosaic added by URL, `folder`, `path` and `updatedAt` are `null` and `addedAt` is when it was added. Times are ISO 8601 strings in UTC. Added in mod API `0.1.18`.

```js
const catalog = await engine.request("catalog.list", {});
// catalog.mods[0] is { source: "https://example.org/samples/mods/book_list/mod_conf.yaml", listedBy: "instance", place: "remote" }
// catalog.mosaics[0] is { source: "https://example.org/samples/mosaics/nobel_books_list.yaml", listedBy: "instance", place: "remote", defaultOf: null, provenance: null }
```

While "List the default mosaics of mods" is off, nothing is fetched to answer it. While it is on, the mosaics also hold the default mosaic of each catalog mod that declares one, after the instance catalog's mosaics, in the order of the mods, with `defaultOf` naming its mod:

```json
{ "source": "https://example.org/samples/mods/book_list/mosaic.yaml", "listedBy": "default", "place": "remote", "defaultOf": { "source": "https://example.org/samples/mods/book_list/mod_conf.yaml", "title": "Book List" }, "provenance": null }
```

To find them, each catalog mod's mod file is fetched, in parallel, and nothing else: no entrypoint, library, collection or mosaic file. A mod whose file cannot be loaded, or that declares no default mosaic, adds nothing. A default mosaic that the instance catalog's mosaics or an earlier mod already list appears once, at its first place, so one the instance catalog lists keeps `defaultOf: null`. Lookups are not cached, so a mod author who edits `default_mosaic` sees the change at the next request.

The user catalog's mosaics come last, in the order the user added them. A user mosaic that an earlier mosaic of the catalog already lists appears once, at its earlier place and with its marks, and stays in the user catalog: switched off, the same default mosaic is listed at the user catalog's place, with `listedBy: "user"`. A stored mosaic, imported from the user's files:

```json
{ "source": "opentesela-browser:///7f3a…/maps/nobel_map.yaml", "listedBy": "user", "place": "browser", "defaultOf": null, "provenance": { "folder": "my-mosaics", "path": "maps/nobel_map.yaml", "addedAt": "2026-11-20T10:00:00.000Z", "updatedAt": null } }
```

When the switch changes, or the user catalog changes, the engine pushes `catalog.changed` to every running mod, visible or hidden, once, with the new catalog. A mod that lists the catalog follows it without a reload:

```js
engine.on("catalog.changed", function relist(catalog) {
  render(catalog.mosaics);
});
```

How it works: `buildCatalog(instanceCatalog, includesDefaultMosaics, userCatalog, fetchOptions)` (`catalog.ts`) builds the `Catalog` from the `ResolvedInstanceCatalog` and the user catalog's entries, and sets the marks. The stage gives every session, checks included, a `readCatalog` built on it, which `catalog_methods.ts` answers from, and it builds the catalog once for the push (see the [stage module](../stage/README.md#catalog)).

### Asking the user: links, files and confirmations

The sandbox keeps a mod from opening tabs, starting downloads and showing browser dialogs. Instead, a mod asks the app, which shows the request in its own dialog, outside every frame, with the mod's title and source. The app acts only when the user accepts, and the request answers `true` or `false`. No permission is needed.

| Request | The dialog shows | Accept does |
|---|---|---|
| `links.open { url }` | The full address, normalized, with an internationalized host in punycode. Buttons Open and Cancel. | Opens the address in a new tab with `noopener` and `noreferrer`, so the tab has no access to the app. |
| `files.save { name, content, encoding?, type? }` | The file name and size. Buttons Save and Cancel. | Downloads a file with that name, type and content. |
| `ui.confirm { message, confirmLabel?, cancelLabel? }` | The message as plain text, keeping its line breaks. Buttons `confirmLabel` (default `OK`) and `cancelLabel` (default `Cancel`). | Nothing more: the answer is the action. |

The params are checked before any dialog, and a problem is `-32602` with a message naming the method and the problem:

- `links.open`: `url` must be an absolute `http:` or `https:` address (`links.open: "url" must be an http: or https: address`), without a user name or password.
- `files.save`: `name` must be a file name: 1 to 255 characters, not `.` or `..`, and without `/`, `\` or control characters (`files.save: "name" must be a file name without a path`). `content` must be a string. `encoding` is `"text"` (the default) or `"base64"`. Text is saved as UTF-8, and base64 must decode (`files.save: "content" is not valid base64`). `type` is a media type such as `"text/csv"`, by default `text/plain` for text and `application/octet-stream` for base64. The saved file must be at most 20 MB (`files.save: the file is larger than 20 MB`).
- `ui.confirm`: `message` must be a non-empty string of at most 1000 characters, and each label, when given, a non-empty string of at most 40 characters.

Only the visible mod can ask: a hidden one gets `-32002` with, for example, `ui.confirm: only the visible mod can ask the user`, and no dialog is shown.

The app shows one dialog at a time. A request that arrives while a dialog is open waits, and dialogs are shown in the order the requests arrived. When the asking mod stops being visible or is closed, its dialogs are removed and its requests answer `false`. A mod that is stopped gets no answer.

```js
const deleted = await engine.request("ui.confirm", {
  message: `Delete "${list.name}"?`,
  confirmLabel: "Delete",
});
if (deleted) {
  removeList(list);
}

await engine.request("files.save", {
  name: "books.csv",
  content: "title\nKallocain\n",
  type: "text/csv",
});

await engine.request("links.open", { url: tile.data.url });
```

The request stays pending while the dialog is open, for as long as the user needs, so a mod must not rely on a quick answer.

### The user catalog

The `userCatalog.*` requests let a mod, such as the mosaic explorer and viewer, reach the user catalog's flows (see the [user catalog module](../../user_catalog/README.md)): `userCatalog.import` opens the import dialog, `userCatalog.update` the update dialog of a stored mosaic, `userCatalog.add` the "Add a mosaic" dialog, `userCatalog.export` the save dialog of a stored mosaic's file, and `userCatalog.remove` a confirmation that removes a user mosaic. The app draws every dialog and does every write: a mod cannot write the user catalog, so a mod cannot add mosaics whose `show` lines widen its own reach. They follow the rules of the other dialogs (see [Asking the user](#asking-the-user-links-files-and-confirmations)): only the visible mod can send them (`-32002` otherwise), one dialog is shown at a time, and a mod that leaves gets `false`. They need no permission.

- `mosaic` must be a non-empty string for `userCatalog.update`, `userCatalog.export` and `userCatalog.remove`, and is resolved against the app's address as a mosaic reference. `userCatalog.add` takes an optional `mosaic` string that fills its field. Wrong params fail with `-32602`, for example `userCatalog.export: "mosaic" must be a non-empty string`.
- `userCatalog.update` and `userCatalog.export` need a stored mosaic, and `userCatalog.remove` a user mosaic, or they fail with `-32602` and no dialog: `userCatalog.update: the mosaic "<address>" is not stored in this browser`, `userCatalog.remove: the mosaic "<address>" is not in the user catalog`.
- Each resolves with `true` once the user confirmed and the change is done, and `false` when the user cancels, presses Escape, or nothing changes. After each change, every running mod gets `catalog.changed` (see [Reading the catalog](#reading-the-catalog)).

```js
const imported = await engine.request("userCatalog.import", {});
await engine.request("userCatalog.remove", { mosaic: entry.source });
```

How it works: `user_catalog_methods.ts` checks the params, then the entries that `ModMethodContext.readUserCatalog()` gives. It gives `null` in checks and cases, which never change the user catalog, so their requests are not checked against entries and get the scripted answer or `false`. Each request becomes a `CatalogAction` (`catalogImport`, `catalogUpdate { address }`, `catalogAdd { suggested }`, `catalogExport { address }`, `catalogRemove { address }`), which the stage queues like the other actions, and the app's user catalog dialogs perform (see [main](../../../main/README.md)).

### Telling the user something

`ui.notify { message, level?, source? }` adds a message from the mod to its sandbox's stage bar, without a dialog, and answers `null`. The user finds it under the errors, warnings or notifications button, with the mod's other messages and the app's (see the [stage module](../stage/README.md#messages-and-load-failures)).

- `message`: the text, a non-empty string of at most 1000 characters, shown as plain text.
- `level`: `"info"` (the default), `"warning"` or `"error"`.
- `source`: what the message is about, such as a tile's `source`, a non-empty string of at most 1000 characters. By default, the mod's source.

A problem with the params is `-32602` with a message naming `ui.notify` and the field, such as `ui.notify: "level" must be "info", "warning" or "error"`, and adds no message.

No permission is needed, and hidden mods can notify too: a hidden sandbox keeps the message and shows it when it is visible again. Each request is a new message, even with the same text, so a mod that repeats itself should say so once. A sandbox keeps at most 100 messages from its mod for each level: past that, the oldest one of that level is dropped, and that level's list ends with how many were dropped. Notifications never push out the mod's errors or warnings. The app's own messages are never dropped.

Each message in the stage bar is labeled "App" or "Mod", and the mod cannot change the label: its title, `source` and `message` are shown after it. So a mod's error never reads as the app's own.

A notification is not an issue: it is never in the mount context's `issues` or in `tiles.changed`, which keep the collection's issues only. In a check, an error or warning notification is a `mount` finding, and `info` is none (see [Mod checks](../stage/README.md#mod-checks)).

```js
await engine.request("ui.notify", { message: "Saved" });

await engine.request("ui.notify", {
  message: "Cannot read the rating",
  level: "warning",
  source: tile.source,
});
```

### Players

A video or audio player from a site such as YouTube does not play inside a mod's frame, whose origin is opaque. So the app shows players itself, in a dialog of its own page, outside the mod's frame, after asking the user. `players.open { url }` follows the rules of the other actions above: only the visible mod asks, one dialog at a time, in the order the requests arrived, and a mod that leaves gets an answer.

**Player addresses.** `url` must be a player address of the mod's current tiles:

- the `src` of an `<iframe>` in a tile's body, resolved against the tile, when it is `https:` and allowed by the private network guard (see the [sandbox module](../sandbox/README.md#media-linked-by-tiles)). The rendered body holds it as a placeholder's `data-ot-player`;
- a page link or player address of a known site (YouTube, Vimeo, SoundCloud) that is a metadata string of a tile, such as `video: "https://www.youtube.com/watch?v=aqz-KE-bpKQ"`, or an image address in its body, such as `![Trailer](https://www.youtube.com/watch?v=aqz-KE-bpKQ)`.

No other address is one: `homepage: "https://example.org/about"` is not a player. The [players module](../players/README.md) lists the known sites and what each plays from: YouTube plays from `youtube-nocookie.com`, and any other iframe from its own `src`.

**Errors**, without a dialog: a `url` that is not a string holding an absolute `https:` address is `-32602` (`players.open: "url" must be an absolute https: address`), and one that is not a player address of the mod's tiles is `-32002` (`players.open: https://www.youtube.com/watch?v=dQw4w9WgXcQ is not a player of the mod's tiles`). A hidden mod gets `-32002` (`players.open: only the visible mod can ask the user`).

**The player dialog** names the mod by its title and source, shows the whole title the tile gives the player (the iframe's `title`, the image's alt text, or the tile's `title` for a metadata page link), the site's name for a known site and the host the player loads, and says that this site will see that the user played this. Until the user presses Play, nothing is requested from the site. Cancel is focused; Cancel and Escape answer `false`. **Always play from <host>**, unchecked by default, remembers the host for every mod when Play is pressed, and later players of that host play at once. Settings lists and removes these hosts (see the [Settings page](../../../main/settings/README.md)).

After Play, the player plays in a frame of the app's page, sized for the site, with a Close button; Escape closes it too. The app sets the frame's sandbox, permissions and referrer policy itself, and never copies an attribute of the tile's iframe: the player gets autoplay, encrypted media, picture-in-picture and fullscreen, and the app's origin, and no more, as the referrer. Closing removes the frame, so playback stops, and answers `true`. A player removed because its mod stopped being visible, was closed or was stopped answers `true` too.

```js
await engine.request("players.open", {
  url: tile.metadata.video,
});
```

A mod rarely sends it itself: a click on a placeholder of a rendered body sends it (see [Tile bodies](#tile-bodies)).

### Libraries

`libs.load` installs a library in the frame of the mod that asks. It knows two kinds of libraries: the ones the app ships, and the ones the mod declares in its mod file.

**Shipped libraries.** Some libraries are too large for a mod to bundle. The app ships a vetted copy of them and installs one in the frame of a mod that asks, from the app's own host.

| Name | Major version | Global |
|---|---|---|
| `mermaid` | `12` | `globalThis.mermaid` |

`libs.load { name, version }` installs the shipped library `name` at the major version `version`, and resolves with `{ name, version }`, where `version` is the full version installed, such as `"12.2.0"`, once the library is ready to use:

```js
const { version } = await engine.request("libs.load", {
  name: "mermaid",
  version: "12",
});
```

- `version` is a major version, as a string: `"12"`, not `"12.2"` nor `12`.
- Another major version is `-32602` (`libs.load: the app has mermaid 12, not mermaid "11"`), and so is a `version` that is not a string. Nothing is installed.

**Declared libraries.** A mod lists the other libraries it uses under `libraries` in its mod file: npm packages at an exact version, or files next to the mod (see the [mod module](../../mod/README.md#library-declarations)):

```yaml
  libraries:
    leaflet:
      npm: "leaflet@1.9.4"
      files: ["dist/leaflet.js", "dist/leaflet.css"]
    world_atlas:
      npm: "world-atlas@2.0.2"
      files: ["countries-110m.json"]
```

`libs.load { name }` installs the declared library `name`, and resolves with `{ name, version, files }` once all of its files are installed:

```js
await engine.request("libs.load", { name: "leaflet" });
// { name: "leaflet", version: "1.9.4", files: {} }, and globalThis.L is ready
const { files } = await engine.request("libs.load", { name: "world_atlas" });
const world = JSON.parse(files["countries-110m.json"]);
```

- Each file's kind follows its extension. `.js` files are installed as classic scripts, in the order of `files`, each one after the previous one ran, so a plugin can follow the library it extends. `.css` files are installed as stylesheets, after the scripts. Any other file is data: it is not installed, and `files` maps its path, as declared, to its text. The mod never receives the text of a script or a stylesheet.
- A library's stylesheets go before every stylesheet the mod added, right after the theme styles (or after the `<meta>` elements with `theme: "none"`). At equal specificity, the mod's rules win over the library's, whatever the order in which the mod added its styles and loaded the library. A relative `url()` in a library stylesheet does not resolve, since the stylesheet is inline text.
- `version` is the declared npm version, or `null` for files next to the mod. A request may leave `version` out, give `null` or give the declared version: all three name the same library and share one install. Any other version is `-32602` (`libs.load: the mod declares leaflet 1.9.4, not leaflet "1"`, or `libs.load: the library "helper" has no npm version, so "version" must be absent or null, not "1.0.0"`).
- A mod only loads the libraries it declares: another mod's declarations do not count.
- Declared libraries need no permission, add no line to the site consent dialog and leave the frame's content policy as it is: the app's page fetches the files, not the frame, from a host the instance chose and from a list fixed in the mod file. That works for mods from other origins too.
- Only classic scripts are supported: a mod file that lists an `.mjs` file is rejected, and a `.js` file that is an ES module fails to install with `libs.load: the library "…" could not be installed: …`. Pick a package's UMD or IIFE build.

**Where the files come from.** The app fetches an npm file from its [npm host](#npm-host), at `<npm host><package>@<version>/<path>`, which is `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js` in the vanilla app, and a file next to the mod from its address resolved against the mod file. The app's page makes these requests, so the npm host sees the user's address and the names and versions of the packages, not the mod. A mod that must work offline, or on a network that blocks the npm host, declares files next to the mod instead.

**Errors.** A name that is neither a library the app ships nor one the mod declares is `-32602`, as in `libs.load: the app has no library "katex" (it has mermaid), and the mod declares none of that name`, followed by ` (it declares leaflet, world_atlas)` when the mod declares some. When a file of a declared library cannot be fetched, the request is `-32001` and none of the library's files is installed. The message names the library, the file's address and the HTTP status or the network error, and ends with the host's answer when it is short plain text, as jsDelivr's 404 reasons are:

```text
libs.load: the library "leaflet" could not be loaded: Cannot load file "https://cdn.jsdelivr.net/npm/leaflet@9.9.9/dist/leaflet.js": HTTP 404 Not Found: Couldn't find the requested release version 9.9.9.
```

**Once per frame, once per page.** A frame receives a library once: a second `libs.load` resolves with the same result and leaves the library's globals as they were. A failed request is not kept, so a later one tries again. The app downloads a shipped library on the first request in a page, and fetches each declared file address on the first request for a library that lists it, never before: a mod that declares a library it never loads costs no request. It keeps what it fetched for the page, so two mods that declare the same files download them once, and each frame still installs its own copy. A file that failed is fetched again by the next request.

The libraries run only in the frame that asked, under its sandbox and content policy, not in the app's page nor in another mod's frame. They work in the frames of a check's tests too, and a case's `requests` record what the mod received: `{ name, version }` for a shipped library, and `{ name, version, files }` with the data files for a declared one, never the code.

How it works: the engine's handler (`libs_methods.ts`) answers a shipped library's code, or a declared library's files with their texts and kinds, once all of them arrived. The frame loader installs each script as a classic `<script>` from a `blob:` address and each stylesheet as a `<style>` element, which the frame's policy allows, before it resolves the mod's request.

**Size.** Mermaid's single-file build is about 5.5 MB, 1.6 MB gzipped, in a chunk of its own, `assets/mermaid.min-<hash>.js`, which an instantiation serves with the rest of the build. The app's first load does not include it. Each frame that loads it pays its install, 0.2 to 0.6 s on a desktop, a first diagram slower than the next ones, up to about 0.25 s on a desktop and close to 1 s on a slower CPU, and its memory: two mods that draw diagrams each install their own copy. Data files travel to the frame as text and are recorded in test cases' `requests`, which suits files of a few hundred kilobytes.

### Default mod settings

The app has default mod settings: the default mods folder and the default mods that are switched off. What `#/` shows is not a default mod setting: it is the Home section of the app's [section registry](../../../main/README.md#home-a-page-or-a-mod). The vanilla app (`src/main/default_mods.ts`) uses:

```ts
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  switchedOff: [],
};
```

The folder is resolved against the app's address, and each switched-off name to the source of its mod file, so a switched-off mod is refused whatever reference names it.

### Instance catalog

The instance catalog is what the instantiation sets: the mods, collections and mosaics it offers, three ordered lists of references (`InstanceCatalog`). It is a part of the catalog, which the explorers list and mods read with [`catalog.list`](#reading-the-catalog). The vanilla app (`src/main/instance_catalog.ts`) uses:

```ts
export const INSTANCE_CATALOG: InstanceCatalog = {
  mods: [
    "./samples/mods/book_list",
    "./samples/mods/flashcards",
    "./samples/mods/country_map",
  ],
  collections: [
    "./samples/tiles/literature_nobel_laureates/collection.yaml",
    "./samples/tiles/literature_nobel_laureates_books/collection.yaml",
  ],
  mosaics: [
    "./samples/mosaics/nobel_books_list.yaml",
    "./samples/mosaics/nobel_laureates_map.yaml",
  ],
};
```

Each entry is resolved against the app's address with the rules of its kind: a mod entry as a mod reference, so a default mod name (`tile_viewer`) means its mod file in the default mods folder and a folder means its `mod_conf.yaml`; a collection entry as a collection reference, so a folder means its `collection.yaml`; and a mosaic entry as a mosaic reference, so a folder means its `mosaic.yaml`. A mod entry that names a switched-off default mod is left out, whatever reference names it.

`resolveInstanceCatalog(catalog, baseUrl, defaults)` (`instance_catalog.ts`) resolves it once, when the app starts, and returns `{ catalog, errors }`: the `ResolvedInstanceCatalog`, whose entries are the addresses of their files, and the start errors. An entry that is empty, cannot be resolved, or resolves to the same file as an earlier entry of its list gives an error that names the list and the entry as written, and the app does not start, as for an invalid section registry:

```text
Instance catalog mods: "./samples/mods/book_list/mod_conf.yaml" repeats an earlier entry (https://example.org/samples/mods/book_list/mod_conf.yaml).
Instance catalog collections: "" is empty: an entry must be a non-empty string.
```

### npm host

The app also has an npm host: the address it fetches the files of the npm libraries mods declare from (see [Libraries](#libraries)), as `<npm host><package>@<version>/<path>`. Like the default mod settings, it is the instantiation's choice, and the engine has no default of its own. The vanilla app (`src/main/library_host.ts`) uses jsDelivr:

```ts
export const NPM_HOST = "https://cdn.jsdelivr.net/npm/";
```

`main.tsx` passes it to the stage as `npmHost`, and the stage gives it to every mod load: opening a mod, `mods.inspect` and `mods.check`. An instantiation can point it at another npm CDN or at a mirror on its own network. The host must end in `/`, serve each file at that address and answer with `access-control-allow-origin`, since the app's page, not the mod's frame, fetches the files.

### The mod entrypoint: `mount(engine, context)`

A mod is one ES module. Its entrypoint default-exports a `mount` function, which the frame loader calls once with the engine API object and the mount context. Anything else in the module is ordinary web code: the DOM, `fetch` (for granted `connect` hosts) and images (for content hosts and granted `show` hosts). A missing default export, or a `mount` that throws or rejects, is reported as an error issue.

A short version of the sample mod (`public/samples/mods/book_list/main.js`):

```js
const COLUMNS_KEY = "columns";

function renderBookList(view) {
  // Replaces the children of view.main only: a header with a heading from
  // view.title and the "Books per row" select, then one button per tile,
  // with the cover when view.config.show_covers is true, and
  // aria-expanded="true" on the book whose card is open.
}

function fillBookCard(view, tile) {
  // Fills view.card, the <dialog>, with the book's details, then an
  // <ot-tile-body> whose tile is the book's tile.
}

function openBookCard(view, source) {
  const tile = findTile(view, source);
  if (tile === null || view.card.open) {
    return;
  }
  fillBookCard(view, tile);
  view.card.showModal();
  view.openSource = source;
  const button = findBookButton(view, source);
  button.setAttribute("aria-expanded", "true");
}

// On the dialog's close event: the focus ring only after a keyboard close.
function showClosedCard(view) {
  const button = findBookButton(view, view.openSource);
  view.openSource = null;
  if (button !== null) {
    button.setAttribute("aria-expanded", "false");
    button.blur();
    button.focus({ focusVisible: view.closedByKeyboard });
  }
}

// Sets the list's data-columns without drawing the list again, then stores it.
async function chooseBooksPerRow(view, event) {
  view.booksPerRow = readBooksPerRow(Number(event.currentTarget.value));
  const bookList = view.main.querySelector("ul");
  bookList.dataset.columns = String(view.booksPerRow);
  await view.engine.request("storage.set", {
    key: COLUMNS_KEY,
    value: view.booksPerRow,
  });
}

function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  renderBookList(view);
  // An open card is rebuilt from its book's new tile, or closed when the
  // book is gone.
  updateOpenCard(view);
}

export default async function mount(engine, context) {
  const view = {
    engine,
    main: document.createElement("main"),
    card: null,
    title: context.mod.title,
    config: context.config,
    tiles: context.tiles,
    booksPerRow: DEFAULT_BOOKS_PER_ROW,
    openSource: null,
    closedByKeyboard: false,
  };
  view.card = buildBookCard(view);
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  addBookListStyle();
  document.body.replaceChildren(view.main, view.card);
  const columns = await engine.request("storage.get", { key: COLUMNS_KEY });
  view.booksPerRow = readStartBooksPerRow(columns, context.config.columns);
  renderBookList(view);
}
```

The page has two parts: `<main>`, which is drawn again when the tiles change, and one `<dialog>`, the book's card, which is built once, so a `tiles.changed` never destroys an open card. Opening and closing the card only change the book's `aria-expanded`, which also raises the book with the theme's shadow, so the covers are not drawn again. The body in the card is an `<ot-tile-body>` (see [Tile bodies](#tile-bodies)), so its links and players work with no code in the mod. The storage keeps the books per row under `columns`.

The mod registers its event handlers before its first `await`, so it misses no event, and keeps its state in its own frame's memory: back and forward show the frame as it was left.

### Open a mod

A mod never builds an app address. It sends what to run, and the stage turns it into a run link (see the [stage module](../stage/README.md)). References and locations are resolved against the app's address, so relative ones mean the same everywhere.

| Request | Run link it becomes |
|---|---|
| `engine.request("mods.open", { mod: "mod_viewer", params: { target: inspection.source } })` | `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` |
| `engine.request("mosaics.open", { mosaic: inspection.defaultMosaic })` | `#/run?mosaic=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmosaic.yaml` |
| `engine.request("mods.open", { mod: inspection.source, collection: "./samples/mods/book_list/book_collection.yaml" })` | `#/run?mod=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml&collection=.%2Fsamples%2Fmods%2Fbook_list%2Fbook_collection.yaml` |
| `engine.request("mods.open", { mod: "./samples/mods/book_list" })` | `#/run?mod=.%2Fsamples%2Fmods%2Fbook_list` |
| `engine.request("mods.open", { mod: "tile_viewer", tile: "https://example.org/samples/mods/book_list/books/kallocain.md" })` | `#/run?mod=tile_viewer&tile=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fbooks%2Fkallocain.md` |

The mod explorer, for example, inspects each mod of its config and opens the viewer for the one the user picks:

```js
const inspection = await engine.request("mods.inspect", { mod: "./samples/mods/book_list" });
await engine.request("mods.open", {
  mod: context.config.viewer,
  params: { target: inspection.source },
});
```

A mod that wants to pass a location in a parameter passes an absolute one, such as the `source` from `mods.inspect`.

### Mod API version

The mod API has a version of its own, separate from the app's version in `package.json`. It covers what a mod relies on: the engine's methods and events, the mount context, the mod file format (see the [mod module](../../mod/README.md)) and the test API, what a mod's test file gets (see the [guide to writing mod tests](../../../../mod_plugin_spec.md#mod-tests)). It is `MOD_API_VERSION` in `src/lib/core/engine/mod_api_version.ts`, `0.1.18` today. Mods read it as `context.api.version`, declare the range they were written for as `api` in their mod file, and the stage asks the user before starting a mod whose range does not match (see the [stage module](../stage/README.md#questions-before-a-mod-starts)).

When it changes, while it is `0.x`:

- A breaking change bumps the minor version (`0.1.0` → `0.2.0`): removing or renaming a method, an event, a mount context key or a mod file key, or changing what one means or accepts so that existing mods break. `^0.1.0` ranges stop matching, so their users are asked.
- An addition or a fix bumps the patch version (`0.1.0` → `0.1.1`): a new method, event, context key or optional mod file key, or a fix that existing mods keep working with. `^0.1.0` ranges still match.

From `1.0.0` on, semver's usual rule applies: major for a breaking change, minor for an addition, patch for a fix.

A change that bumps the mod API also bumps the app's version, at least as much (see the release guide's [bump rule](../../../../releasing.md#bump-rule)).

Each bump also updates:

- the surface guard, `mod_api_surface.test.ts`: it records, for each version, the API's surface by name (the method names, the event names, the mount context's keys and the keys of its `mod`, `mosaic` (from `0.1.13`, read from a mod opened from a mosaic, since it is `null` otherwise), `collection` (from `0.1.17`, read from a mod opened with a collection, since it is `null` otherwise), `api`, `permissions` and `theme` mappings, the mod file keys and the permission categories). It fails when the surface built from the code differs from the entry of `MOD_API_VERSION`, or when a recorded version is above it. A bump adds an entry for the new version; older entries are never edited, so the record shows how the API grew. The guard sees names, not params or results, so a change to those needs the bump without the guard's help. The test API is part of the mod API, but the guard does not record it: the guard builds its surface from the engine's code and never runs the frame loader, so the e2e tests of `e2e/mod_tests.spec.ts` pin the test API's names instead;
- the shipped mods' `api` ranges, and `TEST_MOD_API_RANGE` in `src/test/sample_mods.ts` and `e2e/mod_routes.ts`, on a breaking bump.

Version notes:

- `0.1.12` added `tile` and `replace` to `mods.open`, the `tile` run link field and the mount context filled from a tile. It also made `tile` a reserved link name, like `mod` and `collection`: a link parameter named `tile` is no longer passed in `params`, and `mods.open` refuses `params` named `mod`, `collection` or `tile` with `-32602`. That could break a mod that read a `tile` parameter or passed one of those names in `params`, which would call for a minor bump. No shipped, test or known mod does, and a minor bump would make every `^0.1.x` mod ask the user before it starts, so it was taken as a patch. The surface guard's `0.1.12` entry repeats `0.1.11`'s, since it records names and no name was added.
- `0.1.13` added mosaics: the methods `mosaics.inspect` and `mosaics.open`, the mount context key `mosaic` (`source`, `title`, `description`, or `null`), the run link field `mosaic`, and the collection folder, a collection reference without `.yaml` or `.yml` that means the `collection.yaml` in it. A mod not opened from a mosaic gets the same context, config, tiles and grants as before. It also made `mosaic` a reserved link name: a link parameter named `mosaic` is no longer passed in `params`, and `mods.open` refuses `params.mosaic` with `-32602`. As with `tile` in `0.1.12`, no shipped, test or known mod reads or passes a `mosaic` parameter, and no shipped, sample, fixture or known collection is named without `.yaml` or `.yml`, so it was taken as a patch.
- `0.1.14` reworked the mod and collection file formats around mosaics. What breaks:
  - mod files need `title`, and `name` is ignored, so a mod file with only `name` fails with `"title" must be a non-empty string`; `context.mod.name` and `mods.inspect`'s `name` are gone;
  - `sample_collection` is ignored, and `mods.inspect`'s `sampleCollection` is gone;
  - collection files need `title` in place of `name`, and loaded collections, collection indexes and `collections.inspect` answer `title`;
  - a storage slot is kept per mod and context (the mosaic, otherwise the collection or the tile), so values stored before are no longer read.

  What was added: the mod file key `default_mosaic`, `mods.inspect`'s `defaultMosaic`, `mods.check` without a collection checking the mod with its default mosaic, the method `mosaics.check`, the check report's `mosaic`, and `answer("mosaics.open", null)` in the test API. Each break above would call for a minor bump. It was taken as a patch, as `0.1.12` was, because no mod or collection exists outside this repository, and every mod and collection in it moved to the new formats in the same change, so no `^0.1.x` range had a reader to protect. This holds only while the project is not shared: once mods or collections exist outside the repository, the minor rule above applies. The sample mods declare `^0.1.14`, the first version with `default_mosaic`; the default mods keep `^0.1.0`.

- `0.1.15` added the app's catalog: the method `catalog.list`, the event `catalog.changed`, and `answer("catalog.list", catalog)` in the test API. These are additions that no existing mod can break on, so it is a patch. The explorers' `mods`, `collections` and `mosaics` config keys were removed in the same change: that is the config of three default mods, not the mod API.
- `0.1.16` added the run link field `sites`, a mosaic reference whose `show` lines a mod link's sandbox gets (see [Launch](#launch)). It also made `sites` a reserved link name: a link parameter named `sites` is no longer passed in `params`, and `mods.open` and `mosaics.open` refuse `params.sites` with `-32602`. That could break a mod that read or passed a `sites` parameter, which would call for a minor bump. No shipped, test or known mod does, and no mod exists outside this repository, so it was taken as a patch, as `tile` was in `0.1.12` and `mosaic` in `0.1.13`. The surface guard's `0.1.16` entry repeats `0.1.15`'s, since it records names and no name was added.
- `0.1.17` added the mount context key `collection` (`source`, `title`, `description`, or `null`), the collection the mod's tiles were loaded from, and `options.collection` for `mount(options)` in the test API. These are additions that existing mods keep working with, so it is a patch.
- `0.1.18` added the `userCatalog.import`, `userCatalog.update`, `userCatalog.add`, `userCatalog.export` and `userCatalog.remove` requests, the catalog entry keys `listedBy`, `place` and `provenance`, and the test API's boolean answers to the five requests and the scripted catalog's new keys. `catalog.changed` keeps its form, and is also pushed when the user catalog changes. These are additions that existing mods keep working with, so it is a patch.

An OpenSpec proposal that changes the mod API's specs (`mod-engine-api`, `mod-loading`'s mod file format, `mod-api-version`, `mod-theme`'s context and events, `mod-app-actions`) states its bump, as `docs/code_conventions.md`, "OpenSpec changes", asks.

### Hosting note

Mods run in `srcdoc` frames, which inherit the Content-Security-Policy of the page that embeds them. The app sends none on static hosts. A page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames (`script-src 'unsafe-inline' blob:`), or no mod can start. The app also needs `unsafe-eval` to build tile validators (see the [tile module](../../tile/README.md)). A policy with `frame-src` (or `child-src`) must also allow the player sites, such as `https://www.youtube-nocookie.com https://player.vimeo.com https://w.soundcloud.com`, and the sites of the iframes tile bodies hold, or players stay blank. A policy with `connect-src` (or `default-src`) must also allow the [npm host](#npm-host), `https://cdn.jsdelivr.net` in the vanilla app, or `libs.load` fails for declared npm libraries.

## Module Details

Implemented in `src/lib/core/engine/`. Other modules import only from the public entry point `src/lib/core/engine/index.ts`.

### Storage slots

Implemented in `src/lib/core/storage/` and exported from `src/lib/core/storage/index.ts`.

Each mod has one storage slot per context, a `ModSlot` (`{ mod, context }`): the mod's source, and the context the engine derives from the link that opened the mod. Mods never choose it. The context is:

- the mosaic file's address, when the mod was opened from a mosaic;
- otherwise the collection's source, when the link names a collection;
- otherwise the tile's source, when the link names a tile;
- otherwise `""`, for a mod opened without tiles.

So two mods from different sources never read each other's values, and a mod keeps one set of values per mosaic and per collection: `flashcards` remembers study fields per deck, and two mosaics of the same mod and collection, or a mosaic and a run link with its mod and collection, have their own values. A slot keeps its values when the app is reloaded, and "Reload tiles" keeps it. The session builds the slot once, with `buildLaunchSlot(launch)` from `storage_methods.ts`, and gives it to the `storage.*` handlers as the method context's `storageSlot`.

- `readModValue(storage, slot, key)`: the value stored under `key` in the slot, or `null`.
- `writeModValue(storage, slot, key, value)`: stores the value as JSON. Storing `null` removes the key. Storage errors propagate.
- Types: `ModSlot`; `ModStorage`, the `getItem`, `setItem` and `removeItem` part of `Storage`. The app passes `localStorage`, and tests pass a `createMemoryStorage()` (see the [storage module](../storage/README.md)).

The storage key is `"opentesela.mod-storage:" + JSON.stringify([mod, context, key])`, so keys made of `:` parts never collide. Before mod API `0.1.14`, slots had no context and the key was `JSON.stringify([modSource, key])`. A three-element key never equals one of those, so values stored before are no longer read, and they are not deleted.

Example:

```ts
import { readModValue, writeModValue } from "./lib/core/storage/index.ts";

const mod = "https://example.org/samples/mods/flashcards/mod_conf.yaml";
const sampleDeck = {
  mod,
  context: "https://example.org/samples/mods/flashcards/mosaic.yaml",
};
writeModValue(localStorage, sampleDeck, "study_fields", ["term", "body"]);
readModValue(localStorage, sampleDeck, "study_fields"); // ["term", "body"]
readModValue(localStorage, { mod, context: "" }, "study_fields"); // null
writeModValue(localStorage, sampleDeck, "study_fields", null);
readModValue(localStorage, sampleDeck, "study_fields"); // null
```

### Default mod settings

- `resolveDefaultModSettings(settings, baseUrl)`: resolves a `DefaultModSettings` (`folder`, `home`, `switchedOff`) against the app's address. Returns `ResolvedDefaultModSettings`, with the folder as an absolute URL ending in `/` and `switchedOff` as `{ name, source }` entries.
- `findSwitchedOffMod(source, defaults)`: the name of the switched-off default mod with that source, or `null`.

Example:

```ts
import { findSwitchedOffMod, resolveDefaultModSettings } from "./lib/core/engine/index.ts";

const defaults = resolveDefaultModSettings(
  { folder: "./default_mods/", home: "mod_explorer", switchedOff: ["mod_viewer"] },
  "https://example.org/",
);
// defaults.folder === "https://example.org/default_mods/"
findSwitchedOffMod("https://example.org/default_mods/mod_viewer/mod_conf.yaml", defaults);
// "mod_viewer"
```

### Inspection

- `inspectMod(source, appOrigin, decisions, options)`: loads the mod file at `source` without its entrypoint and returns a `ModInspection`, whose `permissions` are granted with `decisions`, as a launch would grant them. `mods.inspect` passes the remembered site decisions (`context.readSiteDecisions()`), so a foreign mod shows as granted what the user allowed and remembered, and nothing is asked. Load errors propagate.

```ts
import { inspectMod } from "./lib/core/engine/index.ts";

const inspection = await inspectMod(
  "https://example.org/samples/mods/book_list/mod_conf.yaml",
  "https://example.org",
  [],
  { baseUrl: "https://example.org/" },
);
// inspection.title === "Book List"
// inspection.api === "^0.1.0" and inspection.apiCompatible === true
// inspection.permissions.granted holds the show permission for https://upload.wikimedia.org
```

### API version matching

Implemented in `mod_api_version.ts`. The mod library only checks that a mod's `api` is a valid range; the engine matches it, so the library never knows which app runs it.

- `MOD_API_VERSION`: `"0.1.18"`, the app's mod API version.
- `matchModApiRange(range)`: `null` when `range` is `null`, otherwise whether `MOD_API_VERSION` satisfies the range by npm's semver rules (`satisfies` from `semver`). A caret range on a `0.x` version allows only patch updates: `^0.1.0` matches `0.1.10` but not `0.2.0`.
- `describeMissingApiRange()`: the message of the warning of a mod without `api`, naming `"api"` and `MOD_API_VERSION`.
- `describeCancelledApiMismatch(range)`: the error of a sandbox whose mod the user did not run, naming the range and `MOD_API_VERSION`.
- `describeApiRangeMismatch(range)`: the message of the bundle check's warning for a range that does not match, naming the range and `MOD_API_VERSION`. Used inside the engine, not exported by `index.ts`.

`buildModLaunch`, `inspectMod`, `checkModBundle` and the stage use these, so the version and its matching live in one place.

### Launch

- `loadModLaunchInputs(request, options)`: loads what a mod's launch is built from. `request` is a `ModLaunchRequest` (`link`, `defaults`), where `link` is a `RunLink` (`mod`, `collection`, `tile`, `mosaic`, `sites`, `params`, where `tile`, `mosaic` and `sites` are optional and absent means `null`): what to run, not an address. In order, it refuses a switched-off mod with `ModSwitchedOffError` and a link with both a collection and a tile with `RunLinkConflictError` (`A link cannot have both a collection and a tile.`, whose `source` is the resolved mod reference) before any request, loads the mod and its entrypoint, and loads the collection when `link.collection` is not `null`, or else the tile when `link.tile` is not `null`. Returns `ModLaunchInputs` (`mod`, `link`, `modTiles`), with `modTiles` `null` without a collection or a tile. Every error propagates, and each names its source. The stage keeps the inputs while it asks the user (see the [stage module](../stage/README.md)), and builds the launch once the grants are known.
- With a mosaic: when `link.mosaic` is set, `loadModLaunchInputs` first refuses a link that also has a non-empty `mod`, `collection`, `tile` or `sites` with `MosaicLinkConflictError` (`A link to a mosaic cannot also have a mod, a collection, a tile or sites.`, whose `source` is the resolved mosaic reference), before any request. It then loads the mosaic file (`loadMosaicFile`, see the [mosaic module](../../mosaic/README.md)), whose failures name the mosaic file and request neither its mod nor its collection, and continues with `{ mod: mosaic.mod, collection: mosaic.collection, tile: null, params: link.params }` as for a mod link. So a switched-off mod named by a mosaic is refused before its files are requested, and a mosaic of a mod for another mod API asks the same question. The returned `ModLaunchInputs` has `mosaic`, the `LoadedMosaic`, or `null` for a mod link, and its `link` is the expanded link. The collection's tiles are renamed by the mosaic's aliases before they are validated.
- With `sites`: when a mod link's `link.sites` is set, `loadModLaunchInputs` loads that mosaic file too (`loadLaunchSites`), with the default mods folder, and the inputs keep it as `sites`. Only its `show` lines are used: not its mod, collection, config or aliases, so the mount context's `mosaic` stays `null` and the storage slot stays the one of the mod and its collection. A `sites` file that cannot be loaded or does not follow the mosaic file format does not stop the launch: `sites` is `null`, and `sitesIssues` holds one warning whose source is the mosaic file's address and whose text is the error's message followed by `Its sites were not granted.`. Without `sites`, `sites` is `null` and `sitesIssues` is empty.
- `loadLaunchSites(request, options)`: loads the mosaic of `request.link.sites` and returns `LaunchSites` (`mosaic`, the `LoadedMosaic` or `null`, and `issues`, the warning of a failure). It never throws for the mosaic file.
- `loadLaunchMosaic(request, options)`, `expandMosaicRequest(request, mosaic)`, `loadLaunchMod(request, options)` and `loadLaunchTiles(mod, link, options, mosaic?, sites?)`: the steps of `loadModLaunchInputs`, with `loadLaunchSites` after `loadLaunchMosaic`. The first refuses a conflicting mosaic link and loads the mosaic, or gives `null` for a mod link. The second turns a loaded mosaic into the request of its mod and collection, and gives `request` itself for `null`. The third refuses a switched-off mod and a conflicting link and loads the mod, and the last loads the collection or the tile, renamed by the mosaic's aliases, and returns the `ModLaunchInputs`. The stage calls them one after the other, so it knows the mosaic when its mod fails, and the mod when the collection or the tile fails.
- `grantLaunchMosaic(mosaic, appOrigin, decisions, role?)`: the `LaunchMosaicGrants` (`mosaic`, `role`, `grants`) of a mosaic's `show` lines by `decisions` (`grantMosaicPermissions`), or `null` for `null`. `role` is `"mosaic"` (the default) for the mosaic a launch was opened from, or `"sites"` for the one its link names as `sites`. `grantInputsMosaic(inputs, appOrigin, decisions)` grants whichever of the two `ModLaunchInputs` has, with its role, and `readDeclaringMosaic(inputs)` gives that mosaic, or `null`: the stage asks about, grants and remembers the lines of either the same way.
- `buildModLaunch(mod, link, modTiles, grants, loadsTileLinkedMedia, mosaic?, loadIssues?)`: builds the `ModLaunch` of a loaded mod, its `ModTiles` (or `null`) and its `grants`, the `ModGrants` of `grantModPermissions` (see the [permissions module](../permissions/README.md)), without requesting anything: collects the content hosts and the tile links (when `loadsTileLinkedMedia` is `true`), builds the policy, the frame document, the mount context and the issues. Opening a mod and checking it both call it, so a checked mod gets the frame it would get if it were opened with the same grants.
  With a `mosaic` of role `"mosaic"`, the mount context's `config` is the merged config, its `mosaic` is the mosaic's `source`, `title` and `description`, and the mosaic file's origin is a content host, first in the list. With role `"sites"`, only the mosaic's granted `show` lines join the mod's, and its refused lines are reported as a mosaic's are. `loadIssues`, such as the inputs' `sitesIssues`, come first in `issues`.
  Returns a `ModLaunch` (`mod`, `mosaic`, the `LoadedMosaic` or `null`, `sites`, the `LoadedMosaic` of role `"sites"` or `null`, which blocked `show` reports name as a place to declare a host, `tilesKind`, `tilesSource`, `context`, `contentHosts`, `tileLinks`, `tileBodies`, `policy`, `sandboxDocument`, `apiCompatible`, `fileIssues`, `issues`), where `context` is a `LaunchContext`: the mount context without `theme`, which the session adds when the frame connects, and whose `permissions` are `grants`. `apiCompatible` is `matchModApiRange(mod.api)`: the stage asks the user before starting a mod whose range does not match. `fileIssues` holds the issues of the mod file itself, today only the warning of a missing `api` range, whose source is the mod file's source. `issues` holds one warning per denied permission. `tilesKind` is `"collection"` or `"tile"`, and `tilesSource` the resolved location the link's tiles come from, both `null` when the link names neither: the stage's "Reload tiles", its availability and the loaded and reloaded notifications follow them. `tileBodies` is the `TileBodies` of the tiles the mod receives (`buildTileBodies`, below), which the session keeps. `tileLinks` is the `TileLinks` of the tiles the mod receives and their body media (`collectModTileLinks`, below, see [Media linked by tiles](../sandbox/README.md#media-linked-by-tiles)): `sources`, the files the policy allows as images, video and audio, and `issues`, the left-out links and the iframes the bodies left out, kept apart from `issues` so the stage can replace them after "Reload tiles". It is `{ sources: [], issues: [] }` without a collection or a tile, and `null` when `loadsTileLinkedMedia` is `false`: then nothing is collected or reported, and blocked image reports get no redirect hint. The mount context does not list the tile links, so the mod API does not change.
- `buildModTestDocument(launch)`: the `srcdoc` HTML of a frame of the mod's tests: the launch's `policy` (the frame's Content-Security-Policy) and the mod's theme setting, as in `sandboxDocument`, with the assertions and the test runner after the frame loader (see the [sandbox module](../sandbox/README.md#frames-of-a-checks-tests)). So a case runs the mod with the content policy it gets when it is opened.
- `loadModTiles(mod, collectionLocation, options?, aliases?)`: loads a collection for a mod, renames its tiles by `aliases` (none by default) and selects them with `selectModTiles`. Returns `ModTiles` (`tilesSource`, the collection's source, `tiles`, `issues`).
- `loadModTile(mod, tileLocation, options?)`: loads one tile for a mod (`loadTile`), wraps it in a collection whose `source` is the tile's, with an empty `title` and `description` and no issues, and selects it with `selectModTiles`. Returns `ModTiles` whose `tilesSource` is the tile's source. A tile that cannot be fetched or parsed throws `FileFetchError` or `MarkdownParseError` with the tile as its source.
- `loadModTilesOfKind(mod, kind, location, options?, aliases?)`: `loadModTile` for `"tile"`, `loadModTiles` with the aliases for `"collection"`. The stage's "Reload tiles" calls it with the launch's `tilesKind`, `tilesSource` and `readMosaicAliases(launch.mosaic)`, so a mosaic's reloaded tiles are renamed as at the start, and the mosaic file is not requested again.
- `readMosaicAliases(mosaic)`: the aliases of a launch's mosaic, or none for `null`.
- `RUN_LINK_RESERVED_NAMES`: `mod`, `collection`, `tile`, `mosaic` and `sites`, the link names the stage reads itself. They are never in `context.params`, and `mods.open` and `mosaics.open` refuse them in their `params`.
- `selectModTiles(collection, tileValidator)`: the `ModTiles` of a loaded collection. With a validator, the collection is validated and only the tiles of its type are kept, the others appearing as warnings in `issues`. With `null`, every tile is kept. The kept tiles are new tiles whose metadata strings starting with `./` or `../` are resolved against the tile's `source` (`resolveTilePaths` in `tile_paths.ts`, not exported by `index.ts`), so opening, "Reload tiles" and checks all get resolved tiles. The collection's tiles stay as written and are validated as written.

```ts
import { buildModLaunch, loadModLaunchInputs } from "./lib/core/engine/index.ts";
import { grantModPermissions } from "./lib/core/permissions/index.ts";

const inputs = await loadModLaunchInputs(
  {
    link: {
      mod: "./samples/mods/book_list",
      collection: "./samples/mods/book_list/book_collection.yaml",
      params: {},
    },
    defaults,
  },
  { baseUrl: "https://example.org/" },
);
const grants = grantModPermissions(inputs.mod, "https://example.org", []);
const launch = buildModLaunch(inputs.mod, inputs.link, inputs.modTiles, grants, true);
// launch.context.tiles has the three sample books, each with types ["book"]
// launch.contentHosts is ["https://example.org"]
// launch.tileLinks is { sources: [], issues: [] }: the granted show hosts cover the covers
// launch.context.mosaic is null

const mosaicRequest = {
  link: { mod: "", collection: null, mosaic: "./samples/mosaics/nobel_map.yaml", params: {} },
  defaults,
};
const mosaicInputs = await loadModLaunchInputs(mosaicRequest, { baseUrl: "https://example.org/" });
// mosaicInputs.mosaic.source === "https://example.org/samples/mosaics/nobel_map.yaml"
// mosaicInputs.link.mod === "https://example.org/samples/mods/country_map/mod_conf.yaml"
// mosaicInputs.modTiles.tiles have the mosaic's aliases applied, then the country type's validation
```

### Tile bodies of a launch

Implemented in `mod_tile_bodies.ts`, with the renderer of the [tile bodies module](../tile_bodies/README.md) and the table of the [players module](../players/README.md).

- `buildTileBodies(tiles)`: the `TileBodies` of the tiles a mod receives: `tiles` (each tile by source), `renderedBodies` (the promise of the HTML of each body requested so far, by source), `playerAddresses` (each player address, normalized as `URL.href`, with its `TilePlayer`: the `Player` and the title the tile gives it, which is the tile's `title` for a metadata page link), `mediaByTile` (the `mediaUrls` of each collected body, by source) and `issues` (the warnings of iframes the bodies left out). Each metadata string that `readPlayer` recognizes is a player address; each body holding `<`, `![` or `://` is scanned with `scanTileBody`, and its media, players and issues are collected. No body is rendered: each renders when the mod asks for it, so the libraries of the extras load only then. `buildModLaunch` and the stage's "Reload tiles" call it. The tiles are not changed.
- `collectModTileLinks(tiles, tileBodies, contentHosts, granted)`: `collectTileLinks` with the bodies' media, followed by the bodies' issues.
- `readTileBodyHtml(tileBodies, source)` and `findTilePlayer(tileBodies, url)`, used by the handlers and not exported by `index.ts`: async, the HTML of a tile's body, rendered on first request with its promise kept, or `null` for a source of no tile; a promise that rejects is dropped, so a later request renders again; and the `TilePlayer` of a player address, or `null`.

### Mod check

The bundle check and the report of `mods.check` and `mosaics.check`. Neither needs a DOM, so a Node script can import them.

- `checkModBundle(request, defaults, options?, libraryFiles?)`: checks the files of a `ModCheckRequest`: a `ModCheckTarget` (`{ source, collection }`, the resolved mod file and the collection as `mods.check` gave it, or `null`) or a `MosaicCheckTarget` (`{ mosaic }`, the resolved mosaic file); `isMosaicCheckTarget` tells them apart. `defaults` are the resolved default mod settings, which resolve a mosaic's default mod name and refuse a switched-off mod. `options` are the mod module's `ModLoadOptions`, whose `npmHost` resolves the mod's npm files. `libraryFiles` is the cache the library files go through, by default the page's (`PAGE_LIBRARY_FILES`), so the mount check's `libs.load` reuses what the bundle check fetched. Returns a `ModBundleCheck`: `findings`, `source` (the checked mod file, or `null` when a mosaic failed before its mod was known), `mosaicSource` (the mosaic file the check used, or `null`), `mosaic` (the `LoadedMosaic` whose config, aliases and lines the mount check uses, or `null`), `collection` (the collection the tiles came from, or `null`), `mod` (the `LoadedMod`, or `null` when the mod file or the entrypoint failed) and `modTiles` (the `ModTiles` to mount, or `null` without a collection). It never throws for a file. The steps run in this order, and the findings follow it:
  1. For a mosaic target, the mosaic file (`loadMosaicFile`), then the switched-off list for its mod. An error here ends the check, with this one finding.
  2. The mod file (`loadModFile`). An error here ends the check, with this one finding.
  3. The `api` range (`matchModApiRange`): a missing range is a warning with the text of `describeMissingApiRange`, the warning the stage bar shows, and a range that does not match is a warning naming the range and `MOD_API_VERSION`. Both have the mod file as their source. So the range finding comes right after the mod file's, as in the stage bar.
  4. For a mod target without a collection, the mod's default mosaic, when it declares one: a file that cannot be loaded, or a mosaic whose `mod` is not the checked mod's file, is an error whose source is the mosaic file. The check goes on without tiles, so the other files are still checked.
  5. The entrypoint (`loadModCode`).
  6. The files of the declared libraries, each fetched through `libraryFiles`. Each file that cannot be fetched is an error whose source is the file's address, and whose message names the library and ends with the host's reason when it is short plain text, as `libs.load`'s does (see [Libraries](#libraries)): `the library "leaflet" could not be loaded: Cannot load file "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/missing.js": HTTP 404 Not Found: Couldn't find the requested file /dist/missing.js in leaflet.`
  7. The tile type (`buildTileValidator`), when the mod has a `type_path`.
  8. The collection: the target's `collection`, or else the mosaic's, or none. It is loaded, its tiles are renamed by the mosaic's aliases (`aliasCollectionTiles` of the [mosaic module](../../mosaic/README.md#config-and-aliases)) and selected with `selectModTiles`. Each of its issues becomes a finding with the issue's level and source. When the tile type failed, the collection is not loaded, since it could not be validated.
  9. With a mosaic, the mosaic findings (`mosaic_findings.ts`): `checkMosaicAliases` warns about each alias field the tile type's `fieldNames` lack, and `checkMosaicConfig` about each key path of the mosaic's config that the mod's config lacks (see [Checking a mosaic](#checking-a-mosaic)).

  A file that cannot be loaded, or has the wrong format, is an error finding whose source is the error's `source` (the failing file) and whose message is the error's message.
- `buildModCheckReport(checkedFiles, findings, mountChecked, tests)`: the `ModCheckReport` of a check of `checkedFiles`, a `CheckedFiles` (`{ source, mosaic }`). `tests` is the list of `ModTestResult`, or `null` when the cases did not run, which gives `testsChecked` `false` and an empty `tests`. Its `status` is `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none: it is read from the findings alone, which already hold an error for each failed case. The findings and the test results are copied.
- Types: `ModCheckFinding` (`step`, `level`, `source`, `message`), with `step` a `ModCheckStep` (`"bundle"`, `"mount"` or `"test"`) and `level` `"error"` or `"warning"`; `ModTestResult` (`name`, `status` `"pass"` or `"fail"`, `message`); `ModCheckReport` (`source`, `mosaic`, `status`, `mountChecked`, `testsChecked`, `tests`, `findings`), plain data; `ModCheckStatus` (`"pass" | "warn" | "fail"`); `ModBundleCheck`.

```ts
import { buildModCheckReport, checkModBundle } from "./lib/core/engine/index.ts";

const source = "https://example.org/samples/mods/book_list/mod_conf.yaml";
const bundleCheck = await checkModBundle(
  { source, collection: null },
  { folder: "https://example.org/default_mods/", switchedOff: [] },
  { baseUrl: "https://example.org/" },
);
// bundleCheck.findings is [], bundleCheck.mosaicSource is the default mosaic
// and bundleCheck.modTiles.tiles has the three sample books
const report = buildModCheckReport(
  { source: bundleCheck.source, mosaic: bundleCheck.mosaicSource },
  bundleCheck.findings,
  false,
  null,
);
// report.status === "pass", report.mosaic ends in book_list/mosaic.yaml and report.testsChecked === false
```

### Library files

Implemented in `library_files.ts`, and used by `libs.load` and the bundle check, not exported by `index.ts`.

- `fetchLibraryFiles(cache, library, options)`: fetches every file of a `LoadedLibrary` in parallel and resolves with `{ path, kind, text }` for each, in the order of the declaration, once all arrived. `fetchLibraryFile(cache, library, fileIndex, options)` fetches one. A failure rejects with a `LibraryFileError`, whose `source` is the file's address and whose message names the library.
- Each file address is fetched once per `LibraryFileCache`: later requests share the first one's promise, and a failed fetch leaves the cache. `PAGE_LIBRARY_FILES` is the page's cache, shared by every mod's `libs.load` and by `mods.check`; tests pass their own from `createLibraryFileCache()`.
- The files are fetched with the shared fetcher of the files module, whose messages stay as they are for other files. Only for library files, a failed answer whose `content-type` is `text/plain` and whose body is at most 200 characters adds that body after the fetcher's message.

### Request handlers

Each request namespace has its own module with one table of handlers: `storage_methods.ts` (`STORAGE_METHODS`), `mods_methods.ts` (`MODS_METHODS`), `collections_methods.ts` (`COLLECTIONS_METHODS`), `mosaics_methods.ts` (`MOSAICS_METHODS`), `catalog_methods.ts` (`CATALOG_METHODS`), `links_methods.ts` (`LINKS_METHODS`), `files_methods.ts` (`FILES_METHODS`), `ui_methods.ts` (`UI_METHODS`), `tiles_methods.ts` (`TILES_METHODS`), `players_methods.ts` (`PLAYERS_METHODS`) and `libs_methods.ts` (`LIBS_METHODS`). A handler is a `ModMethod`: `(context: ModMethodContext, params) => Promise<result>`. It resolves with the `result`, or throws `ModMethodError(code, message)`, which the session sends as the error response. Handlers know nothing about ports or messages, so they are tested by calling them with a plain `ModMethodContext` (`mod`, `grants`, `storage`, `appOrigin`, `defaults`, `fetchOptions`, `tileBodies`, `readSiteDecisions`, `readCatalog`, `onOpenLink`, `onRequestAction`, `onCheckMod`). `tileBodies` is the session's current `TileBodies`, which `pushTilesChanged` replaces.

The `links.*`, `files.*`, `ui.*` and `players.*` handlers check their params into an `AppAction` (`app_actions.ts`), data the app can perform with no more checks:

- `LinkAction`: `{ kind: "link", url }`, with `url` the normalized `href`.
- `SaveFileAction`: `{ kind: "save", name, type, bytes }`, with `bytes` a `Uint8Array` holding the file, so the size the dialog shows is the size downloaded. `MAX_SAVE_BYTES` is 20 MB.
- `ConfirmAction`: `{ kind: "confirm", message, confirmLabel, cancelLabel }`, with the labels defaulted.
- `PlayerAction`: `{ kind: "player", title, frameUrl, host, siteName, shape }`: the title recorded with the address (plain text, or `null`), and the `Player` of the address: what the player frame loads, the host the dialog asks about, the known site's name or `null`, and the frame's `PlayerShape`. The tile's iframe attributes are never part of it.

Then they call `askUser(context, method, action)`, which calls `context.onRequestAction(action)`: a promise of the user's answer, or `null` when the sandbox is not the visible one, which `askUser` turns into `-32002`. Actions never cross `postMessage`: they go from the session to the stage and the page in the same window. The types are exported from `index.ts` as types only.

To add a namespace, for example `notes.*`:

1. Write `notes_methods.ts` with module-level named handlers and `export const NOTES_METHODS: ModMethodTable = { "notes.list": listNotes }`. Check the params with `readRequiredText` and `throwInvalidParams` from `mod_methods.ts`, and turn the errors you expect into `ModMethodError`.
2. Test the handlers directly with a plain context.
3. Add the table to `ENGINE_METHODS` in `mod_session.ts`.

The session does not grow, and names starting with `sandbox.` stay reserved.

### Session

- `connectModSession(frameTarget, launch, options)`: opens the private channel to the frame (`sandbox.connect` with the mod's code and its mount context: `launch.context` with `theme` set to `options.theme` and `layout` to `options.layout`), and answers the mod's requests from the handler tables. `options` are `ModSessionOptions` (`storage`, `appOrigin`, `defaults`, `fetchOptions`, `readSiteDecisions`, `readCatalog`, `onIssue`, `onOpenLink`, `onRequestAction`, `onCheckMod`, `theme`, `layout`, and the optional `onMounted`, `onErrorResponse`, `test` and `onTestReport`). Returns a `ModSession`, whose `hintsTileLinks` is `launch.tileLinks !== null`: blocked image and media reports then end with the redirect hint for tile authors (see the [sandbox module](../sandbox/README.md#blocked-request-reports)).
  - `onMounted()`: called when the mod's `mount` finished: for `sandbox.mounted`, and for `sandbox.mountFailed` after its issue is reported. The mod check uses it to start its settle time. Running sandboxes pass none, and ignore `sandbox.mounted`.
  - `test`: `{ code, caseName }` (`SandboxTestParams`), sent in `sandbox.connect` so the frame lists the cases of the test file (`caseName` `null`) or runs one. Only the frames of a check's tests, built with `buildModTestDocument`, pass it.
  - `onTestReport(report)`: called with each test notification of the frame, read as a `SandboxTestReport` (`listed`, `listFailed`, `answerQueued` or `caseFinished`, see the [sandbox module](../sandbox/README.md#frame-loader-messages)). Notifications of the wrong shape are ignored. Running sandboxes pass none, so a mod that sends them outside a check changes nothing.
  - `onErrorResponse(method, error)`: called for every error response the session sends, with the request's method, or `null` for a message that is not a request (`-32600`), and the response's `error` (`ResponseError`: `code`, `message`). The mod check keeps `-32600`, `-32601` and `-32602`, the signal that a mod uses the API wrongly. Without it, nothing outside the session sees the responses.
- `pushTilesChanged(session, tiles, issues, tileBodies)`: pushes `tiles.changed`, and replaces the session's `TileBodies` with `tileBodies`, those of the reloaded tiles, so `tiles.renderBody` and `players.open` follow them. The policy stays the launch's.
- `pushThemeChanged(session, theme)`: pushes `theme.changed` with the `Theme`.
- `pushCatalogChanged(session, catalog)`: pushes `catalog.changed` with the `Catalog`.
- `pushLayoutChanged(session, layout)`: pushes `layout.changed` with `{ layout }` (`LayoutChangedParams`), a `FrameLayout`.
- `THEME_CHANGED_METHOD`: `"theme.changed"`, `LAYOUT_CHANGED_METHOD`: `"layout.changed"`, and `CATALOG_CHANGED_METHOD`: `"catalog.changed"`, shared with the frame loader. `TILES_CHANGED_METHOD`, `"tiles.changed"`, and `ENGINE_METHODS`, the merged handler table, are exported by `mod_session.ts` for the surface guard, not by `index.ts`.
- `stopModSession(session)`: closes the channel. Later messages, pushes and answers to pending requests do nothing.

Lifecycle:

1. The stage loads the mod with `loadLaunchMod` and `loadLaunchTiles`, asks the user what it needs to, builds the launch with `buildModLaunch` and renders its frame with `launch.sandboxDocument`.
2. On the frame's first `load`, the stage calls `connectModSession` with the frame's window.
3. The session answers each request once with the same `id`. `sandbox.blocked`, `sandbox.mountFailed` and `sandbox.dialogBlocked` from the frame loader become issues through `onIssue`, each reported once. `sandbox.mounted` and `sandbox.mountFailed` call `onMounted`, and the test runner's notifications `onTestReport`, when given.
4. "Reload tiles" calls `loadModTiles`, `buildTileBodies` and `pushTilesChanged`. A color scheme change calls `pushThemeChanged` for every running session.
5. Closing the sandbox, or the frame loading another document, calls `stopModSession`.

```ts
import {
  buildTileBodies,
  connectModSession,
  pushTilesChanged,
} from "./lib/core/engine/index.ts";

const session = connectModSession(frame.contentWindow, launch, {
  storage: localStorage,
  appOrigin: location.origin,
  defaults,
  fetchOptions: { baseUrl: document.baseURI },
  onIssue: addIssue,
  onOpenLink: openLinkFromThisSandbox,
  onRequestAction: showActionFromThisSandbox,
  theme: buildTheme("dark"),
});
pushTilesChanged(
  session,
  reloadedTiles.tiles,
  reloadedTiles.issues,
  buildTileBodies(reloadedTiles.tiles),
);
```
