# Proposal

## Why

`add-collection-explorer` lets a user find a collection and see which tiles it lists, but not open one. Tiles are the content of OpenTesela, and nothing in the app shows a single tile with its metadata and body. The Viewer component of Tiles is still missing.

A tile must be viewable from a link anyone can share, whether the tile is in one collection, in several or in none, because a tile is identified by its address. A mod can't do this today:
- A run link takes only a `collection`, so a single tile has to be wrapped in a collection.
- A mod can't load a tile itself.
- A tile the mod didn't receive when its frame started gets none of its media allowed and can't have its body rendered.

So the engine has to load the tile before the frame starts.

Stepping through a collection one tile at a time should feel like turning pages, not like a trail of history entries and open frames. That needs a way for a mod to replace itself with the next view.

## What Changes

- **Run links and `mods.open` take a `tile`**: the location of one tile file. It is mutually exclusive with `collection`.
  - The engine loads the tile before the mod's frame starts and validates it against the mod's tile type, as it does for collections. The mod receives it as `context.tiles`, so the media rules, `tiles.renderBody` and `<ot-tile-body>` work as they do for tiles of a collection.
  - A tile that cannot be loaded is a load failure of the sandbox, as a missing collection file is.
  - "Reload tiles" loads the tile again.
  - Relative locations are resolved against the app's address.
  - `tile` becomes a reserved link name, like `mod` and `collection`. It is no longer passed to the mod in `params`, and `mods.open` refuses `params` named `mod`, `collection` or `tile`.
- **`mods.open` takes `replace: true`**:
  - The new sandbox takes over the requesting sandbox's history entry, and the requesting sandbox is closed.
  - The new sandbox keeps the requester's opener and section, so closing it and Back return to where the user came from.
  - The home mod at `#/` cannot be replaced.
- **New default mod `tile_viewer`** (title "Tile Viewer"):
  - It shows its tile: a heading (the tile's `title`, or its file name), its source, its metadata and its body.
  - Metadata is shown in frontmatter order, with lists and mappings nested. Web addresses are links. Addresses of tiles (`.md`) open in the tile viewer. Addresses of images also show a small thumbnail.
  - A tile without metadata says so.
  - Links to other tiles in the body open in the tile viewer.
  - Without a tile, it says that no tile was given.
- **The `from` parameter.** The tile viewer takes an optional `from`, the address of a collection. When the tile is in that collection, the viewer shows:
  - the collection's name, which opens the collection viewer;
  - the tile's position ("3 of 16");
  - Previous and Next buttons, which replace the viewer with the neighbouring tile, keeping `from`.

  When `from` can't be read, the tile is still shown, with a warning. When the tile isn't in that collection, the breadcrumb isn't shown.
- **The collection viewer's tiles open the tile viewer**, with the collection as `from`. The tile viewer it opens is named in its config.
- **The mod API version goes from `0.1.11` to `0.1.12`.**
- Out of scope, for this change:
  - tile titles in the collection viewer;
  - listing the other collections a tile is in;
  - making the breadcrumb go back to an open collection viewer instead of opening a new one;
  - players for video and audio addresses in metadata;
  - `mods.check` with a tile;
  - the tile maker.

## Capabilities

### New Capabilities

None. The tile viewer is a default mod and belongs to `default-mods`. Links with a tile belong to `mod-stage` and `mod-engine-api`.

### Modified Capabilities

- `mod-stage`: run links take a `tile`, which loads one tile before the frame starts and fails like a missing collection when it cannot be loaded. "Reload tiles" also applies to a sandbox opened with a tile. A sandbox can be replaced, so that opening a link no longer always keeps the visible sandbox.
- `mod-engine-api`: `mods.open` takes `tile` and `replace`, and its params are checked. The mount context's `params` leaves out `tile`, and its `tiles` and `issues` come from a collection or from a tile. A mod opened with neither gets no tiles. "Tiles changed" also follows a reloaded tile.
- `stage-bar`: the notifications of the loaded and reloaded tiles also cover a sandbox opened with a tile.
- `mod-api-version`: the version becomes `0.1.12`.
- `default-mods`: the tile viewer (what it shows, `from`, the breadcrumb, Previous and Next, links to tiles, its cases and look), and the collection viewer's tiles opening it.

## Impact

- **Mod API version**: patch, `0.1.11` → `0.1.12`, under the "Mod API version" section of the engine's README. The additions are:
  - the `tile` and `replace` fields of `mods.open`;
  - the `tile` run link field;
  - the mount context filled from a tile.

  One change could break an existing mod: a mod that read a link parameter named `tile`, or that passed `params.tile`, `params.collection` or `params.mod` to `mods.open`, now gets a loaded tile or `-32602`. No shipped, test or known mod does, so this is treated as an addition rather than a minor (breaking) bump, which would make every `^0.1.x` mod ask the user before starting. The engine README's version history will say this. `^0.1.0` ranges still match. The surface guard gets a `0.1.12` entry.
- **App version**: patch, a new feature. Instantiations' section targets keep working, because the run link's `tile` is optional in the section registry.
- **Code**:
  - `src/lib/core/stage/`: run link parsing and building, opening, replacing, "Reload tiles".
  - `src/lib/core/engine/`: loading the link's tile, `mods.open`'s params, `MOD_API_VERSION`.
  - `default_mods/mod_api.d.ts`.
  - `default_mods/collection_viewer/`: rows that open the tile viewer, and its config.
- **New default mod**: `default_mods/tile_viewer/`, in TypeScript, with tests and fixtures.
- **Tests**:
  - unit tests of run links, the stage state's replace, launching with a tile, and `mods.open`'s params;
  - the surface guard;
  - the collection viewer's cases;
  - e2e tests in `e2e/mod_stage.spec.ts`, `e2e/mod_engine_api.spec.ts` and `e2e/default_mods.spec.ts`.
- **Docs**:
  - `docs/modules/tiles/viewer/README.md`, today TODO;
  - the stage and engine READMEs (run links, `mods.open`, replacing a sandbox);
  - `docs/mod_plugin_spec.md`;
  - `docs/modules/tiles/explorer/README.md` (tiles now open);
  - `docs/modules/README.md` and `default_mods/README.md`.
- **Network**: opening a tile requests its file once, and its collection file when `from` is given. Previous and Next request the next tile and the collection file again.
- **Depends on**: `add-collection-explorer`, which adds `collections.inspect`, the collection viewer and mod API `0.1.11`. It is applied and archived first.
