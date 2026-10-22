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
{ "jsonrpc": "2.0", "id": 7, "result": "https://example.org/samples/tiles/books/kallocain.md" }
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
| `-32001` | A mod file could not be loaded. The message is the load error's message. |
| `-32002` | Permission denied. The message says which permission is missing. |
| `-32003` | The requested default mod is switched off. The message names the mod. |

### Reserved names

Methods starting with `sandbox.` belong to the frame loader, which uses them to connect the channel and to report blocked requests and mount failures (see the [sandbox module](../sandbox/README.md)). Mods must not use them.

Method names are looked up as own properties of the engine's handler tables, so names such as `toString` or `__proto__` are unknown methods.

### Methods and events

| Method | Params | Result |
|---|---|---|
| `storage.get` | `{ key }`, a non-empty string | The value stored under `key` in the mod's slot, or `null`. |
| `storage.set` | `{ key, value }`, with `value` plain data (strings, finite numbers, booleans, null, lists and mappings) | `null`. Storing `null` removes the key. |
| `mods.inspect` | `{ mod }`, a mod reference | The mod's metadata, without running it (see below). |
| `mods.open` | `{ mod, collection?, params? }` | `null`, once the stage opened the mod in a new sandbox. |

| Event | Params |
|---|---|
| `tiles.changed` | `{ tiles, issues }`: the reloaded tiles, with the same rules as the mount context. Pushed when the user presses "Reload tiles" for a mod opened with a collection. |
| `theme.changed` | `{ colorScheme, tokens }`: the new theme, the same shape as `context.theme`. Pushed to every running mod, visible or hidden, once each time the app's resolved color scheme changes. A new theme choice that resolves to the same color scheme pushes nothing. The frame loader updates the frame's `data-ot-color-scheme` attribute before the mod's handlers run. |

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
| `mod` | `source`, `name`, `title`, `version`, `description`. |
| `config` | The mod's `config`. |
| `params` | The link's parameters other than `mod` and `collection`, as a mapping of strings. |
| `tiles` | The tiles of the link's collection that match the mod's tile type. |
| `issues` | The issues from loading and validating the collection. |
| `permissions` | `granted` and `denied` lists of `{ category, host, reason }`. |
| `theme` | `colorScheme` (`"light"` or `"dark"`) and `tokens`, a mapping from each theme token name to its value for that color scheme (see the [theme module](../theme/README.md)). It is the theme current when the frame connects, not when the mod started loading, so a mod opened while the user switches still mounts with the right one. |

### Tiles

A collection is optional. Without one, `tiles` and `issues` are empty and no collection file is requested. With one:

- When the mod has a `type_path`, the engine builds the tile validator, validates the collection and keeps only the tiles whose `types` include the type name. Tiles that do not match are left out of `tiles` and appear as warnings in `issues`.
- Without a `type_path`, the mod receives every tile, each with `types` `[]`.
- The validator is built again on each load, so "Reload tiles" picks up a changed type file too.

### Inspecting and opening mods

References in requests are resolved against the app's address, so a reference means the same in a request, in the address bar and after a reload. A default mod name (`mod_viewer`) means its folder in the default mods folder.

Before any file is requested, the engine checks:

1. The request's params. `mods.open` needs `mod` as a non-empty string, `collection` absent, `null` or a non-empty string, and `params` absent or a mapping of strings. Otherwise `-32602`, e.g. `mods.open: "params.target" must be a string`.
2. The `open` permission: the requesting mod needs a **granted** `open` permission for `"*"` or the origin of the target mod file. Otherwise `-32002` (see the [permissions module](../permissions/README.md)). Only mods served from the app's origin are granted their permissions.
3. The switched-off list: a switched-off default mod is refused with `-32003`, whatever reference names it.

Then:

- `mods.inspect` loads the mod file, without its entrypoint, and answers `source`, `name`, `title`, `version`, `description`, `typeSource`, `sampleCollection`, `config` and `permissions` (the `granted` and `denied` lists that mod would get if it were opened). A load failure is `-32001` with the load error's message.
- `mods.open` asks the stage to open the link in a new sandbox, with the requesting sandbox as its opener, and answers `null`. Only the visible mod can open mods: a hidden one gets `-32002` with `mods.open: only the visible mod can open mods`. The new mod's load failures belong to its own sandbox, not to the response.

Mods never build app addresses: they send what to run, and only the stage turns it into a run link and a history entry (see the [stage module](../stage/README.md)).

### Default mod settings

The app has default mod settings: the default mods folder, the home mod opened for `#/`, and the default mods that are switched off. The vanilla app (`src/main/default_mods.ts`) uses:

```ts
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  home: "mod_explorer",
  switchedOff: [],
};
```

