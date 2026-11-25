# Tasks

## 0. Prerequisite

- [x] 0.1 Check that `add-collection-explorer` is applied and archived: `openspec/specs/default-mods/spec.md` has "Collection viewer labels tiles by file name", `MOD_API_VERSION` is `0.1.11`, and `default_mods/collection_viewer/` exists. Verify with `openspec validate add-tile-viewer --strict`, which must report no INFO about a MODIFIED header not found.

## 1. Run links with a tile

- [x] 1.1 Add the optional `tile` to `RunLink` (design.md, decision 1), and make `readAppRoute`, `buildRunLink` and `areSameLinks` handle it (decision 2): it is reserved, an empty value means none, it is written after `collection`, and an absent `tile` compares equal to `null`. Write the tests first in `run_links.test.ts` and `stage_routes.test.ts`, including "Tile is not a parameter of the mod" and a section link without `tile` equal to a typed link without `tile`. Verify with `npx vitest run src/lib/core/stage`, and that `src/main/sections/vanilla_sections.ts` compiles unchanged (`npm run build`).
- [x] 1.2 Add `loadModTile` and the choice between collection and tile in `loadLinkTiles` (`src/lib/core/engine/mod_launch.ts`), and rename `collectionSource`/`collectionLocation` to `tilesSource`/`tilesLocation` through the engine and stage. Throw `RunLinkConflictError` before any request for a link with both. Write the tests first in `mod_launch.test.ts`:
  - a tile without a tile type;
  - a tile of another type (no tiles, one warning);
  - a missing tile and a tile that cannot be parsed (launch failure with the tile's source);
  - relative paths in the tile resolved;
  - the tile's origin among the content hosts, and its media among the linked files;
  - a conflicting link requesting nothing.

  Verify with `npx vitest run src/lib/core/engine src/lib/core/stage`.
- [x] 1.3 Make "Reload tiles" and the loaded and reloaded notifications follow `tilesSource`, so a sandbox opened with a tile has the button and the notifications of the `stage-bar` delta. Add unit tests next to the existing reload tests: reload a tile, a tile that fails on reload keeps the mod's tile, "1 tile" in the notification. Verify with `npx vitest run src/lib/core/stage`.
- [x] 1.4 Add e2e tests in `e2e/mod_stage.spec.ts` for what units can't see:
  - "Link with a tile" (no collection requested);
  - "Media of the tile";
  - "Shared tile link after a reload";
  - "Both in a link";
  - "Missing tile";
  - "Reload a tile" (the frame is not reloaded).

  Use the test mods served by `e2e/test_mods.ts` and fixture tiles under `e2e/test_mods/tiles/`. Verify with `npx playwright test e2e/mod_stage.spec.ts`.
- [x] 1.5 Document the `tile` run link field in `docs/modules/lib/core/stage/README.md` (the link table, a conflicting link, "Reload tiles", and section links that compare `tile`) and in `docs/modules/main/README.md` (`tile` is optional in a section's mod target). Verify that every link example in these docs parses with `readAppRoute` as documented.

## 2. `mods.open` with a tile and replace

- [x] 2.1 Make `readOpenParams` in `mods_methods.ts` read `tile` and `replace`, refuse reserved `params` keys, and refuse `collection` together with `tile` (design.md, decision 3). Change `onOpenLink` to take `{ replace }` and return an outcome, mapped to the existing `-32002` message or to `mods.open: the home mod cannot be replaced`. Write the tests first in `mods_methods.test.ts`, one per `-32602` and `-32002` scenario of the `mod-engine-api` delta. Verify with `npx vitest run src/lib/core/engine`.
- [x] 2.2 Add `replaceStageEntry` to `stage_state.ts` (design.md, decision 4), with the tests first in `stage_state.test.ts`:
  - the current entry points to the new sandbox at the same position and section;
  - the new sandbox has the requester's opener;
  - forward entries are kept;
  - the requester is in `closedIds`;
  - another entry that pointed to the requester is restored by link when visited.

  Verify with `npx vitest run src/lib/core/stage/stage_state.test.ts`.
- [x] 2.3 Wire the replace mode into the controller's open path:
  - `writeStageEntry("replace")`;
  - the close side effects for `closedIds`, which stop the session, remove the frame and drop dialogs;
  - `forgetSandboxes` before `rememberShownEntry`;
  - refusing the home mod.

  Add controller tests: the requester's session is stopped before the handler returns and no response reaches it, push still answers `null`, "Section after a replace", and "Close after a replace". Verify with `npx vitest run src/lib/core/stage`.
- [x] 2.4 Add e2e tests in `e2e/mod_engine_api.spec.ts` with test mods:
  - "Viewer replaces itself" (one frame left in the page, and back returns to the opener);
  - "Home mod cannot be replaced", in the `e2e-home-mod` project;
  - "Hidden mod cannot replace itself";
  - "Dialogs of the replaced mod".

  Verify with `npx playwright test e2e/mod_engine_api.spec.ts`.
- [x] 2.5 Bump `MOD_API_VERSION` to `0.1.12`:
  - add the guard's `0.1.12` entry, repeating `0.1.11`'s names (design.md, decision 7);
  - update `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`;
  - add `tile?` and `replace?` to `ModOpenParams` in `default_mods/mod_api.d.ts`, checked by `mod_api_types.test.ts`.

  Document `mods.open`'s `tile` and `replace`, the reserved keys and the `0.1.12` note in `docs/modules/lib/core/engine/README.md`, and add a short example of opening a tile and of replace to `docs/mod_plugin_spec.md`. Verify with `npx vitest run src/lib/core/engine`, `npx tsc -p tsconfig.default_mods.json --noEmit`, and that the documented params match `readOpenParams`.

## 3. Default mod `tile_viewer`

- [x] 3.1 Create `default_mods/tile_viewer/` with `mod_conf.yaml`:
  - `name: "tile_viewer"`, `title: "Tile Viewer"`, `version: "0.1.0"`, `api: "^0.1.0"`;
  - a description;
  - `entrypoint`, `test_path`;
  - `sample_collection: "./fixtures/tiles_collection.yaml"`, so the check's cases can render the fixture tiles' bodies (design.md, decision 5);
  - `open` for `"*"` with a reason;
  - `config: { tile_viewer: "tile_viewer", collection_viewer: "collection_viewer" }`.

  Add the `src/` modules of design.md, decision 5, with layout-only CSS in which no rule that sets `display` matches a `[hidden]` element, and a `role="status"` region that stays empty until an error. Write the pure modules (`tile_heading.ts`, `metadata_addresses.ts`) test-first through the cases of 3.2: title or file name, a decoded name, web, image and tile addresses with query and letter case. Verify that `npm run build` emits `dist/default_mods/tile_viewer/main.js` with no `import`.
- [x] 3.2 Add `test/test.ts` and fixture tiles and a fixture collection in `default_mods/tile_viewer/fixtures/`, covering "Tile viewer cases":
  - the heading;
  - nested metadata, links and thumbnails (including a hidden thumbnail after an error);
  - no metadata;
  - the body;
  - no tile;
  - the place in the collection, with Previous disabled on the first tile and Next disabled on the last;
  - Next and Previous requests with `replace` `true`;
  - a tile not in `from`;
  - a `from` that fails (`ui.notify` warning);
  - a body link to a tile in and out of the collection, with and without `from`;
  - the look (card on `--ot-card`, Next primary).

  Verify that the mod viewer's "Check mod" for `tile_viewer` passes, with every case passed.
- [x] 3.3 Add e2e tests in `e2e/default_mods.spec.ts`:
  - "View a tile" through its run link;
  - "Image thumbnail" and "Image that fails" with routes;
  - "Link to another tile in the body" (no action dialog, back returns);
  - "Next tile" (one tile viewer frame in the page, and back returns to what was before);
  - "Missing from collection" (the warning in the stage bar);
  - "Tile viewer passes its check";
  - "Own styles are layout only" extended to the tile viewer;
  - "Cases without the samples" extended to `tile_viewer`.

  Verify with `npx playwright test e2e/default_mods.spec.ts`.
- [x] 3.4 Write `docs/modules/tiles/viewer/README.md` (today TODO), modeled on the mod viewer's doc: what it shows, its config, `from`, the breadcrumb, Previous and Next, links to tiles, its permission, its tests, and example links. List it in `default_mods/README.md` and `docs/modules/README.md`. Verify that every path, config key and link in these docs exists.

## 4. Collection viewer opens tiles

- [x] 4.1 Make the label in the first cell of each row of the collection viewer's tile table a button that opens the tile viewer (design.md, decision 6), and add `config: { tile_viewer: "tile_viewer" }` to its `mod_conf.yaml`. Change its `open` reason to "Shows the collection you are viewing and opens the tiles you pick". Drop "Selecting it does nothing yet." from the comment of `buildTileRow` in `tile_list.ts`. Add a `role="status"` region for `mods.open` errors, apart from the tile count. Add the cases "Selecting a tile in a case" and "Refused open in a case", and keep the filter cases passing with buttons. Verify that "Check mod" for `collection_viewer` passes.
- [x] 4.2 Add the e2e tests in `e2e/default_mods.spec.ts`:
  - "Open a tile from the list" (the address carries `tile` and `from`, the viewer shows `1 of <n>`, and Tiles stays current);
  - "Open the collection" from the breadcrumb.

  A refused open is covered by the case of 4.1, not here (design.md, decision 6), so `src/test/registries/explorer_off_mods.ts` is unchanged. Verify with `npx playwright test e2e/default_mods.spec.ts`.
- [x] 4.3 Update `docs/modules/tiles/explorer/README.md`:
  - the collection viewer's tiles now open the tile viewer with `from`;
  - its config and its new `open` reason;
  - the introduction says that both mods use `mods.open`, and drops "Tiles do not open yet: the viewer lists a collection's tiles, and selecting one does nothing.";
  - the viewer's list drops "and selecting a tile does nothing".

  Verify that its links, config keys and reasons match `mod_conf.yaml`, and that `grep -n -i "does nothing\|do not open" docs/modules/tiles/explorer/README.md` finds nothing.

## 5. Release

- [x] 5.1 Add `.changeset/add-tile-viewer.md` with an `"opentesela": patch` bump. It's a new feature with no breaking change for users or instantiations, section targets without `tile` keep working, and the mod API's patch bump to `0.1.12` asks for at least a patch (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "Tiles open in a new tile viewer, with their metadata, body and place in their collection, through links with a `tile` that anyone can share (mod API 0.1.12)." Verify the file follows the format of the other files in `.changeset/`.

## 6. Tile card layout

- [x] 6.1 Put the whole tile in one card in `tile_card.ts` (design.md, decision 5): the heading, the source, the metadata in a `<section aria-label="Metadata">`, then an `<hr>` and the body, with neither for an empty body. Lay the metadata out in `viewer_page.ts`'s layout-only CSS, scoped to that section: each `<dl>` a two-column grid, each `<ul>` a column without bullets. Update the cases: the body and the `<hr>` inside the card, none for an empty body, a single value on its key's row and list items one per line ("Value beside its key"), and the look case. Update `docs/modules/tiles/viewer/README.md`. Verify that "Check mod" for `tile_viewer` passes and that `npx playwright test e2e/default_mods.spec.ts` passes.

- [x] 6.2 Collapse long metadata (design.md, decision 5): the pure `metadata_lines.ts`, test-first through cases (line counts, a field that fits, a list cut with `and <n> more`, the fields after it hidden, a long first list, short metadata), and `metadata_section.ts` with the small "Metadata" heading and the toggle button next to it, which hides whole fields and list items with `hidden`. Make the thumbnail two lines high, before the address. Add the cases of the `default-mods` delta ("Long metadata starts collapsed", "Show all the fields", "Short metadata", "Long first list") and a thumbnail height case, keep the other cases passing with the collapsed fixture, and update `docs/modules/tiles/viewer/README.md`. Verify that "Check mod" for `tile_viewer` passes and that `npx playwright test e2e/default_mods.spec.ts` passes.

- [x] 6.3 Add an `<hr>` between the source and the metadata in `tile_card.ts`, and make the metadata's button the theme's outline button, no taller than the "Metadata" heading, with layout-only CSS (design.md, decision 5). Add the "Button shape" case and the separator to the card cases, and update `docs/modules/tiles/viewer/README.md`. Verify that "Check mod" for `tile_viewer` passes and that `npx playwright test e2e/default_mods.spec.ts` passes.

## 7. Verification

- [x] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify all pass. Run `openspec validate add-tile-viewer --strict` and verify it is valid.
