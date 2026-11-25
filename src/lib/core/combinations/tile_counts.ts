import type { ModFile } from "../../mod/index.ts";
import { aliasCollectionTiles } from "../../mosaic/index.ts";
import type { MosaicAliases } from "../../mosaic/index.ts";
import { validateTileCollection } from "../../tile/index.ts";
import type {
  Tile,
  TileCollection,
  TileCollectionIndex,
  TileValidator,
} from "../../tile/index.ts";

/**
 * How many tiles of a collection or a tile have a mod's tile type, after a
 * mosaic's aliases when it is a mosaic's count. A mod without a tile type
 * matches every tile, and is marked `isUntyped`.
 */
export interface TileCount {
  matching: number;
  total: number;
  isUntyped: boolean;
}

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
  /** The collection file alone, with no tile requested. */
  loadCollectionIndex: (source: string) => Promise<TileCollectionIndex>;
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
  const count: TileCount = {
    matching,
    total: collection.tiles.length,
    isUntyped: false,
  };
  return count;
}

/** Every tile of the target matches a mod without a tile type: counted from the collection file, never its tiles. */
async function measureUntypedCount(
  target: CountTarget,
  loads: CountLoads,
): Promise<TileCount> {
  let total = 1;
  if (target.kind === "collection") {
    const index = await loads.loadCollectionIndex(target.source);
    total = index.tiles.length;
  }
  const count: TileCount = { matching: total, total, isUntyped: true };
  return count;
}

/** No aliases: the count of a mod or collection entry, not of a mosaic. */
const NO_ALIASES: MosaicAliases = {};

/**
 * Measures one count: the mod file, then the target's tiles and the mod's
 * tile type file, never the entrypoint, a library or a mosaic file. The
 * tiles are renamed by `aliases` before they are validated, as a mosaic's
 * launch does. A mod without a tile type is counted from the collection
 * file alone. Every load error propagates.
 */
export async function measureTileCount(
  modSource: string,
  target: CountTarget,
  loads: CountLoads,
  aliases: Readonly<MosaicAliases> = NO_ALIASES,
): Promise<TileCount> {
  const modFile = await loads.loadModFile(modSource);
  if (modFile.typeSource === null) {
    return measureUntypedCount(target, loads);
  }
  const [collection, validator] = await Promise.all([
    loadTargetTiles(target, loads),
    loads.loadValidator(modFile.typeSource),
  ]);
  const aliasedCollection = aliasCollectionTiles(collection, aliases);
  return countMatchingTiles(aliasedCollection, validator);
}
