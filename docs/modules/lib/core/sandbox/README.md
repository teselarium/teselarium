# Sandbox Module

## Introduction

Each mod runs isolated from the app in its own sandboxed frame. This module builds what isolates it: the frame's content policy, the frame document and the frame loader, the private channel to the engine, and the reports of requests the policy blocked. What a mod is granted is decided by the [permissions module](../permissions/README.md).

### Content hosts

The content hosts of a mod are the `http:` and `https:` origins of the files the engine read to start it: the mod file, its entrypoint, its tile type file, the collection file (when the mod was opened with one) and each tile. They are always allowed for `show`, so a mod can show images from where its tiles live. `file:` and `data:` sources are dropped, and the list is sorted and without duplicates.

- The sample collection is not a content host unless the mod was opened with it.
- Content hosts are fixed when the mod starts. Tiles reloaded later from a new host are blocked, and the block is reported.

Example: the sample book list mod opened with the sample collection from the app at `https://example.org/` has one content host, `https://example.org`.

### Assets next to the mod

The mod file's origin is always a content host, so a mod can show images, media, fonts and stylesheets from its own folder without declaring a permission, wherever it is served from. Resolve their paths against the mod's source, not the frame's address: the frame's document is built in memory, so a relative URL inside it has nothing to resolve against.

```js
export default function mount(engine, context) {
  const icon = document.createElement("img");
  icon.src = new URL("./icon.svg", context.mod.source).href;
  icon.alt = "";
  document.body.append(icon);
}
```

For a mod at `https://mods.example.net/probe/mod_conf.yaml`, the image loads from `https://mods.example.net/probe/icon.svg`. Scripts are different: loading code from the mod's folder with a `<script>` or `import` still needs a granted `code` permission, because the engine delivers a mod's code over the channel: its one entrypoint, and the scripts of the libraries it declares in its mod file, which `libs.load` fetches from the mod's folder or the npm host and installs from `blob:` addresses (see [Libraries](../engine/README.md#libraries)). A mod that needs a script next to it declares it as a library rather than asking for `code`.

### Images next to tiles

