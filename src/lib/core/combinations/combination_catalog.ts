import type { CatalogListing } from "../engine/index.ts";
import { loadModFile } from "../../mod/index.ts";
import type { ModFile, ModLoadOptions } from "../../mod/index.ts";
import { loadMosaicFile } from "../../mosaic/index.ts";
import type { MosaicAliases } from "../../mosaic/index.ts";
import {
  buildTileValidator,
  loadTile,
  loadTileCollection,
  readTileCollectionIndex,
} from "../../tile/index.ts";
import type { Tile, TileCollection, TileValidator } from "../../tile/index.ts";
import { measureTileCount } from "./tile_counts.ts";
import type { CountLoads, CountTarget, TileCount } from "./tile_counts.ts";

/** Something loaded on demand: still loading, loaded, or failed with the reason. Frozen. */
export type Loadable<Value> =
  | { state: "loading" }
  | { state: "loaded"; value: Value }
  | { state: "failed"; reason: string };

/** What the mod list shows of a mod file. Frozen. */
export interface ModSummary {
  source: string;
  title: string;
  version: string;
  /** The tile type file, or `null` for a mod without a tile type. */
  typeSource: string | null;
}

/** What the collection list shows of a collection file, read without loading any tile. Frozen. */
export interface CollectionSummary {
  source: string;
  title: string;
}

/** What the mosaic list shows of a mosaic file. Frozen. */
export interface MosaicSummary {
  source: string;
  title: string;
  /** Resolved. */
  mod: string;
  /** Resolved, or `null`. */
  collection: string | null;
  aliases: Readonly<MosaicAliases>;
}

/** The loads of the combination catalog: the app's address and default mods folder, and an optional `fetch`. */
export type CombinationLoadOptions = ModLoadOptions & {
  defaultModsFolder: string;
};

export interface CombinationCatalogOptions {
  fetchOptions: CombinationLoadOptions;
  /** The catalog as `catalog.list` answers it now (the stage's `readStageCatalog`). */
  readCatalog: () => Promise<CatalogListing>;
}

/** What the stage bar's lists render. Frozen, and new after every change. */
export interface CombinationSnapshot {
  /** The last catalog read by `refreshCatalog`, or `null` before. */
  listing: CatalogListing | null;
  mods: Readonly<Record<string, Loadable<ModSummary>>>;
  collections: Readonly<Record<string, Loadable<CollectionSummary>>>;
  mosaics: Readonly<Record<string, Loadable<MosaicSummary>>>;
  /** By `buildCountKey(modSource, targetSource)`. */
  counts: Readonly<Record<string, Loadable<TileCount>>>;
}

/**
 * The summaries and tile-match counts of the stage bar's lists, measured on
 * demand and kept until the page is closed. Mutable. It holds no UI state.
 */
export interface CombinationCatalog {
  fetchOptions: CombinationLoadOptions;
  readCatalog: () => Promise<CatalogListing>;
  modFiles: Map<string, Promise<ModFile>>;
  collectionLoads: Map<string, Promise<TileCollection>>;
  tileLoads: Map<string, Promise<Tile>>;
  validators: Map<string, Promise<TileValidator>>;
  listeners: Set<() => void>;
  snapshot: CombinationSnapshot;
}

const LOADING: Loadable<never> = Object.freeze({ state: "loading" });

const EMPTY_SNAPSHOT: CombinationSnapshot = Object.freeze({
  listing: null,
  mods: Object.freeze({}),
  collections: Object.freeze({}),
  mosaics: Object.freeze({}),
  counts: Object.freeze({}),
});

/** The key of a count in `CombinationSnapshot.counts`. */
export function buildCountKey(modSource: string, targetSource: string): string {
  const key = `${modSource} ${targetSource}`;
  return key;
}

export function createCombinationCatalog(
  options: CombinationCatalogOptions,
): CombinationCatalog {
  const catalog: CombinationCatalog = {
    fetchOptions: options.fetchOptions,
    readCatalog: options.readCatalog,
    modFiles: new Map(),
    collectionLoads: new Map(),
    tileLoads: new Map(),
    validators: new Map(),
    listeners: new Set(),
    snapshot: EMPTY_SNAPSHOT,
  };
  return catalog;
}

function publishCatalog(
  catalog: CombinationCatalog,
  snapshot: CombinationSnapshot,
): void {
  catalog.snapshot = Object.freeze(snapshot);
  for (const listener of catalog.listeners) {
    listener();
  }
}

