# Proposal

## Why

When the tile viewer is opened from the collection viewer, it shows the tile's place in the collection with Previous and Next. When the user then chooses another collection in the stage bar, the tile viewer opens with the new collection but keeps the old `from` parameter. The viewer finds its place only through `from`, so the first tile of the new collection is not found there, and the breadcrumb, Previous and Next are lost. When that tile is also listed in the old collection, the viewer shows its place in the wrong collection. A mod cannot fix this itself, because the mount context does not say which collection the mod's tiles were loaded from.

## What Changes

- The mount context gains `collection`: the `source`, `title` and `description` of the collection the mod's tiles were loaded from, or `null` when the mod was opened with a tile or without tiles. It has the same shape as `mosaic`. A mod opened from a mosaic gets the mosaic's collection. `tiles.changed` does not change, since "Reload tiles" reloads the same collection.
- In the test API, a case's `mount(options)` accepts `options.collection` to replace the check's `collection`, `null` included. A check run with a collection or with the mod's default mosaic gives its cases that collection.
- When the tile viewer was opened with a collection, that collection is its place in a collection, and a `from` parameter is ignored. Without a collection, `from` is used as before. The breadcrumb, Previous and Next, the collection title button, the warning for a collection that cannot be read and the `from` of linked tiles all use that place.
- Choosing another collection in the stage bar while the tile viewer runs shows the first tile of the new collection with its place, `1 of <n>`, Previous disabled and Next enabled. Opening the tile viewer from its default mosaic now also shows its place in the mosaic's collection.
- Mod API version bump: **patch**, `0.1.16` → `0.1.17`. A new mount context key and a new optional `mount` option of the test API are additions that existing mods keep working with, which the "Mod API version" section of the engine's README bumps as a patch. The app bumps as a patch too.

Out of scope: the stage bar's rule that choosing a collection keeps the link's params does not change. The collection viewer, which reads its collection from `target`, is not changed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `mod-engine-api`: the "Mount context" requirement adds `collection`, with scenarios for a collection link, a tile link and a mosaic.
- `mod-tests`: `mount(options)` accepts `collection`, and cases get the check's collection.
- `mod-api-version`: the mod API version is `0.1.17`.
- `default-mods`: the tile viewer's place in a collection comes from the collection it was opened with, or else from `from`. This changes the requirements for showing its place, stepping through it, reporting a collection it cannot read and opening linked tiles.

## Impact

- Engine: `src/lib/core/engine/mod_launch.ts` (mount context), `mod_session.ts`, `mod_api_version.ts`, and the surface guard `mod_api_surface.test.ts`, which gets a `0.1.17` entry with the new key and its `collection` keys.
- Sandbox test runner: `src/lib/core/sandbox/sandbox_test_runner.js` (`buildCaseMountContext`, `checkMountOptions`).
- Mod typings: `default_mods/mod_api.d.ts` (`ModContextCollection`, `ModContext.collection`, `CaseMountOptions.collection`) and the type test `mod_api_types.test.ts`.
- Tile viewer: `default_mods/tile_viewer/src/` (`main.ts`, `viewer_view.ts`, `collection_place.ts`, `tile_links.ts`) and its test cases.
- Docs: the mount context table and a `0.1.17` version note in `docs/modules/lib/core/engine/README.md`, and `docs/mod_plugin_spec.md`.
- E2E: the mount context checks in `e2e/mod_engine_api.spec.ts`, and a stage-bar collection switch with the tile viewer.
- A changeset `.changeset/fix-tile-viewer-collection-switch.md` (patch).
- Sample e2e checks: `e2e/sample_book_list.spec.ts` and `e2e/sample_country_map.spec.ts` measure the mod frame's width with a helper in `e2e/app_layout.ts` instead of assuming the shell's insets, which `refresh-app-shell` changed, and compare book sizes with a sub-pixel tolerance. Tests only; no behavior change.