The folder is resolved against the app's address, and each switched-off name to the source of its mod file, so a switched-off mod is refused whatever reference names it.

### The mod entrypoint: `mount(engine, context)`

A mod is one ES module. Its entrypoint default-exports a `mount` function, which the frame loader calls once with the engine API object and the mount context. Anything else in the module is ordinary web code: the DOM, `fetch` (for granted `connect` hosts) and images (for content hosts and granted `show` hosts). A missing default export, or a `mount` that throws or rejects, is reported as an error issue.

A short version of the sample mod (`public/samples/mods/book_list/main.js`):

```js
const SELECTED_KEY = "selected";

function renderBookList(view) {
  // Builds a heading from view.title and one button per tile, with the
  // cover when view.config.show_covers is true, and aria-pressed="true"
  // on the selected book.
}

function addBookListStyle() {
  // Adds a <style> element: inline styles are allowed by the policy.
}

async function selectBook(view, source) {
  view.selected = source;
  renderBookList(view);
  await view.engine.request("storage.set", {
    key: SELECTED_KEY,
    value: source,
  });
}

function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  renderBookList(view);
}

export default async function mount(engine, context) {
  const view = {
    engine,
    root: document.body,
    title: context.mod.title,
    config: context.config,
    tiles: context.tiles,
    selected: null,
  };
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  addBookListStyle();
  const selected = await engine.request("storage.get", { key: SELECTED_KEY });
  view.selected = typeof selected === "string" ? selected : null;
  renderBookList(view);
}
```

The mod registers its event handlers before its first `await`, so it misses no event, and keeps its state in its own frame's memory: back and forward show the frame as it was left.

### Open a mod

A mod never builds an app address. It sends what to run, and the stage turns it into a run link (see the [stage module](../stage/README.md)). References and locations are resolved against the app's address, so relative ones mean the same everywhere.

| Request | Run link it becomes |
|---|---|
| `engine.request("mods.open", { mod: "mod_viewer", params: { target: inspection.source } })` | `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` |
| `engine.request("mods.open", { mod: inspection.source, collection: inspection.sampleCollection })` | `#/run?mod=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml&collection=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fbooks_collection.yaml` |
| `engine.request("mods.open", { mod: "./samples/mods/book_list" })` | `#/run?mod=.%2Fsamples%2Fmods%2Fbook_list` |

The mod explorer, for example, inspects each mod of its config and opens the viewer for the one the user picks:

```js
const inspection = await engine.request("mods.inspect", { mod: "./samples/mods/book_list" });
await engine.request("mods.open", {
  mod: context.config.viewer,
  params: { target: inspection.source },
});
```

A mod that wants to pass a location in a parameter passes an absolute one, such as the `source` from `mods.inspect`.

### Hosting note

Mods run in `srcdoc` frames, which inherit the Content-Security-Policy of the page that embeds them. The app sends none on static hosts. A page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames (`script-src 'unsafe-inline' blob:`), or no mod can start. The app also needs `unsafe-eval` to build tile validators (see the [tile module](../../tile/README.md)).

## Module Details

Implemented in `src/lib/core/engine/`. Other modules import only from the public entry point `src/lib/core/engine/index.ts`.

### Storage slots

Implemented in `src/lib/core/storage/` and exported from `src/lib/core/storage/index.ts`.

Each mod has its own storage slot, identified by the mod's source, so two mods with the same `name` from different sources never read each other's values. A slot keeps its values when the app is reloaded.

- `readModValue(storage, modSource, key)`: the value stored under `key` in the mod's slot, or `null`.
- `writeModValue(storage, modSource, key, value)`: stores the value as JSON. Storing `null` removes the key. Storage errors propagate.
- Types: `ModStorage`, the `getItem`, `setItem` and `removeItem` part of `Storage`. The app passes `localStorage`, and tests pass a `Map`-backed object.

The storage key is `"opentesela.mod-storage:" + JSON.stringify([modSource, key])`, so keys made of `:` parts never collide.

Example:

```ts
import { readModValue, writeModValue } from "./lib/core/storage/index.ts";

const source = "https://example.org/samples/mods/book_list/mod_conf.yaml";
writeModValue(localStorage, source, "selected", "kallocain");
readModValue(localStorage, source, "selected"); // "kallocain"
writeModValue(localStorage, source, "selected", null);
readModValue(localStorage, source, "selected"); // null
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

- `inspectMod(source, appOrigin, options)`: loads the mod file at `source` without its entrypoint and returns a `ModInspection`. Load errors propagate.

```ts
import { inspectMod } from "./lib/core/engine/index.ts";

