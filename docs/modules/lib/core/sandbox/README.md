# Sandbox Module

## Introduction

Each mod runs isolated from the app in its own sandboxed frame. This module builds what isolates it: the frame's content policy, the frame document and the frame loader, the private channel to the engine, and the reports of requests the policy blocked. What a mod is granted is decided by the [permissions module](../permissions/README.md).

### Content hosts

The content hosts of a mod are the `http:` and `https:` origins of the files the engine read to start it: the mod file, its entrypoint, its tile type file, the collection file (when the mod was opened with one) and each tile. They are always allowed for `show`, so a mod can show images from where its tiles live. `file:` and `data:` sources are dropped, and the list is sorted and without duplicates.

- The sample collection is not a content host unless the mod was opened with it.
- Content hosts are fixed when the mod starts. Tiles reloaded later from a new host are blocked, and the block is reported.

Example: the sample book list mod opened with the sample collection from the app at `https://example.org/` has one content host, `https://example.org`.

### Content policy

The frame document carries a Content-Security-Policy. Directives come in this order, and the hosts of each directive are sorted and without duplicates, so the policy is the same for the same mod:

| Directive | Sources |
|---|---|
| `default-src` | `'none'` |
| `script-src` | `'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:` + granted `code` hosts |
| `style-src` | `'unsafe-inline' data: blob:` + content hosts + granted `show` hosts |
| `img-src` | `data: blob:` + content hosts + granted `show` hosts |
| `media-src` | `data: blob:` + content hosts + granted `show` hosts |
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

The default policy of the sample book list mod, without grants:

```
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline' data: blob: https://example.org; img-src data: blob: https://example.org; media-src data: blob: https://example.org; font-src data: blob: https://example.org; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
```

With its `show` permission granted, `https://upload.wikimedia.org` is added after `https://example.org` in `style-src`, `img-src`, `media-src` and `font-src`.

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
- Declared but not granted: `Blocked image request to https://upload.wikimedia.org: the mod declares it in permissions.show, but the permission was not granted.`
- Any other directive, or a blocked URL that is not a web URL (such as `inline` or `eval`): `Blocked by the sandbox policy (object-src).`

Each message is reported once per mod, because a page of images could otherwise produce hundreds of equal issues.

### The sandbox frame

Each mod runs in its own `<iframe sandbox="allow-scripts">` whose document is built in memory and set with `srcdoc`, so running a mod needs no extra hosted file:

- The frame has an opaque origin: `self.origin` is `"null"` inside it. Reading `localStorage`, `document.cookie` or `parent.document` throws a `SecurityError`.
- Without `allow-top-navigation` and `allow-popups`, setting `top.location` throws and `window.open` returns `null`. Without `allow-forms`, forms do not submit: mods read their inputs with click or key handlers.
- The frame never gets `allow-same-origin`: with both flags, a frame whose document comes from the app could remove its own sandbox.
- The app creates every frame itself, also for a mod opened by another mod, so frames are never nested.
- When a mod navigates its frame, the frame fires a second `load` event: the stage stops the mod, removes its frame and reports `The mod left its page and was stopped.`

The frame document holds only the policy, the theme styles and the frame loader:

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

The frame loader (`sandbox_loader.js`) is the only script the app puts in a mod's frame. It is plain browser JavaScript, inlined as text. It is not the mod loader, which fetches mod files in the app.

1. While the document loads, it listens for `securitypolicyviolation` on `document` (it keeps the reports until it is connected) and for `message` on `window`.
2. It accepts only the first message whose `source` is the app's window (`window.parent`), whose data is a `sandbox.connect` notification and which carries exactly one port. Later messages are ignored.
3. It builds the frozen engine API object: `request(method, params)` sends a JSON-RPC request with ids counting from 1, and `on(event, handler)` adds a handler for an event.
4. On the port, a response settles its pending request: resolved with `result`, or rejected with an `Error` that has the response's `message` and `code`. A notification calls the handlers of its method in registration order; a handler that throws is logged with `console.error` and the others still run.
5. On connect, it sets `data-ot-color-scheme` on `<html>` to `context.theme.colorScheme`, before importing the mod, so the attribute is there before `mount`.
6. On a `theme.changed` notification, it sets the attribute to the params' `colorScheme` before calling the mod's handlers. If `mount` has not been called yet, it also replaces `context.theme` with the params, so a mod whose code is still being imported mounts with the newest theme. A `colorScheme` other than `"light"` or `"dark"` is ignored. The attribute is set for mods that opted out of the theme styles too.
7. It turns the mod's code into a `blob:` URL, `import()`s it, revokes the URL, checks that the default export is a function and calls `mount(engine, context)`, awaiting the result. A missing default export, an import error, a throw or a rejection becomes `sandbox.mountFailed`.

