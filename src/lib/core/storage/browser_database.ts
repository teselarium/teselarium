/** The text of a file stored in the browser, at its `teselarium-browser:` address. */
export interface StoredFile {
  address: string;
  text: string;
}

/** What every entry of the database has: the address that keys it. */
export interface AddressedEntry {
  address: string;
}

/** What made a stored file's text: its import, an update from a file, a save in the app, or a restore. */
export type StoredVersionKind = "imported" | "updated" | "saved" | "restored";

/** Names one version: the stored file's address and when its text was written. */
export interface StoredVersionKey {
  address: string;
  /** An ISO 8601 time in UTC. */
  savedAt: string;
}

/** A text a stored file had, kept in its history. */
export interface StoredVersion extends StoredVersionKey {
  kind: StoredVersionKind;
  text: string;
}

/**
 * One write of the database, applied at once: files, entries and versions to
 * put, then versions to delete, then addresses whose file, entry and versions
 * are deleted. Absent versions mean none.
 */
export interface BrowserDatabaseChanges<Entry extends AddressedEntry> {
  putFiles: StoredFile[];
  putEntries: Entry[];
  putVersions?: StoredVersion[];
  deleteVersions?: StoredVersionKey[];
  deleteAddresses: string[];
}

/**
 * The browser's storage of imported files and of the entries that list them.
 * An entry put again keeps its place, a new one goes last.
 */
export interface BrowserDatabase<Entry extends AddressedEntry> {
  /** The stored text at `address`, or `null`. */
  readText(address: string): Promise<string | null>;
  /** Every entry, in order of addition. */
  readEntries(): Promise<Entry[]>;
  /** The versions of the stored file at `address`, newest first. */
  readVersions(address: string): Promise<StoredVersion[]>;
  /** Writes the changes in one transaction: all of them, or none. */
  apply(changes: BrowserDatabaseChanges<Entry>): Promise<void>;
  /** Deletes every file, entry and version. */
  clear(): Promise<void>;
}

/** The IndexedDB database of the app. A later store raises the version. */
export const BROWSER_DATABASE_NAME = "teselarium";
/** Version 2 added `versions`. */
export const BROWSER_DATABASE_VERSION = 2;
/** Keyed by address, `{ address, text }` as value. */
export const FILES_STORE = "files";
/** Keyed by the entry's address, `{ position, entry }` as value. */
export const USER_CATALOG_STORE = "user-catalog";
/** Keyed by `[address, savedAt]`, `StoredVersion` as value, with an index on `address`. Added in version 2. */
export const VERSIONS_STORE = "versions";
export const VERSIONS_ADDRESS_INDEX = "address";

const ALL_STORES = [FILES_STORE, USER_CATALOG_STORE, VERSIONS_STORE];

/** Newest first: ISO 8601 times in UTC sort as text. */
function compareNewestFirst(
  first: StoredVersion,
  second: StoredVersion,
): number {
  if (first.savedAt === second.savedAt) {
    return 0;
  }
  return first.savedAt < second.savedAt ? 1 : -1;
}

function buildVersionKey(version: StoredVersionKey): string {
  const key = JSON.stringify([version.address, version.savedAt]);
  return key;
}

/** Copies in and out, so callers never share an entry with the database. */
class MemoryBrowserDatabase<
  Entry extends AddressedEntry,
