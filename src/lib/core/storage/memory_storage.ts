/**
 * A `ModStorage` backed by a `Map`, with the items exposed for checks. Each
 * one starts empty and shares nothing with `localStorage` or another one.
 */
export interface MemoryStorage {
  items: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getMemoryItem(items: Map<string, string>, key: string): string | null {
  return items.get(key) ?? null;
}

function setMemoryItem(
  items: Map<string, string>,
  key: string,
  value: string,
): void {
  items.set(key, value);
}

function removeMemoryItem(items: Map<string, string>, key: string): void {
  items.delete(key);
}

/** Creates an empty in-memory storage, dropped with its last reference. */
export function createMemoryStorage(): MemoryStorage {
  const items = new Map<string, string>();
  const memoryStorage: MemoryStorage = {
    items,
    getItem: getMemoryItem.bind(undefined, items),
    setItem: setMemoryItem.bind(undefined, items),
    removeItem: removeMemoryItem.bind(undefined, items),
  };
  return memoryStorage;
}