Each tile's origin is a content host too, and the engine resolves metadata strings starting with `./` or `../` against the tile's source before the mod gets them (see [Tiles](../engine/README.md#tiles)). So a mod can set `img.src` from the metadata as is:

```js
cover.src = tile.metadata.image;
```

For a tile at `https://example.org/books/kallocain.md` with `image: "./cover.jpg"`, the image loads from `https://example.org/books/cover.jpg`. A tile picked from the user's computer resolves to a `file:` URL, which is not a content host, so an image next to it does not load.

### Media linked by tiles

Tile authors choose the images, video and audio their tiles link to, so the policy allows exactly the files the tiles link, whatever site they are on, without a permission. The mod cannot choose these addresses, only whether to load them, so they give it no way to send data to a host of its choice. Mods from the app's origin and from other origins get them alike, as they get the content hosts.

When "Load media linked by tiles" is on as the mod starts (see the [Settings page](../../../main/settings/README.md)), `collectTileLinks` reads every metadata string of the tiles the mod receives, after the tile type filter, inside lists and nested mappings too, then the media addresses of each tile's rendered body (see the [tile bodies module](../tile_bodies/README.md#media-and-pictures)): the addresses of its images, video, audio, `<source>` elements, posters and `srcset` candidates, resolved against the tile. Keys, and the body's text URLs and links, are never read. Each string or address goes through these steps in order, and the first step that applies decides:

1. Not an absolute `http:` or `https:` URL: skipped. Plain text, relative paths, `data:` and `file:` strings are never links.
2. Its path ends with `/`: skipped. It names a folder or a page, not a file, and its source would allow every file under it.
3. Its origin is covered by a content host or a granted `show` host, wildcard hosts included: skipped, because the policy already allows it.
4. The policy cannot express it: left out and reported (see below).
5. Its host is on the user's computer or network, and the tile's own host is not: left out and reported (see below).
6. Otherwise its origin and path, without the query and fragment, which the browser does not match, are added to `img-src` and `media-src` as one exact source, sorted and without duplicates. A source cannot hold `,`, `;`, `[`, `]` and `|`, so the path has them written as `%2C`, `%3B`, `%5B`, `%5D` and `%7C`. The browser compares source paths percent-decoded, so the source matches the address as written, which is the one the mod requests. A link written with `,` and one written with `%2C` give one source.

For a tile with `image: "https://media.example.net/covers/kallocain.jpg?size=large"`, the policy gets `https://media.example.net/covers/kallocain.jpg`. It allows that file and no other file of `https://media.example.net`. For `image: "https://media.example.net/covers/chronicles,_volume_1.jpg"`, it gets `https://media.example.net/covers/chronicles%2C_volume_1.jpg`, which allows that file and not `https://media.example.net/covers/chronicles.jpg`. Tile links are never added to `style-src`, `font-src`, `connect-src`, `frame-src` or `script-src`: tiles never let a mod load stylesheets, fonts, data, pages or code, whatever the linked file is.

**What the policy cannot express.** A policy source is `scheme://host[:port]/path`. A link that does not fit is left out:

- a user name or password in the URL (browsers block such subresource requests too);
- an IPv6 address as host, which the source grammar has no form for;
- a host name with a character other than letters, digits, `-` and `.`, such as `_`;
- a path character other than letters, digits and `-._~!$&'()*+=:@%/,;[]|`. The URL parser percent-encodes every other character, such as spaces, quotes and non-ASCII characters, so in practice no path is left out.

Each is reported once per tile as a warning whose source is the tile: `Not loading https://user:secret@media.example.net/cover.jpg: the sandbox cannot allow this address.`

**Private network guard.** A tile from the web must not make the reader's browser send requests to their router or other devices. A link whose host is on the user's computer or network is left out, unless the tile itself was loaded over `http:` or `https:` from such a host, as when someone serves their tiles from `localhost` while working on them. A tile picked from the user's computer gets the guard, since the file may have been downloaded from the web. A host counts as on the user's computer or network when, after dropping a trailing `.`, it is:

- `localhost`, a name without a dot, or a name ending with `.localhost`, `.local`, `.internal`, `.lan` or `.home.arpa`;
- an IPv4 address in `0.0.0.0/8`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` or `100.64.0.0/10`. The URL parser turns other forms of an address, such as `2130706433` or `0x7f.1`, into `127.0.0.1` first. Private IPv6 addresses are already left out by the previous step.

Each is reported once per tile as a warning whose source is the tile: `Not loading http://192.168.1.1/logo.png: tiles from other sites cannot link addresses on your computer or network.` The guard checks names and addresses, not DNS: a public name that resolves to a private address, by DNS rebinding or a name such as `router.example.com` pointing at `192.168.1.1`, is not caught. The browser's own local network protections, such as Chrome's Local Network Access prompt, are a second line.

A private link that a content host or a granted `show` host covers is skipped at step 3: that host's source allows it anyway.

**Fixed when the mod starts.** The tile links are part of the policy, which cannot change while the mod runs. After "Reload tiles", the stage replaces the left-out link issues with those of the reloaded tiles, and when the reloaded tiles link files the policy does not allow, it reports one warning whose source is the collection: `The reloaded tiles link 1 file that this mod does not allow yet. Open the mod again to show it.` (see the [stage module](../stage/README.md)).

**The setting.** Each linked site sees that the reader viewed the tile, as with any image on the web. "Load media linked by tiles", in the Privacy group of Settings, is on by default. Switched off, no tile link is collected or reported, and mods show only media from content hosts and granted `show` hosts. A change applies to mods started after it.

**Large collections.** Each source is about 100 bytes, written twice in the policy. A mod whose collections link thousands of files on one host can declare that host in `permissions.show`: step 3 then leaves the links out of the policy.

**For tile authors.** Link the file itself, at its final address:

- Link an image, audio or video file, not a page or a folder that shows it.
- Avoid links that redirect. The browser checks only the host of a redirect's target, never its path, so a link to `https://media.example.net/cover.jpg` that redirects to `https://cdn.example.org/cover.jpg` is blocked. Open the link in a browser and copy the address it ends at.
- In the body, show media as images, `<video>`, `<audio>` or `<picture>`: `![Still](https://media.example.net/body.jpg)` loads, but the text `https://media.example.net/body.jpg` or a link to it does not make it loadable.
- Streams (HLS and DASH), whose segment addresses are not in the tile, are not covered. Pages embedded in frames, such as videos on a video site, are not media: the app shows them as players (see the [players module](../players/README.md)).

### Content policy

The frame document carries a Content-Security-Policy. Directives come in this order, and the hosts of each directive are sorted and without duplicates, so the policy is the same for the same mod:

| Directive | Sources |
|---|---|
| `default-src` | `'none'` |
| `script-src` | `'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:` + granted `code` hosts |
| `style-src` | `'unsafe-inline' data: blob:` + content hosts + granted `show` hosts |
| `img-src` | `data: blob:` + content hosts + granted `show` hosts + tile links |
| `media-src` | `data: blob:` + content hosts + granted `show` hosts + tile links |
| `font-src` | `data: blob:` + content hosts + granted `show` hosts |
| `connect-src` | granted `connect` hosts, or `'none'` |
| `frame-src` | granted `embed` hosts, or `'none'` |
| `base-uri` | `'none'` |
| `form-action` | `'none'` |

- `'unsafe-inline'` runs the frame loader, and `blob:` runs the mod's module.
- `'unsafe-eval'` and `'wasm-unsafe-eval'` let mods use libraries that compile code at runtime (template engines, WebAssembly). The sandbox is the security boundary, not script restrictions: a mod already runs any code it wants. `script-src` only decides where code can be **fetched** from, because a script URL is also a way to send data out.
- Workers fall back to `script-src`, so `blob:` workers are allowed and remote workers need `code`.
- `object-src` and every other directive fall back to `default-src 'none'`.
- `open` permissions are not in the policy: the engine enforces them.
- Tile links (see [Media linked by tiles](#media-linked-by-tiles)) come after the sorted hosts, sorted among themselves. A mod whose tiles link nothing has the same policy as without them.
- Granted hosts go in as written, including wildcard hosts such as `https://*.us.archive.org`. The browser's policy matches a leading `*.` against one or more subdomain labels, never against the bare host name, which is what the [mod module's host rules](../../mod/README.md) say a wildcard host covers. `*` sorts before letters and digits, so `https://*.us.archive.org` lists before `https://example.org`.

The default policy of the sample book list mod, without grants:

```
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline' data: blob: https://example.org; img-src data: blob: https://example.org; media-src data: blob: https://example.org; font-src data: blob: https://example.org; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
```

With its `show` permissions granted, its four `show` hosts, `https://*.archive.org`, `https://archive.org`, `https://covers.openlibrary.org` and `https://upload.wikimedia.org`, are added to `style-src`, `img-src`, `media-src` and `font-src`, sorted with `https://example.org`. The Open Library covers redirect from `https://covers.openlibrary.org` to `https://archive.org` and then to a subdomain such as `https://ia800100.us.archive.org`, so the sample declares both `https://archive.org` and `https://*.archive.org`:

```
img-src data: blob: https://*.archive.org https://archive.org https://covers.openlibrary.org https://example.org https://upload.wikimedia.org
```

### Blocked request reports

When the policy blocks a request, the frame loader reports the blocked URL and the directive, and the engine adds a `warning` issue whose source is the mod's source. The directive gives the category and the noun of the message:

| Directive | Category | Noun |
|---|---|---|
| `img-src` | `show` | image |
| `media-src` | `show` | media |
| `font-src` | `show` | font |
| `style-src`, `style-src-elem`, `style-src-attr` | `show` | stylesheet |
| `connect-src` | `connect` | connection |
| `frame-src`, `child-src` | `embed` | embedded page |
| `script-src`, `script-src-elem`, `script-src-attr` | `code` | script |
| `worker-src` | `code` | worker |

The blocked URL is reduced to its origin, since browsers sometimes report only the origin. Messages:

- Not declared: `Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml.`
- Not declared, for `img-src` and `media-src` when "Load media linked by tiles" was on as the mod started, the same message followed by a sentence for tile authors: `Blocked image request to https://cdn.example.org. Add it to permissions.show in mod_conf.yaml. If a tile links this file, link its final address: links that redirect to another site are blocked.` The hint does not say which tile link redirected, since browsers report either the original address or the target, sometimes only its origin.
- Declared but not granted: `Blocked image request to https://upload.wikimedia.org: the mod declares it in permissions.show, but the permission was not granted.`
- Any other directive, or a blocked URL that is not a web URL (such as `inline` or `eval`): `Blocked by the sandbox policy (object-src).`

A blocked origin counts as declared when a host of the category covers it, as the mod module's `permissionHostCovers` decides: an exact host equal to it, or a wildcard host one of whose subdomains it is. With `show` for `https://*.us.archive.org`:

- A blocked image from `https://ia800100.us.archive.org`, with the permission denied: `Blocked image request to https://ia800100.us.archive.org: the mod declares it in permissions.show, but the permission was not granted.`
- A blocked image from `https://ia800100.us.archive.org`, with the permission granted (the policy did not allow it for another reason): `Blocked by the sandbox policy (img-src).`
- A blocked image from `https://us.archive.org`, which the wildcard does not cover: `Blocked image request to https://us.archive.org. Add it to permissions.show in mod_conf.yaml.`

Each message is reported once per mod, because a page of images could otherwise produce hundreds of equal issues.

### The sandbox frame

Each mod runs in its own `<iframe sandbox="allow-scripts">` whose document is built in memory and set with `srcdoc`, so running a mod needs no extra hosted file:

- The frame has an opaque origin: `self.origin` is `"null"` inside it. Reading `localStorage`, `document.cookie` or `parent.document` throws a `SecurityError`.
- Without `allow-top-navigation` and `allow-popups`, setting `top.location` throws and `window.open` returns `null`. Without `allow-forms`, forms do not submit: mods read their inputs with click or key handlers.
- The frame never gets `allow-same-origin`: with both flags, a frame whose document comes from the app could remove its own sandbox.
- The app creates every frame itself, also for a mod opened by another mod, so frames are never nested.
- When a mod navigates its frame, the frame fires a second `load` event: the stage stops the mod, removes its frame and reports `The mod left its page and was stopped.`
- The frame has `allow="fullscreen *"`, so `element.requestFullscreen()` works after a click inside the mod, with the browser's own exit notice. This is a permissions policy of the `<iframe>`, not a sandbox flag: the `sandbox` value stays `allow-scripts`. The `*` is needed: a bare `allow="fullscreen"` only allows the origin the frame was declared with, which for a `srcdoc` frame is the app's, never the sandbox's opaque origin, so Firefox and WebKit refuse the request. When the visible sandbox changes, the app leaves fullscreen, so a hidden frame never keeps the screen.
- Without `allow-modals`, `alert`, `confirm`, `prompt` and `print` show nothing (see [Dialogs in mods](#dialogs-in-mods)). Without `allow-downloads`, a mod cannot start a download, and without `allow-popups` it cannot open a tab: it asks the app with `files.save` and `links.open` (see the [engine module](../engine/README.md)).

The frame document holds only the policy, the theme styles and the frame loader (in the frames of a check's tests, the loader is followed by the assertions and the test runner, in the same script, see [Frames of a check's tests](#frames-of-a-checks-tests)):

```html
<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="POLICY">
<style>THEME_FRAME_STYLES</style>
<script type="module">FRAME_LOADER</script>
</head><body></body></html>
```

The policy comes first, because a `<meta>` policy only applies to what follows it. The `<style>` holds the theme tokens and the base stylesheet in the layer `opentesela` (see the [theme module](../theme/README.md)); a mod whose file sets `theme: "none"` gets no `<style>`. The policy's `style-src 'unsafe-inline'` already allows it. The mod's code is not in the document: it arrives over the channel, and the styles are static text without a closing style tag, so nothing needs HTML escaping. The frame loader is an inline module script, so its names stay out of the mod's global scope.

The document is fixed for the life of the mod, because changing `srcdoc` reloads the frame, which stops the mod. What changes while a mod runs, such as the color scheme, reaches the frame only over the channel.

### The frame loader

The frame loader (`sandbox_loader.js`) is the only script the app puts in a running mod's frame. It is plain browser JavaScript, inlined as text. It is not the mod loader, which fetches mod files in the app.

1. While the document loads, it listens for `securitypolicyviolation` on `document` (it keeps the reports until it is connected) and for `message` on `window`.
2. It accepts only the first message whose `source` is the app's window (`window.parent`), whose data is a `sandbox.connect` notification and which carries exactly one port. Later messages are ignored.
3. It builds the frozen engine API object: `request(method, params)` sends a JSON-RPC request with ids counting from 1, and `on(event, handler)` adds a handler for an event.
4. On the port, a response settles its pending request: resolved with `result`, or rejected with an `Error` that has the response's `message` and `code`. A notification calls the handlers of its method in registration order; a handler that throws is logged with `console.error` and the others still run.
5. On connect, it sets `data-ot-color-scheme` on `<html>` to `context.theme.colorScheme`, before importing the mod, so the attribute is there before `mount`.
6. On a `theme.changed` notification, it sets the attribute to the params' `colorScheme` before calling the mod's handlers. If `mount` has not been called yet, it also replaces `context.theme` with the params, so a mod whose code is still being imported mounts with the newest theme. A `colorScheme` other than `"light"` or `"dark"` is ignored. The attribute is set for mods that opted out of the theme styles too.
7. Before importing the mod, it replaces `alert`, `confirm`, `prompt` and `print` on `window` with functions that send `sandbox.dialogBlocked` and return what the blocked originals return: `undefined`, `false`, `null` and `undefined`.
8. It starts the frame's mode, read from the connect params: `mount` without a `test` param, `list` for a `test` whose `caseName` is `null`, and `case` for a `test` with a case name. The modes live in a table, `frameModes`. The loader has only `mount`; the test runner adds `list` and `case`, so the loader does not depend on it. A mode the frame does not have (a `test` param in a frame without the runner) becomes `sandbox.mountFailed`.
9. In the `mount` mode, it turns the mod's code into a `blob:` URL, `import()`s it, revokes the URL, checks that the default export is a function and calls `mount(engine, context)`, awaiting the result. A missing default export, an import error, a throw or a rejection becomes `sandbox.mountFailed`. When `mount` resolves, and only then, it sends `sandbox.mounted`.
10. While the document loads, it defines the `ot-tile-body` element and listens to `click` on `window`, in the bubbling phase, for the links and player placeholders of rendered tile bodies. Both are in every frame, the frames of a check's tests too (see [Tile bodies](../engine/README.md#tile-bodies) in the engine's README).

### Frames of a check's tests

A mod's tests run only in the hidden frames of a mod check (see the [stage module](../stage/README.md#mod-checks)). Their document, `buildSandboxDocument(policy, theme, { testRunner: true })`, has the same policy and theme styles as the mod's own frame, and its module script holds the frame loader followed by two more plain browser scripts, so the three share one scope and their names stay out of the mod's global scope:

- `sandbox_assertions.js`: `expect(actual)` with `toBe` (by `Object.is`), `toEqual` (deep equality of plain data: lists by their items in order, mappings by their keys in any order), `toContain` (a string's substring, or a list's item by `toEqual`), `toBeTruthy` and `not`; the descriptions of values in failure messages (`Expected 2 to be 3`, at most 200 characters per value); and `waitFor(fn, timeout = 2000)`, which calls `fn` every 50 milliseconds until it returns a truthy value without throwing, and rejects with `The condition was not met within <timeout> ms`, plus `. Last error: <message>` when `fn` threw. Its functions are exported, so Vitest imports them; nothing in the frame does.
- `sandbox_test_runner.js`: adds the `list` and `case` modes to `frameModes`. Both import the test file from a `blob:` URL, check that its default export is a function and call it with `t`, whose `test(name, fn)` registers a case, and await it. An empty or repeated name, a missing function, or a call after the default export settled throws, and is kept, so a test file that catches it still fails. A test file that registers no case fails with `the test file registers no test`.
  - `list` sends `sandbox.testsListed` with the names in registration order, or `sandbox.testsFailed` with the error's message. It never imports the entrypoint.
  - `case` runs the case named in the connect params with its context, and sends `sandbox.caseFinished` when the case's function settles: `pass`, or `fail` with the error's message. A name the test file no longer registers fails with a message that says so.

The case context:

- `mount(options?)` copies the mount context, replaces `tiles` with `options.tiles`, merges `options.config` into `config` and sets `params` to `options.params`, then imports the entrypoint and calls its default export with an engine API object whose `request` records each request, and that context. A failing mount rejects `mount` and is not sent as `sandbox.mountFailed`. A second call rejects with `the mod is already mounted`, and options of the wrong shape reject with a message that names the option.
- `requests` lists each request the mod sent through that object, in order, as `{ method, params }`, which gets its `result`, or its `error` (`{ code, message }`), when the request settles.
- `storage.get(key)` and `storage.set(key, value)` send `storage.get` and `storage.set` on the frame's port, so the engine's rules apply. They are not recorded, and work before `mount`.
- `answer(method, value)` checks the method and the value at once (`the answer to ui.confirm must be a boolean`; `mods.open` takes `null`), then sends `sandbox.answerQueued`. The engine queues the answer for the next request for that method.
- `root` is `document.body`, `tiles` the mount context's tiles, and `expect` and `waitFor` the assertions.

The runner, the assertions and their notifications are the loader's protocol, outside the mod API: running mods' frames do not carry them, and a running session ignores the notifications. What a test file gets (`t`, the case context and the matchers) is the test API, which is part of the mod API (see the [engine module](../engine/README.md#mod-api-version)).

### Frame loader messages

The frame loader and the engine use five notifications, and the test runner four more, whose names start with the reserved `sandbox.` prefix. They are the loader's protocol, not the mod API: mods never send or receive them through the engine API object, the mod API surface guard does not record them, and adding one needs no mod API version bump.

| Message | Direction | Params |
|---|---|---|
| `sandbox.connect` | engine to frame, on `window`, with the port | `{ code, context, test? }`: the entrypoint text, the mount context and, in a check's test frames, `test`: `{ code, caseName }`, the test file's text and the case to run, or `null` to list the cases |
| `sandbox.blocked` | frame to engine, on the port | `{ blockedUrl, directive }` of a `securitypolicyviolation` |
| `sandbox.mountFailed` | frame to engine, on the port | `{ message }` of the mount error |
| `sandbox.mounted` | frame to engine, on the port | `{}`, once the mod's `mount` resolved. Never sent after `sandbox.mountFailed` |
| `sandbox.dialogBlocked` | frame to engine, on the port | `{ name }`: `"alert"`, `"confirm"`, `"prompt"` or `"print"`, the blocked function the mod called |
| `sandbox.testsListed` | list frame to engine, on the port | `{ names }`: the names of the cases, in registration order |
| `sandbox.testsFailed` | list frame to engine, on the port | `{ message }`: why the test file gives no cases |
| `sandbox.answerQueued` | case frame to engine, on the port | `{ method, value }`: a scripted answer, a boolean for `links.open`, `files.save`, `ui.confirm` and `players.open`, and `null` for `mods.open` |
| `sandbox.caseFinished` | case frame to engine, on the port | `{ status, message }`: `"pass"` with `null`, or `"fail"` with the error's message |

The frame loader also knows the engine's `theme.changed` event (see the [engine module](../engine/README.md)), to keep the color scheme attribute up to date. The name test in `sandbox_messages.test.ts` checks it against the engine's `THEME_CHANGED_METHOD`.

The engine turns `sandbox.blocked` into a blocked request report, `sandbox.dialogBlocked` into a blocked dialog report and `sandbox.mountFailed` into the error issue `The mod could not be mounted: <message>`, each reported once. A session that was given `onMounted` (the mod check, see the [engine module](../engine/README.md#session)) calls it for `sandbox.mounted`, and for `sandbox.mountFailed` after the issue; running sandboxes ignore `sandbox.mounted`. A session that was given `onTestReport` (a check's list and case frames) hands it the four test notifications; running sandboxes ignore them. Params of the wrong shape, and unknown function names, are ignored. A mod could send these notifications itself, but they only add issues to its own list, end its own check sooner, or change its own tests' results.

### Dialogs in mods

The sandbox never gets `allow-modals`. A browser dialog is drawn by the browser and does not say which mod opened it, so a mod could make it look like the app's, and it would block the whole tab. The blocked functions keep returning what the browser returns, and the first call of each in a running mod reports a `warning` issue whose source is the mod's source:

| Call | Returns | Issue |
|---|---|---|
| `alert()` | `undefined` | `alert() is not available in mods. Show the message in the page or in a <dialog> element.` |
| `confirm()` | `false` | `confirm() is not available in mods and always returns false. Use a <dialog> element, or request "ui.confirm" for a confirmation shown by the app.` |
| `prompt()` | `null` | `prompt() is not available in mods and always returns null. Use an <input> in a <dialog> element.` |
| `print()` | `undefined` | `print() is not available in mods.` |

Later calls of the same function report nothing more. A mod can put the originals back: they stay blocked, and only the report is lost.

What to use instead:

- **Anything inside the mod**: a `<dialog>` element with `showModal()`. It needs no permission, works inside the frame, and the base stylesheet gives it the theme's look. Messages, forms, pickers and "are you sure?" questions that only concern the mod's own data belong here.

  ```js
  const dialog = document.createElement("dialog");
  dialog.innerHTML = "<p>Delete this list?</p><button value='yes'>Delete</button> <button value='no'>Cancel</button>";
  document.body.append(dialog);
  dialog.addEventListener("click", function answer(event) {
    if (event.target instanceof HTMLButtonElement) {
      dialog.close(event.target.value);
    }
  });
  dialog.addEventListener("close", function act() {
    if (dialog.returnValue === "yes") {
      deleteList();
    }
  });
  dialog.showModal();
  ```

- **A confirmation the app vouches for**: `engine.request("ui.confirm", { message, confirmLabel })`. The app shows it in its own dialog, outside the frame, with the mod's title and source, and answers `true` or `false`. Use it when the user should know the question really comes from this mod, for example before something that cannot be undone.

### The channel

The engine opens one private `MessageChannel` per mod when its frame first loads: it posts `sandbox.connect` to the frame's window with `"*"` as the target origin (an opaque origin cannot be named; the message goes to the frame object the app created) and the channel's second port as transfer, and keeps the first port. Every later message goes over the port. The engine never listens on `window`, so messages a frame posts to the app's window are ignored.

### Hosting note

A `srcdoc` document inherits the Content-Security-Policy of the page that embeds it. The app sends none on static hosts such as GitHub Pages. A page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames (`script-src 'unsafe-inline' blob:`), or no mod can start.

## Module Details

Implemented in `src/lib/core/sandbox/`. Other modules import only from the public entry point `src/lib/core/sandbox/index.ts`.

### Content policy and reports

- `collectContentHosts(sources)`: the content hosts of a list of file URLs.
- `collectTileLinks(tiles, contentHosts, granted, bodyMedia)`: the `TileLinks` of the tiles a mod receives: `sources`, the exact sources to add, sorted and without duplicates, and `issues`, one warning per left-out URL and tile (see [Media linked by tiles](#media-linked-by-tiles)). `bodyMedia` maps a tile's `source` to the `mediaUrls` of its rendered body; a tile missing from it has no body media. The input tiles are not changed.
- `isGuardedLink(url, tileSource)`: whether the private network guard leaves out a link of the tile at `tileSource`. The tile bodies module uses it for iframes.
- `buildPrivateLinkIssue(tileSource, value)`: the guard's warning for a left-out link.
- `buildSandboxPolicy(contentHosts, granted, tileLinkSources)`: the policy text for the content hosts, the granted permissions and the tile link sources, which go into `img-src` and `media-src` only. Pass `[]` when tile links are off.
- `describeBlockedRequest(blocked, mod, grants, hintsTileLinks)`: the `ModIssue` for a `BlockedRequest` (`blockedUrl`, `directive`) of the mod with that `source`. With `hintsTileLinks`, an undeclared image or media host gets the redirect hint.
- `describeNewTileLinks(count, collectionSource)`: the warning, whose source is the collection, that the reloaded tiles link `count` files the running mod does not allow yet.
- `describeBlockedDialog(name, mod)`: the warning `ModIssue` for a blocked dialog function (`BlockedDialogName`) of the mod with that `source`.
- Types: `BlockedRequest`, `BlockedDialogName` (`"alert"`, `"confirm"`, `"prompt"` or `"print"`), `TileLinks`.

Example:

```ts
import {
  buildSandboxPolicy,
  collectContentHosts,
  collectTileLinks,
} from "./lib/core/sandbox/index.ts";

const contentHosts = collectContentHosts([
  "https://example.org/samples/mods/book_list/mod_conf.yaml",
  "https://example.org/samples/mods/book_list/books/kallocain.md",
]);
// contentHosts is ["https://example.org"]

const tileLinks = collectTileLinks(
  tiles,
  contentHosts,
  grants.granted,
  tileBodies.mediaByTile,
);
const policy = buildSandboxPolicy(
  contentHosts,
  grants.granted,
  tileLinks.sources,
);
```

### Frame document, messages and channel

- `buildSandboxDocument(policy, theme, options?)`: the `srcdoc` HTML of a mod's frame, with the policy, then the theme styles when `theme` (the mod's `ModThemeSetting`) is `"default"`, then the frame loader. With `options.testRunner` `true` (`SandboxDocumentOptions`), the assertions and the test runner follow the loader in the same script.
- `openSandboxChannel(frameTarget, params)`: posts `sandbox.connect` with `params` (`SandboxConnectParams`: `code`, `context` and the optional `test`, a `SandboxTestParams`: `code`, `caseName`) and one port to the frame, and returns the engine's port.
- `readBlockedRequest(params)`, `readMountFailure(params)` and `readBlockedDialog(params)`: read the params of `sandbox.blocked`, `sandbox.mountFailed` and `sandbox.dialogBlocked`, or `null` for params of the wrong shape or an unknown function name.
- `readSandboxTestReport(method, params)`: reads a test notification as a `SandboxTestReport`: `{ kind: "listed", names }`, `{ kind: "listFailed", message }`, `{ kind: "answerQueued", method, value }` (with `method` an `AnswerMethod` and a value of the right type for it) or `{ kind: "caseFinished", status, message }`. Returns `null` for another method or params of the wrong shape.
- `SANDBOX_CONNECT_METHOD`, `SANDBOX_BLOCKED_METHOD`, `SANDBOX_MOUNT_FAILED_METHOD`, `SANDBOX_MOUNTED_METHOD`, `SANDBOX_DIALOG_BLOCKED_METHOD`, `SANDBOX_TESTS_LISTED_METHOD`, `SANDBOX_TESTS_FAILED_METHOD`, `SANDBOX_ANSWER_QUEUED_METHOD`, `SANDBOX_CASE_FINISHED_METHOD`: the message names, shared with the frame loader and the test runner.
- Types: `SandboxConnectParams`, `SandboxTestParams`, `SandboxTestReport`, `AnswerMethod`, `SandboxDocumentOptions`.

Example:

```ts
import { buildSandboxDocument, openSandboxChannel } from "./lib/core/sandbox/index.ts";

frame.srcdoc = buildSandboxDocument(policy, mod.theme);
frame.addEventListener("load", function connectFrame(): void {
  const port = openSandboxChannel(frame.contentWindow, { code, context });
  port.onmessage = handleModMessage;
}, { once: true });
```

The engine's session does this for you (see the [engine module](../engine/README.md)).
