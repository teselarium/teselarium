# Design

## Context

See proposal.md for why. The current state this builds on:

- **The combination catalog** (`src/lib/core/combinations/`) keeps promise caches and a frozen snapshot of `mods`, `collections`, `mosaics` and `counts`.
  - A count is `{ matching, total } | "any"`, keyed by `buildCountKey(mod, target)`.
  - `measureTileCount` loads the mod file, then the target's tiles and the type validator.
  - `requestSummaries` and `requestCounts` start only loads that were never started.
  - Collection summaries come from `readTileCollectionIndex`, which already lists the tile addresses, but the summary keeps only the title.
- **Parallel loads:** `loadTileCollection` loads 6 tiles at a time per collection (`MAX_PARALLEL_TILE_LOADS`, private). Two collections load 12 at once.
- **Aliases:** they are applied at launch by `aliasCollectionTiles` in `src/lib/core/engine/mod_launch.ts`, which wraps `applyMosaicAliases` from `src/lib/mosaic/`.
- **Lists:**
  - `CombinationList.tsx` wraps `Popover` and cmdk `Command`, with `filterByTitle` as cmdk's filter.
  - It records count ranks when the list opens and splits rows into a plain group and "Not compatible".
  - Rows carry `marks` (badges) and a `count`.
  - `ModList.tsx`, `CollectionList.tsx` and `MosaicList.tsx` build rows and start loads when opened.
- **Capsules:** each capsule (`CombinationCapsule.tsx`) is wrapped in a `Tooltip`, under `App.tsx`'s `TooltipProvider`.
- **Recently used:**
  - `src/main/settings/recently_used.ts` keeps `{ mods, collections, mosaics }` under `opentesela.recently-used`.
  - It is fed by the stage's `onFilesLoaded(entry)`, which `reportLoadedFile` in `stage_sandboxes.ts` calls for recorded launches (`isRecordedLaunch`).
- **Vendored components:** `DropdownMenu` (radio and checkbox items), `Separator`, `Tooltip`, `Badge` and `Command` are already vendored. `PlayerDialog.tsx` has a `LoaderCircle` spinner with `motion-safe:animate-spin`.

## Goals / Non-Goals

**Goals:**
- Every ordering, filtering and matching rule is a pure, unit-tested function. The React layer renders and keeps the open list's state.
- No new dependency and no vendored file edited.
- One comparison of scores, used by both score sorts, by the pages and by the best score.

**Non-Goals:**
- Saving tried combinations, or mods, collections and mosaics from links, in this app instance. The ring marks what a later change can save.
- Renaming or rewording the Settings "Catalog" group.
- A row that drops the current mosaic while keeping its pair (no "Without a mosaic" for the current entry of a mosaic sandbox).
- Changing how the stage bar folds, or the right side of the bar.

## Decisions

### A count is always a fraction

`TileCount` becomes `{ matching: number; total: number; isUntyped: boolean }`.

- For a mod without a tile type, `measureTileCount` returns `{ matching: total, total, isUntyped: true }`:
  - `total` is the collection index's tile count, which the collection summary now keeps as `tileCount`;
  - for a tile target, `total` is 1.
- So untyped scores never load tiles.
- The display reads only `matching/total`. `isUntyped` only picks the tooltip.

*Alternative:* keeping `"any"` with a total added, which needs a special case in every comparison and the display.

The index counts tiles whose files may fail, while typed counts use the loaded tiles. This is accepted: failures already show as warnings when the mod runs.

### Mosaic scores are counts with aliases, under their own key

- `aliasCollectionTiles` moves to `src/lib/mosaic/mosaic_aliases.ts`, next to `applyMosaicAliases`, and the engine imports it from there.
- `measureTileCount(mod, target, loads, aliases?)` aliases the loaded collection before validating, which is the launch's own path.
- Mosaic counts are keyed by `buildMosaicCountKey(mosaicSource)`, so they never overwrite the plain pair's count. Their collection and validator come from the same caches.
- `requestMosaicCounts(catalog, mosaicSources)` reads mod, collection and aliases from the loaded mosaic summaries.
- `dropCollection(source)` also drops the mosaic counts on that collection.

### One comparison module

`src/lib/core/combinations/score_order.ts` exports:
- `compareByRatio(a, b)` and `compareByTiles(a, b)`. Ratios are compared exactly by cross-multiplying, and unknown scores sort last.
- `pickBestScore(scores)`, which uses `compareByRatio` and gives `null` while any score is unknown.

The title is the last tie-break and is applied by the caller's sort, which has the titles. Within one entry's page all options share a total, so the two orderings agree there and the best score doesn't depend on the chosen sort.

### List rules as pure modules in `src/main/stage/`

- **`list_order.ts`:**
  - `orderEntries(entries, sort)`: "Mosaics first", "This pair first" (with its two groups), "Name", "Match ratio", "Matching tiles". Titles A-Z use `localeCompare` with base sensitivity.
  - `keepFilteredEntries(entries, filters)`.
  - Pinned rows (tile, "None", the current "Unsaved combination") are outside both.
- **`list_search.ts`:**
  - `matchEntries(entries, query)` returns, per entry, `{ by: "title" | "mosaics", mosaicIds }`.
  - `matchPageOptions(entry, query)` uses the same rule, with "Without a mosaic" matched by its entry's title.
  - The best score and the badge count read the matching options, so the main list and the page always agree.
- **`list_choices.ts`:**
  - A small store, created in `main.tsx` like recently used, holds `{ sort, filters }` for each list kind, in memory only.
  - The lists read and write it through `use_store_snapshot.ts`.

