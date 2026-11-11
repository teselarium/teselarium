import { describe, expect, it } from "vitest";
import { FakeHistory } from "../../test/fake_history.ts";
import {
  createBlockedStorage,
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import { buildTestStage } from "../../test/test_stages.ts";
import { readStageSnapshot } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import {
  changeTheaterMode,
  createTheaterSetting,
  readStartTheaterMode,
  THEATER_MODE_KEY,
} from "./theater_setting.ts";
import type { TheaterSetting } from "./theater_setting.ts";

function buildStage(): Stage {
  const stage = buildTestStage(new FakeHistory(""));
  return stage;
}

function buildSetting(
  storage: MemoryStorage,
  stage: Stage = buildStage(),
): TheaterSetting {
  const setting = createTheaterSetting({ storage, stage });
  return setting;
}

function buildStoredStorage(storedText: string): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(THEATER_MODE_KEY, storedText);
  return storage;
}

describe("readStartTheaterMode", function describeReadStart(): void {
  it("reads a stored true", function readsStoredTrue(): void {
    expect(readStartTheaterMode(buildStoredStorage("true"))).toBe(true);
  });

  it("is off without a stored value", function startsOff(): void {
    expect(readStartTheaterMode(createMemoryStorage())).toBe(false);
  });

  it("reads a stored false", function readsStoredFalse(): void {
    expect(readStartTheaterMode(buildStoredStorage("false"))).toBe(false);
  });

  it("Unknown stored value", function ignoresUnknownValue(): void {
    expect(readStartTheaterMode(buildStoredStorage('"maybe"'))).toBe(false);
    expect(readStartTheaterMode(buildStoredStorage("maybe"))).toBe(false);
    expect(readStartTheaterMode(buildStoredStorage("1"))).toBe(false);
  });

  it("is off when the storage cannot be read", function startsOffWhenBlocked(): void {
    expect(readStartTheaterMode(createBlockedStorage())).toBe(false);
  });
});

describe("changeTheaterMode", function describeChangeTheaterMode(): void {
  it("Choice kept after a reload", function keepsChoice(): void {
    const storage = createMemoryStorage();

    changeTheaterMode(buildSetting(storage), true);

    expect(storage.getItem(THEATER_MODE_KEY)).toBe("true");
    expect(readStartTheaterMode(storage)).toBe(true);
  });

  it("tells the stage", function tellsStage(): void {
    const stage = buildStage();
    const setting = buildSetting(createMemoryStorage(), stage);

    changeTheaterMode(setting, true);
    expect(readStageSnapshot(stage).isTheaterMode).toBe(true);

    changeTheaterMode(setting, false);
    expect(readStageSnapshot(stage).isTheaterMode).toBe(false);
  });

  it("Storage cannot be written", function appliesWithoutStorage(): void {
    const stage = buildStage();

    expect(function changeInFullStorage(): void {
      changeTheaterMode(buildSetting(createFullStorage(), stage), true);
    }).not.toThrow();
    expect(readStageSnapshot(stage).isTheaterMode).toBe(true);
  });

  it("applies when the storage can be neither read nor written", function appliesWhenBlocked(): void {
    const stage = buildStage();
    const storage = createBlockedStorage();

    changeTheaterMode(buildSetting(storage, stage), true);

    expect(readStageSnapshot(stage).isTheaterMode).toBe(true);
    expect(readStartTheaterMode(storage)).toBe(false);
  });
});
