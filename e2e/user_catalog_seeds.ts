import type { Page } from "@playwright/test";

/** A user catalog entry as the browser database keeps it (see the storage module's README). */
export interface SeededEntry {
  address: string;
  place: "browser" | "remote";
  root: string | null;
  provenance: {
    folder: string | null;
    path: string | null;
    addedAt: string;
    updatedAt: string | null;
    changedSinceExport: boolean;
    copiedFrom: string | null;
  };
  /** The `savedAt` of the version it was imported with, or `null` for a remote entry. */
  syncedAt: string | null;
}

export interface UserCatalogSeed {
  entries: SeededEntry[];
  /** The stored files' texts, by address. */
  files: Record<string, string>;
}

/** A stored entry imported from `path` of the folder `my-mosaics`. */
export function buildStoredSeedEntry(path: string): SeededEntry {
  const entry: SeededEntry = {
    address: `opentesela-browser:///seeded/${path}`,
    place: "browser",
    root: "seeded",
    provenance: {
      folder: "my-mosaics",
      path,
      addedAt: "2026-11-20T10:00:00.000Z",
      updatedAt: null,
      changedSinceExport: false,
      copiedFrom: null,
    },
    syncedAt: "2026-11-20T10:00:00.000Z",
  };
  return entry;
}

/** A remote entry added by URL. */
export function buildRemoteSeedEntry(address: string): SeededEntry {
  const entry: SeededEntry = {
    address,
    place: "remote",
    root: null,
    provenance: {
      folder: null,
      path: null,
      addedAt: "2026-11-20T11:00:00.000Z",
      updatedAt: null,
      changedSinceExport: false,
      copiedFrom: null,
    },
    syncedAt: null,
  };
  return entry;
}

/**
 * Runs in the page: writes the entries and files into the app's database
 * `opentesela`, version 2, as its stores keep them, with the "imported"
 * version each stored entry is synced with, and resolves once written.
 */
function writeSeed(seed: UserCatalogSeed): Promise<void> {
  function writeStores(
    database: IDBDatabase,
    resolve: () => void,
    reject: (error: unknown) => void,
  ): void {
    const transaction = database.transaction(
      ["files", "user-catalog", "versions"],
      "readwrite",
    );
    for (const [address, text] of Object.entries(seed.files)) {
      transaction.objectStore("files").put({ address, text });
    }
    for (const entry of seed.entries) {
      const text = seed.files[entry.address];
      if (entry.syncedAt !== null && text !== undefined) {
        transaction.objectStore("versions").put({
          address: entry.address,
          savedAt: entry.syncedAt,
          kind: "imported",
          text,
        });
      }
    }
    for (const [position, entry] of seed.entries.entries()) {
      transaction
        .objectStore("user-catalog")
        .put({ position, entry }, entry.address);
    }
    transaction.oncomplete = function finishWrite(): void {
      database.close();
      resolve();
    };
    transaction.onerror = function failWrite(): void {
      reject(transaction.error);
    };
  }
  function openAndWrite(
    resolve: () => void,
    reject: (error: unknown) => void,
  ): void {
    const request = indexedDB.open("opentesela", 2);
    request.onupgradeneeded = function createStores(): void {
      request.result.createObjectStore("files", { keyPath: "address" });
      request.result.createObjectStore("user-catalog");
      const versions = request.result.createObjectStore("versions", {
        keyPath: ["address", "savedAt"],
      });
      versions.createIndex("address", "address");
    };
    request.onsuccess = function writeOpened(): void {
      writeStores(request.result, resolve, reject);
    };
    request.onerror = function failOpen(): void {
      reject(request.error);
    };
  }
  return new Promise(openAndWrite);
}

/**
 * Seeds the user catalog on the app's origin, then reloads, so the app
 * starts with it. The page must already be on the app.
 */
export async function seedUserCatalog(
  page: Page,
  seed: UserCatalogSeed,
): Promise<void> {
  await page.evaluate(writeSeed, seed);
  await page.reload();
}
