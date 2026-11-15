# Proposal

## Why

The sidebar's Tiles section has been "coming soon" since the sidebar shipped. Mods are the only part of the app that can be explored: a user can see which mods exist, but not which tile collections exist or what they hold. The Explore and Viewer components of Tiles are the next step. They also give the later tile viewer (`add-tile-viewer`) a place to start from.

A mod cannot do this today. The only way for it to learn anything about a collection is to be opened with it, which loads every tile. There is no request that reads a collection file alone. A list of collections only needs each collection's name, description and entries, so this change adds that request and builds the two default mods on it.

## What Changes

- **New engine request `collections.inspect`** with `{ collection }`:
  - It reads only the collection file and requests no tile.
  - It answers `{ source, name, description, tiles, issues }`. `tiles` holds the resolved address of each tile entry, in entry order, with a repeated tile listed once. `issues` holds the entry issues the collection loader would report before loading any tile: malformed entries, relative `url`s, repeated tiles, and local files in a remote collection.
  - Relative locations are resolved against the app's address, as `mods.inspect` does.
  - A collection file that cannot be fetched or read, is not plain YAML, or has the wrong structure is answered with `-32001` and the load error's message.
- **The `open` permission also covers collections.** `collections.inspect` needs a granted `open` permission for `"*"` or the collection file's origin. Without it, the request is answered with `-32002` before anything is requested, just as `mods.inspect` is gated today, so a mod cannot use the engine to fetch a URL it may not reach. `collections.inspect` never shows the site consent dialog.
- **New default mod `collection_explorer`** (title "Tiles"):
  - It declares `open` for `"*"`.
  - Its config is `{ viewer, collections }`. The vanilla config lists the Nobel laureates collection, then the Nobel laureates' books collection, from `samples/tiles/`, with `collection_viewer` as the viewer.
  - It shows a card per collection with its name, description and number of tiles.
  - A collection that cannot be inspected is listed as an alert with its reference and the error.
  - Selecting a collection sends `mods.open` for the configured viewer, with the collection's source as the `target` parameter.
- **New default mod `collection_viewer`** (title "Collection Viewer"):
  - It declares `open` for `"*"`.
  - It shows the collection named by its `target` parameter: name, description, source, entry issues, and the list of tiles.
  - Each tile is labeled by its file name, with the parent folder added when two tiles share a file name, and shows its full address.
  - A filter narrows the list by file name.
  - A missing, empty or failing `target` is shown as an error.
  - Tiles are not opened yet.
- **Clearer fetch errors**: when the browser rejects a request, which is how a site that does not allow the app shows up, the fetch error's message adds that the site may be unreachable or may not allow this app to read its files. This holds for every collection, tile and mod file the app loads, so the collection viewer, the stage bar and the mod viewer all show the hint.
- **Both mods are ordinary default mods.** Each ships its tests and fixtures and passes `mods.check`, and each gets its look only from the theme.
- **The Tiles section becomes the mod link `collection_explorer`** and stops being coming soon. Mosaics is now the only coming-soon section. The viewer that the explorer opens stays in Tiles, through the existing opener rule.
- **The mod API version goes from `0.1.10` to `0.1.11`.**
- Out of scope, for this change:
  - the tile viewer, the `tile` run link field, `mods.open`'s `replace`, and the `from` parameter (`add-tile-viewer`);
  - tile titles in the viewer's list;
  - ways to add collections (a typed address, picked folders);
  - listing the mods' sample collections in the explorer.

## Capabilities

### New Capabilities

None. The two mods are default mods and belong to `default-mods`, beside the mod explorer and the mod viewer.

### Modified Capabilities

- `tile-loading`: the message of a rejected request says that the site may be unreachable or may not allow this app to read its files.
- `collection-loading`: reading a collection's index (its name, description, resolved tile entries and entry issues) without loading any tile.
- `mod-engine-api`: the new `collections.inspect` request, its permission check, its errors, and references resolved against the app's address. The `-32001` engine error also covers collection files.
- `mod-sandbox`: `open` covers the collections a mod may inspect, as well as the mods.
- `mod-api-version`: the version becomes `0.1.11`.
- `default-mods`: the collection explorer and the collection viewer, their vanilla config, their cases and fixtures, their checks and their look.
- `app-sidebar`: Tiles is the mod link `collection_explorer` and no longer coming soon. The coming-soon example is Mosaics.
- `app-settings`: on the Settings page, only Mosaics says "Coming soon".

## Impact

- **Mod API version**: patch, `0.1.10` → `0.1.11`. Under the "Mod API version" section of the engine's README, this change is an addition:
  - a new method;
  - `open` now also lets a mod inspect collections, and every mod that could inspect mods before still can;
  - `-32001` gets a new use, and its existing use is unchanged.

  No method, event, context key or mod file key is removed or changes meaning. `^0.1.0` ranges still match. The surface guard gets a `0.1.11` entry with `collections.inspect`.
- **App version**: patch. A mod API patch bump means at least an app patch bump. The new Tiles section is a feature, and nothing breaks for users or instantiations.
- **Code**:
  - `src/lib/tile/`: the collection loader's index step, shared with `loadTileCollection`.
  - `src/lib/files/file_fetcher.ts`: the hint in the message of a rejected request.
  - `src/lib/core/engine/`: a `collections.*` method table, and the `open` check's message for collections.
  - `src/lib/core/permissions/`.
  - `MOD_API_VERSION`.
  - `src/main/sections/vanilla_sections.ts`.
  - `default_mods/mod_api.d.ts`, which types the new method.
- **New default mods**: `default_mods/collection_explorer/` and `default_mods/collection_viewer/`, in TypeScript, with `test/`, `fixtures/` and `mod_conf.yaml`. The default-mods build picks the new folders up with no change.
- **Tests**:
  - unit tests of the index step and of `collections.inspect`;
  - the surface guard;
  - the sidebar and Settings unit tests that expect Tiles to be coming soon;
  - `e2e/default_mods.spec.ts` (Tiles opens the explorer, the explorer opens the viewer, both pass their checks);
  - `e2e/app_sidebar.spec.ts` and `e2e/app_settings.spec.ts` where they rely on Tiles being coming soon.
- **Docs**:
  - `docs/modules/tiles/explorer/README.md`, today TODO, describes both mods;
  - `docs/modules/README.md` and `default_mods/README.md` list them;
  - the engine's README documents `collections.inspect`;
  - the permissions and tile module READMEs follow;
  - `docs/modules/main/README.md` shows the new Tiles section.
- **Network**: opening Tiles requests the two sample collection files and no tile. Opening a collection requests its file again.
- **Followed by**: `add-tile-viewer`, which makes the viewer's tiles open in a tile viewer.
