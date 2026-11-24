import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { FakeHistory } from "../../test/fake_history.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import { buildTestStage } from "../../test/test_stages.ts";
import { readStageCatalog } from "../../lib/core/stage/index.ts";
import { createMemoryBrowserDatabase } from "../../lib/core/storage/index.ts";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import {
  createRecentlyUsed,
  readRecentlyUsedSnapshot,
  recordRecentlyUsed,
} from "../settings/recently_used.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";
import {
  applyUserCatalogChanges,
  createUserCatalogNotices,
  createUserCatalogStore,
  raiseUserCatalogNotice,
  readStartingText,
  readStartUserCatalog,
  readUserCatalogSnapshot,
  readUserCatalogText,
  removeAllUserMosaics,
  subscribeUserCatalog,
  UserCatalogUnavailableError,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type {
  PersistentStorage,
  StartUserCatalog,
  UserCatalogDatabase,
  UserCatalogStore,
} from "./user_catalog_store.ts";

const STORED_ADDRESS = "teselarium-browser:///r1/nobel_map.yaml";
const REMOTE_ADDRESS = "https://mosaics.example.net/maps/laureates.yml";

const STORED_ENTRY: UserCatalogEntry = {
  address: STORED_ADDRESS,
  place: "browser",
  root: "r1",
  provenance: {
    folder: null,
    path: "nobel_map.yaml",
    addedAt: "2026-11-20T10:00:00.000Z",
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: "2026-11-20T10:00:00.000Z",
};

const REMOTE_ENTRY: UserCatalogEntry = {
  address: REMOTE_ADDRESS,
  place: "remote",
  root: null,
  provenance: {
    folder: null,
    path: null,
    addedAt: "2026-11-20T11:00:00.000Z",
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: null,
};

interface FakePersistentStorage extends PersistentStorage {
  persist: Mock<() => Promise<boolean>>;
  persisted: Mock<() => Promise<boolean>>;
}

function createFakePersistentStorage(answer: boolean): FakePersistentStorage {
  const persistentStorage: FakePersistentStorage = {
    persist: vi.fn<() => Promise<boolean>>().mockResolvedValue(answer),
    persisted: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
  };
  return persistentStorage;
}

interface StoreFixture {
  store: UserCatalogStore;
  database: UserCatalogDatabase;
  recentlyUsed: RecentlyUsed;
  persistentStorage: FakePersistentStorage;
}

function buildStoreFixture(
  persistAnswer = true,
  database: UserCatalogDatabase | null = createMemoryBrowserDatabase(),
): StoreFixture {
  const recentlyUsed = createRecentlyUsed({ storage: createMemoryStorage() });
  const persistentStorage = createFakePersistentStorage(persistAnswer);
  const store = createUserCatalogStore({
    start: Promise.resolve({ database, entries: [] }),
    stage: buildTestStage(new FakeHistory("")),
    recentlyUsed,
    persistentStorage,
  });
  const fixture: StoreFixture = {
    store,
    database: database ?? createMemoryBrowserDatabase(),
    recentlyUsed,
    persistentStorage,
  };
  return fixture;
}

function storeNobelMap(store: UserCatalogStore): Promise<void> {
  return applyUserCatalogChanges(store, {
    putFiles: [{ address: STORED_ADDRESS, text: "mosaic: {}\n" }],
    putEntries: [STORED_ENTRY],
    deleteAddresses: [],
  });
}

function addRemoteMosaic(store: UserCatalogStore): Promise<void> {
  return applyUserCatalogChanges(store, {
    putFiles: [],
    putEntries: [REMOTE_ENTRY],
    deleteAddresses: [],
  });
}

function neverSettle(): void {
  // The browser is still asking the user.
}

function resolveNull(): Promise<null> {
  return Promise.resolve(null);
}

function rejectOpening(): Promise<UserCatalogDatabase> {
  return Promise.reject(new DOMException("Refused", "InvalidStateError"));
}

function returnDatabase(
  database: UserCatalogDatabase,
): Promise<UserCatalogDatabase> {
  return Promise.resolve(database);
}

describe("readStartUserCatalog", function describeStart(): void {
  it("reads the stored entries", async function readsEntries(): Promise<void> {
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await database.apply({
      putFiles: [],
      putEntries: [REMOTE_ENTRY],
      deleteAddresses: [],
    });

    const start = await readStartUserCatalog(
      returnDatabase.bind(undefined, database),
    );

    expect(start.database).toBe(database);
    expect(start.entries).toEqual([REMOTE_ENTRY]);
  });

  it("Store refused", async function startsWithoutStore(): Promise<void> {
    const start = await readStartUserCatalog(resolveNull);
    const failed = await readStartUserCatalog(rejectOpening);

    expect(start).toEqual({ database: null, entries: [] });
    expect(failed).toEqual({ database: null, entries: [] });
  });

  it("starts with no user mosaic in the catalog when the store is refused", async function listsNoUserMosaic(): Promise<void> {
    const start = await readStartUserCatalog(resolveNull);
    const { store } = buildStoreFixture(true, start.database);
    await waitForUserCatalogStart(store);

    const catalog = await readStageCatalog(store.stage);

    expect(readUserCatalogSnapshot(store).isAvailable).toBe(false);
    for (const mosaic of catalog.mosaics) {
      expect(mosaic.listedBy).not.toBe("user");
    }
  });
});

interface PendingStart {
  start: Promise<StartUserCatalog>;
  finish: (start: StartUserCatalog) => void;
}

function keepFinish(
  pending: { finish?: (start: StartUserCatalog) => void },
  resolve: (start: StartUserCatalog) => void,
): void {
  pending.finish = resolve;
}

/** A start whose database opens when the test calls `finish`. */
function createPendingStart(): PendingStart {
  const pending: { finish?: (start: StartUserCatalog) => void } = {};
  const start = new Promise<StartUserCatalog>(
    keepFinish.bind(undefined, pending),
  );
  const pendingStart: PendingStart = {
    start,
    finish: pending.finish as (start: StartUserCatalog) => void,
  };
  return pendingStart;
}

function buildPendingStore(pending: PendingStart): UserCatalogStore {
  const store = createUserCatalogStore({
    start: pending.start,
    stage: buildTestStage(new FakeHistory("")),
    recentlyUsed: createRecentlyUsed({ storage: createMemoryStorage() }),
    persistentStorage: createFakePersistentStorage(true),
  });
  return store;
}

describe("the start of the store", function describeStoreStart(): void {
  it("starts empty, then gives the stage the entries once read", async function followsStart(): Promise<void> {
    const pending = createPendingStart();
    const store = buildPendingStore(pending);
    expect(readUserCatalogSnapshot(store)).toMatchObject({
      entries: [],
      isStarted: false,
    });

    pending.finish({
      database: createMemoryBrowserDatabase(),
      entries: [REMOTE_ENTRY],
    });
    await waitForUserCatalogStart(store);

    expect(readUserCatalogSnapshot(store)).toMatchObject({
      entries: [REMOTE_ENTRY],
      isStarted: true,
      isAvailable: true,
    });
    expect(store.stage.userCatalog).toEqual([REMOTE_ENTRY]);
  });

  it("waits for the database before writing", async function waitsToWrite(): Promise<void> {
    const pending = createPendingStart();
    const store = buildPendingStore(pending);
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();

    const storing = storeNobelMap(store);
    pending.finish({ database, entries: [] });
    await storing;

    expect(await database.readText(STORED_ADDRESS)).toBe("mosaic: {}\n");
    expect(readUserCatalogSnapshot(store).entries).toEqual([STORED_ENTRY]);
  });

  it("is read-only once the database is refused", async function refusesAfterStart(): Promise<void> {
    const pending = createPendingStart();
    const store = buildPendingStore(pending);

    pending.finish({ database: null, entries: [] });
    await waitForUserCatalogStart(store);

    expect(readUserCatalogSnapshot(store).isAvailable).toBe(false);
    await expect(storeNobelMap(store)).rejects.toBeInstanceOf(
      UserCatalogUnavailableError,
    );
  });
});

describe("readStartingText", function describeStartingText(): void {
  it("reads a stored file once the database opens", async function readsAfterOpening(): Promise<void> {
    const pending = createPendingStart();
    const database = createMemoryBrowserDatabase<UserCatalogEntry>();
    await database.apply({
      putFiles: [{ address: STORED_ADDRESS, text: "mosaic: {}\n" }],
      putEntries: [],
      deleteAddresses: [],
    });

    const reading = readStartingText(pending.start, STORED_ADDRESS);
    pending.finish({ database, entries: [] });

    expect(await reading).toBe("mosaic: {}\n");
  });

  it("reads nothing when the database is refused", async function readsNothing(): Promise<void> {
    const start = Promise.resolve({ database: null, entries: [] });

    expect(await readStartingText(start, STORED_ADDRESS)).toBeNull();
  });
});

describe("applyUserCatalogChanges", function describeApply(): void {
  it("stores the changes and tells the stage", async function appliesChanges(): Promise<void> {
    const { store } = buildStoreFixture();
    const listener = vi.fn<() => void>();
    subscribeUserCatalog(store, listener);

    await storeNobelMap(store);
    await addRemoteMosaic(store);

    expect(readUserCatalogSnapshot(store).entries).toEqual([
      STORED_ENTRY,
      REMOTE_ENTRY,
    ]);
    expect(store.stage.userCatalog).toEqual([STORED_ENTRY, REMOTE_ENTRY]);
    expect(await readUserCatalogText(store, STORED_ADDRESS)).toBe(
      "mosaic: {}\n",
    );
    expect(listener).toHaveBeenCalled();
  });

  it("asks to keep the storage after the first stored file only", async function asksPersistence(): Promise<void> {
    const { store, persistentStorage } = buildStoreFixture(true);

    await addRemoteMosaic(store);
    expect(persistentStorage.persist).not.toHaveBeenCalled();
    await storeNobelMap(store);
    await storeNobelMap(store);
    await Promise.resolve();

    expect(persistentStorage.persist).toHaveBeenCalledOnce();
    expect(readUserCatalogSnapshot(store).persisted).toBe(true);
  });

  it("does not wait for the browser's answer", async function keepsGoing(): Promise<void> {
    const { store, persistentStorage } = buildStoreFixture();
    persistentStorage.persist.mockReturnValue(new Promise(neverSettle));

    await storeNobelMap(store);

    expect(readUserCatalogSnapshot(store).entries).toEqual([STORED_ENTRY]);
  });

  it("Persistence refused", async function keepsRefusal(): Promise<void> {
    const { store } = buildStoreFixture(false);

    await storeNobelMap(store);
    await Promise.resolve();

    expect(readUserCatalogSnapshot(store).entries).toEqual([STORED_ENTRY]);
    expect(readUserCatalogSnapshot(store).persisted).toBe(false);
  });

  it("reads whether the storage is already kept", async function readsPersisted(): Promise<void> {
    const { store, persistentStorage } = buildStoreFixture();
    await Promise.resolve();

    expect(persistentStorage.persisted).toHaveBeenCalledOnce();
    expect(readUserCatalogSnapshot(store).persisted).toBe(false);
  });

  it("Removed user mosaics are forgotten", async function forgetsRemoved(): Promise<void> {
    const { store, recentlyUsed } = buildStoreFixture();
    await addRemoteMosaic(store);
    recordRecentlyUsed(recentlyUsed, {
      kind: "mosaic",
      source: REMOTE_ADDRESS,
    });

    await applyUserCatalogChanges(store, {
      putFiles: [],
      putEntries: [],
      deleteAddresses: [REMOTE_ADDRESS],
    });

    expect(readUserCatalogSnapshot(store).entries).toEqual([]);
    expect(readRecentlyUsedSnapshot(recentlyUsed).mosaics).toEqual([]);
  });

  it("refuses to write without a database", async function refusesWithoutDatabase(): Promise<void> {
    const { store } = buildStoreFixture(true, null);

    const applying = storeNobelMap(store);

    await expect(applying).rejects.toBeInstanceOf(UserCatalogUnavailableError);
    await expect(applying).rejects.toThrowError(
      "This browser does not let the app store files",
    );
    expect(readUserCatalogSnapshot(store).entries).toEqual([]);
  });
});

describe("removeAllUserMosaics", function describeRemoveAll(): void {
  it("All removed", async function removesAll(): Promise<void> {
    const { store, database, recentlyUsed } = buildStoreFixture();
    await storeNobelMap(store);
    await addRemoteMosaic(store);
    recordRecentlyUsed(recentlyUsed, {
      kind: "mosaic",
      source: REMOTE_ADDRESS,
    });

    await removeAllUserMosaics(store);

    expect(readUserCatalogSnapshot(store).entries).toEqual([]);
    expect(store.stage.userCatalog).toEqual([]);
    expect(await database.readText(STORED_ADDRESS)).toBeNull();
    expect(readRecentlyUsedSnapshot(recentlyUsed).mosaics).toEqual([]);
  });
});

describe("user catalog notices", function describeNotices(): void {
  it("says another tab blocks the opening, until it opens", async function followsBlocked(): Promise<void> {
    const pending = createPendingStart();
    const notices = createUserCatalogNotices();
    const store = createUserCatalogStore({
      start: pending.start,
      stage: buildTestStage(new FakeHistory("")),
      recentlyUsed: createRecentlyUsed({ storage: createMemoryStorage() }),
      persistentStorage: createFakePersistentStorage(true),
      notices,
    });

    raiseUserCatalogNotice(notices, "blocked");

    expect(readUserCatalogSnapshot(store).notice).toBe("blocked");
    pending.finish({ database: createMemoryBrowserDatabase(), entries: [] });
    await waitForUserCatalogStart(store);
    expect(readUserCatalogSnapshot(store).notice).toBeNull();
  });

  it("asks for a reload after another tab upgraded the database", async function followsReload(): Promise<void> {
    const notices = createUserCatalogNotices();
    const store = createUserCatalogStore({
      start: Promise.resolve({
        database: createMemoryBrowserDatabase(),
        entries: [],
      }),
      stage: buildTestStage(new FakeHistory("")),
      recentlyUsed: createRecentlyUsed({ storage: createMemoryStorage() }),
      persistentStorage: createFakePersistentStorage(true),
      notices,
    });
    await waitForUserCatalogStart(store);

    raiseUserCatalogNotice(notices, "reload");

    expect(readUserCatalogSnapshot(store).notice).toBe("reload");
  });
});
