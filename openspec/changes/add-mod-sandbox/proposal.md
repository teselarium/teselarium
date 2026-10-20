# Proposal

## Why

Mods are community JavaScript, and a shared link can make OpenTesela run a mod from any host. Before more of the app is built on mods, the isolation model has to be proven in the real app: a sandboxed frame, a message API with the core engine as the mod's backend, and a permission model that limits where a mod can reach on the web. Tiles and collections already load and validate as plain data (`add-tile-loader`, `add-collection-loader` and `add-tile-validators` are archived), so they can be handed to a sandboxed mod as they are.

OpenTesela is meant to be composable and portable: the Explore, Viewer and Maker components of mods, tiles and mosaics (`docs/modules/README.md`) should be mods themselves, shipped as optional default mods with the vanilla app, that an instantiation can switch off or replace. So the sandbox has to support mods that open other mods, several sandboxes at once, and navigation between them with the browser's back button, without moving any trust decision into a mod. This change is the proof of concept: the sandbox, a stage that keeps several sandboxes and navigates between them, the first two default mods (the mod explorer and the mod viewer), and a very simple sample mod.

## What Changes

- **Shared file module** (`src/lib/files/`): the file fetcher, local files, and the YAML and markdown parsers move out of `src/lib/tile/` unchanged, with their errors and tests, so tiles and mods (and later mosaics) use them without depending on each other. The tile module keeps tiles, tile types and collections.
- **Mod loading** (`src/lib/mod/`): read a mod's `mod_conf.yaml` (`name`, `title`, `version`, `description`, `entrypoint`, `type_path`, `sample_collection`, `config`, `permissions`), resolve its paths against the file's location, and fetch the entrypoint code with the existing file fetcher. An inline `schema` is rejected for now with a clear message (only `type_path` is supported in this change).
- **Mod references**: a mod is named by a default mod name (`mod_viewer`, looked up in the default mods folder), a folder (`./samples/mods/book_list`, which means its `mod_conf.yaml`) or the mod file itself. All the forms of one mod resolve to the same mod file URL, which is the mod's identity.
- **Sample collection**: a mod can point to the sample tiles it comes with (`sample_collection`). A collection is never required: a mod opened without one gets no tiles.
- **Permission declarations** in `mod_conf.yaml`: five categories a user can understand, `show` (images, video, audio, fonts, stylesheets), `connect` (fetch, WebSocket), `embed` (pages in frames), `code` (scripts loaded at runtime) and `open` (other mods this mod may inspect and open), each a list of `{ host, reason }`. `open` also accepts the host `"*"` (any site).
- **Sandbox**: each mod runs in an `<iframe sandbox="allow-scripts">` whose document is built in memory (`srcdoc`), so it needs no extra hosted file and gets an opaque origin: no access to the app's storage, cookies or DOM. The app creates every frame itself, also for a mod opened by another mod, so frames are never nested. The document carries a Content-Security-Policy built by the engine:
  - **Content hosts** (the hosts of the mod, the collection and its tiles) are always allowed for `show`.
  - **Declared permissions are granted only to mods served from the app's own origin** (the site-owner rule). Mods from other origins run with the default policy, as if the user had chosen "Run without", and each permission they do not get is reported. The permission prompt is a later change.
  - **Blocked requests explain themselves**: a blocked request is reported with the exact entry to add to `mod_conf.yaml`.
  - A mod that navigates its own frame is stopped and reported.
