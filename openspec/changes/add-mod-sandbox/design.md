# Design

## Context

See proposal.md (Why) for motivation. The required behavior is in specs/mod-loading, specs/mod-sandbox, specs/mod-engine-api, specs/mod-stage and specs/default-mods.

Current state:

- `src/lib/tile/` exports `fetchFile`, `resolveLocation`, `parseYaml`, `loadTileCollection`, `buildTileValidator`, `validateTileCollection` and the plain types `Tile`, `TileCollection`, `TileIssue`, `IssueLevel`, `YamlMapping` and `YamlValue` from `index.ts`. Every tile and collection is plain data, so it can cross `postMessage` as it is. Compiled validators stay in the app. `resolveLocation(location, baseUrl)` returns a `URL` or raises `FileFetchError`.
- Half of `src/lib/tile/` is not about tiles: `file_fetcher.ts`, `local_files.ts`, `yaml_parser.ts` and `markdown_parser.ts` fetch and parse any file, and `tile_errors.ts` holds their errors (`FileFetchError`, `YamlParseError`, `MarkdownParseError`, and the internal `describeErrorCause`) next to the tile errors. `isYamlMapping`, `describeYamlValue` and `readPlainYaml` are used inside the module only. No other file in the tile module uses `describeErrorCause`.
- Errors follow one pattern (`tile_errors.ts`): extend `Error`, set `name`, take `(source, reason, options?)`, build the message in the constructor and expose `readonly source`. Format checks live in their own file next to the loader (`collection_format.ts`).
- `src/App.tsx` renders only the `OpenTesela` heading, and `src/main.tsx` mounts it in `StrictMode`. There is no router (D16). `docs/modules/README.md` plans per-object modules with Explore, Viewer and Maker components, `docs/modules/main/README.md` plans a page body "that also contains the sandbox where the mods will be loaded", and `docs/modules/lib/core/` plans `engine` and `storage`.
- `samples/` is outside `public/`, so `npm run build` does not copy it and the Playwright tests (which run on `npm run build && npm run preview`) cannot load it. Unit tests read it from disk through `src/test/sample_files.ts` (`SAMPLES_DIRECTORY_URL`) and `dependencies.test.ts`. Their virtual base URL is `https://example.org/samples/`. The three sample tiles have their `image` on `https://upload.wikimedia.org`.
- Vite serves the app as a single-page app (`appType: "spa"` by default). In dev and preview, a GET for a missing file whose `Accept` header contains `*/*`, which `fetch` sends by default, is answered with `index.html` and status 200 (checked in `htmlFallbackMiddleware` of the installed Vite). GitHub Pages answers 404.
- Oxlint enforces function declarations, named functions, explicit return types, no `forEach`/`reduce` and a maximum depth of 3. Review checks the rest of [docs/code_conventions.md](../../../docs/code_conventions.md).

Browser behavior, checked while preparing this design in the installed Playwright Chromium (1.64, chromium-1248) with a throwaway page using a sandboxed `srcdoc` frame and the D6 policy:

- The frame's `self.origin` is `"null"`. `localStorage`, `document.cookie` and `parent.document` throw `SecurityError`. `window.open` returns `null`. Setting `top.location.href` throws `SecurityError` and the page address does not change.
- A `MessagePort` sent with `frame.contentWindow.postMessage(message, "*", [port])` on the frame's `load` event reaches a listener the inline frame loader registered while parsing.
- The frame loader can `import()` a `blob:` URL that it made from code received over the port, with `script-src 'unsafe-inline' 'unsafe-eval' blob:`. `new Function` runs.
- Images load from hosts listed in `img-src` and are blocked from other hosts. `fetch` is blocked by `connect-src 'none'`, even for a content host. A dynamic `import()` of a remote URL is blocked under `script-src-elem`. An `<object>` is blocked under `object-src`.
- Each block fires `securitypolicyviolation` in the frame with `blockedURI` and `effectiveDirective` (`img-src`, `connect-src`, `script-src-elem`, `object-src`). For the `<object>`, `blockedURI` held only the origin.
- Blocked requests never reach a Playwright `page.route` handler. Blocked images and scripts fire `requestfailed` with error text `csp`, and blocked `fetch` calls fire no request event at all.
- When code in the frame sets `location.href`, the frame element fires a second `load` event in the page.
- `request.frame()` is the page's main frame for a `fetch` made by the page, and the sandboxed frame for the frame's own requests.

## Goals / Non-Goals

**Goals:**

- Keep every decision about trust in the app: the frame only runs what it is given, and the policy, the grants, the storage slot and every frame are decided and created outside it. A mod that opens another mod asks the engine; it never hosts the other mod.
- Keep mod code ordinary web code: a mod is one ES module, uses the DOM and the network like any web page, and the only OpenTesela-specific API is `engine.request` and `engine.on`.
- Keep the protocol the contract: JSON-RPC 2.0 messages of plain data, so the frame loader is a convenience and another host could implement the same messages.
- Keep the app composable: the Explore, Viewer and Maker components are default mods with no access beyond the engine API, so an instantiation can switch them off or replace them. Mods never own a route; a link names the mod it runs.
- Keep the app's addresses out of the engine and the mods: a mod asks for a mod, a collection and parameters, and only the stage turns them into a run link and a history entry. Two stage files know about addresses and history (D14, D16).
- Keep the pure parts (mod file format, references, grants, policy, reports, message reading, run links, stage state) separate from the browser parts (frame, channel, storage, history), so most of the change is tested in Node.
- Keep each module about one thing: shared file code in `lib/files`, trust decisions in `lib/core/permissions`, one request handler module per namespace, and the stage split into history, sandboxes and the controller that connects them.

**Non-Goals:**

- Hardening the frame against a mod that misbehaves on purpose beyond the sandbox and the policy: a mod can fake its own reports or spin the CPU of its frame. Both only affect that mod's own view.
- A list or a limit of open sandboxes. Hidden sandboxes keep running until they are closed or no history entry reaches them (D16).
- Init options. The default mod settings are a constant in `src/main/default_mods.ts` that the lib receives as input.
- Changing what the tile module does. Its file code moves to `src/lib/files/` unchanged (D1), and the rest is used through `src/lib/tile/index.ts` as it is.

## Decisions

### D1. Module layout