type SnapshotTable = "mods" | "collections" | "mosaics" | "counts";

/** Sets one entry of a table of the snapshot, and publishes. */
function setEntry(
  catalog: CombinationCatalog,
  table: SnapshotTable,
  key: string,
  entry: Loadable<unknown>,
): void {
  const entries = { ...catalog.snapshot[table], [key]: Object.freeze(entry) };
  publishCatalog(catalog, {
    ...catalog.snapshot,
    [table]: Object.freeze(entries),
  });
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildLoaded<Value>(value: Value): Loadable<Value> {
  const loaded: Loadable<Value> = {
    state: "loaded",
    value: Object.freeze(value),
  };
  return loaded;
}

function buildFailed(error: unknown): Loadable<never> {
  const failed: Loadable<never> = {
    state: "failed",
    reason: describeError(error),
  };
  return failed;
}

function readModFile(
  catalog: CombinationCatalog,
  source: string,
): Promise<ModFile> {
  return readCachedLoad(
    catalog.modFiles,
    loadModFile,
    catalog.fetchOptions,
    source,
  );
}

function readCollection(
  catalog: CombinationCatalog,
  source: string,
): Promise<TileCollection> {
  return readCachedLoad(
    catalog.collectionLoads,
    loadTileCollection,
    catalog.fetchOptions,
    source,
  );
}

function readTile(catalog: CombinationCatalog, source: string): Promise<Tile> {
  return readCachedLoad(
    catalog.tileLoads,
    loadTile,
    catalog.fetchOptions,
    source,
  );
}

function readValidator(
  catalog: CombinationCatalog,
  typeSource: string,
): Promise<TileValidator> {
  return readCachedLoad(
    catalog.validators,
    buildTileValidator,
    catalog.fetchOptions,
    typeSource,
  );
}

/** The loads of a count, through the catalog's caches. */
function buildCountLoads(catalog: CombinationCatalog): CountLoads {
  const loads: CountLoads = {
    loadModFile: readModFile.bind(undefined, catalog),
    loadCollection: readCollection.bind(undefined, catalog),
    loadTile: readTile.bind(undefined, catalog),
    loadValidator: readValidator.bind(undefined, catalog),
  };
  return loads;
}

/** The cached load of `source`, or a new one with `options`, kept for the page. */
function readCachedLoad<Value>(
  cache: Map<string, Promise<Value>>,
  load: (source: string, options: CombinationLoadOptions) => Promise<Value>,
  options: CombinationLoadOptions,
  source: string,
): Promise<Value> {
  const cached = cache.get(source);
  if (cached !== undefined) {
    return cached;
  }
  const loading = load(source, options);
  cache.set(source, loading);
  return loading;
}

function buildModSummary(modFile: ModFile): ModSummary {
  const summary: ModSummary = {
    source: modFile.source,
    title: modFile.title,
    version: modFile.version,
    typeSource: modFile.typeSource,
  };
  return summary;
}

async function loadModSummary(
  catalog: CombinationCatalog,
  source: string,
): Promise<void> {
  try {
    const modFile = await readModFile(catalog, source);
    setEntry(catalog, "mods", source, buildLoaded(buildModSummary(modFile)));
  } catch (error) {
    setEntry(catalog, "mods", source, buildFailed(error));
  }
}

async function loadCollectionSummary(
  catalog: CombinationCatalog,
  source: string,
): Promise<void> {
  try {
    const index = await readTileCollectionIndex(source, catalog.fetchOptions);
    const summary: CollectionSummary = {
      source: index.source,
      title: index.title,
    };
    setEntry(catalog, "collections", source, buildLoaded(summary));
  } catch (error) {
    setEntry(catalog, "collections", source, buildFailed(error));
  }
}

async function loadMosaicSummary(
  catalog: CombinationCatalog,
  source: string,
): Promise<void> {
  try {
    const mosaic = await loadMosaicFile(source, catalog.fetchOptions);
    const summary: MosaicSummary = {
      source: mosaic.source,
      title: mosaic.title,
      mod: mosaic.mod,
      collection: mosaic.collection,
      aliases: mosaic.aliases,
    };
    setEntry(catalog, "mosaics", source, buildLoaded(summary));
  } catch (error) {
    setEntry(catalog, "mosaics", source, buildFailed(error));
  }
}

/** Starts loading the summary of each source of `table` not requested yet. */
function requestTable(
  catalog: CombinationCatalog,
  table: "mods" | "collections" | "mosaics",
  sources: readonly string[],
  load: (catalog: CombinationCatalog, source: string) => Promise<void>,
): Promise<void>[] {
  const loads: Promise<void>[] = [];
  for (const source of sources) {
    if (catalog.snapshot[table][source] === undefined) {
      setEntry(catalog, table, source, LOADING);
      loads.push(load(catalog, source));
    }
  }
  return loads;
}

/** The sources of each kind whose summaries a list shows. */
export interface SummaryRequest {
  mods?: readonly string[];
  collections?: readonly string[];
  mosaics?: readonly string[];
}

/**
 * Starts loading the summaries `request` names that were never requested:
 * mod files, collection indexes and mosaic files. Resolves once they settled.
 */
export async function requestSummaries(
  catalog: CombinationCatalog,
  request: SummaryRequest,
): Promise<void> {
  const loads = [
    ...requestTable(catalog, "mods", request.mods ?? [], loadModSummary),
    ...requestTable(
      catalog,
      "collections",
      request.collections ?? [],
      loadCollectionSummary,
    ),
    ...requestTable(
      catalog,
      "mosaics",
      request.mosaics ?? [],
      loadMosaicSummary,
    ),
  ];
  await Promise.all(loads);
}

/** Reads the catalog anew, as a list does each time it opens, and keeps it in the snapshot. */
export async function refreshCatalog(
  catalog: CombinationCatalog,
): Promise<void> {
  const listing = await catalog.readCatalog();
  publishCatalog(catalog, { ...catalog.snapshot, listing });
}

async function measureCount(
  catalog: CombinationCatalog,
  modSource: string,
  target: CountTarget,
): Promise<void> {
  const key = buildCountKey(modSource, target.source);
  try {
    const count = await measureTileCount(
      modSource,
      target,
      buildCountLoads(catalog),
    );
    if (catalog.snapshot.counts[key] !== undefined) {
      setEntry(catalog, "counts", key, buildLoaded(count));
    }
  } catch (error) {
    if (catalog.snapshot.counts[key] !== undefined) {
      setEntry(catalog, "counts", key, buildFailed(error));
    }
  }
}

/**
 * Starts measuring the count of each mod on `target` that is not known or
 * being measured, once per pair for the page. Resolves once they settled.
 * Tiles load with the collection loader's parallel limit, once per
 * collection, and each tile type file once.
 */
export async function requestCounts(
  catalog: CombinationCatalog,
  modSources: readonly string[],
  target: CountTarget,
): Promise<void> {
  const measures: Promise<void>[] = [];
  for (const modSource of modSources) {
    const key = buildCountKey(modSource, target.source);
    if (catalog.snapshot.counts[key] === undefined) {
      setEntry(catalog, "counts", key, LOADING);
      measures.push(measureCount(catalog, modSource, target));
    }
  }
  await Promise.all(measures);
}

/** The entries of `entries` whose key does not end with ` <source>`. */
function leaveOutTarget(
  entries: Readonly<Record<string, Loadable<TileCount>>>,
  source: string,
): Record<string, Loadable<TileCount>> {
  const kept: Record<string, Loadable<TileCount>> = {};
  const suffix = ` ${source}`;
  for (const [key, entry] of Object.entries(entries)) {
    if (!key.endsWith(suffix)) {
      kept[key] = entry;
    }
  }
  return kept;
}

/**
 * Forgets a collection's or a tile's loaded tiles, its summary and its
 * counts, as when the stage reloads its tiles, so the next list measures
 * them again.
 */
export function dropCollection(
  catalog: CombinationCatalog,
  source: string,
): void {
  catalog.collectionLoads.delete(source);
  catalog.tileLoads.delete(source);
  const collections = { ...catalog.snapshot.collections };
  delete collections[source];
  publishCatalog(catalog, {
    ...catalog.snapshot,
    collections: Object.freeze(collections),
    counts: Object.freeze(leaveOutTarget(catalog.snapshot.counts, source)),
  });
}

export function readCombinationSnapshot(
  catalog: CombinationCatalog,
): CombinationSnapshot {
  return catalog.snapshot;
}

function unsubscribeCombinations(
  catalog: CombinationCatalog,
  listener: () => void,
): void {
  catalog.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeCombinations(
  catalog: CombinationCatalog,
  listener: () => void,
): () => void {
  catalog.listeners.add(listener);
  return unsubscribeCombinations.bind(undefined, catalog, listener);
}