- **Core engine API** (`src/lib/core/engine/`, `src/lib/core/storage/`): a private `MessageChannel` per mod, with JSON-RPC 2.0 messages. The engine pushes events (`tiles.changed`) and answers requests: `storage.get`, `storage.set`, `mods.inspect` (a mod's metadata without running it) and `mods.open` (open a mod, with an optional collection and link parameters, in a new sandbox). Mods never build app addresses: only the stage turns a request into a run link and a history entry. The `mods.*` requests need a granted `open` permission for the target's origin, and only the visible mod can open another. The mod's entrypoint default-exports `mount(engine, context)`, and the context holds the mod's config, the link parameters, its validated tiles, the issues and the granted and denied permissions. Each mod's storage slot is keyed by the mod's source.
- **Stage** (`src/lib/core/stage/`, rendered by `src/main/stage/`): one route, `#/run?mod=<reference>&collection=<location>&<params>`, opens a mod in a new sandbox, and `#/` opens the home mod. Mods never own a route: they are values of the route's parameters. Several sandboxes stay open at once, each with an id from the stage, and one is visible. Back and forward show a sandbox that is still open in the state it was left in. A close button (×) closes the visible sandbox. A stage bar shows the visible mod's title, its issues and a "Reload tiles" button that pushes `tiles.changed`.
- **Default mods** (`public/default_mods/`): `mod_explorer` (the home mod) lists the mods in its config and opens the viewer for one of them. `mod_viewer` shows a mod's metadata and runs it with its sample tiles, with a collection from the internet, or without tiles. `src/main/default_mods.ts` holds the default mods folder, the home mod and the switched-off list (empty here). The engine refuses to open a switched-off default mod.
- **Sample mod** `book_list`: lists the sample books with their covers (declared `show` permission for `https://upload.wikimedia.org`), remembers the selected book in its storage slot and points to the sample books as its sample collection.
- **Samples move to `public/samples/`**, so dev, build, preview and static hosts serve them. The test helpers that read `samples/` from disk point to the new folder.
- Update `docs/modules/lib/mod/README.md` and `docs/modules/lib/core/engine/README.md`, add `docs/modules/lib/files/README.md` (the file part of `docs/modules/lib/tile/README.md`, which keeps the tile part), `docs/modules/lib/core/permissions/README.md`, `docs/modules/lib/core/sandbox/README.md` and `docs/modules/lib/core/stage/README.md`, fill `docs/modules/mods/explorer/README.md` and `docs/modules/mods/viewer/README.md`, and say in `docs/modules/README.md` that the components ship as default mods.

## Capabilities

### New Capabilities

- `mod-loading`: reads a mod configuration file into a plain loaded mod: mod references, the file format, path resolution, the sample collection, the permission declarations, the tile type by path, and the entrypoint code.
- `mod-sandbox`: runs a loaded mod isolated in a sandboxed frame: the frame and its policy, content hosts, which declared permissions are granted, reports of denied permissions and blocked requests, stopping a mod that navigates, and the `mount` entry point.
- `mod-engine-api`: the message protocol between a running mod and the core engine: the private channel, the message shapes, the mount context, requests and their errors, the storage slot, inspecting and opening mods, and pushed events.
- `mod-stage`: opening mods from links in several sandboxes: the run link, the home mod, sandbox ids, the visible sandbox, back and forward, closing, the stage bar with issues and reloading tiles, load failures and switched-off mods.
- `default-mods`: the default mods folder, the mod explorer and the mod viewer.

### Modified Capabilities

None. Moving `samples/` to `public/samples/` changes where the files live on disk, not the behavior of the tile and collection specs. Their scenarios use the virtual base URL `https://example.org/samples/`, which stays the same. Moving the file fetcher and the parsers to `src/lib/files/` changes import paths, not behavior, and the tile and collection specs do not name modules.

## Impact

- **New code**:
  - `src/lib/mod/`: mod file format, mod references, the mod loader, permission declarations and mod issues.
  - `src/lib/core/permissions/`: grants (the site-owner rule) and the `open` check.
  - `src/lib/core/sandbox/`: content policy, blocked request reports, the sandbox document, the frame loader script, and the frame loader messages and channel.
  - `src/lib/core/engine/`: messages, default mod settings, mod launch, inspection, the request handlers per namespace (`storage.*`, `mods.*`) and the mod session.
  - `src/lib/core/storage/`: mod storage slots.
  - `src/lib/core/stage/`: run links, the stage state, the history adapter, the sandbox runtime and the stage controller.
  - `src/main/`: `default_mods.ts` and the `stage/` components.
  - `src/App.tsx` renders the stage.
- **Moved code**: `src/lib/files/` gets `file_fetcher.ts`, `local_files.ts`, `yaml_parser.ts` and `markdown_parser.ts` from `src/lib/tile/`, with their tests, and `file_errors.ts` with `FileFetchError`, `YamlParseError`, `MarkdownParseError` and `describeErrorCause` from `tile_errors.ts`. `src/lib/tile/index.ts` no longer exports them, and the tile files and `src/test/test_files.ts` import them from `src/lib/files/index.ts`.
- **Config**: `vite.config.ts` sets `appType: "mpa"`, so dev and preview answer missing files with 404 like static hosts, instead of the single-page fallback. `.prettierignore` follows the samples move.
- **Samples and default mods**: `samples/` moves to `public/samples/` and gains `mods/book_list/` (`mod_conf.yaml`, `main.js`). `public/default_mods/` gets `mod_explorer/` and `mod_viewer/`. `src/test/sample_files.ts` and `src/lib/tile/dependencies.test.ts` read from the new path.
- **Tests**: unit tests next to the new files (Vitest, Node), component tests for the stage (jsdom), and Playwright tests that run the sample mod, the default mods, navigation between sandboxes and a probe mod served from another origin. Playwright routes the cover image host to a local file, so no test needs the network.
- **Dependencies**: none added. The stage reads `location.hash` and uses the History API directly, and TanStack Router is removed from `docs/stack.md` (design D16): the app has one route, the stage alone decides what each history entry means, and frames must never remount. History and addresses are kept in two stage files, so a router can be adopted later for app pages that are not mods.
- **Hosting**: works on static hosts with no server config. A page that embeds OpenTesela with its own Content-Security-Policy must allow inline scripts in frames, because `srcdoc` documents inherit the embedding page's policy.
- **Out of scope**:
  - the permission prompt (Allow / Run without / Cancel) and remembered choices;
  - init options: a site-owner allow list, the default mods folder, the home mod and the switched-off list (this change reads them from `src/main/default_mods.ts`), and granting permissions to a default mods folder on another origin;
  - the other default mods: `mod_maker`, `tile_explorer`, `tile_maker`, `tile_viewer`, `mosaic_explorer`, `mosaic_maker` and `mosaic_viewer`;
  - running a mod with a collection that is already loaded, or with tiles or mods from a local folder, and an `assetUrl` helper for local tile files;
  - a list or limit of open sandboxes;
  - mosaic files (config overrides, aliases), inline `schema` in `mod_conf.yaml`, tile media on hosts outside the content hosts, routing links in mods to new tabs, and mod typings for authors;
  - changes to `docs/mod_plugin_spec.md` and `docs/opentesela_spec.md` (drafts owned by the author).