```
src/lib/files/             # moved from src/lib/tile/, unchanged apart from imports
  file_errors.ts         # FileFetchError, YamlParseError, MarkdownParseError, describeErrorCause
  file_fetcher.ts        # FetchedFile, FileFetchOptions, fetchFile, resolveLocation
  local_files.ts         # LocalFiles, PickedFile, indexLocalFiles
  yaml_parser.ts         # ParsedYaml, YamlMapping, YamlValue, parseYaml, isYamlMapping, describeYamlValue
  markdown_parser.ts     # ParsedMarkdown, Metadata, MetadataValue, parseMarkdown
  index.ts
src/lib/mod/
  mod_errors.ts          # ModFormatError
  mod_permissions.ts     # PermissionCategory, ModPermission, readModPermissions (D3)
  mod_format.ts          # ModFormat, readModFormat (D3)
  mod_reference.ts       # resolveModReference (D4)
  mod_loader.ts          # ModFile, LoadedMod, loadModFile, loadMod (D4)
  mod_issues.ts          # ModIssue
  index.ts
src/lib/core/permissions/
  mod_grants.ts          # ModGrants, grantModPermissions, describeDeniedPermission, checkOpenGrant (D5)
  index.ts
src/lib/core/sandbox/
  sandbox_policy.ts      # collectContentHosts, buildSandboxPolicy (D6)
  sandbox_reports.ts     # BlockedRequest, describeBlockedRequest (D7)
  sandbox_loader.js   # frame-side script, imported as text (D9)
  sandbox_document.ts    # buildSandboxDocument (D8)
  sandbox_messages.ts    # sandbox.* names, SandboxConnectParams, readBlockedRequest, readMountFailure (D10)
  sandbox_channel.ts     # openSandboxChannel (D11)
  index.ts
src/lib/core/storage/
  mod_storage.ts         # ModStorage, readModValue, writeModValue (D12)
  index.ts
src/lib/core/engine/
  engine_errors.ts       # ModSwitchedOffError, ModMethodError
  default_mod_settings.ts# DefaultModSettings, resolveDefaultModSettings, findSwitchedOffMod (D13)
  mod_messages.ts        # JSON-RPC types, error codes, readModMessage, builders (D10)
  mod_inspection.ts      # ModInspection, inspectMod (D13)
  mod_launch.ts          # RunLink, ModContext, ModLaunch, prepareModLaunch, loadModTiles (D13)
  mod_methods.ts         # ModMethodContext, ModMethod, ModMethodTable (D11)
  storage_methods.ts     # STORAGE_METHODS: storage.get, storage.set, isPlainData (D11)
  mods_methods.ts        # MODS_METHODS: mods.inspect, mods.open, readOpenParams (D11)
  mod_session.ts         # ModSession, connectModSession, pushTilesChanged, stopModSession (D11)
  index.ts
src/lib/core/stage/
  run_links.ts           # AppRoute, readAppRoute, buildRunLink (D14)
  stage_state.ts         # StageState, openStageEntry, restoreStageEntry, closeStageSandbox (D15)
  stage_history.ts       # StageRoute, readStageRoute, routeForLink, readHistoryPosition, writeStageEntry (D16)
  stage_sandboxes.ts     # SandboxRuntime, launchSandbox, attachSandboxFrame, ... (D16)
  stage_controller.ts    # Stage, createStage, followHistory, closeSandbox, reloadTiles, ... (D16)
  index.ts
src/main/
  default_mods.ts        # DEFAULT_MODS (D20)
  stage/
    StageView.tsx        # every sandbox, one visible (D17)
    StageBar.tsx         # title, version, source, Reload tiles, ×
    SandboxFrame.tsx     # the iframe, attached to the stage on load
    IssueList.tsx
public/samples/          # moved from samples/ (D18), plus mods/book_list/ (D19)
public/default_mods/     # mod_explorer/, mod_viewer/ (D20)
```

Imports go one way:

- `src/main` → `src/lib/core/stage` → `src/lib/core/engine`;
- `src/lib/core/engine` → `src/lib/core/sandbox`, `src/lib/core/storage`, `src/lib/core/permissions`, `src/lib/mod`, `src/lib/tile` and `src/lib/files`;
- `src/lib/core/sandbox` → `src/lib/core/permissions` and `src/lib/mod`;
- `src/lib/core/permissions` → `src/lib/mod`;
- `src/lib/mod` → `src/lib/tile` (for `IssueLevel`) and `src/lib/files`;
- `src/lib/tile` → `src/lib/files`.

Each module is imported only through its `index.ts`. There are no cycles: the engine reaches the stage only through the `onOpenLink` callback the stage gives each session (D11). Imports use explicit extensions, so `src/main.tsx` and `src/main/` do not clash.

The split follows `docs/modules/` and the architecture diagram in `docs/opentesela_spec.md`, which shows the Sandbox, the Core Engine and the Storage as separate components:

- `lib/files` fetches and parses any file: locations, local files, plain YAML, markdown with frontmatter.
- `lib/mod` is plain data about a mod: format, references, declared permissions, the mod loader, issues.
- `lib/core/permissions` decides what a mod is granted: the site-owner rule and the `open` check.
- `lib/core/sandbox` isolates the mod's code: policy, document, frame loader, its messages and channel, blocked request reports.
- `lib/core/engine` is the mod's trusted backend: launch, inspection, one handler module per request namespace, and the session that dispatches to them.
- `lib/core/storage` holds the data.
- `lib/core/stage` keeps the open sandboxes, the addresses and the history.
- `src/main` is the page layout of `docs/modules/main/` that only renders the stage.

The file code moves to `lib/files` with `git mv`, so its history is kept. `tile_errors.ts` keeps `CollectionFormatError`, `TileTypeError` and `TileValidationError`. The other three errors and `describeErrorCause` move to `file_errors.ts`, with their tests from `tile_errors.test.ts`. `src/lib/files/index.ts` exports what the tile index exports today for those files (`fetchFile`, `resolveLocation`, `indexLocalFiles`, `parseYaml`, `parseMarkdown`, the three errors and their types) plus `isYamlMapping` and `describeYamlValue`, which the mod file checks need (D3). `readPlainYaml` and `describeErrorCause` stay internal. The tile index stops exporting the moved names, so each name has one entry point.

- Alternative considered: everything in `src/lib/mod/`. Rejected: the engine and the storage are the parts the docs already name as core, and the engine has other callers (the stage, later mosaics).
- Alternative considered: keep the file code in `lib/tile` and export the YAML helpers from its index (the first version of this change). Rejected: mods, and later mosaics, would depend on the tile module for code that is not about tiles.
- Alternative considered: re-exporting the moved names from the tile index. Rejected: two entry points for one name, and nothing outside the repository imports the tile module yet.
- Alternative considered: grants in `lib/mod`. Rejected: they are a trust decision, not data about a mod, and the init options change will make them depend on the default mods folder (Risks), which `lib/mod` must not import.
- Alternative considered: grants in `lib/core/engine`. Rejected: the sandbox's blocked request reports need them (D7), and the sandbox importing the engine would reverse the import direction.
- Alternative considered: the sandbox files in `src/lib/mod/`. Rejected: it mixes data about a mod with its isolation, and puts frame-side code next to the loader.
- Alternative considered: the sandbox files in `src/lib/core/engine/`. Rejected: the engine and the frame sit on opposite sides of the trust boundary, and one folder for both would hide it.
- Alternative considered: the stage inside the engine. Rejected: the engine serves one mod at a time (launch, session); the stage decides which sandboxes exist, which one is visible, and how they map to history entries. Keeping it apart keeps the engine free of navigation.

### D2. Data shapes (the downstream contract)

```ts
// lib/mod
type PermissionCategory = "show" | "connect" | "embed" | "code" | "open";
interface ModPermission { category: PermissionCategory; host: string; reason: string } // host "*" only for "open"

interface ModFile {
  source: string;            // resolved URL of mod_conf.yaml: the mod's identity
  name: string; title: string; version: string; description: string;
  entrypoint: string;        // resolved URL
  typeSource: string | null; // resolved type_path
  sampleCollection: string | null; // resolved sample_collection
  config: YamlMapping;
  permissions: ModPermission[];
}
interface LoadedMod extends ModFile { code: string } // entrypoint text

interface ModIssue { level: IssueLevel; source: string; message: string } // same shape as TileIssue

// lib/core/permissions
interface ModGrants { granted: ModPermission[]; denied: ModPermission[] }

// lib/core/engine
interface RunLink { mod: string; collection: string | null; params: Record<string, string> } // what to run, not an address

interface ModContext {
  mod: { source: string; name: string; title: string; version: string; description: string };
  config: YamlMapping;
  params: Record<string, string>;
  tiles: Tile[];
  issues: TileIssue[];
  permissions: ModGrants;
}

interface ModInspection {
  source: string; name: string; title: string; version: string; description: string;
  typeSource: string | null; sampleCollection: string | null;
  config: YamlMapping;
  permissions: ModGrants;    // what the mod would get if it were opened
}

interface ModLaunch {
  mod: LoadedMod;
  collectionSource: string | null;
  context: ModContext;
  contentHosts: string[];
  sandboxDocument: string;   // srcdoc HTML
  issues: ModIssue[];        // permission issues found before start
}
```

