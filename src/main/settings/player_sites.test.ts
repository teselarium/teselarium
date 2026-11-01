import { describe, expect, it, vi } from "vitest";
import {
  createBlockedStorage,
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  createPlayerSites,
  PLAYER_SITES_KEY,
  readPlayerSitesSnapshot,
  rememberPlayerSite,
  removePlayerSite,
  subscribePlayerSites,
} from "./player_sites.ts";

const YOUTUBE_HOST = "www.youtube-nocookie.com";

const VIMEO_HOST = "player.vimeo.com";

function buildStoredStorage(stored: unknown): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(PLAYER_SITES_KEY, JSON.stringify(stored));
  return storage;
}

function readStoredHosts(storage: MemoryStorage): unknown {
  const stored: unknown = JSON.parse(
    storage.getItem(PLAYER_SITES_KEY) ?? "null",
  );
  return stored;
}

describe("createPlayerSites", function describeCreatePlayerSites(): void {
  it("starts empty without a stored value", function startsEmpty(): void {
    const store = createPlayerSites({ storage: createMemoryStorage() });

    expect(readPlayerSitesSnapshot(store)).toEqual([]);
  });

  it("reads the stored hosts", function readsHosts(): void {
    const storage = buildStoredStorage([YOUTUBE_HOST, VIMEO_HOST]);

    const store = createPlayerSites({ storage });

    expect(readPlayerSitesSnapshot(store)).toEqual([YOUTUBE_HOST, VIMEO_HOST]);
  });

  it("drops the entries that are not hosts", function dropsInvalidEntries(): void {
    const storage = buildStoredStorage([
      YOUTUBE_HOST,
      "",
      7,
      null,
      "https://player.vimeo.com",
      "player.vimeo.com/video",
      "Player.Vimeo.com",
      { host: VIMEO_HOST },
    ]);

    const store = createPlayerSites({ storage });

    expect(readPlayerSitesSnapshot(store)).toEqual([YOUTUBE_HOST]);
  });

  it("keeps duplicated hosts once", function keepsDuplicatesOnce(): void {
    const storage = buildStoredStorage([
      YOUTUBE_HOST,
      VIMEO_HOST,
      YOUTUBE_HOST,
    ]);

    const store = createPlayerSites({ storage });

    expect(readPlayerSitesSnapshot(store)).toEqual([YOUTUBE_HOST, VIMEO_HOST]);
  });

  it("ignores a stored value that is not a list", function ignoresNonList(): void {
    const store = createPlayerSites({
      storage: buildStoredStorage({ host: YOUTUBE_HOST }),
    });

    expect(readPlayerSitesSnapshot(store)).toEqual([]);
  });

  it("starts empty when the storage cannot be read", function startsEmptyWhenBlocked(): void {
    const store = createPlayerSites({ storage: createBlockedStorage() });

    expect(readPlayerSitesSnapshot(store)).toEqual([]);
  });

  it("keeps its key outside the mod storage slots", function keepsKeyApart(): void {
    expect(PLAYER_SITES_KEY).toBe("opentesela.player-sites");
    expect(PLAYER_SITES_KEY.startsWith("opentesela.mod-storage:")).toBe(false);
  });
});

describe("rememberPlayerSite", function describeRememberPlayerSite(): void {
  it("adds the host and stores it", function remembersHost(): void {
    const storage = createMemoryStorage();
    const store = createPlayerSites({ storage });

    rememberPlayerSite(store, YOUTUBE_HOST);

    expect(readPlayerSitesSnapshot(store)).toEqual([YOUTUBE_HOST]);
    expect(readStoredHosts(storage)).toEqual([YOUTUBE_HOST]);
  });

  it("keeps a host remembered twice once", function remembersOnce(): void {
    const store = createPlayerSites({ storage: createMemoryStorage() });

    rememberPlayerSite(store, YOUTUBE_HOST);
    rememberPlayerSite(store, YOUTUBE_HOST);

    expect(readPlayerSitesSnapshot(store)).toEqual([YOUTUBE_HOST]);
  });

  it("keeps the host in memory when setItem throws", function keepsHostInMemory(): void {
    const store = createPlayerSites({ storage: createFullStorage() });

    rememberPlayerSite(store, YOUTUBE_HOST);

    expect(readPlayerSitesSnapshot(store)).toEqual([YOUTUBE_HOST]);
  });

  it("gives a new frozen snapshot after a change", function freezesSnapshot(): void {
    const store = createPlayerSites({ storage: createMemoryStorage() });
    const before = readPlayerSitesSnapshot(store);

    rememberPlayerSite(store, YOUTUBE_HOST);

    const after = readPlayerSitesSnapshot(store);
    expect(after).not.toBe(before);
    expect(Object.isFrozen(after)).toBe(true);
  });
});

describe("removePlayerSite", function describeRemovePlayerSite(): void {
  it("removes the host and stores the rest", function removesHost(): void {
    const storage = buildStoredStorage([YOUTUBE_HOST, VIMEO_HOST]);
    const store = createPlayerSites({ storage });

    removePlayerSite(store, YOUTUBE_HOST);

    expect(readPlayerSitesSnapshot(store)).toEqual([VIMEO_HOST]);
    expect(readStoredHosts(storage)).toEqual([VIMEO_HOST]);
  });

  it("removes in memory when setItem throws", function removesInMemory(): void {
    const storage = buildStoredStorage([YOUTUBE_HOST]);
    storage.setItem = createFullStorage().setItem;
    const store = createPlayerSites({ storage });

    removePlayerSite(store, YOUTUBE_HOST);

    expect(readPlayerSitesSnapshot(store)).toEqual([]);
  });
});

describe("subscribePlayerSites", function describeSubscribePlayerSites(): void {
  it("calls the listener after every change until unsubscribed", function callsListener(): void {
    const store = createPlayerSites({ storage: createMemoryStorage() });
    const listener = vi.fn<() => void>();

    const unsubscribe = subscribePlayerSites(store, listener);
    rememberPlayerSite(store, YOUTUBE_HOST);
    removePlayerSite(store, YOUTUBE_HOST);
    unsubscribe();
    rememberPlayerSite(store, VIMEO_HOST);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
