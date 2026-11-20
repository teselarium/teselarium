# Combinations Module

## Introduction

The stage bar's lists offer other mods for the same data, other data for the same mod, and other mosaics (see the [main module](../../../main/README.md#the-stage-bar)). This module measures what those lists show, on demand and once per page: the summaries of catalog entries and the tile-match counts that sort them. It holds no UI state, and the rules of what a choice opens live in the [stage module](../stage/README.md#opening-a-combination).

A tile-match count, the score a list shows, says how many tiles of a collection or a tile have a mod's tile type, as a `TileCount` `{ matching, total, isUntyped }`. Every score is a fraction:

- A pair's count, a mod on a collection or a tile, is a raw count: no mosaic's aliases apply, since a plain pair has none.
- A mosaic's count renames its collection's tiles by the mosaic's aliases first (`aliasCollectionTiles` of the [mosaic module](../../mosaic/README.md#config-and-aliases)), as the mosaic's launch does, so the country map scores `17/17` on the laureates through "Nobel laureates on the map" and `0/17` without it.
- A mod without a tile type matches every tile: it scores `total/total` with `isUntyped: true`. `total` is the collection file's tile count (1 for a tile), so its tiles are never loaded. `isUntyped` only says why, as the lists' tooltip does.

Measuring a count requests the mod file, then the collection file and its tiles (or the one tile) and the mod's tile type file. It never requests an entrypoint, a library or the mosaic file (the mosaic's summary gives its mod, collection and aliases), runs no frame, and shows nothing to the user.

## Module Details

Implemented in `src/lib/core/combinations/`. Other modules import only from the public entry point `src/lib/core/combinations/index.ts`.

- `createCombinationCatalog({ fetchOptions, readCatalog })`: a new store, a `CombinationCatalog`. `fetchOptions` are the app's address (`baseUrl`), the resolved default mods folder (`defaultModsFolder`) and an optional `fetch`. `readCatalog` gives the catalog listing; the app passes the stage's `readStageCatalog`, so the page and the mods read one catalog, with the current value of "List the default mosaics of mods".
- `refreshCatalog(catalog)`: reads the listing anew and keeps it in the snapshot's `listing`. A list calls it each time it opens.
- `requestSummaries(catalog, { mods, collections, mosaics })`: starts loading the summaries never requested yet: a `ModSummary` (`source`, `title`, `version`, `typeSource`) from the mod file alone (`loadModFile`), a `CollectionSummary` (`source`, `title`, `tileCount`) from the collection file alone (`readTileCollectionIndex`), and a `MosaicSummary` (`source`, `title`, `mod`, `collection`, `aliases`) from the mosaic file (`loadMosaicFile`). It resolves once every summary it names has settled, those another request started too, so a caller can read the loaded summaries right after it, as `requestMosaicCounts` needs.
- `requestCounts(catalog, modSources, target)`: starts measuring the count of each mod on `target`, a `CountTarget` (`{ kind: "collection" | "tile", source }`), unless it is known or being measured. A list asks only for the rows it shows.
- `requestMosaicCounts(catalog, mosaicSources)`: starts measuring each mosaic's count with its aliases, unless it is known or being measured. It reads the mod, the collection and the aliases from the mosaic's loaded summary, so a mosaic whose summary is not loaded yet, or that has no collection, is left out: request its summary first. A mosaic's count is kept under its own key, so it never replaces the plain pair's count.
- `dropCollection(catalog, source)`: forgets a collection's or a tile's loaded tiles, summary and counts, and the counts of the loaded mosaics on that collection. The page calls it when the stage reloads the tiles of that collection or tile, so the next list measures them again.
- `readCombinationSnapshot(catalog)` and `subscribeCombinations(catalog, listener)`: a frozen `CombinationSnapshot`, new after every change, for React's `useSyncExternalStore` (through `use_store_snapshot.ts`). `subscribeCombinations` returns the function that unsubscribes. The snapshot holds `listing`, and `mods`, `collections`, `mosaics` and `counts`, records of `Loadable` entries: `{ state: "loading" }`, `{ state: "loaded", value }` or `{ state: "failed", reason }`. Pairs' counts are keyed by `buildCountKey(modSource, targetSource)`, and mosaics' counts by `buildMosaicCountKey(mosaicSource)`.
- Types: `CombinationCatalog`, `CombinationCatalogOptions`, `CombinationLoadOptions`, `CombinationSnapshot`, `Loadable`, `ModSummary`, `CollectionSummary`, `MosaicSummary`, `SummaryRequest`, `CountTarget`, `TileCount` and `EntryScore`.

### Score order

`score_order.ts` is the one comparison of scores, used by the lists' "Match ratio" and "Matching tiles" sorts, by the order of a page's options and by an entry's best score. An `EntryScore` is a `Loadable<TileCount>`, or `null` for an entry with no score.

- `compareByRatio(a, b)`: higher `matching / total` first, then more matching tiles. Ratios are compared exactly, by cross-multiplying, so `12/17` and `24/34` have the same ratio; a count of no tiles has the ratio 0. So `9/10`, `50/100`, `5/10`.
- `compareByTiles(a, b)`: more matching tiles first, then higher `matching / total`. So `50/100`, `9/10`, `5/10`.
- Both put unknown scores (loading, failed or `null`) last, equal to each other, and give 0 for equal scores: the title is the last tie-break, applied by the caller's sort, which has the titles.
- `pickBestScore(scores)`: the first of `scores` as `compareByRatio` orders them. While any of them is loading, there is no best score yet and the result is `{ state: "loading" }`. Failed and `null` scores are left out, and the result is `null` when none is left.

Within one entry's page every option counts the same tiles, so they share a total and both orderings agree there: an entry's best score doesn't depend on the chosen sort.

### Caches

Each load is a promise kept by resolved source until the page is closed, so a second opening of a list requests nothing it already has:

- mod files, shared by the mod summaries and the counts;
- collection files read alone (`readTileCollectionIndex`), shared by the collection summaries and the scores of mods without a tile type;
- loaded collections and tiles, once per collection or tile, shared by the pairs' and the mosaics' counts;
- tile validators, once per tile type file (`buildTileValidator`);
- counts, once per mod and collection, mod and tile, or mosaic.

A failed load is kept as a failure with its reason, such as `HTTP 404`, which the lists show on the entry. `dropCollection` is the only way to forget an entry.

### Fetch limit

`createCombinationCatalog` wraps `fetchOptions.fetch`, or the global `fetch`, with `limitFetch(fetch, 6)` (`fetch_limit.ts`): a queue that keeps at most 6 requests pending and starts the oldest waiting one when one settles. Every load of the catalog goes through it, summaries and counts of all lists together, so the collection loader's own limit of 6 tile loads per collection no longer adds up across collections. Each request still settles with its own response or error. The stage's own launches don't use it.

Example:

```ts
import { readStageCatalog } from "./lib/core/stage/index.ts";
import {
  createCombinationCatalog,
  requestCounts,
} from "./lib/core/combinations/index.ts";

const combinations = createCombinationCatalog({
  fetchOptions: { baseUrl: document.baseURI, defaultModsFolder },
  readCatalog: readStageCatalog.bind(undefined, stage),
});
await requestCounts(combinations, [countryMapSource], {
  kind: "collection",
  source: laureatesSource,
});
// The count of Country Map on the laureates, without aliases: 0 of 17 tiles.
```
