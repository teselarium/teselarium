# Storage Module

## Introduction

Each mod has its own storage slot, identified by the mod's source, which it reaches through the engine's `storage.*` requests. This module holds the slots and the storages they live in. The slots and their keys are described in the [engine module](../engine/README.md#storage-slots).

## Module Details

Implemented in `src/lib/core/storage/`. Other modules import only from the public entry point `src/lib/core/storage/index.ts`.

- `readModValue(storage, modSource, key)` and `writeModValue(storage, modSource, key, value)`: read and write a value of a mod's slot (see the [engine module](../engine/README.md#storage-slots)).
- `createMemoryStorage()`: a new, empty `ModStorage` backed by a `Map`. It shares nothing with `localStorage` or with another memory storage, and is dropped with its last reference. The mod check gives one to each checked mod as its throwaway slot, and tests use it in place of `localStorage`.
- Types: `ModStorage`, the `getItem`, `setItem` and `removeItem` part of `Storage`, and `MemoryStorage`, a `ModStorage` that also exposes its `items` map.

Example:

```ts
import { createMemoryStorage, readModValue, writeModValue } from "./lib/core/storage/index.ts";

const source = "https://example.org/samples/mods/book_list/mod_conf.yaml";
const throwawayStorage = createMemoryStorage();
writeModValue(throwawayStorage, source, "selected", "kallocain");
readModValue(throwawayStorage, source, "selected"); // "kallocain"
readModValue(localStorage, source, "selected"); // unchanged
```
