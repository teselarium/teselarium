import { loadModFile } from "../../mod/index.ts";
import type { ModLoadOptions } from "../../mod/index.ts";
import type { ResolvedAppCatalog } from "./app_catalog.ts";

/** A mod or collection of the catalog: the resolved address of its file. */
export interface CatalogEntry {
  source: string;
}

/** The mod whose default mosaic a catalog mosaic is. */
export interface CatalogMosaicMod {
  source: string;
  title: string;
}

/** A mosaic of the catalog, and the mod whose default mosaic it is, or `null` for the catalog's own mosaics. */
export interface CatalogMosaicEntry {
  source: string;
  defaultOf: CatalogMosaicMod | null;
}

/** What `catalog.list` answers and `catalog.changed` pushes. Plain data. */
export interface CatalogListing {
  mods: CatalogEntry[];
  collections: CatalogEntry[];
  mosaics: CatalogMosaicEntry[];
}

function buildCatalogEntries(sources: readonly string[]): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const source of sources) {
    entries.push({ source });
  }
  return entries;
}

function buildOwnMosaicEntries(
  sources: readonly string[],
): CatalogMosaicEntry[] {
  const entries: CatalogMosaicEntry[] = [];
  for (const source of sources) {
    entries.push({ source, defaultOf: null });
  }
  return entries;
}

/**
 * The default mosaic of the mod at `source`, marked with the mod, or `null`
 * when the mod declares none or its mod file cannot be loaded. Only the mod
 * file is fetched: neither its entrypoint nor the mosaic.
 */
async function loadDefaultMosaicEntry(
  source: string,
  fetchOptions: ModLoadOptions,
): Promise<CatalogMosaicEntry | null> {
  try {
    const modFile = await loadModFile(source, fetchOptions);
    if (modFile.defaultMosaic === null) {
      return null;
    }
    const entry: CatalogMosaicEntry = {
      source: modFile.defaultMosaic,
      defaultOf: { source: modFile.source, title: modFile.title },
    };
    return entry;
  } catch {
    // A mod that cannot be loaded adds nothing, and the rest is still listed.
    return null;
  }
}

/** The default mosaics of the catalog's mods, in catalog order, loaded in parallel. */
async function loadDefaultMosaicEntries(
  modSources: readonly string[],
  fetchOptions: ModLoadOptions,
): Promise<CatalogMosaicEntry[]> {
  const pendingEntries: Promise<CatalogMosaicEntry | null>[] = [];
  for (const source of modSources) {
    pendingEntries.push(loadDefaultMosaicEntry(source, fetchOptions));
  }
  const loadedEntries = await Promise.all(pendingEntries);
  const entries: CatalogMosaicEntry[] = [];
  for (const entry of loadedEntries) {
    if (entry !== null) {
      entries.push(entry);
    }
  }
  return entries;
}

/** The entries in order, without those whose source an earlier entry has. */
function dedupeMosaicEntries(
  entries: readonly CatalogMosaicEntry[],
): CatalogMosaicEntry[] {
  const seenSources = new Set<string>();
  const uniqueEntries: CatalogMosaicEntry[] = [];
  for (const entry of entries) {
    if (seenSources.has(entry.source)) {
      continue;
    }
    seenSources.add(entry.source);
    uniqueEntries.push(entry);
  }
  return uniqueEntries;
}

/**
 * The catalog as `catalog.list` answers it. With `includesDefaultMosaics`
 * off, nothing is fetched. With it on, each catalog mod's file is loaded,
 * without its entrypoint, and its default mosaic follows the catalog's own
 * mosaics, in mod order, marked with its mod. A mosaic already listed keeps
 * its first place, and a mod that fails or declares no default mosaic adds
 * nothing.
 */
export async function buildCatalogListing(
  catalog: ResolvedAppCatalog,
  includesDefaultMosaics: boolean,
  fetchOptions: ModLoadOptions,
): Promise<CatalogListing> {
  const ownMosaics = buildOwnMosaicEntries(catalog.mosaics);
  let mosaics = ownMosaics;
  if (includesDefaultMosaics) {
    const defaultMosaics = await loadDefaultMosaicEntries(
      catalog.mods,
      fetchOptions,
    );
    mosaics = dedupeMosaicEntries([...ownMosaics, ...defaultMosaics]);
  }
  const listing: CatalogListing = {
    mods: buildCatalogEntries(catalog.mods),
    collections: buildCatalogEntries(catalog.collections),
    mosaics,
  };
  return listing;
}
