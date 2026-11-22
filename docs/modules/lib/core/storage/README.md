# Storage Module

## Introduction

Each mod has one storage slot per context, identified by the mod's source and what it was opened with: the mosaic file, otherwise the collection or the tile, otherwise nothing. A mod reaches its slot through the engine's `storage.*` requests, and the engine derives the context, so mods never choose it. This module holds the slots and the storages they live in. The slots and their keys are described in the [engine module](../engine/README.md#storage-slots).

It also holds the browser database: the IndexedDB database where the app keeps the text of the files the user imports and the entries of the [user catalog](../../user_catalog/README.md).

## Module Details

Implemented in `src/lib/core/storage/`. Other modules import only from the public entry point `src/lib/core/storage/index.ts`.

- `readModValue(storage, slot, key)` and `writeModValue(storage, slot, key, value)`: read and write a value of a slot, a `ModSlot` (`{ mod, context }`), under the key `"opentesela.mod-storage:" + JSON.stringify([mod, context, key])` (see the [engine module](../engine/README.md#storage-slots)).
- `createMemoryStorage()`: a new, empty `ModStorage` backed by a `Map`. It shares nothing with `localStorage` or with another memory storage, and is dropped with its last reference. The mod check gives one to each checked mod as its throwaway slot, and tests use it in place of `localStorage`.
- Types: `ModSlot`, the mod's source and its context (`""` for none); `ModStorage`, the `getItem`, `setItem` and `removeItem` part of `Storage`; and `MemoryStorage`, a `ModStorage` that also exposes its `items` map.

Example:

```ts
import { createMemoryStorage, readModValue, writeModValue } from "./lib/core/storage/index.ts";

const slot = {
  mod: "https://example.org/samples/mods/book_list/mod_conf.yaml",
  context: "https://example.org/samples/mods/book_list/mosaic.yaml",
};
const throwawayStorage = createMemoryStorage();
writeModValue(throwawayStorage, slot, "selected", "kallocain");
readModValue(throwawayStorage, slot, "selected"); // "kallocain"
readModValue(localStorage, slot, "selected"); // unchanged
```

### Browser database

The IndexedDB database `opentesela`, version 2, has three object stores:

| Store | Key | Value |
| --- | --- | --- |
| `files` | the file's `opentesela-browser:` address | `{ address, text }` |
| `user-catalog` | the entry's address | `{ position, entry }`, where `entry` is the user catalog entry and `position` its place in the order of addition |
| `versions` | `[address, savedAt]`, with an index `address` on `address` | `{ address, savedAt, kind, text }`, one text a stored file had, where `kind` is `"imported"`, `"updated"`, `"saved"` or `"restored"` and `savedAt` an ISO 8601 time in UTC. Added in version 2. |

- `BrowserDatabase<Entry>`: the interface the app uses, generic over the entry type, which only needs an `address`:
  - `readText(address)`: the stored text, or `null`. The [files module](../../files/README.md)'s `BrowserFileReader` is this method.
  - `readEntries()`: every entry, in order of addition. An entry put again keeps its place.
  - `readVersions(address)`: the versions of the stored file at `address`, newest first, read through the `address` index.
  - `apply(changes)`: one `BrowserDatabaseChanges` (`putFiles`, `putEntries`, `putVersions`, `deleteVersions`, `deleteAddresses`), written in one `readwrite` transaction over the three stores, so an entry never points to a missing file and a file never changes without its version. `putVersions` and `deleteVersions` (`{ address, savedAt }` keys) are optional, and absent means none. A deleted address loses its file, its entry and all its versions. The write reads the current positions inside its transaction and touches only the addresses it changes, so a write from another tab is kept.
  - `clear()`: deletes every file, entry and version.
- `openBrowserDatabase(options?)`: opens the database, creating its stores on the first open and upgrading an older version (`onupgradeneeded`). It resolves with `null` when the browser has no IndexedDB, refuses to open it, as some private windows do, or the upgrade fails. `options` (`BrowserDatabaseOptions`) are:
  - `factory`: the `IDBFactory`, `globalThis.indexedDB` by default;
  - `upgradeEntry(entry)`: what the upgrade from version 1 does with each entry, `{ entry, savedAt }`, see below;
  - `onBlocked()`: called when the opening waits for another tab, which still has an older version open, to close;
  - `onVersionChange()`: called after this tab's connection closed because another tab opens a newer version.
- `createMemoryBrowserDatabase()`: a new, empty `BrowserDatabase` kept in memory, with the same order rules. Unit tests use it in place of IndexedDB, which jsdom does not have. The IndexedDB version is tested in the browsers, in the e2e tests tagged `@storage`.
- Types: `BrowserDatabase`, `BrowserDatabaseChanges`, `BrowserDatabaseOptions`, `StoredFile` (`{ address, text }`), `StoredVersion`, `StoredVersionKey` (`{ address, savedAt }`), `StoredVersionKind`, `UpgradedEntry` (`{ entry, savedAt }`) and `AddressedEntry` (`{ address }`).

#### Versions and their pruning

Every write that changes a stored file's text, whether an import, an update from a file, a save, a restore or a conflict choice, puts a version with the new text in the same transaction. So the newest version of a file is always its current text, and a text that is replaced is still the version before it. The database keeps what it is given: which versions to keep is decided by the [user catalog](../../user_catalog/README.md#versions) when it plans a write, and its deletions go in the same `apply`. It keeps the 20 newest versions of a file, and always the version it was last imported, updated from a file or exported with.

#### The upgrade from version 1

`onupgradeneeded` creates the stores a database lacks, so a new database gets all three. From version 1, it then runs in the upgrade's transaction:

1. each entry is put back as `upgradeEntry(entry).entry`. The user catalog gives the entry its sync state: a stored entry is synced with its imported text (see the [user catalog](../../user_catalog/README.md#sync-state));
2. each entry with a stored file gets one `"imported"` version of its current text, at `upgradeEntry(entry).savedAt`, its last update or its import time.

A write of the upgrade that fails aborts the transaction, so the data stays at version 1 and `openBrowserDatabase` resolves with `null`, as for any opening that fails: the app starts with the empty, read-only user catalog, and the next load tries the upgrade again.

#### Other tabs

A tab with version 1 open has no `versionchange` handler, so a tab that opens version 2 waits until the older tab is closed or reloaded. Meanwhile `onBlocked` is called, and the user catalog store says so (see the [main module](../../../main/README.md#the-user-catalog)). From version 2 on, a connection closes itself on `versionchange` and calls `onVersionChange`, so a later upgrade in another tab is never blocked, and the store asks for a reload of the tab whose connection closed.

Example:

```ts
import { createMemoryBrowserDatabase } from "./lib/core/storage/index.ts";

const database = createMemoryBrowserDatabase<{ address: string }>();
const address = "opentesela-browser:///r1/nobel_map.yaml";
await database.apply({
  putFiles: [{ address, text: "title: Nobel map\n" }],
  putEntries: [{ address }],
  deleteAddresses: [],
});
await database.readText(address); // "title: Nobel map\n"
await database.apply({ putFiles: [], putEntries: [], deleteAddresses: [address] });
await database.readEntries(); // []
```