*Alternative:* component state, which is lost when a list closes. Settings storage would keep the choices across reloads, which is not wanted.

### Rows: one model for main rows and page options

`CombinationRow` drops `marks` and gains:
- `mark: "current" | "tried" | null`;
- `mosaics: { count: number; matching: number | null } | "icon" | null`;
- `score: Loadable<TileCount> | null`;
- `options: CombinationRow[] | null`, a page's mosaics and "Without a mosaic";
- `searchText`: the title, or `<mod> + <collection>` for an unsaved combination.

A row with options opens its page instead of calling `onChoose`. The builders in `ModList.tsx`, `CollectionList.tsx` and `MosaicList.tsx` fill these from the catalog snapshot, recently used and the link. `buildModChoice`, `buildCollectionChoice` and `buildMosaicChoice` stay as they are. A tried combination's choice is a new `buildPairChoice(mod, collection)` in `combination_links.ts`.

### Our own filtering, cmdk for the rest

- `Command` gets `shouldFilter={false}` and a controlled search value. The list renders only what `matchEntries` keeps, in `orderEntries` order.
- cmdk still owns the input, the highlighted row (controlled `value`, so Back can highlight the parent), arrow keys and Enter.
- Pages follow cmdk's documented nested pages pattern:
  - the state is `{ page: rowId | null, mainSearch, pageSearch }`;
  - Backspace on an empty search field goes back.

*Alternative:* expandable rows inside the listbox. `aria-expanded` is not allowed on `option`, so the state would have to be faked and the keys hand-rolled.

### Settling as a small state machine in the list

- **`settling`:** the list holds `orderedIds`, recomputed from the current rows at most every 300ms.
- **`frozen`:** on the first `pointermove` inside the list or an arrow key, the list keeps `orderedIds` as they are. New rows, if any, are appended.
- **Back to `settling`, with a new order at once:** opening, Back, a search text change, or choosing a sort.

This replaces the "ranks recorded at opening" code. The state is adjusted while rendering, as the current list already does for ranks.

### Toolbar composed around `CommandInput`

`CombinationListToolbar.tsx` lays out:
- `CommandInput`;
- a vertical `Separator`;
- a "Sort" `DropdownMenu` with `DropdownMenuRadioGroup`;
- a "Filter" `DropdownMenu` with `DropdownMenuCheckboxItem`s, shown pressed while any filter is checked.

Radix stacks the menu's dismissable layer above the popover's, so Escape and a click in the menu close only the menu.

### Measuring ahead from the capsules' tooltips

- Each list module exports its loads as a plain function (today's `startModListLoads` and its siblings), which takes the catalog, the snapshot and recently used.
- **Capsule tooltips:** `CombinationCapsule` gets an `onIntent` prop, called from its `Tooltip`'s `onOpenChange(true)`. Radix opens a tooltip after the hover delay or on keyboard focus, which is the trigger we want, without timers of our own. The capsule calls the same function its list calls when it opens.
- **The folded capsule** under 480px calls all three when its menu opens.
- **Summaries:** `StageBar` requests them (mods, collections, mosaics, no counts) for every list once per combination sandbox shown.

### One limit for every request of the combination catalog

- `createCombinationCatalog` wraps `fetchOptions.fetch`, or the global `fetch`, with `limitFetch(fetch, 6)`. It's a small queue in `src/lib/core/combinations/fetch_limit.ts` that starts a request when one of 6 settles.
- Every load of the catalog goes through it, so the caps of separate collections no longer add up.
- The stage's own launches don't use it.

*Alternative:* exporting the loader's worker pool, which only limits tiles within one collection.

### Tried combinations in recently used

- `LoadedFileEntry` gains `{ kind: "combination", mod, collection }`. `stage_sandboxes.ts` reports it once both the mod file and the collection file of a launch with a collection and without a mosaic have loaded.
- `recently_used.ts` gains `combinations: { mod, collection }[]`, with the same limit, order and checks.
- A stored value without `combinations` reads as an empty list, so existing storage keeps working.
- "Clear" drops all four kinds. The Settings count adds combinations.

### One spinner

`src/main/LoadingSpinner.tsx` wraps `LoaderCircle` with `motion-safe:animate-spin` and an optional label. `PlayerDialog.tsx` and the score column both use it.

## Risks / Trade-offs

- [Summaries load every catalog mod file, collection index and mosaic file when a combination sandbox shows] → They are small, loaded once per page and limited to 6 at a time. Counts still wait for a hover, a focus or an opening.
- [Hovering the collection capsule measures every mod on the collection, and the mosaic capsule every mosaic's collection] → Each collection's tiles load once and validators once per type. The shared limit keeps the bar from flooding the network.
- [Rows re-sorting under a reading user] → Rows stop moving at the first pointer move or arrow key, and re-sorts are throttled.
- [Custom filtering replaces cmdk's] → One pure function, unit-tested for title matches, mosaic matches and pages. cmdk still does keyboard and highlighting.
- [A Radix menu inside a Radix popover inside the stage bar's own outside-click rule] → A component test covers Escape and a click in the menu: the list stays open. An e2e test covers a click in the mod's frame: everything closes.
- [Tooltips don't open on touch] → Opening the list still measures, as today.
- [The component test suite for the lists is largely rewritten] → The behavior tests move to the pure modules, and component tests keep only what needs the DOM: columns, pages, toolbar and settling.

## Migration Plan

- No data migration: stored recently used entries without `combinations` read as before.
- Links are unchanged.
- Rollback is a revert. Stored combinations are then ignored by the old reader, which checks only its three kinds.
