import type {
  LoadedFileEntry,
  LoadedFileKind,
} from "../../lib/core/stage/index.ts";
import { readStoredJson, writeStoredJson } from "./stored_json.ts";
import type { SettingsStorage } from "./stored_json.ts";

/** The part of `Storage` the store uses. The app passes `localStorage`. */
export type RecentlyUsedStorage = SettingsStorage;

export interface RecentlyUsedOptions {
  storage: RecentlyUsedStorage;
}

/** The recently used sources of each kind, newest first. Frozen. */
export interface RecentlyUsedSnapshot {
  mods: readonly string[];
  collections: readonly string[];
  mosaics: readonly string[];
}

/** The mods, collections and mosaics the user tried in combination sandboxes. Mutable. */
export interface RecentlyUsed {
  storage: RecentlyUsedStorage;
  listeners: Set<() => void>;
  /** New after every change. */
  snapshot: RecentlyUsedSnapshot;
}

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const RECENTLY_USED_KEY = "opentesela.recently-used";

/** How many entries of each kind are kept. */
export const RECENTLY_USED_LIMIT = 10;

type RecentlyUsedList = keyof RecentlyUsedSnapshot;

const LIST_OF_KIND: Readonly<Record<LoadedFileKind, RecentlyUsedList>> =
  Object.freeze({
    mod: "mods",
    collection: "collections",
    mosaic: "mosaics",
  });

/** A valid source is a resolved web address: a picked local file does not outlive the page. */
function isValidSource(value: unknown): value is string {
  if (typeof value !== "string" || !URL.canParse(value)) {
    return false;
  }
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

/** The valid, distinct sources of a stored list, in order, at most `RECENTLY_USED_LIMIT`. */
function readValidSources(stored: unknown): readonly string[] {
  const sources: string[] = [];
  if (!Array.isArray(stored)) {
    return Object.freeze(sources);
  }
  for (const entry of stored) {
    if (isValidSource(entry) && !sources.includes(entry)) {
      sources.push(entry);
    }
  }
  return Object.freeze(sources.slice(0, RECENTLY_USED_LIMIT));
}

function readStoredList(stored: unknown, list: RecentlyUsedList): unknown {
  if (typeof stored !== "object" || stored === null) {
    return null;
  }
  return (stored as Record<string, unknown>)[list];
}

function readValidSnapshot(stored: unknown): RecentlyUsedSnapshot {
  const snapshot: RecentlyUsedSnapshot = {
    mods: readValidSources(readStoredList(stored, "mods")),
    collections: readValidSources(readStoredList(stored, "collections")),
    mosaics: readValidSources(readStoredList(stored, "mosaics")),
  };
  return Object.freeze(snapshot);
}

function publishRecentlyUsed(
  store: RecentlyUsed,
  snapshot: RecentlyUsedSnapshot,
): void {
  store.snapshot = Object.freeze(snapshot);
  writeStoredJson(store.storage, RECENTLY_USED_KEY, snapshot);
  for (const listener of store.listeners) {
    listener();
  }
}

/** `sources` without `source`. */
function leaveOutSource(sources: readonly string[], source: string): string[] {
  const kept: string[] = [];
  for (const existing of sources) {
    if (existing !== source) {
      kept.push(existing);
    }
  }
  return kept;
}

/**
 * Reads the stored entries, dropping those that are not valid sources. The
 * cleaned lists are written back on the next change.
 */
export function createRecentlyUsed(options: RecentlyUsedOptions): RecentlyUsed {
  const store: RecentlyUsed = {
    storage: options.storage,
    listeners: new Set(),
    snapshot: readValidSnapshot(
      readStoredJson(options.storage, RECENTLY_USED_KEY),
    ),
  };
  return store;
}

/**
 * Records a file a combination sandbox loaded at the front of its kind's
 * list, moving it there when it is already kept, and drops the oldest past
 * `RECENTLY_USED_LIMIT`. Stored when the storage allows. An entry that is not
 * a web address is not recorded.
 */
export function recordRecentlyUsed(
  store: RecentlyUsed,
  entry: LoadedFileEntry,
): void {
  if (!isValidSource(entry.source)) {
    return;
  }
  const list = LIST_OF_KIND[entry.kind];
  const sources = store.snapshot[list];
  if (sources[0] === entry.source) {
    return;
  }
  const recorded = [entry.source, ...leaveOutSource(sources, entry.source)];
  publishRecentlyUsed(store, {
    ...store.snapshot,
    [list]: Object.freeze(recorded.slice(0, RECENTLY_USED_LIMIT)),
  });
}

/** Drops one entry, as a list's "Remove" button does. Stored when the storage allows. */
export function removeRecentlyUsed(
  store: RecentlyUsed,
  entry: LoadedFileEntry,
): void {
  const list = LIST_OF_KIND[entry.kind];
  publishRecentlyUsed(store, {
    ...store.snapshot,
    [list]: Object.freeze(leaveOutSource(store.snapshot[list], entry.source)),
  });
}

/** Drops every entry of the three kinds at once, from the storage too when it allows. */
export function clearRecentlyUsed(store: RecentlyUsed): void {
  const cleared: RecentlyUsedSnapshot = {
    mods: Object.freeze([]),
    collections: Object.freeze([]),
    mosaics: Object.freeze([]),
  };
  publishRecentlyUsed(store, cleared);
}

export function readRecentlyUsedSnapshot(
  store: RecentlyUsed,
): RecentlyUsedSnapshot {
  return store.snapshot;
}

function unsubscribeRecentlyUsed(
  store: RecentlyUsed,
  listener: () => void,
): void {
  store.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeRecentlyUsed(
  store: RecentlyUsed,
  listener: () => void,
): () => void {
  store.listeners.add(listener);
  return unsubscribeRecentlyUsed.bind(undefined, store, listener);
}
