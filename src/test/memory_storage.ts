import { createMemoryStorage } from "../lib/core/storage/index.ts";
import type { MemoryStorage } from "../lib/core/storage/index.ts";

export { createMemoryStorage };
export type { MemoryStorage };

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
