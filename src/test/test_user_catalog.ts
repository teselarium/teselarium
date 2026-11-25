import type { Stage } from "../lib/core/stage/index.ts";
import { createMemoryBrowserDatabase } from "../lib/core/storage/index.ts";
import type { UserCatalogEntry } from "../lib/user_catalog/index.ts";
import type { RecentlyUsed } from "../main/settings/recently_used.ts";
import { createUserCatalogStore } from "../main/user_catalog/user_catalog_store.ts";
import type {
  PersistentStorage,
  StartUserCatalog,
  UserCatalogDatabase,
  UserCatalogStore,
} from "../main/user_catalog/user_catalog_store.ts";

function resolveKept(isKept: boolean): Promise<boolean> {
  return Promise.resolve(isKept);
}

/** A `navigator.storage` that answers `isKept` to both questions. */
export function createFakePersistentStorage(
  isKept: boolean,
): PersistentStorage {
  const persistentStorage: PersistentStorage = {
    persist: resolveKept.bind(undefined, isKept),
    persisted: resolveKept.bind(undefined, isKept),
  };
  return persistentStorage;
}

export interface TestUserCatalogOptions {
  /** A memory database by default. `null` plays a browser that refused it. */
  database?: UserCatalogDatabase | null;
  entries?: readonly UserCatalogEntry[];
  /** Whether the browser keeps the storage. `true` by default. */
  isKept?: boolean;
}

/** The user catalog store of a test stage, on a memory database unless given one. */
export function createTestUserCatalog(
  stage: Stage,
  recentlyUsed: RecentlyUsed,
  options: TestUserCatalogOptions = {},
): UserCatalogStore {
  const database =
    options.database === undefined
      ? createMemoryBrowserDatabase<UserCatalogEntry>()
      : options.database;
  const start: StartUserCatalog = { database, entries: options.entries ?? [] };
  const store = createUserCatalogStore({
    start: Promise.resolve(start),
    stage,
    recentlyUsed,
    persistentStorage: createFakePersistentStorage(options.isKept ?? true),
  });
  return store;
}
