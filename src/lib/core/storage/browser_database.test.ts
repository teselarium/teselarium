import { describe, expect, it, vi } from "vitest";
import { createMemoryBrowserDatabase, openBrowserDatabase } from "./index.ts";
import type { BrowserDatabaseChanges, StoredVersion } from "./index.ts";

interface TestEntry {
  address: string;
  title: string;
}

const NOBEL_ADDRESS = "opentesela-browser:///r1/nobel_map.yaml";
const POETS_ADDRESS = "opentesela-browser:///r1/poets.yaml";
const REMOTE_ADDRESS = "https://mosaics.example.net/maps/laureates.yml";

function buildNobelChanges(): BrowserDatabaseChanges<TestEntry> {
  const changes: BrowserDatabaseChanges<TestEntry> = {
    putFiles: [{ address: NOBEL_ADDRESS, text: "title: Nobel map\n" }],
    putEntries: [{ address: NOBEL_ADDRESS, title: "Nobel map" }],
    deleteAddresses: [],
  };
  return changes;
}

describe("createMemoryBrowserDatabase", function describeMemoryDatabase(): void {
  it("starts empty", async function startsEmpty(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();

    expect(await database.readText(NOBEL_ADDRESS)).toBeNull();
    expect(await database.readEntries()).toEqual([]);
  });

  it("puts and reads a file", async function putsFile(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();

    await database.apply(buildNobelChanges());

    expect(await database.readText(NOBEL_ADDRESS)).toBe("title: Nobel map\n");
  });

  it("reads entries in order of addition", async function readsInOrder(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply(buildNobelChanges());
    await database.apply({
      putFiles: [],
      putEntries: [{ address: REMOTE_ADDRESS, title: "Laureates" }],
      deleteAddresses: [],
    });
    await database.apply({
      putFiles: [{ address: POETS_ADDRESS, text: "title: Poets\n" }],
      putEntries: [{ address: POETS_ADDRESS, title: "Poets" }],
      deleteAddresses: [],
    });

    const entries = await database.readEntries();

    expect(entries.map(readEntryAddress)).toEqual([
      NOBEL_ADDRESS,
      REMOTE_ADDRESS,
      POETS_ADDRESS,
    ]);
  });

  it("keeps an updated entry at its place", async function keepsUpdatedPlace(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply(buildNobelChanges());
    await database.apply({
      putFiles: [],
      putEntries: [{ address: REMOTE_ADDRESS, title: "Laureates" }],
      deleteAddresses: [],
    });

    await database.apply({
      putFiles: [{ address: NOBEL_ADDRESS, text: "title: Nobel map 2\n" }],
      putEntries: [{ address: NOBEL_ADDRESS, title: "Nobel map 2" }],
      deleteAddresses: [],
    });

    const entries = await database.readEntries();
    expect(entries).toEqual([
      { address: NOBEL_ADDRESS, title: "Nobel map 2" },
      { address: REMOTE_ADDRESS, title: "Laureates" },
    ]);
    expect(await database.readText(NOBEL_ADDRESS)).toBe("title: Nobel map 2\n");
  });

  it("deletes a file and its entry together", async function deletesTogether(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply(buildNobelChanges());

    await database.apply({
      putFiles: [],
      putEntries: [],
      deleteAddresses: [NOBEL_ADDRESS],
    });

    expect(await database.readText(NOBEL_ADDRESS)).toBeNull();
    expect(await database.readEntries()).toEqual([]);
  });

  it("clears every file and entry", async function clearsAll(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply(buildNobelChanges());

    await database.clear();

    expect(await database.readText(NOBEL_ADDRESS)).toBeNull();
    expect(await database.readEntries()).toEqual([]);
  });

  it("returns copies of its entries", async function returnsCopies(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply(buildNobelChanges());

    const entries = await database.readEntries();
    entries[0].title = "Changed outside";

    const entriesAgain = await database.readEntries();
    expect(entriesAgain[0].title).toBe("Nobel map");
  });
});

function readEntryAddress(entry: TestEntry): string {
  return entry.address;
}

function buildVersion(
  address: string,
  savedAt: string,
  text: string,
): StoredVersion {
  const version: StoredVersion = { address, savedAt, kind: "saved", text };
  return version;
}

function readSavedAt(version: StoredVersion): string {
  return version.savedAt;
}

