import type {
  StoredVersion,
  StoredVersionKey,
  StoredVersionKind,
} from "../core/storage/index.ts";

/** How many of a stored mosaic's newest versions are kept, besides the synced one. */
export const MAX_KEPT_VERSIONS = 20;

/** Newest first: ISO 8601 times in UTC sort as text. */
function compareNewestFirst(
  first: StoredVersionKey,
  second: StoredVersionKey,
): number {
  if (first.savedAt === second.savedAt) {
    return 0;
  }
  return first.savedAt < second.savedAt ? 1 : -1;
}

/**
 * The versions to delete so that a stored mosaic keeps its 20 newest
 * versions and, always, the one it was last imported, updated from a file
 * or exported with, at `syncedAt`. Gives their keys, oldest last.
 */
export function pruneVersions(
  versions: readonly StoredVersionKey[],
  syncedAt: string | null,
): StoredVersionKey[] {
  const sorted = [...versions].sort(compareNewestFirst);
  const deleted: StoredVersionKey[] = [];
  for (const version of sorted.slice(MAX_KEPT_VERSIONS)) {
    if (version.savedAt !== syncedAt) {
      deleted.push({ address: version.address, savedAt: version.savedAt });
    }
  }
  return deleted;
}

/**
 * Whether a stored mosaic's text differs from the text it was last
 * imported, updated from a file or exported with, `null` for a mosaic saved
 * in the app and never exported.
 */
export function isChangedSinceExport(
  text: string,
  syncedText: string | null,
): boolean {
  if (syncedText === null) {
    return true;
  }
  return text !== syncedText;
}

/** The text of the version at `syncedAt`, or `null` when there is none. */
export function readSyncedText(
  versions: readonly StoredVersion[],
  syncedAt: string | null,
): string | null {
  if (syncedAt === null) {
    return null;
  }
  for (const version of versions) {
    if (version.savedAt === syncedAt) {
      return version.text;
    }
  }
  return null;
}

/** The version a write puts for the new text of the stored file at `address`. */
export function buildVersion(
  address: string,
  savedAt: string,
  kind: StoredVersionKind,
  text: string,
): StoredVersion {
  const version: StoredVersion = { address, savedAt, kind, text };
  return version;
}
