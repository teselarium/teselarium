import { changeStageTileLinkedMedia } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";

/** The part of `Storage` the setting uses. The app passes `localStorage`. */
export type TileMediaStorage = Pick<Storage, "getItem" | "setItem">;

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

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const TILE_MEDIA_SETTING_KEY = "opentesela.tile-linked-media";

function readStoredValue(storage: TileMediaStorage): unknown {
  try {
    const stored: unknown = JSON.parse(
      storage.getItem(TILE_MEDIA_SETTING_KEY) ?? "null",
    );
    return stored;
  } catch {
    // Unreadable or not JSON: counts as no stored value.
    return null;
  }
}

function writeSetting(storage: TileMediaStorage, isOn: boolean): void {
  try {
    storage.setItem(TILE_MEDIA_SETTING_KEY, JSON.stringify(isOn));
  } catch {
    // The setting still applies until the page is closed.
  }
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
