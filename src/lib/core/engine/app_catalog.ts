import { resolveModReference } from "../../mod/index.ts";
import { resolveMosaicReference } from "../../mosaic/index.ts";
import { resolveCollectionReference } from "../../tile/index.ts";
import { findSwitchedOffMod } from "./default_mod_settings.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { describeEngineError } from "./engine_errors.ts";

/**
 * The mods, collections and mosaics an instantiation offers: three ordered
 * lists of references, relative to the app's address. A mod entry may be a
 * default mod name.
 */
export interface AppCatalog {
  mods: string[];
  collections: string[];
  mosaics: string[];
}

/** An app catalog whose entries are the resolved addresses of their files, without switched-off default mods. */
export interface ResolvedAppCatalog {
  mods: string[];
  collections: string[];
  mosaics: string[];
}

/** What `resolveAppCatalog` gives: the resolved catalog, and the start errors, each naming its list and entry. */
export interface AppCatalogResolution {
  catalog: ResolvedAppCatalog;
  errors: string[];
}

/** The name of a catalog list, as errors name it. */
type CatalogListName = keyof AppCatalog;

/** Resolves one reference of a list to the address of its file. Raises when it cannot be resolved. */
type CatalogEntryResolver = (
  reference: string,
  baseUrl: string,
  defaults: ResolvedDefaultModSettings,
) => string;

function resolveCatalogMod(
  reference: string,
  baseUrl: string,
  defaults: ResolvedDefaultModSettings,
): string {
  const source = resolveModReference(reference, {
    baseUrl,
    defaultModsFolder: defaults.folder,
  });
  return source;
}

function resolveCatalogCollection(reference: string, baseUrl: string): string {
  const source = resolveCollectionReference(reference, baseUrl);
  return source;
}

function resolveCatalogMosaic(reference: string, baseUrl: string): string {
  const source = resolveMosaicReference(reference, baseUrl);
  return source;
}

/** What resolving one list gives: its sources in order, and its errors. */
interface CatalogListResolution {
  sources: string[];
  errors: string[];
}

function describeEntryError(
  listName: CatalogListName,
  reference: unknown,
  reason: string,
): string {
  const entryError = `Catalog ${listName}: ${JSON.stringify(reference)} ${reason}.`;
  return entryError;
}

/**
 * Resolves one entry, or gives the reason it cannot be: not a non-empty
 * string, not resolvable, or a repeat of an earlier source of its list.
 */
function resolveCatalogEntry(
  reference: unknown,
  resolveEntry: CatalogEntryResolver,
  baseUrl: string,
  defaults: ResolvedDefaultModSettings,
  seenSources: Set<string>,
): { source: string } | { reason: string } {
  if (typeof reference !== "string" || reference === "") {
    const emptyEntry = {
      reason: "is empty: an entry must be a non-empty string",
    };
    return emptyEntry;
  }
  let source: string;
  try {
    source = resolveEntry(reference, baseUrl, defaults);
  } catch (error) {
    const unresolved = {
      reason: `cannot be resolved: ${describeEngineError(error)}`,
    };
    return unresolved;
  }
  if (seenSources.has(source)) {
    const repeat = { reason: `repeats an earlier entry (${source})` };
    return repeat;
  }
  const resolved = { source };
  return resolved;
}

function resolveCatalogList(
  listName: CatalogListName,
  references: readonly string[],
  resolveEntry: CatalogEntryResolver,
  baseUrl: string,
  defaults: ResolvedDefaultModSettings,
): CatalogListResolution {
  const resolution: CatalogListResolution = { sources: [], errors: [] };
  const seenSources = new Set<string>();
  for (const reference of references) {
    const entry = resolveCatalogEntry(
      reference,
      resolveEntry,
      baseUrl,
      defaults,
      seenSources,
    );
    if ("reason" in entry) {
      resolution.errors.push(
        describeEntryError(listName, reference, entry.reason),
      );
      continue;
    }
    seenSources.add(entry.source);
    resolution.sources.push(entry.source);
  }
  return resolution;
}

/** The mod sources without the switched-off default mods. */
function leaveOutSwitchedOffMods(
  sources: readonly string[],
  defaults: ResolvedDefaultModSettings,
): string[] {
  const openableSources: string[] = [];
  for (const source of sources) {
    if (findSwitchedOffMod(source, defaults) === null) {
      openableSources.push(source);
    }
  }
  return openableSources;
}

/**
 * Resolves each list of the catalog against the app's address with the rules
 * of its kind, and leaves out switched-off default mods. An entry that is
 * empty, cannot be resolved, or resolves to the same file as an earlier entry
 * of its list gives an error naming the list and the entry as written: the
 * catalog is a mistake of whoever set it, so the app does not start.
 */
export function resolveAppCatalog(
  catalog: AppCatalog,
  baseUrl: string,
  defaults: ResolvedDefaultModSettings,
): AppCatalogResolution {
  const mods = resolveCatalogList(
    "mods",
    catalog.mods,
    resolveCatalogMod,
    baseUrl,
    defaults,
  );
  const collections = resolveCatalogList(
    "collections",
    catalog.collections,
    resolveCatalogCollection,
    baseUrl,
    defaults,
  );
  const mosaics = resolveCatalogList(
    "mosaics",
    catalog.mosaics,
    resolveCatalogMosaic,
    baseUrl,
    defaults,
  );
  const resolution: AppCatalogResolution = {
    catalog: {
      mods: leaveOutSwitchedOffMods(mods.sources, defaults),
      collections: collections.sources,
      mosaics: mosaics.sources,
    },
    errors: [...mods.errors, ...collections.errors, ...mosaics.errors],
  };
  return resolution;
}
