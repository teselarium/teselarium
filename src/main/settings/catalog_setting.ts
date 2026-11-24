import { changeStageCatalogDefaultMosaics } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import { readStoredJson, writeStoredJson } from "./stored_json.ts";
import type { SettingsStorage } from "./stored_json.ts";

/** The part of `Storage` the setting uses. The app passes `localStorage`. */
export type CatalogSettingStorage = SettingsStorage;

export interface CatalogSettingOptions {
  storage: CatalogSettingStorage;
  stage: Stage;
}

/** "List the default mosaics of mods": whether the catalog's mosaics also hold its mods' default mosaics. Mutable. */
export interface CatalogSetting {
  storage: CatalogSettingStorage;
  stage: Stage;
  listeners: Set<() => void>;
  /** Whether the setting is on. */
  snapshot: boolean;
}

/** Outside the `teselarium.mod-storage:` keys, so no mod storage slot can reach it. */
export const CATALOG_SETTING_KEY = "teselarium.catalog-default-mosaics";

/**
 * Whether the setting is on as the app starts, for the stage created before
 * the setting. Off unless the stored value is `true`.
 */
export function readStartCatalogDefaultMosaics(
  storage: CatalogSettingStorage,
): boolean {
  const isOn = readStoredJson(storage, CATALOG_SETTING_KEY) === true;
  return isOn;
}

/** Reads the stored setting. The stage starts from `readStartCatalogDefaultMosaics`. */
export function createCatalogSetting(
  options: CatalogSettingOptions,
): CatalogSetting {
  const setting: CatalogSetting = {
    storage: options.storage,
    stage: options.stage,
    listeners: new Set(),
    snapshot: readStartCatalogDefaultMosaics(options.storage),
  };
  return setting;
}

/**
 * Switches the setting on or off, stored when the storage allows, and tells
 * the stage, which pushes the new catalog to the running mods.
 */
export function switchCatalogDefaultMosaics(
  setting: CatalogSetting,
  isOn: boolean,
): void {
  writeStoredJson(setting.storage, CATALOG_SETTING_KEY, isOn);
  setting.snapshot = isOn;
  void changeStageCatalogDefaultMosaics(setting.stage, isOn);
  for (const listener of setting.listeners) {
    listener();
  }
}

export function readCatalogSettingSnapshot(setting: CatalogSetting): boolean {
  return setting.snapshot;
}

function unsubscribeCatalogSetting(
  setting: CatalogSetting,
  listener: () => void,
): void {
  setting.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeCatalogSetting(
  setting: CatalogSetting,
  listener: () => void,
): () => void {
  setting.listeners.add(listener);
  return unsubscribeCatalogSetting.bind(undefined, setting, listener);
}