### Frame loader messages

The frame loader and the engine use three notifications, whose names start with the reserved `sandbox.` prefix:

| Message | Direction | Params |
|---|---|---|
| `sandbox.connect` | engine to frame, on `window`, with the port | `{ code, context }`: the entrypoint text and the mount context |
| `sandbox.blocked` | frame to engine, on the port | `{ blockedUrl, directive }` of a `securitypolicyviolation` |
| `sandbox.mountFailed` | frame to engine, on the port | `{ message }` of the mount error |

The frame loader also knows the engine's `theme.changed` event (see the [engine module](../engine/README.md)), to keep the color scheme attribute up to date. The name test in `sandbox_messages.test.ts` checks it against the engine's `THEME_CHANGED_METHOD`.

The engine turns `sandbox.blocked` into a blocked request report and `sandbox.mountFailed` into the error issue `The mod could not be mounted: <message>`, each reported once. Params of the wrong shape are ignored. A mod could send these notifications itself, but they only add issues to its own list.

### The channel

The engine opens one private `MessageChannel` per mod when its frame first loads: it posts `sandbox.connect` to the frame's window with `"*"` as the target origin (an opaque origin cannot be named; the message goes to the frame object the app created) and the channel's second port as transfer, and keeps the first port. Every later message goes over the port. The engine never listens on `window`, so messages a frame posts to the app's window are ignored.

### Hosting note

A `srcdoc` document inherits the Content-Security-Policy of the page that embeds it. The app sends none on static hosts such as GitHub Pages. A page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames (`script-src 'unsafe-inline' blob:`), or no mod can start.

## Module Details

Implemented in `src/lib/core/sandbox/`. Other modules import only from the public entry point `src/lib/core/sandbox/index.ts`.

### Content policy and reports

- `collectContentHosts(sources)`: the content hosts of a list of file URLs.
- `buildSandboxPolicy(contentHosts, granted)`: the policy text for the content hosts and the granted permissions.
- `describeBlockedRequest(blocked, mod, grants)`: the `ModIssue` for a `BlockedRequest` (`blockedUrl`, `directive`) of the mod with that `source`.
- Types: `BlockedRequest`.

Example:

```ts
import { buildSandboxPolicy, collectContentHosts } from "./lib/core/sandbox/index.ts";

const contentHosts = collectContentHosts([
  "https://example.org/samples/mods/book_list/mod_conf.yaml",
  "https://example.org/samples/tiles/books/kallocain.md",
]);
// contentHosts is ["https://example.org"]

const policy = buildSandboxPolicy(contentHosts, grants.granted);
```

### Frame document, messages and channel

- `buildSandboxDocument(policy, theme)`: the `srcdoc` HTML of a mod's frame, with the policy, then the theme styles when `theme` (the mod's `ModThemeSetting`) is `"default"`, then the frame loader.
- `openSandboxChannel(frameTarget, params)`: posts `sandbox.connect` with `params` (`SandboxConnectParams`: `code`, `context`) and one port to the frame, and returns the engine's port.
- `readBlockedRequest(params)` and `readMountFailure(params)`: read the params of `sandbox.blocked` and `sandbox.mountFailed`, or `null` for params of the wrong shape.
- `SANDBOX_CONNECT_METHOD`, `SANDBOX_BLOCKED_METHOD`, `SANDBOX_MOUNT_FAILED_METHOD`: the message names, shared with the frame loader.
- Types: `SandboxConnectParams`.

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
