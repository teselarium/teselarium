# Design

## Context

See proposal.md for the motivation. What the design builds on:

- **The collection loader already plans before it fetches.** In `src/lib/tile/collection_loader.ts`, `loadTileCollection` runs these steps:
  1. it fetches and parses the collection file (`readCollectionFormat`);
  2. `planCollectionSlots` turns each entry into an issue or a tile href to load, which covers path resolution, malformed entries, relative `url`s, `file:` tiles in a remote collection and repeated tiles;
  3. `loadPlannedTiles` loads the tiles;
  4. `assembleTileCollection` builds the result.

  An index is steps 1 and 2 only.
- **`mods.inspect` is the model for the new request** (`src/lib/core/engine/mods_methods.ts`):
  - it reads its params with `readRequiredText`;
  - it resolves the reference against `context.fetchOptions.baseUrl`;
  - it runs `checkOpenGrant` (`src/lib/core/permissions/mod_grants.ts`) before any request;
  - it turns a load failure into `ModMethodError(LOAD_FAILED, message)`.

  Requests from a check's hidden frames are served by the same tables, so mod cases can inspect fixtures today.
- **`checkOpenGrant` builds its denial message for mods**: "Opening mods from `<origin>` …".
- **The default mods' look and structure.** The mod explorer and the mod viewer (`default_mods/mod_explorer/src/`, `default_mods/mod_viewer/src/`) are small TypeScript modules: `main.ts`, page, view, entries and cards. They get their look from semantic HTML: `<article>` cards, a `role="alert"` for failures, `aria-busy` while loading, and a `role="status"` region for request errors. Their own CSS sets layout only.
- **The default mods build** finds every folder in `default_mods/`, so new folders need no build change.
- **The Tiles section** is a page target with `comingSoon: true` in `src/main/sections/vanilla_sections.ts`. The Settings page and the sidebar read `comingSoon` and `optional` from the registry, so they need no code change, only tests.
- **A rejected request** gives a `FileFetchError` whose message is `the request failed: <cause>`, for example `TypeError: Failed to fetch` for a CORS block, without saying what may be wrong.

## Goals / Non-Goals

**Goals:**

- One rule for which entries a collection has: an index and a loaded collection can never disagree about the tiles or the entry issues.
- Mods that read like the mod explorer and the mod viewer, so the four default mods are learned once.
- A request that reveals no more than `mods.inspect` already does, under the same permission.

**Non-Goals:**

- Caching an index or a collection file between requests. Opening a collection reads its file again, and the browser's HTTP cache may serve it.
- Reading picked local files through `collections.inspect`. Requests get no picked files, so a `file:` collection fails as a fetch error, as it does for `mods.inspect`.
- Making the viewer's tile rows interactive (`add-tile-viewer`).

## Decisions

### 1. The index is the loader's planning step, made public

A new public function in `src/lib/tile/`, `readTileCollectionIndex(location, options)`, does the following:
- fetches and parses the collection file;
- plans its entries with the existing `planCollectionSlots`;
- returns a `TileCollectionIndex` `{ source, name, description, tiles, issues }`, where `tiles` holds the hrefs of the `load` slots and `issues` the issues of the `issue` slots, in order.

`loadTileCollection` uses the same fetch-parse-plan step and then loads the planned slots, so the two can't drift apart. The planning code moves to a module of its own (`collection_plan.ts`), which both functions import. The tile module's public entry point exports the function and the type.

Alternatives considered:
- **The engine loads the collection with a fetch that refuses tile requests.** It would turn every tile into a fetch issue, mixing entries that would load with ones that would not, and the engine would have to tell them apart again.
- **The engine reads the YAML itself.** That copies the entry rules into a second place.

### 2. `collections.inspect` is its own method table

`src/lib/core/engine/collections_methods.ts` exports `COLLECTIONS_METHODS`, which holds `collections.inspect`. It is registered next to `MODS_METHODS` where the session builds its method table. The handler:

