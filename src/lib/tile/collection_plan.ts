import {
  fetchFile,
  FileFetchError,
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
import { resolveCollectionReference } from "./collection_reference.ts";
import type { IssueLevel, TileIssue } from "./tile_issues.ts";

export const LOCAL_FILE_PROTOCOL = "file:";

/** One tile entry of the collection, before any tile request: an issue, or a tile href to load. */
export type PlannedSlot =
  { kind: "issue"; issue: TileIssue } | { kind: "load"; href: string };

/**
 * A collection file read and its entries planned: the result of the steps
 * that reading an index and loading a collection share.
 */
export interface CollectionPlan {
  collectionUrl: URL;
  collectionFormat: CollectionFormat;
  slots: PlannedSlot[];
}

export function buildIssueSlot(
  level: IssueLevel,
  source: string,
  message: string,
): PlannedSlot {
  const issueSlot: PlannedSlot = {
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
): PlannedSlot {
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
): PlannedSlot {
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
  const loadSlot: PlannedSlot = { kind: "load", href: tileUrl.href };
  return loadSlot;
}

/**
 * Turns a repeated load into a warning. `firstPositions` maps each tile href
 * to the position of the first entry that loads it, and is updated here.
 */
function checkRepeatedTile(
  slot: PlannedSlot,
  position: number,
  collectionUrl: URL,
  firstPositions: Map<string, number>,
): PlannedSlot {
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
): PlannedSlot[] {
  const slots: PlannedSlot[] = [];
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

/**
 * Fetches and parses a collection file, named by a collection reference (the
 * file or its folder), then plans its entries, requesting no tile. Raises `FileFetchError`, `YamlParseError` or
 * `CollectionFormatError` when the collection file itself fails.
 */
export async function planTileCollection(
  location: string,
  options: FileFetchOptions,
): Promise<CollectionPlan> {
  const collectionSource = resolveCollectionReference(
    location,
    options.baseUrl,
  );
  const collectionFile = await fetchFile(collectionSource, options);
  const collectionFormat = readCollectionFormat(parseYaml(collectionFile));
  const collectionUrl = new URL(collectionFile.source);
  const collectionPlan: CollectionPlan = {
    collectionUrl,
    collectionFormat,
    slots: planCollectionSlots(collectionFormat, collectionUrl),
  };
  return collectionPlan;
}
