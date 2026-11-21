import { describe, expect, it, vi } from "vitest";
import {
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  clearRecentlyUsed,
  createRecentlyUsed,
  forgetRecentlyUsedMosaics,
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
const OTHER_MOD = `${BASE}mods/globe/mod_conf.yaml`;

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
      combinations: [],
    });
  });

  it("Combination tried again: moves a combination already kept to the front", function movesCombinationToFront(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });

    recordRecentlyUsed(store, {
      kind: "combination",
      mod: MOD,
      collection: COLLECTION_A,
    });
    recordRecentlyUsed(store, {
      kind: "combination",
      mod: OTHER_MOD,
      collection: COLLECTION_A,
    });
    recordRecentlyUsed(store, {
      kind: "combination",
      mod: MOD,
      collection: COLLECTION_A,
    });

    expect(readRecentlyUsedSnapshot(store).combinations).toEqual([
      { mod: MOD, collection: COLLECTION_A },
      { mod: OTHER_MOD, collection: COLLECTION_A },
    ]);
  });

  it("keeps 10 combinations, dropping the oldest", function dropsOldestCombination(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });

    for (let number = 1; number <= 11; number += 1) {
      recordRecentlyUsed(store, {
        kind: "combination",
        mod: buildModSource(number),
        collection: COLLECTION_A,
      });
    }

    const combinations = readRecentlyUsedSnapshot(store).combinations;
    expect(combinations).toHaveLength(10);
    expect(combinations[0]).toEqual({
      mod: buildModSource(11),
      collection: COLLECTION_A,
    });
    expect(combinations).not.toContainEqual({
      mod: buildModSource(1),
      collection: COLLECTION_A,
    });
  });

  it("does not record a combination without two web addresses", function skipsInvalidCombination(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });

    recordRecentlyUsed(store, {
      kind: "combination",
      mod: "file:///mods/atlas/mod_conf.yaml",
      collection: COLLECTION_A,
    });

    expect(readRecentlyUsedSnapshot(store).combinations).toEqual([]);
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

  it("Combinations kept after a reload", function readsStoredCombinations(): void {
    const storage = createMemoryStorage();
    recordRecentlyUsed(createRecentlyUsed({ storage }), {
      kind: "combination",
      mod: MOD,
      collection: COLLECTION_A,
    });

    const reloaded = createRecentlyUsed({ storage });

    expect(readRecentlyUsedSnapshot(reloaded).combinations).toEqual([
      { mod: MOD, collection: COLLECTION_A },
    ]);
  });

  it("Stored before combinations were recorded: restored, with no combination", function readsOldValue(): void {
    const storage = buildStoredStorage({
      mods: [MOD],
      collections: [COLLECTION_A],
      mosaics: [MOSAIC],
    });

    const store = createRecentlyUsed({ storage });

    expect(readRecentlyUsedSnapshot(store)).toEqual({
      mods: [MOD],
      collections: [COLLECTION_A],
      mosaics: [MOSAIC],
      combinations: [],
    });
  });

  it("drops stored combinations without a valid mod and collection source", function dropsInvalidCombinations(): void {
    const storage = buildStoredStorage({
      combinations: [
        { mod: MOD, collection: COLLECTION_A },
        { mod: MOD },
        { mod: "./relative/mod_conf.yaml", collection: COLLECTION_B },
        "not a combination",
        null,
        { mod: MOD, collection: COLLECTION_A },
        { mod: OTHER_MOD, collection: COLLECTION_B },
      ],
    });

    const store = createRecentlyUsed({ storage });

    expect(readRecentlyUsedSnapshot(store).combinations).toEqual([
      { mod: MOD, collection: COLLECTION_A },
      { mod: OTHER_MOD, collection: COLLECTION_B },
    ]);
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
      combinations: [],
    });
  });

  it("starts empty from a value that is not an object", function startsEmpty(): void {
    const store = createRecentlyUsed({ storage: buildStoredStorage([MOD]) });

    expect(readRecentlyUsedSnapshot(store)).toEqual({
      mods: [],
      collections: [],
      mosaics: [],
      combinations: [],
    });
  });

  it("Mods cannot reach it", function keepsKeyApart(): void {
    expect(RECENTLY_USED_KEY).toBe("opentesela.recently-used");
    expect(RECENTLY_USED_KEY.startsWith("opentesela.mod-storage:")).toBe(false);
  });
});

describe("forgetRecentlyUsedMosaics", function describeForgetMosaics(): void {
  it("Opened, then removed", function forgetsRemovedMosaic(): void {
    const storage = createMemoryStorage();
    const store = createRecentlyUsed({ storage });
    recordRecentlyUsed(store, { kind: "mosaic", source: MOSAIC });
    recordRecentlyUsed(store, { kind: "mod", source: MOD });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });

    forgetRecentlyUsedMosaics(store, [MOSAIC]);

    const snapshot = readRecentlyUsedSnapshot(store);
    expect(snapshot.mosaics).toEqual([]);
    expect(snapshot.mods).toEqual([MOD]);
    expect(snapshot.collections).toEqual([COLLECTION_A]);
    expect(readStored(storage)).toMatchObject({ mosaics: [] });
  });

  it("changes nothing for mosaics it does not hold", function keepsUnknown(): void {
    const store = createRecentlyUsed({ storage: createMemoryStorage() });
    recordRecentlyUsed(store, { kind: "mosaic", source: MOSAIC });
    const listener = vi.fn<() => void>();
    subscribeRecentlyUsed(store, listener);

    forgetRecentlyUsedMosaics(store, [`${BASE}mosaics/other.yaml`]);

    expect(readRecentlyUsedSnapshot(store).mosaics).toEqual([MOSAIC]);
    expect(listener).not.toHaveBeenCalled();
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
  it("drops every entry of the four kinds, from the storage too, and records again afterwards", function clears(): void {
    const storage = createMemoryStorage();
    const store = createRecentlyUsed({ storage });
    recordRecentlyUsed(store, { kind: "mod", source: MOD });
    recordRecentlyUsed(store, { kind: "collection", source: COLLECTION_A });
    recordRecentlyUsed(store, {
      kind: "combination",
      mod: MOD,
      collection: COLLECTION_A,
    });

    clearRecentlyUsed(store);
    const cleared = readStored(storage);
    recordRecentlyUsed(store, { kind: "mosaic", source: MOSAIC });

    expect(cleared).toEqual({
      mods: [],
      collections: [],
      mosaics: [],
      combinations: [],
    });
    expect(readRecentlyUsedSnapshot(store)).toEqual({
      mods: [],
      collections: [],
      mosaics: [MOSAIC],
      combinations: [],
    });
  });
});