describe("versions of the memory database", function describeMemoryVersions(): void {
  it("reads an address's versions newest first", async function readsNewestFirst(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply({
      ...buildNobelChanges(),
      putVersions: [
        buildVersion(NOBEL_ADDRESS, "2026-01-01T10:00:00.000Z", "one"),
        buildVersion(NOBEL_ADDRESS, "2026-01-03T10:00:00.000Z", "three"),
        buildVersion(POETS_ADDRESS, "2026-01-04T10:00:00.000Z", "poets"),
        buildVersion(NOBEL_ADDRESS, "2026-01-02T10:00:00.000Z", "two"),
      ],
    });

    const versions = await database.readVersions(NOBEL_ADDRESS);

    expect(versions.map(readSavedAt)).toEqual([
      "2026-01-03T10:00:00.000Z",
      "2026-01-02T10:00:00.000Z",
      "2026-01-01T10:00:00.000Z",
    ]);
  });

  it("deletes the versions it is given", async function deletesVersions(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply({
      ...buildNobelChanges(),
      putVersions: [
        buildVersion(NOBEL_ADDRESS, "2026-01-01T10:00:00.000Z", "one"),
        buildVersion(NOBEL_ADDRESS, "2026-01-02T10:00:00.000Z", "two"),
      ],
    });

    await database.apply({
      putFiles: [],
      putEntries: [],
      deleteAddresses: [],
      deleteVersions: [
        { address: NOBEL_ADDRESS, savedAt: "2026-01-01T10:00:00.000Z" },
      ],
    });

    const versions = await database.readVersions(NOBEL_ADDRESS);
    expect(versions.map(readSavedAt)).toEqual(["2026-01-02T10:00:00.000Z"]);
  });

  it("deletes an entry's versions with the entry", async function deletesWithEntry(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply({
      ...buildNobelChanges(),
      putVersions: [
        buildVersion(NOBEL_ADDRESS, "2026-01-01T10:00:00.000Z", "one"),
      ],
    });

    await database.apply({
      putFiles: [],
      putEntries: [],
      deleteAddresses: [NOBEL_ADDRESS],
    });

    expect(await database.readVersions(NOBEL_ADDRESS)).toEqual([]);
  });

  it("clears the versions", async function clearsVersions(): Promise<void> {
    const database = createMemoryBrowserDatabase<TestEntry>();
    await database.apply({
      ...buildNobelChanges(),
      putVersions: [
        buildVersion(NOBEL_ADDRESS, "2026-01-01T10:00:00.000Z", "one"),
      ],
    });

    await database.clear();

    expect(await database.readVersions(NOBEL_ADDRESS)).toEqual([]);
  });
});

/** An open request that the test settles by hand, as IndexedDB would. */
interface FakeOpenRequest {
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  error: DOMException | null;
  result: unknown;
}

function buildFakeOpenRequest(): FakeOpenRequest {
  const request: FakeOpenRequest = {
    onupgradeneeded: null,
    onblocked: null,
    onsuccess: null,
    onerror: null,
    error: null,
    result: undefined,
  };
  return request;
}

function buildFakeFactory(request: FakeOpenRequest): IDBFactory {
  const factory = {
    open: vi
      .fn<(name: string, version: number) => FakeOpenRequest>()
      .mockReturnValue(request),
  };
  return factory as unknown as IDBFactory;
}

function waitForNextTask(resolve: () => void): void {
  setTimeout(resolve, 0);
}

function waitForMicrotasks(): Promise<void> {
  return new Promise(waitForNextTask);
}

describe("openBrowserDatabase", function describeOpenBrowserDatabase(): void {
  it("opens version 2", async function opensVersionTwo(): Promise<void> {
    const request = buildFakeOpenRequest();
    const factory = buildFakeFactory(request);

    void openBrowserDatabase<TestEntry>({ factory });

    expect(factory.open).toHaveBeenCalledWith("opentesela", 2);
  });

  it("resolves to null when the upgrade fails", async function failsUpgrade(): Promise<void> {
    const request = buildFakeOpenRequest();

    const opening = openBrowserDatabase<TestEntry>({
      factory: buildFakeFactory(request),
    });
    await waitForMicrotasks();
    request.error = new DOMException("The upgrade was aborted", "AbortError");
    request.onerror?.();

    expect(await opening).toBeNull();
  });

  it("reports a blocked opening, and opens once it is unblocked", async function reportsBlocked(): Promise<void> {
    const request = buildFakeOpenRequest();
    const onBlocked = vi.fn<() => void>();
    const opening = openBrowserDatabase<TestEntry>({
      factory: buildFakeFactory(request),
      onBlocked,
    });
    await waitForMicrotasks();

    request.onblocked?.();

    expect(onBlocked).toHaveBeenCalledOnce();
    request.result = { onversionchange: null, close: vi.fn<() => void>() };
    request.onsuccess?.();
    expect(await opening).not.toBeNull();
  });

  it("closes the connection on versionchange and reports it", async function closesOnVersionChange(): Promise<void> {
    const request = buildFakeOpenRequest();
    const onVersionChange = vi.fn<() => void>();
    const connection = {
      onversionchange: null as (() => void) | null,
      close: vi.fn<() => void>(),
    };
    const opening = openBrowserDatabase<TestEntry>({
      factory: buildFakeFactory(request),
      onVersionChange,
    });
    await waitForMicrotasks();
    request.result = connection;
    request.onsuccess?.();
    await opening;

    connection.onversionchange?.();

    expect(connection.close).toHaveBeenCalledOnce();
    expect(onVersionChange).toHaveBeenCalledOnce();
  });
});
