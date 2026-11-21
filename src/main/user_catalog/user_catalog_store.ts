import type {
  BrowserDatabase,
  BrowserDatabaseChanges,
} from "../../lib/core/storage/index.ts";
import { changeStageUserCatalog } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { forgetRecentlyUsedMosaics } from "../settings/recently_used.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";

/** The user catalog's database. */
export type UserCatalogDatabase = BrowserDatabase<UserCatalogEntry>;

/** The part of `navigator.storage` the store uses. */
export type PersistentStorage = Pick<StorageManager, "persist" | "persisted">;

/** The message of the error that the import dialog shows when the browser refused the store. */
export const STORE_REFUSED_MESSAGE =
  "This browser does not let the app store files, for example in a private window. Nothing was stored.";

/** The browser files store cannot be used: the browser refused to open it. */
export class UserCatalogUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super(STORE_REFUSED_MESSAGE, options);
    this.name = "UserCatalogUnavailableError";
  }
}

/** What the store and the stage start with, read before the stage is created. */
export interface StartUserCatalog {
  /** `null` when the browser has no database or refused it: the user catalog is then empty and read-only. */
  database: UserCatalogDatabase | null;
  entries: readonly UserCatalogEntry[];
}

export interface UserCatalogStoreOptions {
  /** The opening of the browser database, which `readStartUserCatalog` started with the app. */
  start: Promise<StartUserCatalog>;
  stage: Stage;
  recentlyUsed: RecentlyUsed;
  /** `navigator.storage`, or `null` when the browser has none. */
  persistentStorage: PersistentStorage | null;
}

/** What the dialogs and Settings render. Frozen. */
export interface UserCatalogSnapshot {
  entries: readonly UserCatalogEntry[];
  /** Whether the browser keeps the storage persistently, or `null` until it is known. */
  persisted: boolean | null;
  /** Whether files can be stored: `false` when the browser refused the database. */
  isAvailable: boolean;
  /** Whether the database was opened and its entries read, or found refused. */
  isStarted: boolean;
}

/** The user catalog of the app: its entries, the database they live in, and who follows them. Mutable. */
export interface UserCatalogStore {
  /** `null` until the database is open, and when the browser refused it. */
  database: UserCatalogDatabase | null;
  /** Resolves once the database was opened and its entries read, or found refused. */
  starting: Promise<void>;
  stage: Stage;
  recentlyUsed: RecentlyUsed;
  persistentStorage: PersistentStorage | null;
  /** Whether the browser was asked to keep the storage, so it is asked once per page. */
  hasAskedPersistence: boolean;
  listeners: Set<() => void>;
  /** New after every change. */
  snapshot: UserCatalogSnapshot;
}

/**
 * Opens the browser database and reads its entries. A database that cannot
 * be opened or read gives an empty, read-only user catalog, never an error,
 * since the user's data must not stop the app.
 */
export async function readStartUserCatalog(
  openDatabase: () => Promise<UserCatalogDatabase | null>,
): Promise<StartUserCatalog> {
  const unavailable: StartUserCatalog = { database: null, entries: [] };
  try {
    const database = await openDatabase();
    if (database === null) {
      return unavailable;
    }
    const start: StartUserCatalog = {
      database,
      entries: await database.readEntries(),
    };
    return start;
  } catch {
    return unavailable;
  }
}

function publishUserCatalog(
  store: UserCatalogStore,
  snapshot: UserCatalogSnapshot,
): void {
  store.snapshot = Object.freeze(snapshot);
  for (const listener of store.listeners) {
    listener();
  }
}

function keepPersistence(store: UserCatalogStore, persisted: boolean): void {
  publishUserCatalog(store, { ...store.snapshot, persisted });
}

async function readPersistence(store: UserCatalogStore): Promise<void> {
  if (store.persistentStorage === null) {
    return;
  }
  try {
    keepPersistence(store, await store.persistentStorage.persisted());
  } catch {
    // Unknown: Settings says nothing about it.
  }
}

/**
 * Keeps the opened database and its entries, and gives the stage the entries,
 * so running mods get `catalog.changed` when there is any.
 */
async function finishStart(
  store: UserCatalogStore,
  start: Promise<StartUserCatalog>,
): Promise<void> {
  const started = await start;
  store.database = started.database;
  publishUserCatalog(store, {
    ...store.snapshot,
    entries: Object.freeze(structuredClone([...started.entries])),
    isAvailable: started.database !== null,
    isStarted: true,
  });
  if (started.entries.length > 0) {
    await changeStageUserCatalog(store.stage, started.entries);
  }
}