All of them are plain data. `ModIssue` reuses `IssueLevel` and has the shape of `TileIssue`, so the stage lists both in one list. It has its own name because it is about a mod, not a tile.

`source` is the mod's identity everywhere: grants (D5), storage slots (D12), issue sources and the switched-off check (D13). A name is chosen by the mod author and can be copied, a source cannot. Every reference to one mod file resolves to the same source (D4).

### D3. Reading the mod file

`readModFormat(parsedYaml): ModFormat` follows `collection_format.ts`: one named function per field, checks in field order, and `ModFormatError(source, reason)` at the first failure. It uses `isYamlMapping` and `describeYamlValue` from the YAML parser, imported from `src/lib/files/index.ts` (D1). Reasons:

- `a "mod" mapping is required`
- `"name"`, `"version"`, `"entrypoint"` → `"<field>" must be a non-empty string`
- `"title"`, `"description"` → `"<field>" must be a string`
- `"type_path"`, `"sample_collection"` → `"<field>" must be a non-empty string`
- `"config"` → `"config" must be a mapping`
- `"schema"` present → `inline "schema" is not supported yet, use "type_path" with the path of a tile type file`

`readModPermissions(value, source)` lives in `mod_permissions.ts`:

- `permissions` absent → `[]`. Not a mapping → `"permissions" must be a mapping`.
- Each key must be one of the categories: `"permissions.shows" is not a permission category, use one of: show, connect, embed, code, open`.
- Each category must be a list, and each entry a mapping with non-empty string `host` and `reason`: `"permissions.connect" entry 2: "reason" must be a non-empty string`. Entries count from 1, as in the collection loader.
- A host is an origin when `new URL(host)` succeeds, the protocol is `http:` or `https:`, the host name has no `*`, and `url.origin === host`. That last check rejects paths, queries, fragments, user info and trailing slashes in one comparison. Reason: `"permissions.show" entry 1: host "https://example.org/images" must be an origin such as "https://example.org"`.
- In `open`, the host can also be exactly `"*"`. Elsewhere: `"permissions.show" entry 1: host "*" is only allowed in permissions.open`.
- The output follows the category order `show`, `connect`, `embed`, `code`, `open`, whatever the key order in the file, so policies and messages do not depend on how the author ordered the keys.

- Alternative considered: accepting wildcards (`https://*.example.org`), which CSP supports. Rejected for now: a wildcard is harder to explain to a user, and nothing needs it yet. Adding it later only widens what is accepted. `"*"` in `open` is the one exception: the explorer and the viewer open mods from links anyone can share, and `open` is not a CSP directive, so it widens nothing the browser enforces.
- Alternative considered: `reason` optional. Rejected: it is the text the future permission prompt shows, and making it required later would break existing mods.

### D4. Mod references and loading

`resolveModReference(reference, options: ModReferenceOptions): string` (`mod_reference.ts`), with `ModReferenceOptions = { baseUrl?: string; defaultModsFolder?: string }`:

1. A reference without `/` that matches `^[a-z][a-z0-9_]*$` is a default mod name: `new URL(name + "/mod_conf.yaml", defaultModsFolder)`. Without a folder it raises `FileFetchError(reference, "a default mod name needs a default mods folder")`.
2. Otherwise `resolveLocation(reference, baseUrl)`. When the URL's `pathname` ends in `.yaml` or `.yml`, it is the mod file.
3. Otherwise it is the mod's folder: a `/` is added to the path when it is missing, then `new URL("mod_conf.yaml", folderUrl)`. The folder's query and fragment are dropped.

The result is an `href`, so all the forms of one mod give the same source. Relative paths must contain a `/` (`./book_list`) to be read as locations; the docs say so.

`loadModFile(reference, options?: ModLoadOptions): Promise<ModFile>` and `loadMod(reference, options?): Promise<LoadedMod>`, with `ModLoadOptions = FileFetchOptions & { defaultModsFolder?: string }`:

1. `resolveModReference` → `fetchFile(href, options)` → `parseYaml` → `readModFormat`.
2. `resolveLocation` of `entrypoint`, and when present of `type_path` and `sample_collection`, against the mod file. The mod file is the base, as for tiles in a collection.
3. `loadMod` then calls `fetchFile(entrypointHref, options)` for the code.
4. Build the result in a named variable. `config` comes from the parsed YAML of this call, so two loads never share objects.

Fetch, YAML and format errors propagate unchanged (`FileFetchError`, `YamlParseError`, `ModFormatError`). The type file and the sample collection are not fetched here: the engine builds the validator in D13, and the sample collection is only a location the viewer offers to run with.

- Why the folder form: a mod is a folder with a standard file name, so a link can point to the folder, as a web server serves `index.html`. Accepting the file itself keeps other file names possible.
- Alternative considered: a trailing `/` required for folders. Rejected: `./samples/mods/book_list` is what users write, and the `.yaml`/`.yml` check is unambiguous.

### D5. Grants: the site-owner rule

Grants live in `lib/core/permissions/mod_grants.ts` (D1): `lib/mod` says what a mod declares, and this module decides what it gets. The future permission prompt and the init options change only this module.

`grantModPermissions(mod, appOrigin): ModGrants`. When `new URL(mod.source).origin === appOrigin`, every declared permission is granted. Otherwise all of them are denied. The stage passes `window.location.origin`, and tests pass any origin. Default mods are in `./default_mods/` on the app's origin, so they get their `open` grants.

`describeDeniedPermission(permission)` builds the warning text, for example: `Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites run without extra permissions for now.` The verbs match the future prompt: show content from, exchange data with, embed pages from, load code from, open mods from. `"*"` reads as "any site".

`checkOpenGrant(mod, grants, targetSource): string | null` returns `null` when a granted `open` permission has host `"*"` or the target's origin, and otherwise the denial message for `PERMISSION_DENIED` (D10):

- Not declared: `Opening mods from https://mods.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.`
- Declared but denied: `Opening mods from https://mods.example.net: the mod declares it in permissions.open, but the permission was not granted.`

- Why the same origin: the site owner chose to publish the files under the app's origin, as a website chooses its own scripts. A link to a mod on another origin can come from anyone.
- Alternative considered: granting `show` to every mod, since it mostly reveals the user's IP. Rejected: `show` hosts can still carry data in URLs, and the rule is easier to explain with no exceptions.

### D6. Content policy

`collectContentHosts(sources): string[]` keeps the `http:` and `https:` origins of the given URLs, without duplicates, sorted. D13 passes the mod source, the entrypoint, the type source, the collection source (when there is one) and every tile source. The sample collection is not a content host unless the mod was opened with it.

`buildSandboxPolicy(contentHosts, granted): string` returns the policy in this directive order, with the hosts of each directive sorted and without duplicates. `open` permissions are not part of the policy: the engine enforces them (D11).

| Directive | Sources |
|---|---|
| `default-src` | `'none'` |
| `script-src` | `'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:` + `code` hosts |
| `style-src` | `'unsafe-inline' data: blob:` + content hosts + `show` hosts |
| `img-src` | `data: blob:` + content hosts + `show` hosts |
| `media-src` | `data: blob:` + content hosts + `show` hosts |
| `font-src` | `data: blob:` + content hosts + `show` hosts |
| `connect-src` | `connect` hosts, or `'none'` |
| `frame-src` | `embed` hosts, or `'none'` |
| `base-uri` | `'none'` |
| `form-action` | `'none'` |

