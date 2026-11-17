import { FileFetchError, MarkdownParseError } from "../files/index.ts";
import type { FileFetchOptions } from "../files/index.ts";
import type { CollectionFormat } from "./collection_format.ts";
import {
  buildIssueSlot,
  LOCAL_FILE_PROTOCOL,
  planTileCollection,
} from "./collection_plan.ts";
import type { PlannedSlot } from "./collection_plan.ts";
import type { TileIssue } from "./tile_issues.ts";
import { loadTile } from "./tile_loader.ts";
import type { Tile } from "./tile_loader.ts";

/** A loaded tile collection. Tiles and issues follow the order of the entries. */
export interface TileCollection {
  /** Resolved absolute URL of the collection file. */
  source: string;
  title: string;
  /** Empty when the file has none. */
  description: string;
  tiles: Tile[];
  issues: TileIssue[];
}

/** Over HTTP/1.1, browsers open at most 6 connections per host. */
const MAX_PARALLEL_TILE_LOADS = 6;

/** One tile entry of the collection: a planned slot, or a loaded tile. */
type CollectionSlot = PlannedSlot | { kind: "tile"; tile: Tile };

interface TileLoad {
  slotIndex: number;
  href: string;
}

/** Shared by the load workers of one collection. It never leaves `loadTileCollection`. */
interface TileLoadQueue {
  loads: TileLoad[];
  next: number;
  results: CollectionSlot[];
}

/** Picked files are only given to the tiles of a collection that is itself local. */
function buildTileOptions(
  collectionUrl: URL,
  options: FileFetchOptions,
): FileFetchOptions {
  const isLocalCollection = collectionUrl.protocol === LOCAL_FILE_PROTOCOL;
  const tileOptions: FileFetchOptions = {
    fetch: options.fetch,
    localFiles: isLocalCollection ? options.localFiles : undefined,
  };
  return tileOptions;
}

/** Loads one tile. Only fetch and markdown failures become issues; anything else is a bug. */
async function loadCollectionTile(
  href: string,
  tileOptions: FileFetchOptions,
): Promise<CollectionSlot> {
  try {
    const tile = await loadTile(href, tileOptions);
    const tileSlot: CollectionSlot = { kind: "tile", tile };
    return tileSlot;
  } catch (error) {
    if (
      error instanceof FileFetchError ||
      error instanceof MarkdownParseError
    ) {
      return buildIssueSlot("error", error.source, error.message);
    }
    throw error;
  }
}

/**
 * Takes the next waiting load until none is left. The cursor only moves
 * between awaits, so no load is taken twice.
 */
async function runTileLoadWorker(
  loadQueue: TileLoadQueue,
  tileOptions: FileFetchOptions,
): Promise<void> {
  while (loadQueue.next < loadQueue.loads.length) {
    const tileLoad = loadQueue.loads[loadQueue.next];
    loadQueue.next += 1;
    loadQueue.results[tileLoad.slotIndex] = await loadCollectionTile(
      tileLoad.href,
      tileOptions,
    );
  }
}

function listTileLoads(slots: PlannedSlot[]): TileLoad[] {
  const tileLoads: TileLoad[] = [];
  for (const [slotIndex, slot] of slots.entries()) {
    if (slot.kind === "load") {
      tileLoads.push({ slotIndex, href: slot.href });
    }
  }
  return tileLoads;
}

/** Loads the planned tiles with at most `MAX_PARALLEL_TILE_LOADS` in progress. */
async function loadPlannedTiles(
  slots: PlannedSlot[],
  tileOptions: FileFetchOptions,
): Promise<CollectionSlot[]> {
  const loadQueue: TileLoadQueue = {
    loads: listTileLoads(slots),
    next: 0,
    results: [...slots],
  };
  const workerCount = Math.min(MAX_PARALLEL_TILE_LOADS, loadQueue.loads.length);
  const workers: Promise<void>[] = [];
  for (let worker = 0; worker < workerCount; worker += 1) {
    workers.push(runTileLoadWorker(loadQueue, tileOptions));
  }
  await Promise.all(workers);
  return loadQueue.results;
}

function assembleTileCollection(
  collectionUrl: URL,
  collectionFormat: CollectionFormat,
  loadedSlots: CollectionSlot[],
): TileCollection {
  const tiles: Tile[] = [];
  const issues: TileIssue[] = [];
  for (const slot of loadedSlots) {
    if (slot.kind === "tile") {
      tiles.push(slot.tile);
    }
    if (slot.kind === "issue") {
      issues.push(slot.issue);
    }
  }
  const tileCollection: TileCollection = {
    source: collectionUrl.href,
    title: collectionFormat.title,
    description: collectionFormat.description,
    tiles,
    issues,
  };
  return tileCollection;
}

/**
 * Loads a tile collection from a path or URL, then every tile it lists, at
 * most 6 at a time. Raises `FileFetchError`, `YamlParseError` or
 * `CollectionFormatError` when the collection file itself fails. Tiles that
 * fail become issues, and the rest of the list still loads.
 */
export async function loadTileCollection(
  location: string,
  options: FileFetchOptions = {},
): Promise<TileCollection> {
  const collectionPlan = await planTileCollection(location, options);
  const loadedSlots = await loadPlannedTiles(
    collectionPlan.slots,
    buildTileOptions(collectionPlan.collectionUrl, options),
  );
  const tileCollection = assembleTileCollection(
    collectionPlan.collectionUrl,
    collectionPlan.collectionFormat,
    loadedSlots,
  );
  return tileCollection;
}