> implements BrowserDatabase<Entry> {
  private readonly files = new Map<string, string>();
  private readonly entries = new Map<string, Entry>();
  private readonly versions = new Map<string, StoredVersion>();

  async readText(address: string): Promise<string | null> {
    const text = this.files.get(address) ?? null;
    return text;
  }

  async readEntries(): Promise<Entry[]> {
    const entries = structuredClone([...this.entries.values()]);
    return entries;
  }

  async readVersions(address: string): Promise<StoredVersion[]> {
    const versions: StoredVersion[] = [];
    for (const version of this.versions.values()) {
      if (version.address === address) {
        versions.push(structuredClone(version));
      }
    }
    versions.sort(compareNewestFirst);
    return versions;
  }

  async apply(changes: BrowserDatabaseChanges<Entry>): Promise<void> {
    for (const file of changes.putFiles) {
      this.files.set(file.address, file.text);
    }
    for (const entry of changes.putEntries) {
      this.entries.set(entry.address, structuredClone(entry));
    }
    for (const version of changes.putVersions ?? []) {
      this.versions.set(buildVersionKey(version), structuredClone(version));
    }
    for (const key of changes.deleteVersions ?? []) {
      this.versions.delete(buildVersionKey(key));
    }
    for (const address of changes.deleteAddresses) {
      this.files.delete(address);
      this.entries.delete(address);
      this.deleteAddressVersions(address);
    }
  }

  private deleteAddressVersions(address: string): void {
    for (const [key, version] of this.versions) {
      if (version.address === address) {
        this.versions.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.files.clear();
    this.entries.clear();
    this.versions.clear();
  }
}

/** A new, empty database kept in memory, for tests. */
export function createMemoryBrowserDatabase<
  Entry extends AddressedEntry,
>(): BrowserDatabase<Entry> {
  const database = new MemoryBrowserDatabase<Entry>();
  return database;
}

/** A record of the user catalog store: the entry and its place in the order of addition. */
interface PositionedEntry<Entry extends AddressedEntry> {
  position: number;
  entry: Entry;
}

type RequestResolve = (value: unknown) => void;
type RequestReject = (reason: unknown) => void;

function describeRequestError(error: DOMException | null): Error {
  if (error !== null) {
    return error;
  }
  const unknownError = new Error("The browser database request failed");
  return unknownError;
}

function resolveRequestResult(
  request: IDBRequest,
  resolve: RequestResolve,
): void {
  resolve(request.result);
}

function rejectRequestError(request: IDBRequest, reject: RequestReject): void {
  reject(describeRequestError(request.error));
}

function settleRequest(
  request: IDBRequest,
  resolve: RequestResolve,
  reject: RequestReject,
): void {
  request.onsuccess = resolveRequestResult.bind(undefined, request, resolve);
  request.onerror = rejectRequestError.bind(undefined, request, reject);
}

/** The result of one IndexedDB request. */
async function readRequest<Result>(
  request: IDBRequest<Result>,
): Promise<Result> {
  const result = await new Promise(settleRequest.bind(undefined, request));
  return result as Result;
}

function resolveTransaction(resolve: RequestResolve): void {
  resolve(undefined);
}

function rejectTransaction(
  transaction: IDBTransaction,
  reject: RequestReject,
): void {
  reject(describeRequestError(transaction.error));
}

function settleTransaction(
  transaction: IDBTransaction,
  resolve: RequestResolve,
  reject: RequestReject,
): void {
  transaction.oncomplete = resolveTransaction.bind(undefined, resolve);
  transaction.onerror = rejectTransaction.bind(undefined, transaction, reject);
  transaction.onabort = rejectTransaction.bind(undefined, transaction, reject);
}

/** Resolves once the transaction commits, rejects when it fails or aborts. */
async function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  await new Promise(settleTransaction.bind(undefined, transaction));
}

async function readIndexedText(
  database: IDBDatabase,
  address: string,
): Promise<string | null> {
  const transaction = database.transaction(FILES_STORE, "readonly");
  const request = transaction.objectStore(FILES_STORE).get(address);
  const file = (await readRequest(request)) as StoredFile | undefined;
  if (file === undefined) {
    return null;
  }
  return file.text;
}

function comparePositions<Entry extends AddressedEntry>(
  first: PositionedEntry<Entry>,
  second: PositionedEntry<Entry>,
): number {
  return first.position - second.position;
}

async function readIndexedEntries<Entry extends AddressedEntry>(
  database: IDBDatabase,
): Promise<Entry[]> {
  const transaction = database.transaction(USER_CATALOG_STORE, "readonly");
  const request = transaction.objectStore(USER_CATALOG_STORE).getAll();
  const records = (await readRequest(request)) as PositionedEntry<Entry>[];
  records.sort(comparePositions);
  const entries: Entry[] = [];
  for (const record of records) {
    entries.push(record.entry);
  }
  return entries;
}

async function readIndexedVersions(
  database: IDBDatabase,
  address: string,
): Promise<StoredVersion[]> {
  const transaction = database.transaction(VERSIONS_STORE, "readonly");
  const index = transaction
    .objectStore(VERSIONS_STORE)
    .index(VERSIONS_ADDRESS_INDEX);
  const versions = (await readRequest(
    index.getAll(address),
  )) as StoredVersion[];
  versions.sort(compareNewestFirst);
  return versions;
}

/** Deletes every version of `address`, inside the write's transaction. */
async function deleteIndexedAddressVersions(
  versionsStore: IDBObjectStore,
  address: string,
): Promise<void> {
  const index = versionsStore.index(VERSIONS_ADDRESS_INDEX);
  const keys = await readRequest(index.getAllKeys(address));
  for (const key of keys) {
    versionsStore.delete(key);
  }
}

/** The position of each stored entry by address, and the next free one. */
interface StoredPositions {
  byAddress: Map<string, number>;
  next: number;
}

async function readStoredPositions(
  catalogStore: IDBObjectStore,
): Promise<StoredPositions> {
  const records = (await readRequest(
    catalogStore.getAll(),
  )) as PositionedEntry<AddressedEntry>[];
  const positions: StoredPositions = { byAddress: new Map(), next: 0 };
  for (const record of records) {
    positions.byAddress.set(record.entry.address, record.position);
    positions.next = Math.max(positions.next, record.position + 1);
  }
  return positions;
}

function claimPosition(positions: StoredPositions, address: string): number {
  const storedPosition = positions.byAddress.get(address);
  if (storedPosition !== undefined) {
    return storedPosition;
  }
  const position = positions.next;
  positions.byAddress.set(address, position);
  positions.next += 1;
  return position;
}

/**
 * Reads the current positions inside the write's transaction, so a write
 * from another tab is kept: only the changed addresses are put or deleted.
 */
async function writeIndexedChanges<Entry extends AddressedEntry>(
  transaction: IDBTransaction,
  changes: BrowserDatabaseChanges<Entry>,
): Promise<void> {
  const filesStore = transaction.objectStore(FILES_STORE);
  const catalogStore = transaction.objectStore(USER_CATALOG_STORE);
  const versionsStore = transaction.objectStore(VERSIONS_STORE);
  const positions = await readStoredPositions(catalogStore);
  for (const file of changes.putFiles) {
    filesStore.put(file);
  }
  for (const entry of changes.putEntries) {
    const record: PositionedEntry<Entry> = {
      position: claimPosition(positions, entry.address),
      entry,
    };
    catalogStore.put(record, entry.address);
  }
  for (const version of changes.putVersions ?? []) {
    versionsStore.put(version);
  }
  for (const key of changes.deleteVersions ?? []) {
    versionsStore.delete([key.address, key.savedAt]);
  }
  for (const address of changes.deleteAddresses) {
    filesStore.delete(address);
    catalogStore.delete(address);
    await deleteIndexedAddressVersions(versionsStore, address);
  }
}

async function applyIndexedChanges<Entry extends AddressedEntry>(
  database: IDBDatabase,
  changes: BrowserDatabaseChanges<Entry>,
): Promise<void> {
  const transaction = database.transaction(ALL_STORES, "readwrite");
  const committing = waitForTransaction(transaction);
  try {
    await writeIndexedChanges(transaction, changes);
  } catch (error) {
    transaction.abort();
    await committing.catch(ignoreAbortError);
    throw error;
  }
  await committing;
}

function ignoreAbortError(): void {
  // The write's own error is the one to report.
}

async function clearIndexedDatabase(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(ALL_STORES, "readwrite");
  for (const storeName of ALL_STORES) {
    transaction.objectStore(storeName).clear();
  }
  await waitForTransaction(transaction);
}

/**
 * What the upgrade to version 2 does with an entry: the entry in its new
 * form, and, for an entry with a stored file, the time its text gets as its
 * "imported" version.
 */
export interface UpgradedEntry<Entry extends AddressedEntry> {
  savedAt: string;
  entry: Entry;
}

export interface BrowserDatabaseOptions<Entry extends AddressedEntry> {
  /** `globalThis.indexedDB` by default. */
  factory?: IDBFactory;
  /**
   * Called by the upgrade from version 1 for each entry. Without it, an
   * entry is kept, and its version gets the upgrade's time.
   */
  upgradeEntry?: (entry: Entry) => UpgradedEntry<Entry>;
  /** Called when the opening waits for another tab, which still has an older version open, to close. */
  onBlocked?: () => void;
  /** Called after this tab's connection closed because another tab opens a newer version. */
  onVersionChange?: () => void;
}

function upgradeWithTime<Entry extends AddressedEntry>(
  entry: Entry,
): UpgradedEntry<Entry> {
  const upgraded: UpgradedEntry<Entry> = {
    savedAt: new Date().toISOString(),
    entry,
  };
  return upgraded;
}

/** Upgrades each entry, and writes one "imported" version for each entry with a stored file, inside the upgrade's transaction. */
async function writeImportedVersions<Entry extends AddressedEntry>(
  transaction: IDBTransaction,
  upgradeEntry: (entry: Entry) => UpgradedEntry<Entry>,
): Promise<void> {
  const filesStore = transaction.objectStore(FILES_STORE);
  const catalogStore = transaction.objectStore(USER_CATALOG_STORE);
  const versionsStore = transaction.objectStore(VERSIONS_STORE);
  const records = (await readRequest(
    catalogStore.getAll(),
  )) as PositionedEntry<Entry>[];
  for (const record of records) {
    const address = record.entry.address;
    const upgraded = upgradeEntry(record.entry);
    catalogStore.put({ ...record, entry: upgraded.entry }, address);
    const file = (await readRequest(filesStore.get(address))) as
      StoredFile | undefined;
    if (file === undefined) {
      continue;
    }
    const version: StoredVersion = {
      address,
      savedAt: upgraded.savedAt,
      kind: "imported",
      text: file.text,
    };
    versionsStore.put(version);
  }
}

/** Aborts the upgrade when its writes fail, so the database stays at its old version. */
async function upgradeVersions<Entry extends AddressedEntry>(
  transaction: IDBTransaction,
  upgradeEntry: (entry: Entry) => UpgradedEntry<Entry>,
): Promise<void> {
  try {
    await writeImportedVersions(transaction, upgradeEntry);
  } catch {
    transaction.abort();
  }
}

function createStores<Entry extends AddressedEntry>(
  request: IDBOpenDBRequest,
  options: BrowserDatabaseOptions<Entry>,
  event: IDBVersionChangeEvent,
): void {
  const database = request.result;
  if (!database.objectStoreNames.contains(FILES_STORE)) {
    database.createObjectStore(FILES_STORE, { keyPath: "address" });
  }
  if (!database.objectStoreNames.contains(USER_CATALOG_STORE)) {
    database.createObjectStore(USER_CATALOG_STORE);
  }
  if (!database.objectStoreNames.contains(VERSIONS_STORE)) {
    const versionsStore = database.createObjectStore(VERSIONS_STORE, {
      keyPath: ["address", "savedAt"],
    });
    versionsStore.createIndex(VERSIONS_ADDRESS_INDEX, "address");
  }
  const transaction = request.transaction;
  if (event.oldVersion === 1 && transaction !== null) {
    void upgradeVersions(transaction, options.upgradeEntry ?? upgradeWithTime);
  }
}

/** Closes the connection when another tab opens a newer version, so its upgrade is not blocked. */
function closeOnVersionChange(
  database: IDBDatabase,
  onVersionChange: (() => void) | undefined,
): void {
  database.close();
  onVersionChange?.();
}

function reportBlocked(onBlocked: (() => void) | undefined): void {
  onBlocked?.();
}

async function openIndexedDatabase<Entry extends AddressedEntry>(
  factory: IDBFactory,
  options: BrowserDatabaseOptions<Entry>,
): Promise<IDBDatabase> {
  const request = factory.open(BROWSER_DATABASE_NAME, BROWSER_DATABASE_VERSION);
  const upgradeStores: (
    request: IDBOpenDBRequest,
    options: BrowserDatabaseOptions<Entry>,
    event: IDBVersionChangeEvent,
  ) => void = createStores;
  request.onupgradeneeded = upgradeStores.bind(undefined, request, options);
  request.onblocked = reportBlocked.bind(undefined, options.onBlocked);
  const database = await readRequest(request);
  database.onversionchange = closeOnVersionChange.bind(
    undefined,
    database,
    options.onVersionChange,
  );
  return database;
}

class IndexedBrowserDatabase<
  Entry extends AddressedEntry,
> implements BrowserDatabase<Entry> {
  private readonly database: IDBDatabase;

  constructor(database: IDBDatabase) {
    this.database = database;
  }

  readText(address: string): Promise<string | null> {
    return readIndexedText(this.database, address);
  }

  readEntries(): Promise<Entry[]> {
    return readIndexedEntries<Entry>(this.database);
  }

  readVersions(address: string): Promise<StoredVersion[]> {
    return readIndexedVersions(this.database, address);
  }

  apply(changes: BrowserDatabaseChanges<Entry>): Promise<void> {
    return applyIndexedChanges(this.database, changes);
  }

  clear(): Promise<void> {
    return clearIndexedDatabase(this.database);
  }
}

/**
 * Opens the app's IndexedDB database, creating its stores the first time and
 * upgrading a version 1 database to version 2. Resolves with `null` when the
 * browser has no IndexedDB or refuses to open it, as some private windows
 * do, and when the upgrade fails, which leaves the data at version 1.
 */
export async function openBrowserDatabase<Entry extends AddressedEntry>(
  options: BrowserDatabaseOptions<Entry> = {},
): Promise<BrowserDatabase<Entry> | null> {
  const factory = options.factory ?? globalThis.indexedDB;
  if (factory === undefined) {
    return null;
  }
  try {
    const database = await openIndexedDatabase(factory, options);
    const browserDatabase = new IndexedBrowserDatabase<Entry>(database);
    return browserDatabase;
  } catch {
    return null;
  }
}