- `'unsafe-inline'` runs the frame loader. `blob:` runs the mod module (D9). `'unsafe-eval'` and `'wasm-unsafe-eval'` let mods use libraries that compile code at runtime. The sandbox is the security boundary, not script restrictions: a mod already runs arbitrary code. `script-src` only decides where code can be fetched from, because a script URL is also a way to send data out.
- Workers fall back to `script-src`, so `blob:` workers are allowed and remote workers need `code`.
- `object-src`, `worker-src` from remote hosts and the other directives fall back to `default-src 'none'`.
- Deterministic output makes the policy easy to test and to compare between runs.

- Alternative considered: an `engine.fetch` request instead of `connect-src`. Rejected during exploration: most libraries create their own `<img>` and `fetch` calls, and the browser enforces a CSP in the same way for all of them.

### D7. Reporting blocked requests

The frame loader forwards each `securitypolicyviolation` as `{ blockedUrl, directive }` (D9). `describeBlockedRequest(blocked, mod, grants): ModIssue` maps the directive to a category:

| Directive | Category |
|---|---|
| `img-src`, `media-src`, `font-src`, `style-src`, `style-src-elem`, `style-src-attr` | `show` |
| `connect-src` | `connect` |
| `frame-src`, `child-src` | `embed` |
| `script-src`, `script-src-elem`, `script-src-attr`, `worker-src` | `code` |

The blocked origin is `new URL(blockedUrl).origin`. Browsers sometimes report only the origin (checked for `<object>`), so the origin is all the message relies on. Messages, all `warning` with the mod's source:

- Not declared: `Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml.` (the noun follows the category: image or media, connection, embedded page, script).
- Declared but denied: `Blocked image request to https://upload.wikimedia.org: the mod declares it in permissions.show, but the permission was not granted.`
- No category, or a blocked URL that is not a URL such as `inline` or `eval`: `Blocked by the sandbox policy (object-src).`

The session (D11) reports each message once, keyed like the collection validator's issue keys (`JSON.stringify([level, source, message])`), because a page of images could otherwise produce hundreds of equal issues.

### D8. The sandbox document

`buildSandboxDocument(policy): string`:

```html
<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="POLICY">
<script>FRAME_LOADER</script>
</head><body></body></html>
```

The policy comes first because a `<meta>` policy only applies to what follows it. The mod code is not in the document: it arrives over the channel (D9), so it never needs HTML escaping. The policy holds only keywords and checked origins, and a test checks that the frame loader text has no `</script`, so the document needs no escaping either. React sets `srcDoc` as an attribute, with its own escaping.

The frame gets `sandbox="allow-scripts"`, never with `allow-same-origin`: with both flags, a frame whose document comes from the app could remove its own sandbox.

- Alternative considered: `src="sandbox.html"`. Rejected: an embedding page would have to host that file at a known address (portability), and the opaque origin would need CORS to load it.
- Alternative considered: a `blob:` or `data:` URL as `src`. Rejected: `srcdoc` needs no URL lifetime handling and has no length limit.

### D9. The frame loader

The frame loader is the only script the app puts in a mod's frame: it receives the mod's code and context from the engine, gives the mod its `engine` API object, and starts the mod. It is not the mod loader (D4), which fetches mod files in the app.

`sandbox_loader.js` is plain browser JavaScript (ES2023, no imports), imported as text with Vite's `?raw` (typed by `vite/client`) and inlined by D8. It follows the code conventions. It uses `Promise.withResolvers()` for pending requests, so no function is defined inside another.

1. While the document is parsed, it listens for `securitypolicyviolation` on `document` (it keeps reports until connected), and for `message` on `window`.
2. It accepts only the first `message` whose `source` is `window.parent`, whose data is a `sandbox.connect` notification and which carries one port. Later messages are ignored.
3. It builds the frozen engine API object: `request(method, params)` sends a request with ids counting from 1 and keeps the resolvers in a `Map`. `on(event, handler)` appends the handler to that event's list.
4. On the port: a response settles its pending request, either resolving with `result` or rejecting with an `Error` that has the response's `message` and `code`. A notification calls the handlers of its method in order. A handler that throws is logged with `console.error`, and the other handlers still run.
5. It turns `params.code` into a `blob:` URL (`text/javascript`), `import()`s it, revokes the URL, checks that `default` is a function and calls `mount(engine, params.context)`, awaiting the result. A missing default export, an import error, or a throw or rejection becomes a `sandbox.mountFailed` notification with the error message.

Messages from the frame to the engine are `sandbox.blocked { blockedUrl, directive }` and `sandbox.mountFailed { message }`. They are notifications, so the engine never answers them. Their names and params, and the `sandbox.connect { code, context }` params, are defined once in `sandbox_messages.ts`, next to the frame loader that sends and receives them (D10).

- Alternative considered: writing the frame loader in TypeScript and reading its text with `Function.prototype.toString`. Rejected: minification makes that text unreliable. The frame loader is small and covered by the Playwright tests.
- Alternative considered: inlining the mod code as `<script type="module">` in `srcdoc`. Rejected: an inline module cannot be imported, so its default export cannot be called, and the code would need HTML escaping.
- Alternative considered: a global `window.engine` instead of `mount(engine, context)`. Rejected: an explicit argument is easier to test, and no global name is reserved in the mod's page.

### D10. Messages

`mod_messages.ts` defines the JSON-RPC 2.0 types, the error codes `INVALID_REQUEST = -32600`, `METHOD_NOT_FOUND = -32601`, `INVALID_PARAMS = -32602`, and in the server error range `STORAGE_FAILED = -32000`, `LOAD_FAILED = -32001`, `PERMISSION_DENIED = -32002` and `MOD_SWITCHED_OFF = -32003`, builders for responses and notifications, and `readModMessage(data)`. It sorts incoming data into:

- a request: `jsonrpc === "2.0"`, a string or number `id`, a string `method`, and `params` absent or a mapping;
- a notification: the same, without `id`;
- an invalid request: anything else with a string or number `id`, answered with `-32600`;
- ignored: anything else.

Method names are looked up with `Object.hasOwn` on the handler table, so `toString` or `__proto__` are unknown methods (same reason as D3 of `add-tile-validators`).

Methods in this change: `storage.get`, `storage.set`, `mods.inspect`, `mods.open`. Events: `tiles.changed`. Frame loader messages: `sandbox.connect` (engine to frame, on `window`, carries the port), plus `sandbox.blocked` and `sandbox.mountFailed` (frame to engine). The `sandbox.` prefix is reserved for the frame loader.

`mod_messages.ts` knows only the JSON-RPC envelope and that the `sandbox.` prefix is reserved. The frame loader messages belong to the sandbox: `lib/core/sandbox/sandbox_messages.ts` exports their method names, `SandboxConnectParams`, and `readBlockedRequest(params): BlockedRequest | null` and `readMountFailure(params): string | null`, which return `null` for params of the wrong shape. A change to the frame loader protocol then touches only the sandbox module.

### D11. The channel, the request handlers and the session

Three parts, each in its own file, so that a new request namespace (`tiles.*`, `mosaics.*`) adds one handler module and does not grow the session.

**The channel** (`lib/core/sandbox/sandbox_channel.ts`):

```ts
openSandboxChannel(frameTarget: Pick<Window, "postMessage">, params: SandboxConnectParams): MessagePort
```

It creates a `MessageChannel`, posts the `sandbox.connect` notification with `params` (`{ code, context }`) to the frame with `"*"` as the target origin and `[port2]` as transfer, and returns `port1`. `"*"` is required because an opaque origin cannot be named, and the message goes to the frame object the app itself created. The handshake sits next to the frame loader that answers it (D9).

