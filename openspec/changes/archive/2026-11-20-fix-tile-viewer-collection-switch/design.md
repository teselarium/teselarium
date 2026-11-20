# Design

## Context

See proposal.md, "Why", for the bug. The parts that shape the fix:

- The engine builds the mount context in one place, `buildModContext` in `src/lib/core/engine/mod_launch.ts`. Launches and checks both go through it. It gets `ModTiles`, which already carries `tilesSource` and the collection's `title`, but not its `description`. A tile link is loaded as a one-tile collection (`buildSingleTileCollection`), with the tile's source and an empty title, so `ModTiles` alone cannot tell a collection from a tile. `readLinkTilesKind(link)` can.
- The session's mount context is `{ ...launch.context, theme, layout }` (`mod_session.ts`), so a new key in `LaunchContext` reaches the frame with no other change. `tiles.changed` sends only `{ tiles, issues }`.
- A test case's context is a copy of the check's context with overrides (`buildCaseMountContext` in `src/lib/core/sandbox/sandbox_test_runner.js`). The tile viewer's check runs with its default mosaic, so its cases get that mosaic's collection.
- The tile viewer keeps `from` and `fromTiles` on its `ViewerView`. `collection_place.ts`, `tile_links.ts` and the collection title button read them.

## Goals / Non-Goals

**Goals:**
- One rule for the tile viewer's collection, decided once at mount, that every feature tied to the collection reads.
- `context.collection` has the same shape as `context.mosaic` and is built by the same launch code for every launch and check.

**Non-Goals:**
- No change to how the stage bar builds run links, and no change to `params`.
- No change to `tiles.changed`, and no reload of the collection's title or description.
- The collection viewer's own `target` handling is not changed.

## Decisions

### `collection` in the launch context, built from `ModTiles` and the link

`buildModContext` sets `collection` to `{ source, title, description }` when `readLinkTilesKind(link)` is `"collection"`, and to `null` otherwise. `ModTiles` gains `description`, filled in `buildModTiles` from the loaded `TileCollection`. For a mosaic launch, the link is the mosaic's link, so its `collection` is the mosaic's collection with no special case. The engine's `ModContext` and `LaunchContext` types gain `collection: LaunchCollection | null`, and `default_mods/mod_api.d.ts` gains `ModContextCollection` and `ModContext.collection`.

- *Alternative: derive it from `tilesSource` and `title` alone.* Rejected because a one-tile collection has a source too, so it would need the same kind check anyway, and the description would be missing.
- *Alternative: also send `collection` in `tiles.changed`.* Rejected because the collection does not change during a sandbox's life, like `mod` and `mosaic`.

### Test API: `collection` as a mount option, kept from the check by default

`buildCaseMountContext` sets `collection` to `options.collection` when the case passes one, `null` included, and keeps the check's otherwise. `checkMountOptions` rejects any value that is not `null` or a mapping with string `source`, `title` and `description`, with the error in the spec. `CaseMountOptions` in `mod_api.d.ts` gains `collection?: ModContextCollection | null`.

- *Alternative: drop the check's collection when a case replaces `tiles`.* Rejected because it ties two options together that are otherwise independent, which is harder to guess.

### Tile viewer: resolve its collection once at mount

`main.ts` resolves the viewer's collection as `context.collection?.source ?? from` and stores it on the `ViewerView` in place of `from`. The view's `from` and `fromTiles` become `collection` (the source, or `null`) and `collectionTiles`. `collection_place.ts` inspects `view.collection`. Its title button opens the collection viewer with it as `target`, and Previous and Next send it as `params.from`. `tile_links.ts` carries it as `from` when the linked tile is in `collectionTiles`. The unreadable-collection warning names it as `source`.

The viewer keeps calling `collections.inspect` for a launch collection too, instead of counting `context.tiles` or using `context.collection.title`. `context.tiles` can leave out tiles that failed to load, so `<i> of <n>` would differ from the collection viewer, and one code path keeps both cases identical.

- *Alternative: let `from` win over `collection`.* Rejected because a stage-bar switch keeps the old `from`, which is the bug.

### API range of the default mods

The tile viewer keeps `api: "^0.1.0"`. Default mods are served with the app, so they always run on its current mod API. The engine README already says the default mods keep `^0.1.0`.

## Risks / Trade-offs

- [Existing tile viewer cases mount with `from` while the check's collection is set, so after the change their place would come from the check's collection] → `mountWithFixtureTile` and the other case mounts pass `collection: null` unless the case is about the opening collection. Cases that test `from` keep testing `from`.
- [A mod that compares mount contexts by deep equality sees a new key] → No shipped or test mod does. E2E checks that pin the whole context (`e2e/mod_engine_api.spec.ts`) are updated in the same change.
- [Opening the tile viewer from its default mosaic now shows a breadcrumb] → This is intended and is a scenario in the spec. The look and layout checks that use that mosaic are updated if they pin the absence of the nav.
- [The surface guard only sees names] → The `0.1.17` entry adds `collection` to the context keys and records its keys (`description`, `source`, `title`), read from a mod opened with a collection, since it is `null` otherwise.

## Migration Plan

None. This only adds things: mods that do not read `collection` behave as before, and `^0.1.x` ranges still match `0.1.17`.
