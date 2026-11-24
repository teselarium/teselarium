import { isBrowserFileAddress } from "../../files/index.ts";
import { loadModFile } from "../../mod/index.ts";
import type { ModLoadOptions } from "../../mod/index.ts";
import { buildUserMosaicEntries } from "../../user_catalog/index.ts";
import type {
  UserCatalogEntry,
  UserCatalogProvenance,
} from "../../user_catalog/index.ts";
import type { ResolvedInstanceCatalog } from "./instance_catalog.ts";

/** Who listed a catalog entry: the instance catalog, a mod as its default mosaic, or the user. */
export type CatalogListedBy = "instance" | "default" | "user";

/** Where a catalog entry's file lives: stored in this browser, or anywhere else. */
export type CatalogPlace = "remote" | "browser";

/** A mod or collection of the catalog: the resolved address of its file, and its marks. */
export interface CatalogEntry {
  source: string;
  listedBy: CatalogListedBy;
  place: CatalogPlace;
}

/** The mod whose default mosaic a catalog mosaic is. */
export interface CatalogMosaicMod {
  source: string;
  title: string;
}

/**
 * A mosaic of the catalog and its marks: the mod whose default mosaic it is,
 * or `null`, and the provenance of a user mosaic, or `null`.
 */
export interface CatalogMosaicEntry {
  source: string;
  listedBy: CatalogListedBy;
  place: CatalogPlace;
  defaultOf: CatalogMosaicMod | null;
  provenance: UserCatalogProvenance | null;
}

/** What `catalog.list` answers and `catalog.changed` pushes. Plain data. */
export interface Catalog {
  mods: CatalogEntry[];
  collections: CatalogEntry[];
  mosaics: CatalogMosaicEntry[];
}

/** `"browser"` for a `teselarium-browser:` address, `"remote"` for any other. */
function readCatalogPlace(source: string): CatalogPlace {
  if (isBrowserFileAddress(source)) {
    return "browser";
  }
  return "remote";
}

function buildCatalogEntries(sources: readonly string[]): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const source of sources) {
    entries.push({
      source,
      listedBy: "instance",
      place: readCatalogPlace(source),
    });
  }
  return entries;
}

function buildInstanceMosaicEntries(
  sources: readonly string[],
): CatalogMosaicEntry[] {
  const entries: CatalogMosaicEntry[] = [];
  for (const source of sources) {
    entries.push({
      source,
      listedBy: "instance",
      place: readCatalogPlace(source),
      defaultOf: null,
      provenance: null,
    });
  }
  return entries;
}

function buildUserCatalogMosaics(
  userCatalog: readonly UserCatalogEntry[],
): CatalogMosaicEntry[] {
  const entries: CatalogMosaicEntry[] = [];
  for (const userMosaic of buildUserMosaicEntries(userCatalog)) {
    entries.push({
      source: userMosaic.source,
      listedBy: "user",
      place: readCatalogPlace(userMosaic.source),
      defaultOf: null,
      provenance: userMosaic.provenance,
    });
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
      listedBy: "default",
      place: readCatalogPlace(modFile.defaultMosaic),
      defaultOf: { source: modFile.source, title: modFile.title },
      provenance: null,
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
 * The catalog as `catalog.list` answers it, built from the instance catalog,
 * the default mosaics while `includesDefaultMosaics` is on, and the user
 * catalog. With the switch off, nothing is fetched. With it on, each catalog
 * mod's file is loaded, without its entrypoint, and its default mosaic
 * follows the instance catalog's mosaics, in mod order, marked with its mod.
 * The user catalog's mosaics come last, in order of addition. A mosaic
 * already listed keeps its first place and its marks, and a mod that fails
 * or declares no default mosaic adds nothing.
 */
export async function buildCatalog(
  instanceCatalog: ResolvedInstanceCatalog,
  includesDefaultMosaics: boolean,
  userCatalog: readonly UserCatalogEntry[],
  fetchOptions: ModLoadOptions,
): Promise<Catalog> {
  let defaultMosaics: CatalogMosaicEntry[] = [];
  if (includesDefaultMosaics) {
    defaultMosaics = await loadDefaultMosaicEntries(
      instanceCatalog.mods,
      fetchOptions,
    );
  }
  const catalog: Catalog = {
    mods: buildCatalogEntries(instanceCatalog.mods),
    collections: buildCatalogEntries(instanceCatalog.collections),
    mosaics: dedupeMosaicEntries([
      ...buildInstanceMosaicEntries(instanceCatalog.mosaics),
      ...defaultMosaics,
      ...buildUserCatalogMosaics(userCatalog),
    ]),
  };
  return catalog;
}