**The request handlers** (`lib/core/engine/mod_methods.ts`, `storage_methods.ts`, `mods_methods.ts`):

```ts
interface ModMethodContext {
  mod: LoadedMod;
  grants: ModGrants;
  storage: ModStorage;
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;             // D13
  fetchOptions: FileFetchOptions;                   // baseUrl is the app's address
  onOpenLink: (link: RunLink) => boolean;           // false when the sandbox is not the visible one
}
type ModMethod = (context: ModMethodContext, params: YamlMapping) => Promise<YamlValue>;
type ModMethodTable = Record<string, ModMethod>;
```

Each namespace exports one table (`STORAGE_METHODS`, `MODS_METHODS`) of module-level named functions. A handler resolves with the `result`, or throws `ModMethodError(code, message)` (`engine_errors.ts`), which the session turns into the error response. Each handler turns the errors it expects into a `ModMethodError`, as listed below. Handlers know nothing about ports or messages, so they are tested by calling them with a plain context.

- `storage.get` checks that `key` is a non-empty string, `storage.set` also checks that `value` is plain data (`isPlainData`: null, strings, booleans, finite numbers, arrays and objects whose prototype is `Object.prototype` or `null`, checked recursively in separate named functions to stay within the depth limit). A storage error becomes `STORAGE_FAILED` with its message.
- `mods.inspect` checks that `mod` is a non-empty string, then `resolveModReference` with the app's address and the default mods folder (a resolve error is `INVALID_PARAMS`), then `checkOpenGrant` (`PERMISSION_DENIED`), then `findSwitchedOffMod` (`MOD_SWITCHED_OFF`), and only then `inspectMod` (D13). A load error becomes `LOAD_FAILED` with its message.
- `mods.open` reads its params with `readOpenParams` into a `RunLink`: `mod` a non-empty string, `collection` absent, `null` or a non-empty string (absent becomes `null`), and `params` absent (becomes `{}`) or a mapping whose values are strings. Each failure is `INVALID_PARAMS` with the field, for example `"params.target" must be a string`. It then resolves `mod` and runs the same grant and switched-off checks, and calls `onOpenLink(link)`; `false` becomes `PERMISSION_DENIED` with `only the visible mod can open mods`. The answer is `null`. The new mod's load errors belong to its own sandbox.

The checks run before any fetch, so a mod without the grant cannot make the engine request a URL of its choice.

**The session** (`lib/core/engine/mod_session.ts`):

```ts
interface ModSessionOptions {
  storage: ModStorage;
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;
  fetchOptions: FileFetchOptions;
  onIssue: (issue: ModIssue) => void;
  onOpenLink: (link: RunLink) => boolean;
}
connectModSession(frameTarget: Pick<Window, "postMessage">, launch: ModLaunch, options: ModSessionOptions): ModSession
pushTilesChanged(session: ModSession, tiles: Tile[], issues: TileIssue[]): void
stopModSession(session: ModSession): void
```

`connectModSession` calls `openSandboxChannel` with the launch's code and context, builds the `ModMethodContext` once, and sets `port.onmessage` to `handleModPortMessage.bind(undefined, session)`, so the handler is a module-level named function, not a closure. It looks methods up in `ENGINE_METHODS`, the union of the namespace tables, with `Object.hasOwn` (D10). `sandbox.blocked` and `sandbox.mountFailed` are read with the sandbox module's readers and become issues through `describeBlockedRequest`; params of the wrong shape are ignored.

`ModSession` is a record: the port, the method context, the `onIssue` callback, the set of reported issue keys and a `stopped` flag. It is mutable because a channel is state. After `stopModSession`, the port is closed, and later pushes, messages and answers to pending requests do nothing.

The engine never listens on `window`, which is what makes window messages from a frame ignored (spec).

- Alternative considered: one handler table in `mod_session.ts`. Rejected: every new namespace would grow the session file, and the handlers could only be tested over a channel.

### D12. Storage slots

```ts
type ModStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
readModValue(storage: ModStorage, modSource: string, key: string): YamlValue | null
writeModValue(storage: ModStorage, modSource: string, key: string, value: YamlValue | null): void
```

The storage key is `"opentesela.mod-storage:" + JSON.stringify([modSource, key])`. The JSON array cannot collide the way `source + ":" + key` could, since both parts can contain `:`. Values are stored as JSON. `null` removes the key. The app passes `window.localStorage`, and the tests pass a `Map`-backed object.

- Alternative considered: IndexedDB. Rejected for the proof of concept: `localStorage` is synchronous and small. The slot API is already asynchronous through requests, so moving to IndexedDB later does not change the protocol.

### D13. Default mod settings, inspecting and launching a mod

```ts
interface DefaultModSettings { folder: string; home: string; switchedOff: string[] }
interface ResolvedDefaultModSettings { folder: string; home: string; switchedOff: { name: string; source: string }[] }
resolveDefaultModSettings(settings: DefaultModSettings, baseUrl: string): ResolvedDefaultModSettings
findSwitchedOffMod(source: string, defaults: ResolvedDefaultModSettings): string | null // the name

inspectMod(source: string, appOrigin: string, options: FileFetchOptions): Promise<ModInspection>

interface ModLaunchRequest { link: RunLink; appOrigin: string; defaults: ResolvedDefaultModSettings }
prepareModLaunch(request: ModLaunchRequest, options: FileFetchOptions): Promise<ModLaunch>
loadModTiles(mod: LoadedMod, collectionLocation: string, options?: FileFetchOptions): Promise<ModTiles>
// ModTiles: { collectionSource, tiles, issues }
```

`resolveDefaultModSettings` resolves the folder against the app's address (with a trailing `/`) and the source of each switched-off name with `resolveModReference`. `findSwitchedOffMod` compares sources, so a switched-off mod is refused whatever reference names it.

`inspectMod` runs `loadModFile` and `grantModPermissions`, and builds the `ModInspection` (with `config` structured-cloned). The entrypoint is not fetched.

`loadModTiles` runs `loadTileCollection`. When `mod.typeSource` is not `null`, it builds the validator and runs `validateTileCollection`, then keeps the tiles whose `types` include the validator's `typeName`. The issues are the validated collection's issues, so tiles left out appear as warnings. The validator is built on each call (about 2 ms, D5 of `add-tile-validators`). The stage's "Reload tiles" calls it again and passes the result to `pushTilesChanged`.

`prepareModLaunch`:

1. `resolveModReference(link.mod)`, then `findSwitchedOffMod`; a switched-off mod raises `ModSwitchedOffError(name, source)`, with the message `The default mod "mod_viewer" is switched off.`, before any fetch.
2. `loadMod`, then `loadModTiles` when `link.collection` is not `null`, otherwise no tiles, no issues and no collection request.
3. `grantModPermissions` and `collectContentHosts`, then `buildSandboxPolicy` and `buildSandboxDocument`.
4. It builds the context, with `config` structured-cloned from the loaded mod and `params` copied from the link, and one permission issue per denied permission.

Every error propagates. Each error message names its source, so the stage shows `error.message`. Content hosts are fixed at launch. Tiles reloaded later from a new host can be blocked, and the block is reported (D7).

### D14. Run links

`RunLink` (D2) is what to run: a mod reference, a collection location and parameters. It is the engine's type, used by launches and by `mods.open`. Turning it into an address and back is the stage's job, in `lib/core/stage/run_links.ts`:

```ts
type AppRoute = { page: "home" } | { page: "run"; link: RunLink };
readAppRoute(hash: string): AppRoute
buildRunLink(link: RunLink): string   // "#/run?mod=...&collection=...&key=value"
```

