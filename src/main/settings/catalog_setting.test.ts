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
  CATALOG_SETTING_KEY,
  createCatalogSetting,
  readCatalogSettingSnapshot,
  readStartCatalogDefaultMosaics,
  subscribeCatalogSetting,
  switchCatalogDefaultMosaics,
} from "./catalog_setting.ts";
import type { CatalogSetting } from "./catalog_setting.ts";

function buildStage(): Stage {
  const stage = buildTestStage(new FakeHistory(""));
  return stage;
}

function buildSetting(
  storage: MemoryStorage,
  stage: Stage = buildStage(),
): CatalogSetting {
  const setting = createCatalogSetting({ storage, stage });
  return setting;
}

function buildStoredStorage(storedText: string): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(CATALOG_SETTING_KEY, storedText);
  return storage;
}

describe("readStartCatalogDefaultMosaics", function describeReadStart(): void {
  it("is off without a stored value", function startsOff(): void {
    expect(readStartCatalogDefaultMosaics(createMemoryStorage())).toBe(false);
  });

  it("reads a stored true", function readsStoredTrue(): void {
    expect(readStartCatalogDefaultMosaics(buildStoredStorage("true"))).toBe(
      true,
    );
  });

  it("Unknown stored value", function ignoresUnknownValue(): void {
    expect(readStartCatalogDefaultMosaics(buildStoredStorage('"maybe"'))).toBe(
      false,
    );
    expect(readStartCatalogDefaultMosaics(buildStoredStorage("maybe"))).toBe(
      false,
    );
    expect(readStartCatalogDefaultMosaics(buildStoredStorage("1"))).toBe(false);
  });

  it("is off when the storage cannot be read", function startsOffWhenBlocked(): void {
    expect(readStartCatalogDefaultMosaics(createBlockedStorage())).toBe(false);
  });
});

describe("catalog setting", function describeCatalogSetting(): void {
  it("Kept after a reload", function keepsSetting(): void {
    const storage = createMemoryStorage();
    switchCatalogDefaultMosaics(buildSetting(storage), true);

    const reloaded = buildSetting(storage);

    expect(storage.getItem(CATALOG_SETTING_KEY)).toBe("true");
    expect(readCatalogSettingSnapshot(reloaded)).toBe(true);
    expect(readStartCatalogDefaultMosaics(storage)).toBe(true);
  });

  it("tells the stage", function tellsStage(): void {
    const stage = buildStage();
    const setting = buildSetting(createMemoryStorage(), stage);

    switchCatalogDefaultMosaics(setting, true);
    expect(stage.catalogDefaultMosaics).toBe(true);
    switchCatalogDefaultMosaics(setting, false);
    expect(stage.catalogDefaultMosaics).toBe(false);
  });

  it("calls the listeners after a change", function callsListeners(): void {
    const setting = buildSetting(createMemoryStorage());
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeCatalogSetting(setting, listener);

    switchCatalogDefaultMosaics(setting, true);
    unsubscribe();
    switchCatalogDefaultMosaics(setting, false);

    expect(listener).toHaveBeenCalledOnce();
  });

  it("Storage cannot be written", function survivesFullStorage(): void {
    const stage = buildStage();
    const setting = buildSetting(createFullStorage(), stage);

    switchCatalogDefaultMosaics(setting, true);

    expect(readCatalogSettingSnapshot(setting)).toBe(true);
    expect(stage.catalogDefaultMosaics).toBe(true);
  });

  it("Mods cannot reach the switch", function keepsKeyOutOfModStorage(): void {
    expect(CATALOG_SETTING_KEY).toBe("opentesela.catalog-default-mosaics");
    expect(CATALOG_SETTING_KEY.startsWith("opentesela.mod-storage:")).toBe(
      false,
    );
  });
});
