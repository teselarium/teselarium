import { describe, expect, it, vi } from "vitest";
import { FakeHistory } from "../../test/fake_history.ts";
import {
  createBlockedStorage,
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import { buildTestStage } from "../../test/test_stages.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import {
  createTileMediaSetting,
  readStartTileLinkedMedia,
  readTileMediaSnapshot,
  subscribeTileMediaSetting,
  switchTileLinkedMedia,
  TILE_MEDIA_SETTING_KEY,
} from "./tile_media_setting.ts";
import type { TileMediaSetting } from "./tile_media_setting.ts";

function buildStage(): Stage {
  const stage = buildTestStage(new FakeHistory(""));
  return stage;
}

function buildSetting(
  storage: MemoryStorage,
  stage: Stage = buildStage(),
): TileMediaSetting {
  const setting = createTileMediaSetting({ storage, stage });
  return setting;
}

function buildStoredStorage(storedText: string): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(TILE_MEDIA_SETTING_KEY, storedText);
  return storage;
}

describe("readStartTileLinkedMedia", function describeReadStart(): void {
  it("is on without a stored value", function startsOn(): void {
    expect(readStartTileLinkedMedia(createMemoryStorage())).toBe(true);
  });

  it("reads a stored false", function readsStoredFalse(): void {
    expect(readStartTileLinkedMedia(buildStoredStorage("false"))).toBe(false);
  });

  it("reads a stored true", function readsStoredTrue(): void {
    expect(readStartTileLinkedMedia(buildStoredStorage("true"))).toBe(true);
  });

  it("Unknown stored value", function ignoresUnknownValue(): void {
    expect(readStartTileLinkedMedia(buildStoredStorage('"maybe"'))).toBe(true);
    expect(readStartTileLinkedMedia(buildStoredStorage("maybe"))).toBe(true);
    expect(readStartTileLinkedMedia(buildStoredStorage("0"))).toBe(true);
  });

  it("is on when the storage cannot be read", function startsOnWhenBlocked(): void {
    expect(readStartTileLinkedMedia(createBlockedStorage())).toBe(true);
  });
});

describe("tile media setting", function describeTileMediaSetting(): void {
  it("starts on by default", function startsOnByDefault(): void {
    const setting = buildSetting(createMemoryStorage());

    expect(readTileMediaSnapshot(setting)).toBe(true);
  });

  it("starts with a stored false", function startsWithStoredFalse(): void {
    const setting = buildSetting(buildStoredStorage("false"));

    expect(readTileMediaSnapshot(setting)).toBe(false);
  });

  it("Kept after a reload", function keepsSetting(): void {
    const storage = createMemoryStorage();
    switchTileLinkedMedia(buildSetting(storage), false);

    const reloaded = buildSetting(storage);

    expect(storage.getItem(TILE_MEDIA_SETTING_KEY)).toBe("false");
    expect(readTileMediaSnapshot(reloaded)).toBe(false);
  });

  it("tells the stage", function tellsStage(): void {
    const stage = buildStage();
    const setting = buildSetting(createMemoryStorage(), stage);

    switchTileLinkedMedia(setting, false);
    expect(stage.loadsTileLinkedMedia).toBe(false);
    switchTileLinkedMedia(setting, true);
    expect(stage.loadsTileLinkedMedia).toBe(true);
  });

  it("calls the listeners after a change", function callsListeners(): void {
    const setting = buildSetting(createMemoryStorage());
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeTileMediaSetting(setting, listener);

    switchTileLinkedMedia(setting, false);
    unsubscribe();
    switchTileLinkedMedia(setting, true);

    expect(listener).toHaveBeenCalledOnce();
  });

  it("Storage cannot be written", function survivesFullStorage(): void {
    const stage = buildStage();
    const setting = buildSetting(createFullStorage(), stage);

    switchTileLinkedMedia(setting, false);

    expect(readTileMediaSnapshot(setting)).toBe(false);
    expect(stage.loadsTileLinkedMedia).toBe(false);
  });

  it("works with a blocked storage", function survivesBlockedStorage(): void {
    const setting = buildSetting(createBlockedStorage());

    switchTileLinkedMedia(setting, false);

    expect(readTileMediaSnapshot(setting)).toBe(false);
  });

  it("Mods cannot reach the switch", function keepsKeyOutOfModStorage(): void {
    expect(TILE_MEDIA_SETTING_KEY).toBe("opentesela.tile-linked-media");
    expect(TILE_MEDIA_SETTING_KEY.startsWith("opentesela.mod-storage:")).toBe(
      false,
    );
  });
});