`readAppRoute` returns a run route when the part before `?` is `#/run` and `mod` is a non-empty string. `collection` is `null` when missing or empty. The other parameters, in link order with the first value of each key, become `params`. Every other hash, including `""`, `#/` and old links such as `#/mods/view`, is `home`. Parameters are read with `URLSearchParams`, so encoded values work. `buildRunLink` writes `mod`, then `collection` when present, then the params, with `URLSearchParams` encoding. Only `stage_history.ts` (D16) calls them. Neither the engine nor the mods know the address format: mods send `mods.open` with a `RunLink`'s fields (D11).

Values stay as written, and relative ones are resolved against the app's address (`document.baseURI`) when the mod is launched or inspected. So a reference means the same in the address bar, in a `mods.open` request and after a reload, and the app keeps working under a sub-path such as GitHub Pages' `/<repo>/`. A mod that wants to pass a location in a parameter passes an absolute one, such as the `source` from `mods.inspect`.

- Why mods never own a route: a link names exactly the mod file it runs, so no mod can take another's place, and switching a default mod off or replacing it needs no route table. Default mods keep short links through their names (D4).
- Alternative considered: one route per default mod (`#/mods`, `#/mods/view`) mapped by an app table. Rejected: it duplicates what a mod reference already says, and links would mean different things in different instantiations.
- Alternative considered: `mods.open` with a run link string (`{ link: "#/run?mod=..." }`), and the run link functions in the engine (the first version of this change). Rejected: every mod that opens mods would copy the app's address format, another host implementing the protocol would have to use the same format, and future app pages (`docs/modules/main/`: Settings, About) would make the engine read app navigation.

### D15. Stage state

`stage_state.ts` is pure: each function takes the state and returns a `StageChange { state, opened: StageSandbox | null, closedIds: string[] }`. The controller (D16) applies the side effects.

```ts
interface StageSandbox { id: string; hash: string; link: RunLink; openerId: string | null; isHome: boolean }
interface StageEntry { position: number; sandboxId: string }
interface StageState { sandboxes: StageSandbox[]; entries: StageEntry[]; position: number; nextNumber: number }
```

- Ids are `sandbox-1`, `sandbox-2`, … from `nextNumber`, unique in the page. Mods never choose them.
- `sandboxes` keeps creation order, so rendering never moves a frame (D17).
- `entries` maps history positions to sandboxes. The visible sandbox is the one of the entry at `position`.
- `openStageEntry(state, hash, link, openerId, isHome)`: a new sandbox at `position + 1`. Entries after the current position are dropped, as a browser drops forward entries, and every sandbox that no remaining entry points to is in `closedIds`.
- `restoreStageEntry(state, position, hash, link, isHome)`: when the entry at that position points to an open sandbox, it becomes visible. Otherwise a new sandbox takes that entry (after a reload, or when its sandbox was closed), and forward entries are kept.
- `closeStageSandbox(state, id)`: removes the sandbox. When it was visible, the current entry points to the opener when it is still open; otherwise `opened` is a new home sandbox for the current entry. Entries that pointed to the closed sandbox stay, and are restored by `restoreStageEntry` when visited.

### D16. Stage controller, history and sandboxes

```ts
interface StageOptions {
  history: Pick<History, "state" | "pushState" | "replaceState">;
  defaults: DefaultModSettings;
  appOrigin: string;
  baseUrl: string;
  storage: ModStorage;
  fetch?: typeof globalThis.fetch;
}
createStage(options: StageOptions): Stage
followHistory(stage: Stage, hash: string, historyState: unknown): void // on start and on popstate
openStageLink(stage: Stage, link: RunLink, openerId: string): boolean  // behind onOpenLink
closeSandbox(stage: Stage, id: string): void
reloadTiles(stage: Stage, id: string): Promise<void>
attachFrame(stage: Stage, id: string, frameTarget: Pick<Window, "postMessage">): void
frameLoadedAgain(stage: Stage, id: string): void
readStageSnapshot(stage: Stage): StageSnapshot
subscribeStage(stage: Stage, listener: () => void): () => void
```

This is the stage's public API, exported from `lib/core/stage/index.ts`. Behind it, the work is split into three files, so each has one reason to change:

- `stage_history.ts`: addresses and history entries. The only file that calls `History` and the run link functions (D14).
- `stage_sandboxes.ts`: the runtime of one sandbox. Launch, frame, session, issues, reload and stop.
- `stage_controller.ts`: connects them. It applies each `StageChange` (D15) by writing history through `stage_history.ts`, starting and stopping runtimes through `stage_sandboxes.ts`, and publishing a snapshot.

`Stage` is the mutable record of the stage: the `StageState`, a `Map` of sandbox runtimes by id, the history, the services the runtimes need and the listeners. Every change builds a new frozen `StageSnapshot`, so React reads it with `useSyncExternalStore`.

**History** (`stage_history.ts`):

```ts
type StageHistory = Pick<History, "state" | "pushState" | "replaceState">;
interface StageRoute { hash: string; link: RunLink; isHome: boolean }
readStageRoute(hash: string, homeMod: string): StageRoute
routeForLink(link: RunLink): StageRoute               // hash from buildRunLink, isHome false
readHistoryPosition(historyState: unknown): number | null
writeStageEntry(history: StageHistory, mode: "push" | "replace", position: number, hash: string): void
```

- Each entry the stage writes has `history.state` set to `{ opentesela: { position } }`. The browser keeps this state across reloads, so positions stay consistent after a reload. `readHistoryPosition` returns `null` for any other state.
- `readStageRoute` reads the hash with `readAppRoute`. Home becomes the home mod's link, `{ mod: homeMod, collection: null, params: {} }`, with hash `#/`. A run route keeps its hash.
- `followHistory` (controller) reads the route and the position:
  - With a position: `restoreStageEntry`.
  - Without one (first load, an address typed by the user, a link followed in the page): `openStageEntry` and `writeStageEntry("replace", ...)` with the next position. On the very first load the position is `0`.
- `openStageLink` (controller, from `mods.open`) returns `false` when the opener is not the visible sandbox. Otherwise it takes the route from `routeForLink`, runs `openStageEntry` with the opener's id and `writeStageEntry("push", ...)` with the route's hash. `pushState` fires no `popstate`, so the entry is never handled twice.
- `closeSandbox` (controller) stops the runtime, applies `closeStageSandbox` and `writeStageEntry("replace", ...)` with the hash of the sandbox now shown.
- `main.tsx` listens to `popstate` and calls `followHistory(stage, location.hash, history.state)`. Fragment navigations fire `popstate` too, so `hashchange` is not needed.

**Sandboxes** (`stage_sandboxes.ts`):

```ts
interface SandboxServices {
  defaults: ResolvedDefaultModSettings;
  appOrigin: string;
  fetchOptions: FileFetchOptions;
  storage: ModStorage;
  onChange: () => void;                                  // the controller publishes a snapshot
  onOpenLink: (openerId: string, link: RunLink) => boolean;
}
launchSandbox(sandbox: StageSandbox, services: SandboxServices): SandboxRuntime
attachSandboxFrame(runtime: SandboxRuntime, frameTarget: Pick<Window, "postMessage">, services: SandboxServices): void
stopSandbox(runtime: SandboxRuntime, issue: ModIssue | null): void
reloadSandboxTiles(runtime: SandboxRuntime, services: SandboxServices): Promise<void>
```

`SandboxRuntime` is a mutable record: the sandbox id, the status (`loading`, `failed`, `running` or `stopped`), the launch, the session, the issues and the error message.

