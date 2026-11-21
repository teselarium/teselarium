/** Where an entry's mosaic file lives: stored in this browser, or on a site. */
export type UserCatalogPlace = "browser" | "remote";

/**
 * Where an entry came from. A stored entry has the picked folder's name, or
 * `null` for a single file, and its path inside the folder or its file name.
 * A remote entry has `null` for both. Times are ISO 8601 strings in UTC.
 */
export interface UserCatalogProvenance {
  folder: string | null;
  path: string | null;
  /** When it was first imported, or added by URL. */
  addedAt: string;
  /** When it was last updated from a file, or `null`. */
  updatedAt: string | null;
}

/**
 * A mosaic of the user catalog. `address` is its `opentesela-browser:`
 * address when stored, or its `http:` or `https:` address when remote.
 * `root` is the root of the stored file's address, or `null` when remote.
 */
export interface UserCatalogEntry {
  address: string;
  place: UserCatalogPlace;
  root: string | null;
  provenance: UserCatalogProvenance;
}

/** A user mosaic as the catalog lists it. */
export interface UserMosaic {
  source: string;
  place: UserCatalogPlace;
  provenance: UserCatalogProvenance;
}

/** The catalog's user mosaics: one per entry, in order of addition. */
export function buildUserMosaicEntries(
  entries: readonly UserCatalogEntry[],
): UserMosaic[] {
  const mosaics: UserMosaic[] = [];
  for (const entry of entries) {
    mosaics.push({
      source: entry.address,
      place: entry.place,
      provenance: structuredClone(entry.provenance),
    });
  }
  return mosaics;
}

/** The entry of a mosaic added by URL at `now`. */
export function buildRemoteEntry(address: string, now: Date): UserCatalogEntry {
  const entry: UserCatalogEntry = {
    address,
    place: "remote",
    root: null,
    provenance: {
      folder: null,
      path: null,
      addedAt: now.toISOString(),
      updatedAt: null,
    },
  };
  return entry;
}

/** The entry at `address`, stored or remote, or `null`. */
export function findUserEntry(
  entries: readonly UserCatalogEntry[],
  address: string,
): UserCatalogEntry | null {
  for (const entry of entries) {
    if (entry.address === address) {
      return entry;
    }
  }
  return null;
}

/** The stored entry at `address`, or `null`, also for a remote one. */
export function findStoredEntry(
  entries: readonly UserCatalogEntry[],
  address: string,
): UserCatalogEntry | null {
  const entry = findUserEntry(entries, address);
  if (entry === null || entry.place !== "browser") {
    return null;
  }
  return entry;
}

/** The file name a stored entry is exported under: the last segment of its path. */
export function readExportFileName(entry: UserCatalogEntry): string {
  const path = entry.provenance.path ?? "mosaic.yaml";
  const segments = path.split("/");
  const fileName = segments[segments.length - 1];
  return fileName;
}
