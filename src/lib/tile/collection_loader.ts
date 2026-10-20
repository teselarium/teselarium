import {
  fetchFile,
  FileFetchError,
  MarkdownParseError,
  parseYaml,
  resolveLocation,
} from "../files/index.ts";
import type { FileFetchOptions, YamlValue } from "../files/index.ts";
import {
  buildMalformedTileEntry,
  readCollectionFormat,
  readTileEntry,
} from "./collection_format.ts";
import type {
  CollectionFormat,
  MalformedTileEntry,
  TileEntry,
} from "./collection_format.ts";
import type { IssueLevel, TileIssue } from "./tile_issues.ts";
import { loadTile } from "./tile_loader.ts";
import type { Tile } from "./tile_loader.ts";

/** A loaded tile collection. Tiles and issues follow the order of the entries. */
export interface TileCollection {
  /** Resolved absolute URL of the collection file. */
  source: string;
  name: string;
  /** Empty when the file has none. */
  description: string;
  tiles: Tile[];
  issues: TileIssue[];
}

/** Over HTTP/1.1, browsers open at most 6 connections per host. */
const MAX_PARALLEL_TILE_LOADS = 6;

const LOCAL_FILE_PROTOCOL = "file:";

/** One tile entry of the collection: an issue, a tile href still to load, or a loaded tile. */
type CollectionSlot =
  | { kind: "issue"; issue: TileIssue }
  | { kind: "load"; href: string }
  | { kind: "tile"; tile: Tile };

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

function buildIssueSlot(
  level: IssueLevel,
  source: string,
  message: string,
): CollectionSlot {
  const issueSlot: CollectionSlot = {
    kind: "issue",
    issue: { level, source, message },
  };
  return issueSlot;
}

function describeTileEntry(
  collectionUrl: URL,
  position: number,
  reason: string,
): string {
  const description = `Tile entry ${position} in collection "${collectionUrl.href}": ${reason}`;
  return description;
}

function buildMalformedEntrySlot(
  collectionUrl: URL,
  malformedTileEntry: MalformedTileEntry,
): CollectionSlot {
  return buildIssueSlot(
    "error",
    collectionUrl.href,
    describeTileEntry(
      collectionUrl,
      malformedTileEntry.position,
      malformedTileEntry.reason,
    ),
  );
}

function readAbsoluteTileUrl(
  location: string,
  position: number,
): URL | MalformedTileEntry {
  if (!URL.canParse(location)) {
    return buildMalformedTileEntry(
      position,
      `"url" must be an absolute URL, found "${location}"`,
    );
  }
  const tileUrl = new URL(location);
  return tileUrl;
}

function resolveTilePath(
  location: string,
  position: number,
  collectionUrl: URL,
): URL | MalformedTileEntry {
  try {
    const tileUrl = resolveLocation(location, collectionUrl.href);
    return tileUrl;
  } catch (error) {
    if (!(error instanceof FileFetchError)) {
      throw error;
    }
    return buildMalformedTileEntry(position, error.message);
  }
}

/** A `path` is resolved against the collection's source. A `url` must be absolute. */
function resolveTileEntry(
  tileEntry: TileEntry,
  position: number,
  collectionUrl: URL,
): URL | MalformedTileEntry {
  if (tileEntry.kind === "url") {
    return readAbsoluteTileUrl(tileEntry.location, position);
  }
  return resolveTilePath(tileEntry.location, position, collectionUrl);
}

function isLocalTileInRemoteCollection(
  tileUrl: URL,
  collectionUrl: URL,
): boolean {
  return (
    tileUrl.protocol === LOCAL_FILE_PROTOCOL &&
    collectionUrl.protocol !== LOCAL_FILE_PROTOCOL
  );
}

function planEntrySlot(
  entry: YamlValue,
  position: number,
  collectionUrl: URL,
): CollectionSlot {
  const tileEntry = readTileEntry(entry, position);
  if (tileEntry.kind === "malformed") {
    return buildMalformedEntrySlot(collectionUrl, tileEntry);
  }
  const tileUrl = resolveTileEntry(tileEntry, position, collectionUrl);
  if (!(tileUrl instanceof URL)) {
    return buildMalformedEntrySlot(collectionUrl, tileUrl);
  }
  if (isLocalTileInRemoteCollection(tileUrl, collectionUrl)) {
    return buildIssueSlot(
      "error",
      tileUrl.href,
      describeTileEntry(
        collectionUrl,
        position,
        "a remote collection cannot list local files",
      ),
    );
  }
  const loadSlot: CollectionSlot = { kind: "load", href: tileUrl.href };
  return loadSlot;
}

/**
 * Turns a repeated load into a warning. `firstPositions` maps each tile href
 * to the position of the first entry that loads it, and is updated here.
 */
function checkRepeatedTile(
  slot: CollectionSlot,
  position: number,
  collectionUrl: URL,
  firstPositions: Map<string, number>,
): CollectionSlot {
  if (slot.kind !== "load") {
    return slot;
  }
  const firstPosition = firstPositions.get(slot.href);
  if (firstPosition === undefined) {
    firstPositions.set(slot.href, position);
    return slot;
  }
  return buildIssueSlot(
    "warning",
    slot.href,
    describeTileEntry(
      collectionUrl,
      position,
      `repeats the tile of entry ${firstPosition}, so it is loaded once`,
    ),
  );
}

/** Plans every entry in order, before any tile request. Positions count from 1. */
function planCollectionSlots(
  collectionFormat: CollectionFormat,
  collectionUrl: URL,
): CollectionSlot[] {
  const slots: CollectionSlot[] = [];
  const firstPositions = new Map<string, number>();
  for (const [index, entry] of collectionFormat.entries.entries()) {
    const position = index + 1;
    const slot = planEntrySlot(entry, position, collectionUrl);
    slots.push(
      checkRepeatedTile(slot, position, collectionUrl, firstPositions),
    );
  }
  return slots;
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

function listTileLoads(slots: CollectionSlot[]): TileLoad[] {
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
  slots: CollectionSlot[],
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
    name: collectionFormat.name,
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
  const collectionFile = await fetchFile(location, options);
  const collectionFormat = readCollectionFormat(parseYaml(collectionFile));
  const collectionUrl = new URL(collectionFile.source);
  const slots = planCollectionSlots(collectionFormat, collectionUrl);
  const loadedSlots = await loadPlannedTiles(
    slots,
    buildTileOptions(collectionUrl, options),
  );
  const tileCollection = assembleTileCollection(
    collectionUrl,
    collectionFormat,
    loadedSlots,
  );
  return tileCollection;
}