const inspection = await inspectMod(
  "https://example.org/samples/mods/book_list/mod_conf.yaml",
  "https://example.org",
  { baseUrl: "https://example.org/" },
);
// inspection.title === "Book List"
// inspection.permissions.granted holds the show permission for https://upload.wikimedia.org
```

### Launch

- `prepareModLaunch(request, options)`: prepares everything a mod's frame needs. `request` is a `ModLaunchRequest` (`link`, `appOrigin`, `defaults`), where `link` is a `RunLink` (`mod`, `collection`, `params`): what to run, not an address. In order, it refuses a switched-off mod with `ModSwitchedOffError` before any request, loads the mod and its entrypoint, loads the collection when `link.collection` is not `null`, grants the permissions, collects the content hosts and builds the policy and the frame document. Returns a `ModLaunch` (`mod`, `collectionSource`, `context`, `contentHosts`, `sandboxDocument`, `issues`), where `context` is a `LaunchContext`: the mount context without `theme`, which the session adds when the frame connects, and `issues` holds one warning per denied permission. Every error propagates, and each names its source.
- `loadModTiles(mod, collectionLocation, options?)`: loads and filters a collection for a mod. Returns `ModTiles` (`collectionSource`, `tiles`, `issues`). The stage's "Reload tiles" calls it again.

```ts
import { prepareModLaunch } from "./lib/core/engine/index.ts";

const launch = await prepareModLaunch(
  {
    link: {
      mod: "./samples/mods/book_list",
      collection: "./samples/tiles/books_collection.yaml",
      params: {},
    },
    appOrigin: "https://example.org",
    defaults,
  },
  { baseUrl: "https://example.org/" },
);
// launch.context.tiles has the three sample books, each with types ["book"]
// launch.contentHosts is ["https://example.org"]
```

### Request handlers

Each request namespace has its own module with one table of handlers: `storage_methods.ts` (`STORAGE_METHODS`) and `mods_methods.ts` (`MODS_METHODS`). A handler is a `ModMethod`: `(context: ModMethodContext, params) => Promise<result>`. It resolves with the `result`, or throws `ModMethodError(code, message)`, which the session sends as the error response. Handlers know nothing about ports or messages, so they are tested by calling them with a plain `ModMethodContext` (`mod`, `grants`, `storage`, `appOrigin`, `defaults`, `fetchOptions`, `onOpenLink`).

To add a namespace, for example `tiles.*`:

1. Write `tiles_methods.ts` with module-level named handlers and `export const TILES_METHODS: ModMethodTable = { "tiles.list": listTiles }`. Check the params with `readRequiredText` and `throwInvalidParams` from `mod_methods.ts`, and turn the errors you expect into `ModMethodError`.
2. Test the handlers directly with a plain context.
3. Add the table to `ENGINE_METHODS` in `mod_session.ts`.

The session does not grow, and names starting with `sandbox.` stay reserved.

### Session

- `connectModSession(frameTarget, launch, options)`: opens the private channel to the frame (`sandbox.connect` with the mod's code and its mount context: `launch.context` with `theme` set to `options.theme`), and answers the mod's requests from the handler tables. `options` are `ModSessionOptions` (`storage`, `appOrigin`, `defaults`, `fetchOptions`, `onIssue`, `onOpenLink`, `theme`). Returns a `ModSession`.
- `pushTilesChanged(session, tiles, issues)`: pushes `tiles.changed`.
- `pushThemeChanged(session, theme)`: pushes `theme.changed` with the `Theme`.
- `THEME_CHANGED_METHOD`: `"theme.changed"`, shared with the frame loader.
- `stopModSession(session)`: closes the channel. Later messages, pushes and answers to pending requests do nothing.

Lifecycle:

1. The stage launches the mod with `prepareModLaunch` and renders its frame with `launch.sandboxDocument`.
2. On the frame's first `load`, the stage calls `connectModSession` with the frame's window.
3. The session answers each request once with the same `id`. `sandbox.blocked` and `sandbox.mountFailed` from the frame loader become issues through `onIssue`, each reported once.
4. "Reload tiles" calls `loadModTiles` and `pushTilesChanged`. A color scheme change calls `pushThemeChanged` for every running session.
5. Closing the sandbox, or the frame loading another document, calls `stopModSession`.

```ts
import { connectModSession, pushTilesChanged } from "./lib/core/engine/index.ts";

const session = connectModSession(frame.contentWindow, launch, {
  storage: localStorage,
  appOrigin: location.origin,
  defaults,
  fetchOptions: { baseUrl: document.baseURI },
  onIssue: addIssue,
  onOpenLink: openLinkFromThisSandbox,
  theme: buildTheme("dark"),
});
pushTilesChanged(session, reloadedTiles.tiles, reloadedTiles.issues);
```
