# Tasks

## 1. Scores in the core

- [ ] 1.1 Move `aliasCollectionTiles` from `src/lib/core/engine/mod_launch.ts` to `src/lib/mosaic/mosaic_aliases.ts`, export it from `src/lib/mosaic/index.ts`, and import it in `mod_launch.ts` and `mod_bundle_check.ts`. Add a unit test next to `applyMosaicAliases`'s (renamed metadata, `source`, `body` and `types` kept), and verify the engine's tests pass unchanged.
- [ ] 1.2 Make `TileCount` `{ matching, total, isUntyped }`.
  - Keep `tileCount` in `CollectionSummary`.
  - Score an untyped mod as `total/total` from the collection index (1 for a tile) without loading tiles.
  - Update `combination_catalog.test.ts`, with a test that no tile file is requested for an untyped mod.
- [ ] 1.3 Add aliases to `measureTileCount`, mosaic counts under `buildMosaicCountKey`, and `requestMosaicCounts`, which reads mod, collection and aliases from the loaded mosaic summaries. Make `dropCollection` drop the mosaic counts on that collection. Verify with unit tests: the laureates fixture scores `17/17` with the map's aliases and `0/17` without, and a reload drops both.
- [ ] 1.4 Add `src/lib/core/combinations/score_order.ts` with `compareByRatio`, `compareByTiles` and `pickBestScore`. Verify with unit tests: `9/10 > 50/100 > 5/10` by ratio, `50/100 > 9/10 > 5/10` by tiles, `12/17 == 24/34`, unknown scores last, and no best score while any score is unknown.
- [ ] 1.5 Add `fetch_limit.ts` with `limitFetch(fetch, 6)` and use it in `createCombinationCatalog`. Verify with a unit test that at most 6 requests are pending while 20 are started, and that each one settles with its own response or error.
- [ ] 1.6 Update `docs/modules/lib/core/combinations/README.md` (fraction scores, mosaic counts, score order, fetch limit) and the mosaic module's docs for `aliasCollectionTiles`. Verify the documented exports match `index.ts`.

## 2. Tried combinations in recently used

- [ ] 2.1 Add `{ kind: "combination", mod, collection }` to `LoadedFileEntry`, reported by `stage_sandboxes.ts` once both files of a launch with a collection and no mosaic have loaded. Verify with stage unit tests:
  - Flashcards with the laureates reports one combination;
  - a mosaic, a tile link, a mod alone and a failed collection report none.
- [ ] 2.2 Add `combinations` to `recently_used.ts`:
  - 10 kept, newest first, moved to the front when reopened;
  - stored entries checked on read, and a stored value without `combinations` read as empty;
  - "Clear" drops all four kinds.

  Verify with unit tests for each rule.
- [ ] 2.3 Count combinations in the Settings Catalog group. Update its test for "2 mods, 1 collection, 0 mosaics and 1 combination", and update `docs/modules/main/settings/README.md`.
- [ ] 2.4 Update `docs/modules/lib/core/stage/README.md` for the new loaded-file entry, and verify it names the reporting rule.

## 3. List rules as pure modules

- [ ] 3.1 Add `src/main/stage/list_order.ts`: the default orders ("Mosaics first", "This pair first" with its groups), "Name", "Match ratio", "Matching tiles" with title tie-breaks, the filters, and the pinned rows outside both. Verify with unit tests for each sort, each filter and their combination, including "Compatible only" keeping counting rows and every filter keeping pinned rows.
- [ ] 3.2 Add `src/main/stage/list_search.ts`: `matchEntries` with title and mosaic matches, and `matchPageOptions`, with "Without a mosaic" matched by the entry's title. Verify with unit tests:
  - `laureates on` matches Country Map by its mosaic;
  - `country` matches it by title;
  - pinned rows are hidden while searching;
  - an unsaved combination is found by its mod's and collection's titles.
