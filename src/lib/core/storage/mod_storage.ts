import type { YamlValue } from "../../files/index.ts";

/** The part of `Storage` the slots use. The app passes `localStorage`. */
export type ModStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * A mod's storage slot: the mod's source and its context, the address of
 * what the mod was opened with (a mosaic, a collection or a tile), or `""`
 * for none. Two slots that differ in either never share a value.
 */
export interface ModSlot {
  mod: string;
  context: string;
}

const STORAGE_KEY_PREFIX = "opentesela.mod-storage:";

/**
 * A JSON array cannot collide the way `source + ":" + key` could, since each
 * part can contain `:`. A three-element key never equals a key of the former
 * per-mod slots, `[modSource, key]`, so their values are never read.
 */
function buildStorageKey(slot: ModSlot, key: string): string {
  const storageKey =
    STORAGE_KEY_PREFIX + JSON.stringify([slot.mod, slot.context, key]);
  return storageKey;
}

/** Reads a value of a mod's slot, or `null` when the key was never stored. */
export function readModValue(
  storage: ModStorage,
  slot: ModSlot,
  key: string,
): YamlValue | null {
  const storedText = storage.getItem(buildStorageKey(slot, key));
  if (storedText === null) {
    return null;
  }
  const value = JSON.parse(storedText) as YamlValue;
  return value;
}

/** Stores a value in a mod's slot as JSON. Storing `null` removes the key. Storage errors propagate. */
export function writeModValue(
  storage: ModStorage,
  slot: ModSlot,
  key: string,
  value: YamlValue | null,
): void {
  const storageKey = buildStorageKey(slot, key);
  if (value === null) {
    storage.removeItem(storageKey);
    return;
  }
  storage.setItem(storageKey, JSON.stringify(value));
}
