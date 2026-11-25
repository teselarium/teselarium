import { buildBrowserFileAddress } from "../files/index.ts";
import type {
  BrowserDatabaseChanges,
  StoredVersion,
  StoredVersionKind,
} from "../core/storage/index.ts";
import type { UserCatalogEntry } from "./user_catalog_entries.ts";
import {
  buildVersion,
  isChangedSinceExport,
  pruneVersions,
  readSyncedText,
} from "./versions.ts";

/** The file name of a new mosaic whose title leaves no letter or digit. */
const FALLBACK_FILE_NAME = "mosaic.yaml";

/** What a save or a restore writes. */
export interface SaveRequest {
  /** The draft's text, which the save confirmation validated. */
  draft: string;
  /** The draft's title, which names a new mosaic's file. */
  title: string;
  /** The stored entry it replaces, or `null` for a new mosaic. */
  entry: UserCatalogEntry | null;
  /** For a new mosaic, the address of the mosaic it is a copy of, or `null`. */
  copiedFrom: string | null;
  /** The entry's versions, newest first. Empty for a new mosaic. */
  versions: readonly StoredVersion[];
  now: Date;
  /** `"saved"`, or `"restored"` for a version restored from the history. */
  kind: Extract<StoredVersionKind, "saved" | "restored">;
  /** Makes a new mosaic's root. Defaults to `crypto.randomUUID()`. */
  createRoot?: () => string;
}

/** The changes of a save, and the address of the saved mosaic. */
export interface SavePlan {
  address: string;
  changes: Required<BrowserDatabaseChanges<UserCatalogEntry>>;
}

function createRandomRoot(): string {
  return crypto.randomUUID();
}

/**
 * The file name of a new mosaic: its title in lower case, accents dropped,
 * each run of other characters an underscore, then `.yaml`, or
 * `mosaic.yaml` when no letter or digit is left.
 */
export function buildSaveFileName(title: string): string {
  const plainTitle = title
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase();
  const name = plainTitle.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (name === "") {
    return FALLBACK_FILE_NAME;
  }
  const fileName = `${name}.yaml`;
  return fileName;
}

function buildNewEntry(
  request: SaveRequest,
  root: string,
  path: string,
  time: string,
): UserCatalogEntry {
  const entry: UserCatalogEntry = {
    address: buildBrowserFileAddress(root, path),
    place: "browser",
    root,
    provenance: {
      folder: null,
      path,
      addedAt: time,
      updatedAt: null,
      changedSinceExport: true,
      copiedFrom: request.copiedFrom,
    },
    syncedAt: null,
  };
  return entry;
}

function buildSavedEntry(
  request: SaveRequest,
  entry: UserCatalogEntry,
  time: string,
): UserCatalogEntry {
  const syncedText = readSyncedText(request.versions, entry.syncedAt);
  const savedEntry: UserCatalogEntry = {
    ...entry,
    provenance: {
      ...entry.provenance,
      updatedAt: time,
      changedSinceExport: isChangedSinceExport(request.draft, syncedText),
    },
  };
  return savedEntry;
}

function readSavedEntry(request: SaveRequest, time: string): UserCatalogEntry {
  if (request.entry !== null) {
    return buildSavedEntry(request, request.entry, time);
  }
  const createRoot = request.createRoot ?? createRandomRoot;
  return buildNewEntry(
    request,
    createRoot(),
    buildSaveFileName(request.title),
    time,
  );
}

/**
 * The changes of a save or a restore: a stored mosaic's file replaced at the
 * same address, or a new mosaic stored as a single file of its own root,
 * named after its title; a version with the draft's text; the update time;
 * and the history pruned. A new mosaic is changed since export until it is
 * exported.
 */
export function planSave(request: SaveRequest): SavePlan {
  const time = request.now.toISOString();
  const entry = readSavedEntry(request, time);
  const version = buildVersion(
    entry.address,
    time,
    request.kind,
    request.draft,
  );
  const plan: SavePlan = {
    address: entry.address,
    changes: {
      putFiles: [{ address: entry.address, text: request.draft }],
      putEntries: [entry],
      putVersions: [version],
      deleteVersions: pruneVersions(
        [version, ...request.versions],
        entry.syncedAt,
      ),
      deleteAddresses: [],
    },
  };
  return plan;
}
