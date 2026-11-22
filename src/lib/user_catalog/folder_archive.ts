import { strToU8, zipSync } from "fflate";
import type { Zippable } from "fflate";
import type { BrowserDatabaseChanges } from "../core/storage/index.ts";
import type { UserCatalogEntry } from "./user_catalog_entries.ts";

/** A stored entry to export: its stored text, and the `savedAt` of its current version, or `null` when it has none. */
export interface ArchivedEntry {
  entry: UserCatalogEntry;
  text: string;
  currentVersion: string | null;
}

/** The `.zip` of a folder, and the changes that make its entries unchanged since export. */
export interface FolderArchive {
  bytes: Uint8Array;
  changes: Required<BrowserDatabaseChanges<UserCatalogEntry>>;
}

function buildNoChanges(): Required<BrowserDatabaseChanges<UserCatalogEntry>> {
  const changes: Required<BrowserDatabaseChanges<UserCatalogEntry>> = {
    putFiles: [],
    putEntries: [],
    putVersions: [],
    deleteVersions: [],
    deleteAddresses: [],
  };
  return changes;
}

/**
 * The entry synced with its current version, since its text was just
 * exported. An entry without a version, which only a write outside the
 * planners could leave, is kept as it is.
 */
function syncExportedEntry(
  entry: UserCatalogEntry,
  currentVersion: string | null,
): UserCatalogEntry {
  if (currentVersion === null) {
    return entry;
  }
  const syncedEntry: UserCatalogEntry = {
    ...entry,
    provenance: { ...entry.provenance, changedSinceExport: false },
    syncedAt: currentVersion,
  };
  return syncedEntry;
}

/**
 * The changes after one stored entry was exported: it is synced with its
 * current version, so it is unchanged since export. No version is added,
 * since its text did not change.
 */
export function planExportSync(
  entry: UserCatalogEntry,
  currentVersion: string | null,
): Required<BrowserDatabaseChanges<UserCatalogEntry>> {
  const changes = buildNoChanges();
  changes.putEntries.push(syncExportedEntry(entry, currentVersion));
  return changes;
}

/**
 * The `.zip` of the stored entries of `folder`, each at its path with its
 * stored text, so unzipping it over the folder replaces the files in place,
 * and the changes that sync each of them with its current version.
 */
export function buildFolderArchive(
  archived: readonly ArchivedEntry[],
  folder: string,
): FolderArchive {
  const files: Zippable = {};
  const changes = buildNoChanges();
  for (const { entry, text, currentVersion } of archived) {
    const isOfFolder =
      entry.place === "browser" && entry.provenance.folder === folder;
    if (!isOfFolder || entry.provenance.path === null) {
      continue;
    }
    files[entry.provenance.path] = strToU8(text);
    changes.putEntries.push(syncExportedEntry(entry, currentVersion));
  }
  const folderArchive: FolderArchive = { bytes: zipSync(files), changes };
  return folderArchive;
}
