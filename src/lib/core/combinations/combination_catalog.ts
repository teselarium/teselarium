import type { Catalog } from "../engine/index.ts";
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
import type {
  Tile,
  TileCollection,
  TileCollectionIndex,
  TileValidator,
} from "../../tile/index.ts";
import { limitFetch } from "./fetch_limit.ts";
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
  /** The tile entries of the collection file, a repeated tile once. */
  tileCount: number;
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
  readCatalog: () => Promise<Catalog>;
}

/** What the stage bar's lists render. Frozen, and new after every change. */
export interface CombinationSnapshot {
  /** The last catalog read by `refreshCatalog`, or `null` before. */
  catalog: Catalog | null;
  mods: Readonly<Record<string, Loadable<ModSummary>>>;
  collections: Readonly<Record<string, Loadable<CollectionSummary>>>;
  mosaics: Readonly<Record<string, Loadable<MosaicSummary>>>;
  /** By `buildCountKey(modSource, targetSource)`, and a mosaic's by `buildMosaicCountKey(mosaicSource)`. */
  counts: Readonly<Record<string, Loadable<TileCount>>>;
}

/**
 * The summaries and tile-match counts of the stage bar's lists, measured on
 * demand and kept until the page is closed. Mutable. It holds no UI state.
 */
export interface CombinationCatalog {
  fetchOptions: CombinationLoadOptions;
  readCatalog: () => Promise<Catalog>;
  modFiles: Map<string, Promise<ModFile>>;
  collectionIndexes: Map<string, Promise<TileCollectionIndex>>;
  collectionLoads: Map<string, Promise<TileCollection>>;
  tileLoads: Map<string, Promise<Tile>>;
  validators: Map<string, Promise<TileValidator>>;
  /** Each summary's load, by `buildSummaryKey(table, source)`, so a later request waits for it too. */
  summaryLoads: Map<string, Promise<void>>;
  listeners: Set<() => void>;
  snapshot: CombinationSnapshot;
}

const LOADING: Loadable<never> = Object.freeze({ state: "loading" });

const EMPTY_SNAPSHOT: CombinationSnapshot = Object.freeze({
  catalog: null,
  mods: Object.freeze({}),
  collections: Object.freeze({}),
  mosaics: Object.freeze({}),
  counts: Object.freeze({}),
});

/** The key of a count in `CombinationSnapshot.counts`, without aliases. */
export function buildCountKey(modSource: string, targetSource: string): string {
  const key = `${modSource} ${targetSource}`;
  return key;
}

/**
 * The key of a mosaic's count, with its aliases, in
 * `CombinationSnapshot.counts`. It holds no space, so it never collides with
 * a pair's key.
 */
export function buildMosaicCountKey(mosaicSource: string): string {
  const key = `mosaic:${mosaicSource}`;
  return key;
}

/** Over HTTP/1.1, browsers open at most 6 connections per host. */
const MAX_PARALLEL_REQUESTS = 6;

/** The global `fetch` as it is when a request starts, so a later stub is used. */
function fetchGlobal(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, init);
}

/**
 * Every request of the catalog goes through one `fetch`, `fetchOptions.fetch`
 * or the global one, with at most 6 requests pending, all loads together.
 */