- [ ] 3.3 Add `src/main/stage/list_choices.ts`, the per-list-kind sort and filter store, in memory, created in `main.tsx`. Verify with a unit test that a choice is kept across reads and that a new store starts with the default sort and no filter.
- [ ] 3.4 Rework the row builders in `combination_rows.ts` and the list modules:
  - remove the marks and add `mark`, `mosaics`, `score`, `options` and `searchText`;
  - build page options: mosaics, then "Without a mosaic", which is omitted for the current entry of a mosaic sandbox;
  - add tried combinations and the pinned current "Unsaved combination" row to the mosaic list;
  - add `buildPairChoice` to `combination_links.ts`.

  Verify with unit tests for each builder and for `buildPairChoice` (no `mosaic`, `sites` or params).

## 4. List component

- [ ] 4.1 Add `src/main/LoadingSpinner.tsx` (`LoaderCircle`, `motion-safe:animate-spin`, optional label) and use it in `PlayerDialog.tsx`. Verify `PlayerDialog.test.tsx` still passes.
- [ ] 4.2 Render the four columns in `CombinationList.tsx`:
  - the dot or ring with tooltip and accessible text, and `aria-current` on the current row;
  - the mosaic badge, with its icon, number and name;
  - the score, with the spinner, the muted zero and the untyped tooltip.

  Remove the "Not compatible" group. Verify with component tests that columns line up by role and that each mark is named.
- [ ] 4.3 Add `CombinationListToolbar.tsx`: `CommandInput`, a vertical `Separator`, the "Sort" radio menu and the "Filter" checkbox menu (pressed while a filter is checked), wired to `list_choices`. Verify with component tests: Escape closes only the menu, a click in the menu keeps the list open, and the choices of each list kind are kept separately.
- [ ] 4.4 Switch to `shouldFilter={false}` with a controlled search and render through `matchEntries` and `orderEntries`. Add pages:
  - the page state, a "Back" row, and Backspace on an empty search;
  - the search carried over for mosaic-only matches, and the main search restored on Back;
  - the parent highlighted on Back.

  Verify with component tests for each scenario of "Rows with mosaics open a page", "Page options", "Search" and "Entries found through their mosaics".
- [ ] 4.5 Add settling:
  - re-sort at most every 300ms while settling;
  - freeze on a pointer move or an arrow key;
  - settle again on opening, Back, a search change and a sort choice.

  Verify with component tests using fake timers for "Rows settle, then stay" and "Rows are sorted again".

## 5. Measuring ahead

- [ ] 5.1 Export each list's loads as a plain function, and include mosaic counts in the mosaic list's loads. Call them from `CombinationCapsule`'s `Tooltip` `onOpenChange(true)` through a new `onIntent` prop, and from the folded capsule's menu opening. Verify with component tests that hovering and focusing each capsule start its loads once.
- [ ] 5.2 Make `StageBar` request the summaries of all three lists once per combination sandbox shown. Verify with a component test that no count is requested before a hover, a focus or an opening.

## 6. End-to-end and docs

- [ ] 6.1 Update `e2e/stage_bar.spec.ts`:
  - the default order and columns;
  - Country Map's page from a Flashcards sandbox on the laureates (`17/17` and `0/17`), choosing its mosaic and "Without a mosaic";
  - search by `laureates on`;
  - sort by "Name" kept for the next sandbox and reset by a reload;
  - a tried combination in the mosaic list after a reload;
  - the tile type requests started by hovering the mod capsule;
  - a click in the mod's frame closing an open sort menu and its list.

  Remove the "Not compatible" and "no match" tests. Verify the file passes with `npm run test:e2e -- stage_bar`.
- [ ] 6.2 Update the stage bar section of `docs/modules/main/README.md`:
  - the columns, the dot and ring meanings in user words ("Tried recently, not saved in the app");
  - the sorts, filters and pages, and the search through mosaics;
  - measuring on hover.

  Verify every label it names matches the UI.
- [ ] 6.3 Add `.changeset/improve-combination-lists.md` with a `patch` bump (no breaking change for users or instantiations, and no mod API bump) and a one-line summary: the stage bar's lists sort by mosaics then name, show scores with mosaics' aliases, and get sort, filter, pages for mosaics and remembered tried combinations.
- [ ] 6.4 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify each passes.
