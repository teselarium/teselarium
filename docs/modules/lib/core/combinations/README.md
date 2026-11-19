# Combinations Module

## Introduction

The stage bar's lists offer other mods for the same data, other data for the same mod, and other mosaics (see the [main module](../../../main/README.md#the-stage-bar)). This module measures what those lists show, on demand and once per page: the summaries of catalog entries and the tile-match counts that sort them. It holds no UI state, and the rules of what a choice opens live in the [stage module](../stage/README.md#opening-a-combination).

A tile-match count says how many tiles of a collection or a tile have a mod's tile type, as `{ matching, total }`, or `"any"` for a mod without a tile type. It is a raw count: no mosaic's aliases apply, since a plain pair has none. Measuring a count requests the mod file, then the collection file and its tiles (or the one tile) and the mod's tile type file. It never requests an entrypoint, a library or a mosaic file, runs no frame, and shows nothing to the user.

## Module Details

Implemented in `src/lib/core/combinations/`. Other modules import only from the public entry point `src/lib/core/combinations/index.ts`.

- `createCombinationCatalog({ fetchOptions, readCatalog })`: a new store, a `CombinationCatalog`. `fetchOptions` are the app's address (`baseUrl`), the resolved default mods folder (`defaultModsFolder`) and an optional `fetch`. `readCatalog` gives the catalog listing; the app passes the stage's `readStageCatalog`, so the page and the mods read one catalog, with the current value of "List the default mosaics of mods".
- `refreshCatalog(catalog)`: reads the listing anew and keeps it in the snapshot's `listing`. A list calls it each time it opens.
- `requestSummaries(catalog, { mods, collections, mosaics })`: starts loading the summaries never requested yet: a `ModSummary` (`source`, `title`, `version`, `typeSource`) from the mod file alone (`loadModFile`), a `CollectionSummary` (`source`, `title`) from the collection file alone (`readTileCollectionIndex`), and a `MosaicSummary` (`source`, `title`, `mod`, `collection`, `aliases`) from the mosaic file (`loadMosaicFile`).
- `requestCounts(catalog, modSources, target)`: starts measuring the count of each mod on `target`, a `CountTarget` (`{ kind: "collection" | "tile", source }`), unless it is known or being measured. A list asks only for the rows it shows.
- `dropCollection(catalog, source)`: forgets a collection's or a tile's loaded tiles, summary and counts. The page calls it when the stage reloads the tiles of that collection or tile, so the next list measures them again.
- `readCombinationSnapshot(catalog)` and `subscribeCombinations(catalog, listener)`: a frozen `CombinationSnapshot`, new after every change, for React's `useSyncExternalStore` (through `use_store_snapshot.ts`). `subscribeCombinations` returns the function that unsubscribes. The snapshot holds `listing`, and `mods`, `collections`, `mosaics` and `counts`, records of `Loadable` entries: `{ state: "loading" }`, `{ state: "loaded", value }` or `{ state: "failed", reason }`. Counts are keyed by `buildCountKey(modSource, targetSource)`.
- Types: `CombinationCatalog`, `CombinationCatalogOptions`, `CombinationLoadOptions`, `CombinationSnapshot`, `Loadable`, `ModSummary`, `CollectionSummary`, `MosaicSummary`, `SummaryRequest`, `CountTarget` and `TileCount`.

### Caches

Each load is a promise kept by resolved source until the page is closed, so a second opening of a list requests nothing it already has:

- mod files, shared by the mod summaries and the counts;
- loaded collections and tiles, once per collection or tile, with the collection loader's limit of 6 parallel tile loads;
- tile validators, once per tile type file (`buildTileValidator`);
- counts, once per mod and collection, or mod and tile.

A failed load is kept as a failure with its reason, such as `HTTP 404`, which the lists show on the entry. `dropCollection` is the only way to forget an entry.

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