export function createCombinationCatalog(
  options: CombinationCatalogOptions,
): CombinationCatalog {
  const limitedFetch = limitFetch(
    options.fetchOptions.fetch ?? fetchGlobal,
    MAX_PARALLEL_REQUESTS,
  );
  const catalog: CombinationCatalog = {
    fetchOptions: { ...options.fetchOptions, fetch: limitedFetch },
    readCatalog: options.readCatalog,
    modFiles: new Map(),
    collectionIndexes: new Map(),
    collectionLoads: new Map(),
    tileLoads: new Map(),
    validators: new Map(),
    summaryLoads: new Map(),
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

function readCollectionIndex(
  catalog: CombinationCatalog,
  source: string,
): Promise<TileCollectionIndex> {
  return readCachedLoad(
    catalog.collectionIndexes,
    readTileCollectionIndex,
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
    loadCollectionIndex: readCollectionIndex.bind(undefined, catalog),
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
    const index = await readCollectionIndex(catalog, source);
    const summary: CollectionSummary = {
      source: index.source,
      title: index.title,
      tileCount: index.tiles.length,
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

type SummaryTable = "mods" | "collections" | "mosaics";

function buildSummaryKey(table: SummaryTable, source: string): string {
  const key = `${table} ${source}`;
  return key;
}

/**
 * The load of the summary of each source of `table`: the one already
 * started, or a new one for a source not requested yet.
 */
function requestTable(
  catalog: CombinationCatalog,
  table: SummaryTable,
  sources: readonly string[],
  load: (catalog: CombinationCatalog, source: string) => Promise<void>,
): Promise<void>[] {
  const loads: Promise<void>[] = [];
  for (const source of sources) {
    const key = buildSummaryKey(table, source);
    const started = catalog.summaryLoads.get(key);
    if (
      started !== undefined &&
      catalog.snapshot[table][source] !== undefined
    ) {
      loads.push(started);
      continue;
    }
    setEntry(catalog, table, source, LOADING);
    const loading = load(catalog, source);
    catalog.summaryLoads.set(key, loading);
    loads.push(loading);
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
 * mod files, collection indexes and mosaic files. Resolves once every
 * summary it names settled, those another request started too.
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
  const catalogRead = await catalog.readCatalog();
  publishCatalog(catalog, { ...catalog.snapshot, catalog: catalogRead });
}

/** One count to measure, and its key in `CombinationSnapshot.counts`. */
interface CountMeasure {
  key: string;
  modSource: string;
  target: CountTarget;
  aliases: Readonly<MosaicAliases>;
}

/** No aliases: a pair's count, not a mosaic's. */
const NO_ALIASES: Readonly<MosaicAliases> = Object.freeze({});

async function measureCount(
  catalog: CombinationCatalog,
  measure: CountMeasure,
): Promise<void> {
  const key = measure.key;
  try {
    const count = await measureTileCount(
      measure.modSource,
      measure.target,
      buildCountLoads(catalog),
      measure.aliases,
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
 * Tiles load once per collection, and each tile type file once, within the
 * catalog's limit on pending requests.
 */
export async function requestCounts(
  catalog: CombinationCatalog,
  modSources: readonly string[],
  target: CountTarget,
): Promise<void> {
  const measures: CountMeasure[] = [];
  for (const modSource of modSources) {
    measures.push({
      key: buildCountKey(modSource, target.source),
      modSource,
      target,
      aliases: NO_ALIASES,
    });
  }
  await startMeasures(catalog, measures);
}

/** Starts each measure whose count is not known or being measured. Resolves once they settled. */
async function startMeasures(
  catalog: CombinationCatalog,
  measures: readonly CountMeasure[],
): Promise<void> {
  const started: Promise<void>[] = [];
  for (const measure of measures) {
    if (catalog.snapshot.counts[measure.key] === undefined) {
      setEntry(catalog, "counts", measure.key, LOADING);
      started.push(measureCount(catalog, measure));
    }
  }
  await Promise.all(started);
}

/** The measure of a loaded mosaic's count, or `null` for a mosaic not loaded or without a collection. */
function buildMosaicMeasure(
  catalog: CombinationCatalog,
  mosaicSource: string,
): CountMeasure | null {
  const entry = catalog.snapshot.mosaics[mosaicSource];
  if (entry?.state !== "loaded" || entry.value.collection === null) {
    return null;
  }
  const measure: CountMeasure = {
    key: buildMosaicCountKey(mosaicSource),
    modSource: entry.value.mod,
    target: { kind: "collection", source: entry.value.collection },
    aliases: entry.value.aliases,
  };
  return measure;
}

/**
 * Starts measuring the count of each mosaic with its aliases, as its launch
 * renames its tiles, under `buildMosaicCountKey`. The mod, collection and
 * aliases are read from the mosaic's loaded summary, so a mosaic whose
 * summary is not loaded, or that has no collection, is left out. The
 * collection's tiles and the type file come from the same caches as the
 * pairs' counts. Resolves once they settled.
 */
export async function requestMosaicCounts(
  catalog: CombinationCatalog,
  mosaicSources: readonly string[],
): Promise<void> {
  const measures: CountMeasure[] = [];
  for (const mosaicSource of mosaicSources) {
    const measure = buildMosaicMeasure(catalog, mosaicSource);
    if (measure !== null) {
      measures.push(measure);
    }
  }
  await startMeasures(catalog, measures);
}

/** The keys of the counts of the loaded mosaics on the collection `source`. */
function listMosaicCountKeys(
  mosaics: CombinationSnapshot["mosaics"],
  source: string,
): Set<string> {
  const keys = new Set<string>();
  for (const [mosaicSource, entry] of Object.entries(mosaics)) {
    if (entry.state === "loaded" && entry.value.collection === source) {
      keys.add(buildMosaicCountKey(mosaicSource));
    }
  }
  return keys;
}

/** The counts of `snapshot` that are not on the target `source`, its mosaics' left out too. */
function leaveOutTarget(
  snapshot: CombinationSnapshot,
  source: string,
): Record<string, Loadable<TileCount>> {
  const kept: Record<string, Loadable<TileCount>> = {};
  const suffix = ` ${source}`;
  const mosaicKeys = listMosaicCountKeys(snapshot.mosaics, source);
  for (const [key, entry] of Object.entries(snapshot.counts)) {
    if (!key.endsWith(suffix) && !mosaicKeys.has(key)) {
      kept[key] = entry;
    }
  }
  return kept;
}

/**
 * Forgets a collection's or a tile's loaded tiles, its summary and its
 * counts, those of its mosaics too, as when the stage reloads its tiles, so the next list measures
 * them again.
 */
export function dropCollection(
  catalog: CombinationCatalog,
  source: string,
): void {
  catalog.collectionIndexes.delete(source);
  catalog.summaryLoads.delete(buildSummaryKey("collections", source));
  catalog.collectionLoads.delete(source);
  catalog.tileLoads.delete(source);
  const collections = { ...catalog.snapshot.collections };
  delete collections[source];
  publishCatalog(catalog, {
    ...catalog.snapshot,
    collections: Object.freeze(collections),
    counts: Object.freeze(leaveOutTarget(catalog.snapshot, source)),
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
