/** The part of `Storage` the settings stores use. The app passes `localStorage`. */
export type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * The JSON value stored under `key`, or `null` when there is none, it is not
 * JSON, or the storage cannot be read.
 */
export function readStoredJson(storage: SettingsStorage, key: string): unknown {
  try {
    const stored: unknown = JSON.parse(storage.getItem(key) ?? "null");
    return stored;
  } catch {
    // Unreadable or not JSON: counts as no stored value.
    return null;
  }
}

/**
 * Stores `value` as JSON under `key` when the storage allows. A storage that
 * cannot be written, full or blocked, keeps nothing: the value still applies
 * until the page is closed.
 */
export function writeStoredJson(
  storage: SettingsStorage,
  key: string,
  value: unknown,
): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Kept in memory only.
  }
}
