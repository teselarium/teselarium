import { describe, expect, it, vi } from "vitest";
import {
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  clearRecentlyUsed,
  createRecentlyUsed,
  readRecentlyUsedSnapshot,
  RECENTLY_USED_KEY,
  recordRecentlyUsed,
  removeRecentlyUsed,
  subscribeRecentlyUsed,
} from "./recently_used.ts";

const BASE = "https://example.org/recent/";
const COLLECTION_A = `${BASE}a/collection.yaml`;
const COLLECTION_B = `${BASE}b/collection.yaml`;
const MOD = `${BASE}mods/atlas/mod_conf.yaml`;
const MOSAIC = `${BASE}mosaics/atlas.yaml`;

function buildModSource(number: number): string {
  const source = `${BASE}mods/mod_${number}/mod_conf.yaml`;
  return source;
}

function buildStoredStorage(stored: unknown): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(RECENTLY_USED_KEY, JSON.stringify(stored));
  return storage;
}

function readStored(storage: MemoryStorage): unknown {
  const stored: unknown = JSON.parse(
    storage.getItem(RECENTLY_USED_KEY) ?? "null",
  );
  return stored;
}

describe("recordRecentlyUsed", function describeRecordRecentlyUsed(): void {
  it("Opened again: moves an entry already kept to the front", function movesToFront(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });

    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_B });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });

    expect(readRecentlyUsedSnapshot(store).collections).toEqual([
      COLLECTION_A,
      COLLECTION_B,
    ]);
  });

  it("Eleventh mod: drops the oldest", function dropsOldest(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });

    for (let number = 1; number <= 11; number += 1) {
      recordRecentlyUsed(store, {
        kind: "mod",
        source: buildModSource(number),
      });
    }

    const mods = readRecentlyUsedSnapshot(store).mods;
    expect(mods).toHaveLength(10);
    expect(mods[0]).toBe(buildModSource(11));
    expect(mods).not.toContain(buildModSource(1));
  });

  it("keeps each kind apart, and stores them", function storesKinds(): void {
    const storage = createMemoryStorage();
    const store = createRecentlyUsed({ storage });

    recordRecentlyUsed(store, { kind: "mod", source: MOD });
    recordRecentlyUsed(store, { kind: "mosaic", source: MOSAIC });

    expect(readStored(storage)).toEqual({
      mods: [MOD],
      collections: [],
      mosaics: [MOSAIC],
    });
  });

  it("keeps working when the storage cannot be written", function keepsInMemory(): void {
    const store = createRecentlyUsed({ storage: createFullStorage() });

    recordRecentlyUsed(store, { kind: "mod", source: MOD });

    expect(readRecentlyUsedSnapshot(store).mods).toEqual([MOD]);
  });

  it("notifies the listeners with a new frozen snapshot", function notifies(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });
    const listener = vi.fn<() => void>();
    subscribeRecentlyUsed(store, listener);
    const before = readRecentlyUsedSnapshot(store);

    recordRecentlyUsed(store, { kind: "mod", source: MOD });

    expect(listener).toHaveBeenCalledOnce();
    expect(readRecentlyUsedSnapshot(store)).not.toBe(before);
    expect(Object.isFrozen(readRecentlyUsedSnapshot(store).mods)).toBe(true);
  });
});

describe("createRecentlyUsed", function describeCreateRecentlyUsed(): void {
  it("Kept after a reload", function readsStored(): void {
    const storage = createMemoryStorage();
    recordRecentlyUsed(createRecentlyUsed({ storage }), {
      kind: "mod",
      source: MOD,
    });

    const reloaded = createRecentlyUsed({ storage });

    expect(readRecentlyUsedSnapshot(reloaded).mods).toEqual([MOD]);
  });

  it("drops stored entries that are not valid sources", function dropsInvalid(): void {
    const storage = buildStoredStorage({
      mods: [MOD, "./relative/mod_conf.yaml", 3, null, MOD],
      collections: "not a list",
      mosaics: [MOSAIC, "ftp://example.org/mosaic.yaml"],
    });

    const store = createRecentlyUsed({ storage });

    expect(readRecentlyUsedSnapshot(store)).toEqual({
      mods: [MOD],
      collections: [],
      mosaics: [MOSAIC],
    });
  });

  it("starts empty from a value that is not an object", function startsEmpty(): void {
    const store = createRecentlyUsed({ storage: buildStoredStorage([MOD]) });

    expect(readRecentlyUsedSnapshot(store)).toEqual({
      mods: [],
      collections: [],
      mosaics: [],
    });
  });

  it("Mods cannot reach it", function keepsKeyApart(): void {
    expect(RECENTLY_USED_KEY).toBe("opentesela.recently-used");
    expect(RECENTLY_USED_KEY.startsWith("opentesela.mod-storage:")).toBe(false);
  });
});

describe("removeRecentlyUsed", function describeRemoveRecentlyUsed(): void {
  it("drops one entry", function removesEntry(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_B });

    removeRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });

    expect(readRecentlyUsedSnapshot(store).collections).toEqual([COLLECTION_B]);
  });
});

describe("clearRecentlyUsed", function describeClearRecentlyUsed(): void {
  it("drops every entry, from the storage too, and records again afterwards", function clears(): void {
    const storage = createMemoryStorage();
    const store = createRecentlyUsed({ storage });
    recordRecentlyUsed(store, { kind: "mod", source: MOD });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });

    clearRecentlyUsed(store);
    const cleared = readStored(storage);
    recordRecentlyUsed(store, { kind: "mosaic", source: MOSAIC });

    expect(cleared).toEqual({ mods: [], collections: [], mosaics: [] });
    expect(readRecentlyUsedSnapshot(store)).toEqual({
      mods: [],
      collections: [],
      mosaics: [MOSAIC],
    });
  });
});