1. reads `collection` as a required non-empty string (`-32602` otherwise);
2. resolves it with the fetcher's location resolution against `context.fetchOptions.baseUrl`, so an unresolvable location is `-32602`;
3. checks the `open` grant for the collection's origin (`-32002`, nothing fetched);
4. reads the index with `context.fetchOptions`;
5. answers it, or `-32001` with the load error's message.

There is no switched-off check, because collections are not default mods, and no visibility check, because `mods.inspect` has none either. The method works unchanged in checks and cases.

Alternative considered:
- **Adding it to `MODS_METHODS`.** The `mods.*` table is about mods. A second domain gets its own table, as `tiles.*` and `links.*` have.

### 3. Reuse `open`, with a message for each subject

`checkOpenGrant` gets the subject of the request, so its denials read "Opening mods from `<origin>` …" for `mods.*` and "Inspecting collections from `<origin>` …" for `collections.inspect`. Both still name `permissions.open`, and the "declared but not granted" form stays. The permissions README describes `open` as "the mods and collections a mod may reach through the engine".

Alternative considered:
- **A new `read` category.** It would change the mod file format, the site consent dialog's lines, the Settings decisions and the surface guard's categories, which is a larger API change, and every explorer would declare both categories. Reusing `open` costs one limitation: a mod cannot be allowed collections without mods. No known mod needs that.

### 4. Mod API `0.1.11`, typed for the default mods

`MOD_API_VERSION` becomes `0.1.11`. The surface guard gets a `0.1.11` entry with `collections.inspect`. `default_mods/mod_api.d.ts` gets:
- `CollectionInspection` `{ source, name, description, tiles: string[], issues: ModTileIssue[] }`;
- `"collections.inspect": { params: { collection: string }; result: CollectionInspection }` in `ModApiMethods`.

`mod_api_types.test.ts` checks that the engine's type fits it. The two new mods declare `api: "^0.1.0"`, as `mod-api-version` asks of every default mod. They ship with the app, so they always meet an engine that has the method.

### 5. A hint in the fetcher's message for rejected requests

When `fetch` rejects, the `FileFetchError`'s message becomes `the request failed: <cause>. The site may be unreachable or may not allow this app to read its files.` HTTP statuses keep their message. The fetcher is the only code that knows a request was rejected rather than answered: mods only get `-32001` and a message, and `-32001` also covers format errors. So the hint is written once, there, and reaches the stage bar, the mod viewer and the collection viewer alike.

Alternative considered:
- **The collection viewer adds a hint to every `-32001`.** That would wrongly blame the site for a YAML error.

### 6. `collection_explorer` mirrors `mod_explorer`

Modules in `default_mods/collection_explorer/src/`:

| Module | What it does |
|---|---|
| `main.ts` | mounts the page |
| `collection_entries.ts` | reads `collections` from the config, then inspects each location one after another, so the list keeps the config's order, giving an entry with its inspection or its error |
| `collection_cards.ts` | one `<article>` per collection: an `<h2>` name, the description, "N tiles", and a button named after the collection that opens it; a failed entry is a `role="alert"` with the location and the message |
| `explorer_page.ts`, `explorer_view.ts` | the page: `aria-busy` while inspecting, and a `role="status"` region for `mods.open` errors such as `-32003` |
| `error_messages.ts` | describes a request error |

`mods.open` gets `{ mod: config.viewer, params: { target: inspection.source } }`.

Its config is `{ viewer: "collection_viewer", collections: [the two samples/tiles collections] }` and its title is "Tiles", as the mod explorer's is "Mods". The explorer shows "N tiles" from `tiles.length`, which is the number of tiles the collection would load.

Alternative considered:
- **Sharing modules with `mod_explorer`.** Each default mod is one self-contained bundle, and the default-mods build has no shared source folder. A shared folder at the root of `default_mods/` is not served and would be a build change. The few duplicated lines (`describeError`, the card skeleton) are accepted, as between the mod explorer and the mod viewer today.

