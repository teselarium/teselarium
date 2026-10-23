/** A `localStorage` stand-in backed by a `Map`, with the items exposed for checks. */
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

function throwQuotaError(): never {
  throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
}

/** A storage whose writes fail like a full `localStorage`. */
export function createFullStorage(): MemoryStorage {
  const fullStorage = createMemoryStorage();
  fullStorage.setItem = throwQuotaError;
  return fullStorage;
}

function throwSecurityError(): never {
  throw new DOMException("The storage is blocked.", "SecurityError");
}

/** A storage that can be neither read nor written, like a blocked `localStorage`. */
export function createBlockedStorage(): MemoryStorage {
  const blockedStorage = createMemoryStorage();
  blockedStorage.getItem = throwSecurityError;
  blockedStorage.setItem = throwSecurityError;
  return blockedStorage;
}