- `launchSandbox` starts `loading` and runs `prepareModLaunch`. When it settles and the runtime is not stopped, it becomes `running` with the launch's issues, or `failed` with `error.message`. A launch that settles for a stopped runtime is ignored.
- `attachSandboxFrame` is called by the controller's `attachFrame` on the frame's first `load`. It runs `connectModSession`, with `onIssue` adding to the runtime's issues and `onOpenLink` bound to the runtime's id.
- `stopSandbox` stops the session and sets `stopped`. The controller's `frameLoadedAgain` calls it with the issue `The mod left its page and was stopped.`, which removes the frame from the snapshot. Closing a sandbox, also through `closedIds`, calls it with `null` and drops the runtime from the map.
- `reloadSandboxTiles` runs `loadModTiles` with the launch's collection source and `pushTilesChanged`, and replaces the collection part of the runtime's issues.

The three files are browser-free apart from the `postMessage` targets and the `History` subset they receive, so each is tested in Node: history with a fake history, sandboxes with fake frame targets, and the controller with both.

- Alternative considered: one `stage_controller.ts` for everything (the first version of this change). Rejected: history, sandbox lifecycle and the snapshot store change for different reasons, and a router or a new page would have to edit the file that runs mods.
- Alternative considered: TanStack Router, which `docs/stack.md` listed. Rejected for this change, and removed from `docs/stack.md`:
  - The app has one route (D14). Nested routes, loaders, preloading and code splitting would go unused, and typed search params are about 50 lines in `run_links.ts`.
  - The stage alone must decide what each history entry means: show an open sandbox, or open its link in a new one (D15). With a router, the router resolves the navigation first and the stage reacts, so two layers read one navigation. TanStack Router also keeps its own keys in `history.state`, where the stage keeps its positions (Risks).
  - Frames must never remount (D17). Route-driven rendering mounts the matched route's component, so the routes would render nothing and the stage would sit beside the outlet, working around the router.
  - The history code is tested in Node with a fake `History` subset. A router needs a router instance and its async navigation in every stage test.
  - Revisit when the app gets pages that are not mods, such as the Settings and About sections of `docs/modules/main/`. Adopting a router then replaces `stage_history.ts` and `run_links.ts` only. The stage state and the sandboxes do not change.

### D17. Rendering the stage

`src/main.tsx` builds the stage once at module level (`createStage` with `window.history`, `DEFAULT_MODS`, `location.origin`, `document.baseURI` and `localStorage`), calls `followHistory` and adds the `popstate` listener, then renders `<App stage={stage} />`. Building it outside React keeps StrictMode's double effect run in dev from launching mods twice.

`App` keeps the `OpenTesela` heading and renders `StageView`. `StageView` renders every sandbox of the snapshot in creation order, keyed by id, each in a wrapper with the `hidden` attribute unless it is visible. A frame is never moved in the DOM, because moving an iframe reloads it. For the visible sandbox, `StageBar` shows the title, version and source (or the link while loading), "Reload tiles" when the sandbox has a collection, × unless it is the home mod at `#/`, and `IssueList`. A `failed` sandbox shows its error and no frame.

`SandboxFrame` renders `<iframe title={mod.title} sandbox="allow-scripts" srcDoc={launch.sandboxDocument}>`. Its `onLoad` handler calls `attachFrame` on the first load and `frameLoadedAgain` on any later load.

React components define their event handlers and effects as named functions inside the component, because they need its state. That is the accepted exception to "avoid defining functions inside functions". Everything else lives at module level.

### D18. Samples move and static serving

- `git mv samples public/samples`. Vite then serves the samples in dev and copies them into `dist/` for preview and static hosts. `SAMPLES_DIRECTORY_URL` in `src/test/sample_files.ts` and `readSample` in `dependencies.test.ts` point to `public/samples/`. The virtual base URL `https://example.org/samples/` stays the same, so no test expectation and no main spec scenario changes. Their phrase "the files under `samples/`" refers to that URL path.
- `.prettierignore` replaces `samples/` with `public/samples/tiles/` and `public/samples/types/`, so the sample tiles stay as written and the sample mod and the default mods are formatted like the rest of the code.
- `vite.config.ts` sets `appType: "mpa"`. The app routes with the hash, so it never needs the single-page fallback. Without the fallback, dev and preview answer missing files with 404, like GitHub Pages, and the "missing mod file" scenario behaves the same everywhere. `/` still serves `index.html`.

### D19. The sample mod

`public/samples/mods/book_list/`:

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

`main.js` (about 60 lines, named functions, no framework) default-exports `mount(engine, context)`. It renders a heading from `context.mod.title`, and a list of buttons with the cover (`alt="Cover of <title>"`, shown when `config.show_covers` is true), the title and the authors. With no tiles it says that there are no books. It reads `selected` with `storage.get` and marks the selected button with `aria-pressed="true"`. A click stores the tile's source with `storage.set` and re-renders. `engine.on("tiles.changed", ...)` re-renders with the new tiles.

`type_path` and `sample_collection` point to the shared `public/samples/` files instead of copies (DRY), at the cost of a mod folder that is not self-contained. They also show that both paths can leave the mod folder.

### D20. Default mods

`src/main/default_mods.ts`:

```ts
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  home: "mod_explorer",
  switchedOff: [],
};
```

The future init options will build this value; the lib only receives it.

`public/default_mods/mod_explorer/` (`mod_conf.yaml`, `main.js`):

```yaml
mod:
  name: "mod_explorer"
  title: "Mods"
  version: "0.1.0"
  description: "Lists mods and opens them in the mod viewer."
  entrypoint: "./main.js"
  config:
    viewer: "mod_viewer"
    mods:
      - "./samples/mods/book_list"
  permissions:
    open:
      - host: "*"
        reason: "Opens the mods you pick"
```

`main.js` calls `mods.inspect` for each reference in `config.mods`, in order, and lists a button per mod with its title and description, or the reference and the error message. A click calls `mods.open` with `{ mod: config.viewer, params: { target: inspection.source } }`. The stage turns it into `#/run?mod=<config.viewer>&target=<inspection.source>` (D14).

`public/default_mods/mod_viewer/` (`mod_conf.yaml`, `main.js`), with `open` for `"*"` ("Runs the mod you are viewing") and no tile type: it reads `context.params.target`, says "No mod was given" when it is missing, and otherwise calls `mods.inspect` and shows the metadata in a definition list: title, version, description, name, source, tile type, sample collection, the config as indented `key: value` lines, and each permission with its category, host, reason and "granted" or "not granted". The run choices each call `mods.open`:

- "Run with sample tiles", only when `sampleCollection` is not `null`: `{ mod: source, collection: sampleCollection }`;
- a collection address field (`type="url"`) with "Run with this collection": `{ mod: source, collection: <typed address> }`;
- "Run without tiles": `{ mod: source }`.

Both use only the engine API and plain DOM code, like the sample mod, and never build an address. Their config values are relative to the app's address, as references in requests are (D14).

- Why the viewer needs no collection: it shows a mod, not tiles. The collection is chosen when the mod is run.
- Alternative considered: the viewer hosting the mod in a frame of its own. Rejected: the app would have to hand the viewer the mod's port and let it build the inner policy, which moves trust decisions into a mod and lets a replaced viewer impersonate any mod. Sibling frames owned by the app keep every decision in the engine.
- Alternative considered: the default mods as trusted app components outside the sandbox. Rejected: an instantiation could not replace them with community mods on equal terms, and the engine API would not be proven by the app's own components.

### D21. Tests

