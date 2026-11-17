# Storage Module

## Introduction

Each mod has one storage slot per context, identified by the mod's source and what it was opened with: the mosaic file, otherwise the collection or the tile, otherwise nothing. A mod reaches its slot through the engine's `storage.*` requests, and the engine derives the context, so mods never choose it. This module holds the slots and the storages they live in. The slots and their keys are described in the [engine module](../engine/README.md#storage-slots).

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
