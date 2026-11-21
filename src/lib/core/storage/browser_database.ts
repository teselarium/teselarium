/** The text of a file stored in the browser, at its `opentesela-browser:` address. */
export interface StoredFile {
  address: string;
  text: string;
}

/** What every entry of the database has: the address that keys it. */
export interface AddressedEntry {
  address: string;
}

/**
 * One write of the database, applied at once: files and entries to put, then
 * addresses whose file and entry are deleted.
 */
export interface BrowserDatabaseChanges<Entry extends AddressedEntry> {
  putFiles: StoredFile[];
  putEntries: Entry[];
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
  /** Writes the changes in one transaction: all of them, or none. */
  apply(changes: BrowserDatabaseChanges<Entry>): Promise<void>;
  /** Deletes every file and entry. */
  clear(): Promise<void>;
}

/** The IndexedDB database of the app. A later store raises the version. */
export const BROWSER_DATABASE_NAME = "opentesela";
export const BROWSER_DATABASE_VERSION = 1;
/** Keyed by address, `{ address, text }` as value. */
export const FILES_STORE = "files";
/** Keyed by the entry's address, `{ position, entry }` as value. */
export const USER_CATALOG_STORE = "user-catalog";

/** Copies in and out, so callers never share an entry with the database. */
class MemoryBrowserDatabase<
  Entry extends AddressedEntry,
> implements BrowserDatabase<Entry> {
  private readonly files = new Map<string, string>();
  private readonly entries = new Map<string, Entry>();

  async readText(address: string): Promise<string | null> {
    const text = this.files.get(address) ?? null;
    return text;
  }

  async readEntries(): Promise<Entry[]> {
    const entries = structuredClone([...this.entries.values()]);
    return entries;
  }

  async apply(changes: BrowserDatabaseChanges<Entry>): Promise<void> {
    for (const file of changes.putFiles) {
      this.files.set(file.address, file.text);
    }
    for (const entry of changes.putEntries) {
      this.entries.set(entry.address, structuredClone(entry));
    }
    for (const address of changes.deleteAddresses) {
      this.files.delete(address);
      this.entries.delete(address);
    }
  }

  async clear(): Promise<void> {
    this.files.clear();
    this.entries.clear();
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
  for (const address of changes.deleteAddresses) {
    filesStore.delete(address);
    catalogStore.delete(address);
  }
}

async function applyIndexedChanges<Entry extends AddressedEntry>(
  database: IDBDatabase,
  changes: BrowserDatabaseChanges<Entry>,
): Promise<void> {
  const transaction = database.transaction(
    [FILES_STORE, USER_CATALOG_STORE],
    "readwrite",
  );
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
  const transaction = database.transaction(
    [FILES_STORE, USER_CATALOG_STORE],
    "readwrite",
  );
  transaction.objectStore(FILES_STORE).clear();
  transaction.objectStore(USER_CATALOG_STORE).clear();
  await waitForTransaction(transaction);
}

function createStores(request: IDBOpenDBRequest): void {
  const database = request.result;
  if (!database.objectStoreNames.contains(FILES_STORE)) {
    database.createObjectStore(FILES_STORE, { keyPath: "address" });
  }
  if (!database.objectStoreNames.contains(USER_CATALOG_STORE)) {
    database.createObjectStore(USER_CATALOG_STORE);
  }
}

async function openIndexedDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(BROWSER_DATABASE_NAME, BROWSER_DATABASE_VERSION);
  request.onupgradeneeded = createStores.bind(undefined, request);
  const database = await readRequest(request);
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

  apply(changes: BrowserDatabaseChanges<Entry>): Promise<void> {
    return applyIndexedChanges(this.database, changes);
  }

  clear(): Promise<void> {
    return clearIndexedDatabase(this.database);
  }
}

/**
 * Opens the app's IndexedDB database, creating its stores the first time.
 * Resolves with `null` when the browser has no IndexedDB or refuses to open
 * it, as some private windows do.
 */
export async function openBrowserDatabase<Entry extends AddressedEntry>(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<BrowserDatabase<Entry> | null> {
  if (factory === undefined) {
    return null;
  }
  try {
    const database = await openIndexedDatabase(factory);
    const browserDatabase = new IndexedBrowserDatabase<Entry>(database);
    return browserDatabase;
  } catch {
    return null;
  }
}
