import { changeStageTileLinkedMedia } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import { readStoredJson, writeStoredJson } from "./stored_json.ts";
import type { SettingsStorage } from "./stored_json.ts";

/** The part of `Storage` the setting uses. The app passes `localStorage`. */
export type TileMediaStorage = SettingsStorage;

export interface TileMediaSettingOptions {
  storage: TileMediaStorage;
  stage: Stage;
}

/** "Load media linked by tiles": whether mods opened from now on load the media their tiles link. Mutable. */
export interface TileMediaSetting {
  storage: TileMediaStorage;
  stage: Stage;
  listeners: Set<() => void>;
  /** Whether the setting is on. */
  snapshot: boolean;
}

/** Outside the `teselarium.mod-storage:` keys, so no mod storage slot can reach it. */
export const TILE_MEDIA_SETTING_KEY = "teselarium.tile-linked-media";

function readStoredValue(storage: TileMediaStorage): unknown {
  const stored = readStoredJson(storage, TILE_MEDIA_SETTING_KEY);
  return stored;
}

function writeSetting(storage: TileMediaStorage, isOn: boolean): void {
  writeStoredJson(storage, TILE_MEDIA_SETTING_KEY, isOn);
}

/**
 * Whether the setting is on as the app starts, for the stage created before
 * the setting. On unless the stored value is `false`.
 */
export function readStartTileLinkedMedia(storage: TileMediaStorage): boolean {
  const isOn = readStoredValue(storage) !== false;
  return isOn;
}

/** Reads the stored setting. The stage starts from `readStartTileLinkedMedia`. */
export function createTileMediaSetting(
  options: TileMediaSettingOptions,
): TileMediaSetting {
  const setting: TileMediaSetting = {
    storage: options.storage,
    stage: options.stage,
    listeners: new Set(),
    snapshot: readStartTileLinkedMedia(options.storage),
  };
  return setting;
}

/**
 * Switches the setting on or off, stored when the storage allows, and tells
 * the stage, so mods opened afterwards follow it. Running mods keep theirs.
 */
export function switchTileLinkedMedia(
  setting: TileMediaSetting,
  isOn: boolean,
): void {
  writeSetting(setting.storage, isOn);
  setting.snapshot = isOn;
  changeStageTileLinkedMedia(setting.stage, isOn);
  for (const listener of setting.listeners) {
    listener();
  }
}

export function readTileMediaSnapshot(setting: TileMediaSetting): boolean {
  return setting.snapshot;
}

function unsubscribeTileMediaSetting(
  setting: TileMediaSetting,
  listener: () => void,
): void {
  setting.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeTileMediaSetting(
  setting: TileMediaSetting,
  listener: () => void,
): () => void {
  setting.listeners.add(listener);
  return unsubscribeTileMediaSetting.bind(undefined, setting, listener);
}
