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

The IndexedDB database `opentesela`, version 1, has two object stores:

| Store | Key | Value |
| --- | --- | --- |
| `files` | the file's `opentesela-browser:` address | `{ address, text }` |
| `user-catalog` | the entry's address | `{ position, entry }`, where `entry` is the user catalog entry and `position` its place in the order of addition |

- `BrowserDatabase<Entry>`: the interface the app uses, generic over the entry type, which only needs an `address`:
  - `readText(address)`: the stored text, or `null`. The [files module](../../files/README.md)'s `BrowserFileReader` is this method.
  - `readEntries()`: every entry, in order of addition. An entry put again keeps its place.
  - `apply(changes)`: one `BrowserDatabaseChanges` (`putFiles`, `putEntries`, `deleteAddresses`), written in one `readwrite` transaction over both stores, so an entry never points to a missing file. A deleted address loses its file and its entry. The write reads the current positions inside its transaction and touches only the addresses it changes, so a write from another tab is kept.
  - `clear()`: deletes every file and entry.
- `openBrowserDatabase()`: opens the database, creating its stores on the first open (`onupgradeneeded`). It resolves with `null` when the browser has no IndexedDB or refuses to open it, as some private windows do. A later change that needs another store raises the version and creates the store in `onupgradeneeded`.
- `createMemoryBrowserDatabase()`: a new, empty `BrowserDatabase` kept in memory, with the same order rules. Unit tests use it in place of IndexedDB, which jsdom does not have. The IndexedDB version is tested in the browsers, in the e2e tests tagged `@storage`.
- Types: `BrowserDatabase`, `BrowserDatabaseChanges`, `StoredFile` (`{ address, text }`) and `AddressedEntry` (`{ address }`).

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
