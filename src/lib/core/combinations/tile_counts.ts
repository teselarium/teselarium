import type { ModFile } from "../../mod/index.ts";
import { validateTileCollection } from "../../tile/index.ts";
import type { Tile, TileCollection, TileValidator } from "../../tile/index.ts";

/**
 * How many tiles of a collection or a tile have a mod's tile type, without
 * any mosaic's aliases, or `"any"` for a mod without a tile type.
 */
export type TileCount = { matching: number; total: number } | "any";

/** What a count is measured on: a collection, or one tile. */
export interface CountTarget {
  kind: "collection" | "tile";
  /** The collection's or the tile's resolved source. */
  source: string;
}

/** The loads a count needs, each cached by the combination catalog. */
export interface CountLoads {
  loadModFile: (source: string) => Promise<ModFile>;
  loadCollection: (source: string) => Promise<TileCollection>;
  loadTile: (source: string) => Promise<Tile>;
  loadValidator: (typeSource: string) => Promise<TileValidator>;
}

/** A collection of one tile, so a tile is counted as a collection is. */
function buildSingleTileCollection(tile: Tile): TileCollection {
  const collection: TileCollection = {
    source: tile.source,
    title: "",
    description: "",
    tiles: [tile],
    issues: [],
  };
  return collection;
}

async function loadTargetTiles(
  target: CountTarget,
  loads: CountLoads,
): Promise<TileCollection> {
  if (target.kind === "tile") {
    const tile = await loads.loadTile(target.source);
    return buildSingleTileCollection(tile);
  }
  return loads.loadCollection(target.source);
}

/** The tiles of `collection` that validate as the type of `validator`. */
export function countMatchingTiles(
  collection: TileCollection,
  validator: TileValidator,
): TileCount {
  const validated = validateTileCollection(collection, validator);
  let matching = 0;
  for (const tile of validated.tiles) {
    if (tile.types.includes(validator.typeName)) {
      matching += 1;
    }
  }
  const count: TileCount = { matching, total: collection.tiles.length };
  return count;
}

/**
 * Measures one count: the mod file, then the target's tiles and the mod's
 * tile type file, never the entrypoint, a library or a mosaic file. Every
 * load error propagates.
 */
export async function measureTileCount(
  modSource: string,
  target: CountTarget,
  loads: CountLoads,
): Promise<TileCount> {
  const modFile = await loads.loadModFile(modSource);
  if (modFile.typeSource === null) {
    return "any";
  }
  const [collection, validator] = await Promise.all([
    loadTargetTiles(target, loads),
    loads.loadValidator(modFile.typeSource),
  ]);
  return countMatchingTiles(collection, validator);
}