- **Unit (Vitest, Node)**, next to each file, tests first (TDD), one test per spec scenario at least:
  - `lib/files`: the existing fetcher, local files, YAML, markdown and error tests, moved with their files and unchanged apart from import paths. A pinned export list for `src/lib/files/index.ts`.
  - `lib/mod`: format, references and permission reasons, with inline `ParsedYaml` values. The mod loader uses `fetchTestFile` and `fetchSample` from `src/test/`.
  - `lib/core/permissions`: grants and `checkOpenGrant`.
  - `lib/core/sandbox`: content hosts, policy strings, report messages, the document (policy before the frame loader, no `</script` in the frame loader), the frame loader message readers, and `openSandboxChannel` with a fake frame target over Node's `MessageChannel`.
  - `lib/core/storage`: a `Map`-backed `ModStorage`.
  - `lib/core/engine`: `readModMessage`, default mod settings, then inspection and launch with the samples at `https://example.org/samples/` and `appOrigin` `https://example.org` (granted) or `https://other.example` (denied). The handler tables are called directly with a plain `ModMethodContext`: the storage handlers, `mods.inspect`, `mods.open` with an `onOpenLink` spy, and every params error. Sessions use a fake frame target that keeps the transferred `port2` and plays the mod side: dispatch, the envelope errors (`-32600`, `-32601`), `tiles.changed`, deduplicated issues, and stop.
  - `lib/core/stage`: `readAppRoute` and `buildRunLink`, the state functions with plain data, the history adapter with a fake history (an array of entries with `pushState`, `replaceState` and a way to play `popstate`), the sandbox runtime with fake frame targets, and the controller with both.
- **Component (Vitest, jsdom)**: `StageView` with a stage built on a fake history: hidden wrappers, the close button rules, "Reload tiles" only with a collection, and the `OpenTesela` heading in `App.test.tsx`. jsdom does not run `srcdoc` scripts, so frame behavior is left to Playwright.
- **End to end (Playwright, Chromium, on the built app)**:
  - `page.route("https://upload.wikimedia.org/**")` answers with a 1×1 PNG, so no test needs the network.
  - Foreign mods are served by `page.route("https://mods.example.net/**")` with `Access-Control-Allow-Origin: *`. Test mods on the app's origin are served by routing paths under `/test-mods/` on the preview origin. Both are built from inline texts in an e2e helper, so the repository gets no extra fixture folders.
  - A probe mod stores `{ engine, context }` on `globalThis.probe`, so tests drive the API with `frame.evaluate`. "The frame was not reloaded" is checked with a marker the test sets on the frame's `globalThis`.
  - "Blocked before it is sent" is checked as "the route handler never saw the URL", plus the reported issue.
  - Switched-off mods are tested in the unit tests of the engine and the stage, since the built app has none.

### D22. Docs

- `docs/modules/lib/files/README.md`: the file fetcher, local files, and the YAML and markdown parsers, moved from `docs/modules/lib/tile/README.md`, which keeps the tile loader, tile types, validators and collections and links to the files README.
- `docs/modules/lib/mod/README.md`: the mod file format with the permission categories, mod references and the loader.
- `docs/modules/lib/core/permissions/README.md`: the site-owner rule, the denial messages and the `open` check.
- `docs/modules/lib/core/sandbox/README.md`: the content hosts, the content policy table, blocked request reports, the sandbox document and frame, the frame loader and its `sandbox.*` messages.
- `docs/modules/lib/core/engine/README.md`: the protocol (methods, events, error codes, the reserved `sandbox.` prefix), the mount context, the `mount(engine, context)` entry point with the sample mod as example, storage slots, inspecting and opening mods, and default mod settings.
- `docs/modules/lib/core/stage/README.md`: run links, sandboxes and their ids, the visible sandbox, history entries, closing, how the page renders the stage, and a short "Why no router library" section with the D16 reasons and when to revisit them.
- `docs/stack.md`: TanStack Router removed (done while revising this change; D16 has the reasons).
- `docs/modules/mods/explorer/README.md` and `docs/modules/mods/viewer/README.md`: the two default mods, their config and links.
- `docs/modules/README.md`: one paragraph saying that the Explore, Viewer and Maker components ship as default mods in `public/default_mods/`.
- A hosting note in the sandbox and engine READMEs: a page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames, because `srcdoc` documents inherit the embedding page's policy.
- `docs/mod_plugin_spec.md` and `docs/opentesela_spec.md` are not changed (proposal, Out of scope).

## Risks / Trade-offs

- [Importing a `blob:` module in a sandboxed `srcdoc` frame was checked in Chromium only, and the Playwright projects run Chromium only] → it uses standard features (opaque-origin `blob:` URLs, dynamic import). The task list has a manual check in Firefox and Safari. If one fails, the fallback is a `data:` URL import with `data:` added to `script-src`, which changes only D6 and D9.
- [Hidden sandboxes keep running and use memory and CPU] → accepted for the proof of concept. Sandboxes that no history entry reaches are closed (D15), and × closes the others. A list or limit of open sandboxes is a later change.
- [A mod with `open` can make the engine request any URL it is granted, and any collection URL in a link it opens, so it can send data in those URLs] → only mods on the app's origin get `open`, the site owner chose them, and it is the same class of leak as `show` hosts. The checks run before any fetch (D11).
- [A hidden mod could open mods in a loop] → only the visible sandbox can open a link (D16).
- [`popstate` on fragment navigation, and `history.state` kept across reloads, were checked in Chromium only] → both are standard. The manual Firefox and Safari check covers back, forward and reload.
- [An embedding page that also writes `history.state` would overwrite the stage's positions] → the stage then treats the entry as new and opens its link again, which loses only the in-memory state of that sandbox. A router library on the embedding page is the usual case. `stage_history.ts` is the one file to change if the stage has to share `history.state` with one.
- [Moving the file code to `lib/files` touches the imports of most tile files and tests] → it is a `git mv` in its own task with no other change. The test count stays the same, and both modules pin their export lists.
- [A default mods folder on another origin, which the future init options allow, would not get its permissions under the site-owner rule] → the init options change extends the rule to "the app's origin or the default mods folder".
- [A mod can send data out before it is stopped, by navigating its frame or by encoding it in image URLs to content or `show` hosts] → accepted for now. A mod only holds its own mosaic's data and its own slot. The issue list makes a stopped mod visible.
- [A mod can fake `sandbox.blocked` and `sandbox.mountFailed`] → they only add deduplicated issues to that mod's own list.
- [`localStorage` is about 5 MB per origin, shared by the app and every mod] → errors become `STORAGE_FAILED`. Quotas per mod or IndexedDB can come later without changing the protocol.
- [Tiles reloaded from a host that was not a content host at launch are blocked] → reported with D7. Reopening the mod picks up the new hosts.
- [`srcdoc` inherits the app's own Content-Security-Policy] → the app sends none on static hosts. Documented for embedding pages (D22).
- [Covers come from `upload.wikimedia.org`, so the sample needs the network in dev] → Playwright routes the host. In dev, a missing cover only shows the alt text.
- [`appType: "mpa"` changes how dev and preview answer unknown paths] → only hash routes are used, and `/` still serves the app. A future path-based router would need to revisit this.

## Migration Plan

No data migration. `samples/` moves to `public/samples/` in one commit with the test path updates, and the file code moves to `src/lib/files/` in another commit with the import and export list updates, so `npm test` passes before and after each. Rollback is reverting the change. Nothing outside the repository refers to `samples/`.

## Open Questions

- Whether the future permission prompt shows `code` and `open` hosts as prominently as `connect` hosts. The categories and messages already allow either choice.
- Whether `title` becomes required in `mod_conf.yaml` now that the explorer lists mods. A default to `name` keeps both options open.
- Whether the home mod should also get a close button, and whether the stage should show the open sandboxes. Both can be added without changing the stage state.
