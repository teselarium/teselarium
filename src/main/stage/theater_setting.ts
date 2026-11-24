import { changeStageTheaterMode } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import { readStoredJson, writeStoredJson } from "../settings/stored_json.ts";
import type { SettingsStorage } from "../settings/stored_json.ts";

/** The part of `Storage` the setting uses. The app passes `localStorage`. */
export type TheaterStorage = SettingsStorage;

export interface TheaterSettingOptions {
  storage: TheaterStorage;
  stage: Stage;
}

/**
 * Theater mode, remembered across reloads. The stage keeps whether it is on
 * (its snapshot's `isTheaterMode`); the setting stores the choice.
 */
export interface TheaterSetting {
  storage: TheaterStorage;
  stage: Stage;
}

/** Outside the `teselarium.mod-storage:` keys, so no mod storage slot can reach it. */
export const THEATER_MODE_KEY = "teselarium.theater-mode";

/**
 * Whether theater mode is on as the app starts, for the stage created before
 * the setting. On only when the stored value is `true`: a missing or unknown
 * value, or a storage that cannot be read, is off.
 */
export function readStartTheaterMode(storage: TheaterStorage): boolean {
  const isOn = readStoredJson(storage, THEATER_MODE_KEY) === true;
  return isOn;
}

export function createTheaterSetting(
  options: TheaterSettingOptions,
): TheaterSetting {
  const setting: TheaterSetting = {
    storage: options.storage,
    stage: options.stage,
  };
  return setting;
}

/**
 * Turns theater mode on or off, stored when the storage allows, and tells
 * the stage, which changes the layout of every running mod. When the storage
 * cannot be written, the choice still applies until the page is closed.
 */
export function changeTheaterMode(
  setting: TheaterSetting,
  isOn: boolean,
): void {
  writeStoredJson(setting.storage, THEATER_MODE_KEY, isOn);
  changeStageTheaterMode(setting.stage, isOn);
}
