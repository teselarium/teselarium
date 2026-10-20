import type { YamlValue } from "../../files/index.ts";

/** The part of `Storage` the slots use. The app passes `localStorage`. */
export type ModStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY_PREFIX = "opentesela.mod-storage:";

/** A JSON array cannot collide the way `source + ":" + key` could, since both can contain `:`. */
function buildStorageKey(modSource: string, key: string): string {
  const storageKey = STORAGE_KEY_PREFIX + JSON.stringify([modSource, key]);
  return storageKey;
}

/** Reads a value of a mod's slot, or `null` when the key was never stored. */
export function readModValue(
  storage: ModStorage,
  modSource: string,
  key: string,
): YamlValue | null {
  const storedText = storage.getItem(buildStorageKey(modSource, key));
  if (storedText === null) {
    return null;
  }
  const value = JSON.parse(storedText) as YamlValue;
  return value;
}

/** Stores a value in a mod's slot as JSON. Storing `null` removes the key. Storage errors propagate. */
export function writeModValue(
  storage: ModStorage,
  modSource: string,
  key: string,
  value: YamlValue | null,
): void {
  const storageKey = buildStorageKey(modSource, key);
  if (value === null) {
    storage.removeItem(storageKey);
    return;
  }
  storage.setItem(storageKey, JSON.stringify(value));
}
