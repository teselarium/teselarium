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
| `-32001` | A mod file could not be loaded. The message is the load error's message. |
| `-32002` | Permission denied. The message says which permission is missing. |
| `-32003` | The requested default mod is switched off. The message names the mod. |
| `-32603` | An error the method did not expect, such as a tile body whose library cannot be loaded. The message is the method's name, `: ` and the error's message, as in `tiles.renderBody: Failed to fetch dynamically imported module: …`. |

### Reserved names

Methods starting with `sandbox.` belong to the frame loader, which uses them to connect the channel and to report blocked requests, blocked browser dialogs and mount failures (see the [sandbox module](../sandbox/README.md)). Mods must not use them.

Method names are looked up as own properties of the engine's handler tables, so names such as `toString` or `__proto__` are unknown methods.

### Methods and events

| Method | Params | Result |
|---|---|---|
| `storage.get` | `{ key }`, a non-empty string | The value stored under `key` in the mod's slot, or `null`. |
| `storage.set` | `{ key, value }`, with `value` plain data (strings, finite numbers, booleans, null, lists and mappings) | `null`. Storing `null` removes the key. |
| `mods.inspect` | `{ mod }`, a mod reference | The mod's metadata, without running it (see below). |
| `mods.open` | `{ mod, collection?, params? }` | `null`, once the stage opened the mod in a new sandbox. |
| `mods.check` | `{ mod, collection? }` | The check report of the mod, once the check is done (see below). Added in mod API `0.1.1`. |
| `links.open` | `{ url }`, an absolute `http:` or `https:` address | `true` once the user opened it in a new tab, `false` if the user cancelled (see below). |
| `files.save` | `{ name, content, encoding?, type? }` | `true` once the user saved the file, `false` if the user cancelled. |
| `ui.confirm` | `{ message, confirmLabel?, cancelLabel? }` | `true` if the user confirmed, `false` if the user cancelled or pressed Escape. |
| `ui.notify` | `{ message, level?, source? }` | `null`, once the message is in the mod's stage bar (see [Telling the user something](#telling-the-user-something)). Added in mod API `0.1.8`. |
| `tiles.renderBody` | `{ source }`, the `source` of one of the mod's tiles | `{ html }`: the tile's body rendered to safe HTML (see [Tile bodies](#tile-bodies)). Added in mod API `0.1.5`; formulas as MathML, highlighted code and emoji since `0.1.7`. |
| `players.open` | `{ url }`, a player address of the mod's tiles | `true` once the player was shown and closed, `false` if the user cancelled (see [Players](#players)). Added in mod API `0.1.5`. |
| `libs.load` | `{ name, version }`, a library the app ships and its major version, such as `{ name: "mermaid", version: "12" }` | `{ name, version }`, with the full version installed, once the library is ready in the mod's frame (see [Libraries](#libraries)). Added in mod API `0.1.6`. |

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
| `api` | `version`: the app's mod API version as a string, `"0.1.8"` (see [Mod API version](#mod-api-version)). Every mod gets it, whether it declares an `api` range or not. |
| `config` | The mod's `config`. |
| `params` | The link's parameters other than `mod` and `collection`, as a mapping of strings. |
| `tiles` | The tiles of the link's collection that match the mod's tile type. Metadata strings starting with `./` or `../` arrive resolved against the tile's `source` (see [Tiles](#tiles)). |
| `issues` | The issues from loading and validating the collection. |
| `permissions` | `granted` and `denied` lists of `{ category, host, reason }`. |
| `theme` | `colorScheme` (`"light"` or `"dark"`) and `tokens`, a mapping from each theme token name to its value for that color scheme (see the [theme module](../theme/README.md)). It is the theme current when the frame connects, not when the mod started loading, so a mod opened while the user switches still mounts with the right one. |

### Tiles

A collection is optional. Without one, `tiles` and `issues` are empty and no collection file is requested. With one:

- When the mod has a `type_path`, the engine builds the tile validator, validates the collection and keeps only the tiles whose `types` include the type name. Tiles that do not match are left out of `tiles` and appear as warnings in `issues`.
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

1. The request's params. `mods.open` needs `mod` as a non-empty string, `collection` absent, `null` or a non-empty string, and `params` absent or a mapping of strings. `mods.check` needs `mod` and `collection` the same way. Otherwise `-32602`, e.g. `mods.open: "params.target" must be a string` or `mods.check: "mod" must be a non-empty string`.
2. The `open` permission: the requesting mod needs a **granted** `open` permission for `"*"` or the origin of the target mod file. Otherwise `-32002` (see the [permissions module](../permissions/README.md)). Mods served from the app's origin are granted their permissions, and mods from other origins the ones the user allowed.
3. The switched-off list: a switched-off default mod is refused with `-32003`, whatever reference names it.

Then:

- `mods.inspect` loads the mod file, without its entrypoint, and answers `source`, `name`, `title`, `version`, `description`, `api` (the mod's `api` range as written, or `null` when it declares none), `apiCompatible` (`true` when the range matches the mod API version, `false` when it does not, `null` without a range), `typeSource`, `sampleCollection`, `testSource` (the resolved address of the mod's test file, or `null` when it declares none; the test file is not requested), `config` and `permissions` (the `granted` and `denied` lists that mod would get if it were opened without being asked: for a mod from another origin, what the user allowed and remembered). Inspecting a mod for another API asks the user nothing. A load failure is `-32001` with the load error's message.
- `mods.open` asks the stage to open the link in a new sandbox, with the requesting sandbox as its opener, and answers `null`. Only the visible mod can open mods: a hidden one gets `-32002` with `mods.open: only the visible mod can open mods`. The new mod's load failures belong to its own sandbox, not to the response.
- `mods.check` asks the stage to check the mod without running it for the user, and answers the report once the check is done. `collection`, resolved against the app's address, gives the tiles to mount; without it, the mod's sample collection does, and a mod without one is mounted with no tiles. Only the visible mod can check mods: a hidden one gets `-32002` with `mods.check: only the visible mod can check mods`. A mod file that cannot be loaded is a report with status `"fail"`, not an error response. Checking a mod for another API asks the user nothing.

The check has three steps. The bundle check loads the mod file, the entrypoint, the tile type and the collection, and validates the tiles (see [Mod check](#mod-check)). When it found no error, the mount check mounts the mod in a hidden frame, with the content policy and permissions it would get if it were opened, the tiles of its type and a throwaway storage slot, and records what happens until 1 second after `mount` finished (see the [stage module](../stage/README.md#mod-checks)). When the mod declares `test_path` and the mount check found no error either, the test step fetches the test file and runs each of its cases in a fresh hidden frame of its own (see the [guide to writing mod tests](../../../../mod_plugin_spec.md#mod-tests)). The report is plain data:

```json
{
  "source": "https://example.org/samples/mods/book_list/mod_conf.yaml",
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
      "message": "the mod declares no \"api\" range, so it may not work with mod API 0.1.8"
    }
  ]
}
```

`status` is `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none. `mountChecked` is `false` when a bundle error skipped the mount. `testsChecked` is `true` when the mod's cases ran, and `false` for a mod without `test_path`, when a bundle or mount error skipped the tests, or when the test file could not be loaded. `tests` lists each case the test file registers, in order, as `{ name, status, message }`, with `status` `"pass"` or `"fail"` and `message` `null` for a passing case and the failure's message otherwise; it is empty when the cases did not run. Findings are in the order they were found, and `step` is `"bundle"`, `"mount"` or `"test"`. A `test` finding comes from the tests: a test file that cannot be loaded or registers no valid case, a failed case (`The test "<name>" failed: <message>`, whose source is the test file), or what a case's mod did that the mount check would record, with the message prefixed by `In the test "<name>": `.

Mods never build app addresses: they send what to run, and only the stage turns it into a run link and a history entry (see the [stage module](../stage/README.md)).

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

Some libraries are too large for a mod to bundle, and loading them from another site needs the `code` permission. The app ships a vetted copy of them and installs one in the frame of a mod that asks, from the app's own host.

| Name | Major version | Global |
|---|---|---|
| `mermaid` | `12` | `globalThis.mermaid` |

**`libs.load { name, version }`** installs the library `name` at the major version `version` in the mod's frame, and resolves with `{ name, version }`, where `version` is the full version installed, such as `"12.2.0"`, once the library is ready to use:

```js
const { version } = await engine.request("libs.load", {
  name: "mermaid",
  version: "12",
});
```

- `version` is a major version, as a string: `"12"`, not `"12.2"` nor `12`.
- A library the app does not ship is `-32602` (`libs.load: the app has no library "katex" (it has mermaid)`), and so is another major version (`libs.load: the app has mermaid 12, not mermaid "11"`) or a `version` that is not a string. Nothing is installed.
- A frame receives a library once: a second `libs.load` resolves with the same result and leaves the library's object as it was. A failed request is not kept, so a later one tries again.
- The library runs only in the frame that asked, under its sandbox and content policy, not in the app's page nor in another mod's frame. It works in the frames of a check's tests too, and a case's `requests` record `{ name, version }`, never the code.

How it works: the engine's handler (`libs_methods.ts`) answers the library's code, and the frame loader installs it as a classic `<script>` from a `blob:` address, which the frame's policy allows, before it resolves the mod's request without the code. The app downloads a library on the first request in a page, not before, and keeps it for the page; a page that runs no mod asking for one never downloads it.

**Size.** Mermaid's single-file build is about 5.5 MB, 1.6 MB gzipped, in a chunk of its own, `assets/mermaid.min-<hash>.js`, which an instantiation serves with the rest of the build. The app's first load does not include it. Each frame that loads it pays its install, 0.2 to 0.6 s on a desktop, a first diagram slower than the next ones, up to about 0.25 s on a desktop and close to 1 s on a slower CPU, and its memory: two mods that draw diagrams each install their own copy.

### Default mod settings

The app has default mod settings: the default mods folder and the default mods that are switched off. What `#/` shows is not a default mod setting: it is the Home section of the app's [section registry](../../../main/README.md#home-a-page-or-a-mod). The vanilla app (`src/main/default_mods.ts`) uses:

```ts
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  switchedOff: [],
};
```

The folder is resolved against the app's address, and each switched-off name to the source of its mod file, so a switched-off mod is refused whatever reference names it.

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
| `engine.request("mods.open", { mod: inspection.source, collection: inspection.sampleCollection })` | `#/run?mod=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml&collection=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fbook_collection.yaml` |
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

### Mod API version

The mod API has a version of its own, separate from the app's version in `package.json`. It covers what a mod relies on: the engine's methods and events, the mount context, the mod file format (see the [mod module](../../mod/README.md)) and the test API, what a mod's test file gets (see the [guide to writing mod tests](../../../../mod_plugin_spec.md#mod-tests)). It is `MOD_API_VERSION` in `src/lib/core/engine/mod_api_version.ts`, `0.1.8` today. Mods read it as `context.api.version`, declare the range they were written for as `api` in their mod file, and the stage asks the user before starting a mod whose range does not match (see the [stage module](../stage/README.md#questions-before-a-mod-starts)).

When it changes, while it is `0.x`:

- A breaking change bumps the minor version (`0.1.0` → `0.2.0`): removing or renaming a method, an event, a mount context key or a mod file key, or changing what one means or accepts so that existing mods break. `^0.1.0` ranges stop matching, so their users are asked.
- An addition or a fix bumps the patch version (`0.1.0` → `0.1.1`): a new method, event, context key or optional mod file key, or a fix that existing mods keep working with. `^0.1.0` ranges still match.

From `1.0.0` on, semver's usual rule applies: major for a breaking change, minor for an addition, patch for a fix.

A change that bumps the mod API also bumps the app's version, at least as much (see the release guide's [bump rule](../../../../releasing.md#bump-rule)).

Each bump also updates:

- the surface guard, `mod_api_surface.test.ts`: it records, for each version, the API's surface by name (the method names, the event names, the mount context's keys and the keys of its `mod`, `api`, `permissions` and `theme` mappings, the mod file keys and the permission categories). It fails when the surface built from the code differs from the entry of `MOD_API_VERSION`, or when a recorded version is above it. A bump adds an entry for the new version; older entries are never edited, so the record shows how the API grew. The guard sees names, not params or results, so a change to those needs the bump without the guard's help. The test API is part of the mod API, but the guard does not record it: the guard builds its surface from the engine's code and never runs the frame loader, so the e2e tests of `e2e/mod_tests.spec.ts` pin the test API's names instead;
- the shipped mods' `api` ranges, and `TEST_MOD_API_RANGE` in `src/test/sample_mods.ts` and `e2e/mod_routes.ts`, on a breaking bump.

An OpenSpec proposal that changes the mod API's specs (`mod-engine-api`, `mod-loading`'s mod file format, `mod-api-version`, `mod-theme`'s context and events, `mod-app-actions`) states its bump, as `openspec/config.yaml` asks.

### Hosting note

Mods run in `srcdoc` frames, which inherit the Content-Security-Policy of the page that embeds them. The app sends none on static hosts. A page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames (`script-src 'unsafe-inline' blob:`), or no mod can start. The app also needs `unsafe-eval` to build tile validators (see the [tile module](../../tile/README.md)). A policy with `frame-src` (or `child-src`) must also allow the player sites, such as `https://www.youtube-nocookie.com https://player.vimeo.com https://w.soundcloud.com`, and the sites of the iframes tile bodies hold, or players stay blank.

## Module Details

Implemented in `src/lib/core/engine/`. Other modules import only from the public entry point `src/lib/core/engine/index.ts`.

### Storage slots

Implemented in `src/lib/core/storage/` and exported from `src/lib/core/storage/index.ts`.

Each mod has its own storage slot, identified by the mod's source, so two mods with the same `name` from different sources never read each other's values. A slot keeps its values when the app is reloaded.

- `readModValue(storage, modSource, key)`: the value stored under `key` in the mod's slot, or `null`.
- `writeModValue(storage, modSource, key, value)`: stores the value as JSON. Storing `null` removes the key. Storage errors propagate.
- Types: `ModStorage`, the `getItem`, `setItem` and `removeItem` part of `Storage`. The app passes `localStorage`, and tests pass a `createMemoryStorage()` (see the [storage module](../storage/README.md)).

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

- `MOD_API_VERSION`: `"0.1.8"`, the app's mod API version.
- `matchModApiRange(range)`: `null` when `range` is `null`, otherwise whether `MOD_API_VERSION` satisfies the range by npm's semver rules (`satisfies` from `semver`). A caret range on a `0.x` version allows only patch updates: `^0.1.0` matches `0.1.8` but not `0.2.0`.
- `describeMissingApiRange()`: the message of the warning of a mod without `api`, naming `"api"` and `MOD_API_VERSION`.
- `describeCancelledApiMismatch(range)`: the error of a sandbox whose mod the user did not run, naming the range and `MOD_API_VERSION`.
- `describeApiRangeMismatch(range)`: the message of the bundle check's warning for a range that does not match, naming the range and `MOD_API_VERSION`. Used inside the engine, not exported by `index.ts`.

`buildModLaunch`, `inspectMod`, `checkModBundle` and the stage use these, so the version and its matching live in one place.

### Launch

- `loadModLaunchInputs(request, options)`: loads what a mod's launch is built from. `request` is a `ModLaunchRequest` (`link`, `defaults`), where `link` is a `RunLink` (`mod`, `collection`, `params`): what to run, not an address. In order, it refuses a switched-off mod with `ModSwitchedOffError` before any request, loads the mod and its entrypoint, and loads the collection when `link.collection` is not `null`. Returns `ModLaunchInputs` (`mod`, `link`, `modTiles`), with `modTiles` `null` without a collection. Every error propagates, and each names its source. The stage keeps the inputs while it asks the user (see the [stage module](../stage/README.md)), and builds the launch once the grants are known.
- `loadLaunchMod(request, options)` and `loadLaunchTiles(mod, link, options)`: the two steps of `loadModLaunchInputs`. The first refuses a switched-off mod and loads the mod, and the second loads the collection and returns the `ModLaunchInputs`. The stage calls them one after the other, so it knows the mod when the collection fails.
- `buildModLaunch(mod, link, modTiles, grants, loadsTileLinkedMedia)`: builds the `ModLaunch` of a loaded mod, its `ModTiles` (or `null`) and its `grants`, the `ModGrants` of `grantModPermissions` (see the [permissions module](../permissions/README.md)), without requesting anything: collects the content hosts and the tile links (when `loadsTileLinkedMedia` is `true`), builds the policy, the frame document, the mount context and the issues. Opening a mod and checking it both call it, so a checked mod gets the frame it would get if it were opened with the same grants.
  Returns a `ModLaunch` (`mod`, `collectionSource`, `context`, `contentHosts`, `tileLinks`, `tileBodies`, `policy`, `sandboxDocument`, `apiCompatible`, `fileIssues`, `issues`), where `context` is a `LaunchContext`: the mount context without `theme`, which the session adds when the frame connects, and whose `permissions` are `grants`. `apiCompatible` is `matchModApiRange(mod.api)`: the stage asks the user before starting a mod whose range does not match. `fileIssues` holds the issues of the mod file itself, today only the warning of a missing `api` range, whose source is the mod file's source. `issues` holds one warning per denied permission. `tileBodies` is the `TileBodies` of the tiles the mod receives (`buildTileBodies`, below), which the session keeps. `tileLinks` is the `TileLinks` of the tiles the mod receives and their body media (`collectModTileLinks`, below, see [Media linked by tiles](../sandbox/README.md#media-linked-by-tiles)): `sources`, the files the policy allows as images, video and audio, and `issues`, the left-out links and the iframes the bodies left out, kept apart from `issues` so the stage can replace them after "Reload tiles". It is `{ sources: [], issues: [] }` without a collection, and `null` when `loadsTileLinkedMedia` is `false`: then nothing is collected or reported, and blocked image reports get no redirect hint. The mount context does not list the tile links, so the mod API does not change.
- `buildModTestDocument(launch)`: the `srcdoc` HTML of a frame of the mod's tests: the launch's `policy` (the frame's Content-Security-Policy) and the mod's theme setting, as in `sandboxDocument`, with the assertions and the test runner after the frame loader (see the [sandbox module](../sandbox/README.md#frames-of-a-checks-tests)). So a case runs the mod with the content policy it gets when it is opened.
- `loadModTiles(mod, collectionLocation, options?)`: loads a collection for a mod and selects its tiles with `selectModTiles`. Returns `ModTiles` (`collectionSource`, `tiles`, `issues`). The stage's "Reload tiles" calls it again.
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
```

### Tile bodies of a launch

Implemented in `mod_tile_bodies.ts`, with the renderer of the [tile bodies module](../tile_bodies/README.md) and the table of the [players module](../players/README.md).

- `buildTileBodies(tiles)`: the `TileBodies` of the tiles a mod receives: `tiles` (each tile by source), `renderedBodies` (the promise of the HTML of each body requested so far, by source), `playerAddresses` (each player address, normalized as `URL.href`, with its `TilePlayer`: the `Player` and the title the tile gives it, which is the tile's `title` for a metadata page link), `mediaByTile` (the `mediaUrls` of each collected body, by source) and `issues` (the warnings of iframes the bodies left out). Each metadata string that `readPlayer` recognizes is a player address; each body holding `<`, `![` or `://` is scanned with `scanTileBody`, and its media, players and issues are collected. No body is rendered: each renders when the mod asks for it, so the libraries of the extras load only then. `buildModLaunch` and the stage's "Reload tiles" call it. The tiles are not changed.
- `collectModTileLinks(tiles, tileBodies, contentHosts, granted)`: `collectTileLinks` with the bodies' media, followed by the bodies' issues.
- `readTileBodyHtml(tileBodies, source)` and `findTilePlayer(tileBodies, url)`, used by the handlers and not exported by `index.ts`: async, the HTML of a tile's body, rendered on first request with its promise kept, or `null` for a source of no tile; a promise that rejects is dropped, so a later request renders again; and the `TilePlayer` of a player address, or `null`.

### Mod check

The bundle check and the report of `mods.check`. Neither needs a DOM, so a Node script can import them.

- `checkModBundle(source, collectionLocation, options?)`: checks the files of the mod at `source`, a resolved mod file address. `options` are `FileFetchOptions`. Returns a `ModBundleCheck`: `findings`, `mod` (the `LoadedMod`, or `null` when the mod file or the entrypoint failed) and `modTiles` (the `ModTiles` to mount, or `null` without a collection). It never throws for a file. The steps run in this order, and the findings follow it:
  1. The mod file (`loadModFile`). An error here ends the check, with this one finding.
  2. The `api` range (`matchModApiRange`): a missing range is a warning with the text of `describeMissingApiRange`, the warning the stage bar shows, and a range that does not match is a warning naming the range and `MOD_API_VERSION`. Both have the mod file as their source. So the range finding comes right after the mod file's, as in the stage bar.
  3. The entrypoint (`loadModCode`).
  4. The tile type (`buildTileValidator`), when the mod has a `type_path`.
  5. The collection: `collectionLocation`, or else the mod's `sampleCollection`, or none. It is loaded and its tiles are selected with `selectModTiles`. Each of its issues becomes a finding with the issue's level and source. When the tile type failed, the collection is not loaded, since it could not be validated.

  A file that cannot be loaded, or has the wrong format, is an error finding whose source is the error's `source` (the failing file) and whose message is the error's message.
- `buildModCheckReport(source, findings, mountChecked, tests)`: the `ModCheckReport` of a check. `tests` is the list of `ModTestResult`, or `null` when the cases did not run, which gives `testsChecked` `false` and an empty `tests`. Its `status` is `"fail"` when a finding is an error, `"warn"` when there are only warnings and `"pass"` when there are none: it is read from the findings alone, which already hold an error for each failed case. The findings and the test results are copied.
- Types: `ModCheckFinding` (`step`, `level`, `source`, `message`), with `step` a `ModCheckStep` (`"bundle"`, `"mount"` or `"test"`) and `level` `"error"` or `"warning"`; `ModTestResult` (`name`, `status` `"pass"` or `"fail"`, `message`); `ModCheckReport` (`source`, `status`, `mountChecked`, `testsChecked`, `tests`, `findings`), plain data; `ModCheckStatus` (`"pass" | "warn" | "fail"`); `ModBundleCheck`.

```ts
import { buildModCheckReport, checkModBundle } from "./lib/core/engine/index.ts";

const source = "https://example.org/samples/mods/book_list/mod_conf.yaml";
const bundleCheck = await checkModBundle(source, null, { baseUrl: "https://example.org/" });
// bundleCheck.findings is [] and bundleCheck.modTiles.tiles has the three sample books
const report = buildModCheckReport(source, bundleCheck.findings, false, null);
// report.status === "pass" and report.testsChecked === false
```

### Request handlers

Each request namespace has its own module with one table of handlers: `storage_methods.ts` (`STORAGE_METHODS`), `mods_methods.ts` (`MODS_METHODS`), `links_methods.ts` (`LINKS_METHODS`), `files_methods.ts` (`FILES_METHODS`), `ui_methods.ts` (`UI_METHODS`), `tiles_methods.ts` (`TILES_METHODS`), `players_methods.ts` (`PLAYERS_METHODS`) and `libs_methods.ts` (`LIBS_METHODS`). A handler is a `ModMethod`: `(context: ModMethodContext, params) => Promise<result>`. It resolves with the `result`, or throws `ModMethodError(code, message)`, which the session sends as the error response. Handlers know nothing about ports or messages, so they are tested by calling them with a plain `ModMethodContext` (`mod`, `grants`, `storage`, `appOrigin`, `defaults`, `fetchOptions`, `tileBodies`, `readSiteDecisions`, `onOpenLink`, `onRequestAction`, `onCheckMod`). `tileBodies` is the session's current `TileBodies`, which `pushTilesChanged` replaces.

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

- `connectModSession(frameTarget, launch, options)`: opens the private channel to the frame (`sandbox.connect` with the mod's code and its mount context: `launch.context` with `theme` set to `options.theme`), and answers the mod's requests from the handler tables. `options` are `ModSessionOptions` (`storage`, `appOrigin`, `defaults`, `fetchOptions`, `readSiteDecisions`, `onIssue`, `onOpenLink`, `onRequestAction`, `onCheckMod`, `theme`, and the optional `onMounted`, `onErrorResponse`, `test` and `onTestReport`). Returns a `ModSession`, whose `hintsTileLinks` is `launch.tileLinks !== null`: blocked image and media reports then end with the redirect hint for tile authors (see the [sandbox module](../sandbox/README.md#blocked-request-reports)).
  - `onMounted()`: called when the mod's `mount` finished: for `sandbox.mounted`, and for `sandbox.mountFailed` after its issue is reported. The mod check uses it to start its settle time. Running sandboxes pass none, and ignore `sandbox.mounted`.
  - `test`: `{ code, caseName }` (`SandboxTestParams`), sent in `sandbox.connect` so the frame lists the cases of the test file (`caseName` `null`) or runs one. Only the frames of a check's tests, built with `buildModTestDocument`, pass it.
  - `onTestReport(report)`: called with each test notification of the frame, read as a `SandboxTestReport` (`listed`, `listFailed`, `answerQueued` or `caseFinished`, see the [sandbox module](../sandbox/README.md#frame-loader-messages)). Notifications of the wrong shape are ignored. Running sandboxes pass none, so a mod that sends them outside a check changes nothing.
  - `onErrorResponse(method, error)`: called for every error response the session sends, with the request's method, or `null` for a message that is not a request (`-32600`), and the response's `error` (`ResponseError`: `code`, `message`). The mod check keeps `-32600`, `-32601` and `-32602`, the signal that a mod uses the API wrongly. Without it, nothing outside the session sees the responses.
- `pushTilesChanged(session, tiles, issues, tileBodies)`: pushes `tiles.changed`, and replaces the session's `TileBodies` with `tileBodies`, those of the reloaded tiles, so `tiles.renderBody` and `players.open` follow them. The policy stays the launch's.
- `pushThemeChanged(session, theme)`: pushes `theme.changed` with the `Theme`.
- `THEME_CHANGED_METHOD`: `"theme.changed"`, shared with the frame loader. `TILES_CHANGED_METHOD`, `"tiles.changed"`, and `ENGINE_METHODS`, the merged handler table, are exported by `mod_session.ts` for the surface guard, not by `index.ts`.
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