/**
 * Builds the store, empty until the database opened with the app is read,
 * and reads whether the browser already keeps the storage persistently. The
 * app starts without waiting for it.
 */
export function createUserCatalogStore(
  options: UserCatalogStoreOptions,
): UserCatalogStore {
  const store: UserCatalogStore = {
    database: null,
    starting: Promise.resolve(),
    stage: options.stage,
    recentlyUsed: options.recentlyUsed,
    persistentStorage: options.persistentStorage,
    hasAskedPersistence: false,
    listeners: new Set(),
    snapshot: Object.freeze({
      entries: Object.freeze([]),
      persisted: null,
      isAvailable: true,
      isStarted: false,
    }),
  };
  store.starting = finishStart(store, options.start);
  void readPersistence(store);
  return store;
}

/** Resolves once the store has read the database opened with the app. */
export function waitForUserCatalogStart(
  store: UserCatalogStore,
): Promise<void> {
  return store.starting;
}

/**
 * Reads the stored files for the stage, waiting for the database opened
 * with the app, so a stored mosaic opens even right at the start.
 */
export async function readStartingText(
  start: Promise<StartUserCatalog>,
  address: string,
): Promise<string | null> {
  const started = await start;
  if (started.database === null) {
    return null;
  }
  return started.database.readText(address);
}

async function requireDatabase(
  store: UserCatalogStore,
): Promise<UserCatalogDatabase> {
  await store.starting;
  if (store.database === null) {
    throw new UserCatalogUnavailableError();
  }
  return store.database;
}

/**
 * Asks the browser to keep the storage once, when a file is first stored on
 * this page, and keeps its answer. The app works the same either way.
 */
async function askPersistence(store: UserCatalogStore): Promise<void> {
  if (store.hasAskedPersistence || store.persistentStorage === null) {
    return;
  }
  store.hasAskedPersistence = true;
  try {
    keepPersistence(store, await store.persistentStorage.persist());
  } catch {
    // The browser refused to answer: the storage is not known to be kept.
    keepPersistence(store, false);
  }
}

/** Publishes the new entries, and tells the stage and recently used. */
async function followEntries(
  store: UserCatalogStore,
  entries: readonly UserCatalogEntry[],
  removedAddresses: readonly string[],
): Promise<void> {
  publishUserCatalog(store, {
    ...store.snapshot,
    entries: Object.freeze([...entries]),
  });
  forgetRecentlyUsedMosaics(store.recentlyUsed, removedAddresses);
  await changeStageUserCatalog(store.stage, entries);
}

/**
 * Writes the changes in one transaction, then reads the entries back, so a
 * write from another tab is kept. Every running mod gets `catalog.changed`,
 * recently used forgets the deleted addresses, and the first stored file
 * asks the browser to keep the storage, without waiting for its answer. Raises `UserCatalogUnavailableError`
 * when the browser refused the database, and any error of the write, before
 * anything changed.
 */
export async function applyUserCatalogChanges(
  store: UserCatalogStore,
  changes: BrowserDatabaseChanges<UserCatalogEntry>,
): Promise<void> {
  const database = await requireDatabase(store);
  await database.apply(changes);
  const entries = await database.readEntries();
  await followEntries(store, entries, changes.deleteAddresses);
  if (changes.putFiles.length > 0) {
    // Not awaited: Firefox asks the user, and the change is done meanwhile.
    void askPersistence(store);
  }
}

function listEntryAddresses(entries: readonly UserCatalogEntry[]): string[] {
  const addresses: string[] = [];
  for (const entry of entries) {
    addresses.push(entry.address);
  }
  return addresses;
}

/** Removes every user entry and every stored file at once, as Settings' "Remove all" does. */
export async function removeAllUserMosaics(
  store: UserCatalogStore,
): Promise<void> {
  const database = await requireDatabase(store);
  const removedAddresses = listEntryAddresses(store.snapshot.entries);
  await database.clear();
  await followEntries(store, [], removedAddresses);
}

/** The stored text at `address`, or `null`, also when the browser refused the database. */
export async function readUserCatalogText(
  store: UserCatalogStore,
  address: string,
): Promise<string | null> {
  await store.starting;
  if (store.database === null) {
    return null;
  }
  return store.database.readText(address);
}

export function readUserCatalogSnapshot(
  store: UserCatalogStore,
): UserCatalogSnapshot {
  return store.snapshot;
}

function unsubscribeUserCatalog(
  store: UserCatalogStore,
  listener: () => void,
): void {
  store.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeUserCatalog(
  store: UserCatalogStore,
  listener: () => void,
): () => void {
  store.listeners.add(listener);
  return unsubscribeUserCatalog.bind(undefined, store, listener);
}
