# Design

## Context

A mod gets tiles on three paths, and all three pick them with `selectModTiles` in `src/lib/core/engine/mod_launch.ts`:

- **Opening**: `prepareModLaunch` → `loadModTiles` → `selectModTiles`, then `buildModContext` puts `modTiles.tiles` in the mount context.
- **Reloading**: `readReloadedIssues` in `src/lib/core/stage/stage_sandboxes.ts` calls `loadModTiles` again and hands `modTiles.tiles` to `pushTilesChanged` in `mod_session.ts`.
- **Checking**: `checkCollection` in `mod_bundle_check.ts` calls `selectModTiles`. The stage's `buildModLaunch` builds the mount check's context from `bundleCheck.modTiles`, and the test runner gives each case `mountOptions.tiles ?? context.tiles`.

`selectModTiles` validates the collection with the mod's tile type when it has one, then keeps the tiles of that type. Tile types are JSON Type Definition schemas, which have no string formats or patterns, so a string is valid or not whether or not it has been resolved. `Tile.metadata` is a `YamlMapping` of plain `YamlValue`s. A tile's `source` is always an absolute URL (`tile-loading` resolves every location), an `http(s):` one or a `file:` one for picked files.

## Goals / Non-Goals

**Goals:**

- One function resolves a tile's paths, called in one place that all three paths go through.
- The resolved tiles are new plain-data objects; the loaded collection's tiles are not changed.

**Non-Goals:**

- Changing `sandbox_test_runner.js`: tiles a test passes to `mount(options)` already replace the context's tiles and stay as given.
- Resolving anything in `issues`, in `collectionSource` or in the tile's `source`, which is already absolute.

## Decisions

### Resolve in `selectModTiles`, after validating and filtering

`selectModTiles` resolves the tiles it keeps just before returning `ModTiles`. Every path that gives tiles to a mod goes through it, so the mount context, `tiles.changed` and the check all get the same tiles with a single call. `stage_sandboxes.ts` and `mod_session.ts` need no change: the reload path gets resolved tiles from `loadModTiles`. That is narrower than the proposal's Impact, which lists them, but the reload path is still covered.

Resolving after validation means the tile type sees the metadata as written, as the spec asks. Since JTD has no string formats, the order does not change any validation result today. Resolving last means a future format check would also apply to what the author wrote.

*Alternatives:*
- Resolving in `buildModContext` and in `pushTilesChanged`: two call sites, and `pushTilesChanged` would turn into a data-shaping function rather than a message sender.
- Resolving in the tile loader: rejected by the proposal. A loaded tile stays what the file says, and the collection loader, the validator and the issues all work on the tile as written.

### A pure function in a new engine module

A new `src/lib/core/engine/tile_paths.ts` exports `resolveTilePaths(tile: Tile): Tile`. It returns a new tile with the same `source`, `body` and `types` (a copy of the list) and with `metadata` rebuilt value by value:

- a string starting with `./` or `../` becomes `new URL(value, tile.source).href`;
- a list becomes a new list of its resolved items;
- a mapping becomes a new mapping with the same keys and resolved values;
- anything else is returned as is.

The output is built from new objects, so the collection's tiles stay as written and the result is still plain data that survives a structured clone. It lives in the engine, not in `src/lib/tile/`, because it shapes what mods receive, while the tile module is about loading and validating files as written. `index.ts` does not export it: the engine's own code is its only caller, as with `selectModTiles`'s other helpers. Its tests live next to it.

*Alternative:* `structuredClone` the tile and then change it in place. That makes two passes, and the rebuild already gives a copy.

### The marker is the prefix only

The function checks `value.startsWith("./") || value.startsWith("../")`, with nothing else: no trimming, no check of what follows. `"./"` alone resolves to the tile's folder. `.\cover.jpg`, ` ./cover.jpg` (leading space) and `.cover.jpg` stay as written. That rule is easy to state in the docs and matches how mod references treat relative paths.

### URLs that cannot be built stay as written

`new URL` with a relative path and an absolute `http(s):` or `file:` base does not throw, so this should not happen. If a source ever were a non-hierarchical URL, `new URL` would throw and the string stays as written: the mod gets the same value it gets today, and the engine does not fail to mount because of one metadata string.

## Risks / Trade-offs

- [A mod shows such a string as text and now shows an absolute URL] → The proposal accepts this as part of the fix. The README's mount context section says it in one line.
- [A metadata value that is not a path starts with `./`, for example a version note `./v2 draft`] → It becomes a URL. The explicit marker makes this rare, and an author who means it as text can drop the `./`. The docs state the rule.
- [Large collections pay for one more pass over every tile] → Metadata is small frontmatter, and the pass is linear. It runs once per load, not per message.
- [Tiles the stage shows itself (issues, sidebar) are not resolved] → They are outside the mod API. `issues` name tile sources, which are already absolute.

## Migration Plan

No data migration. Mod API `0.1.3` → `0.1.4` (patch): `MOD_API_VERSION`, a surface-guard entry equal to `0.1.3`'s, `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`, the version test, and the `0.1.3` mentions in the engine README. Shipped mods' `api` ranges (`^0.1.0`) keep matching. Rolling back is reverting the change; mods that call `new URL(value, tile.source)` work either way.
