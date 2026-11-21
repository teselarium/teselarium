import { describe, expect, it } from "vitest";
import { createMemoryBrowserDatabase } from "./index.ts";
import type { BrowserDatabaseChanges } from "./index.ts";

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