### 7. `collection_viewer` mirrors `mod_viewer`, with pure modules for labels and filtering

Modules in `default_mods/collection_viewer/src/`:

| Module | What it does |
|---|---|
| `main.ts`, `viewer_page.ts`, `viewer_view.ts` | read `params.target` and show "No collection was given." when it is missing or empty; otherwise inspect it, showing `aria-busy` meanwhile and the error message as a `role="alert"` when it fails |
| `collection_card.ts` | an `<article>` with an `<h1>` name, the description, and a `<dl>` with the source |
| `entry_issues.ts` | a list of the issues, each with a badge (`data-ot-variant` `warning` or `destructive`), its source and its message, as the mod viewer shows check findings; there is no list when there are no issues |
| `tile_labels.ts` | pure: addresses in, labels out |
| `tile_filter.ts` | pure: labels and text in, the matching indexes out, comparing lower-cased text |
| `tile_list.ts` | the list of tiles and the filter |

How `tile_labels.ts` builds a label:
1. It takes the last path segment and decodes it with `decodeURIComponent`, keeping the raw segment when decoding fails.
2. Labels that clash are rebuilt as `<parent>/<file name>`, decoded the same way.
3. Labels that still clash are kept as they are: the full address under each one tells them apart. That only happens for the same parent folder name in two places, which is rare enough not to need a third rule.

How the list and filter are built:
- **The list** is a `<ul>`. Each `<li>` holds the label and, under it, the full address in `<small>`. The items are not buttons, because selecting one does nothing until `add-tile-viewer`.
- **The filter** is an `<input type="search">` labeled "Filter tiles", outside any form, since the sandbox has no `allow-forms`. A `role="status"` paragraph says "Showing 3 of 16 tiles". Hidden items get the `hidden` attribute rather than being rebuilt.

### 8. Tiles in the registry

The Tiles section's target becomes `{ mod: { mod: "collection_explorer", collection: null, params: {} } }` and `comingSoon` becomes `false`. It stays optional, and its icon and label are unchanged. The rules that already exist for Mods then apply to Tiles too:
- active section through the opener;
- one root sandbox;
- the Settings switch;
- removal when the explorer is switched off.

The unit and e2e tests that use Tiles as the coming-soon example switch to Mosaics.

## Risks / Trade-offs

- **[A mod with `open` for `"*"` can read any public YAML collection's name and description]** → This is the same exposure `mods.inspect` already has for mod files, under the same permission. A foreign mod gets it only when the user allows it in the site consent dialog. The request sends no credentials beyond what the browser sends for a `fetch` from the app.
- **[Changing the fetcher's message for rejected requests]** → Tests that match the whole message text break. Messages are checked with "includes" in most tests, and the tasks update the rest. The new text is added after the cause, so messages still start as before.
- **[Labels from file names can be poor]** → They are accepted for this change (titles come later). The full address is always shown, and the filter works on what the user sees.
- **[The explorer inspects collections one after another]** → It's slower than in parallel, but it keeps the mod explorer's simple ordered loop, and the vanilla config has two small files. If configs grow, a parallel inspection that keeps the order can come later without a spec change.
- **[A large collection gives a long list]** → The list only adds DOM nodes, and the filter hides items without re-rendering. Hundreds of entries stay cheap, because no tile is loaded.

## Migration Plan

Nothing to migrate:
- Stored section switches keep their `tiles` key. A user who switched the coming-soon Tiles off keeps it off.
- Instantiations that replaced `vanilla_sections.ts` keep their own Tiles target.
- Mods built for `^0.1.0` keep matching.

## Open Questions

- The cards' and the viewer's wording ("N tiles", "Filter tiles", "No collection was given.") can be tuned during implementation without changing the specs, as long as the scenarios' observable facts hold.
