# User Catalog Module

## Introduction

The user catalog holds the mosaics users keep for themselves, next to what the instance offers: mosaics imported from their files and stored in this browser, and remote mosaics added by URL. Its mosaics join the [catalog](../core/engine/README.md#reading-the-catalog) after the instance catalog's and the default mosaics.

This library is the domain logic of the user catalog: its entries, their provenance, and the review that plans an import or an update. It is pure: its planning functions return new values and write nothing. The entries and the stored files live in the [browser database](../core/storage/README.md#browser-database), the app's dialogs and the user catalog store (see [main](../../main/README.md)) apply the plans, and stored files are read at their `opentesela-browser:` addresses by the [files module](../files/README.md).

## Module Details

Implemented in `src/lib/user_catalog/`. Other modules import only from the public entry point `src/lib/user_catalog/index.ts`.

### Entries and provenance

- `UserCatalogEntry`: `{ address, place, root, provenance }`.
  - `address`: the stored file's `opentesela-browser:` address, or the remote mosaic file's `http:` or `https:` address. Two entries never have the same address.
  - `place` (`UserCatalogPlace`): `"browser"` for a stored entry, `"remote"` for one added by URL.
  - `root`: the root of the stored file's address (`opentesela-browser:///<root>/<path>`), made once per imported folder or single file, or `null` for a remote entry.
  - `provenance` (`UserCatalogProvenance`): `{ folder, path, addedAt, updatedAt }`. A stored entry has the picked folder's name, or `null` for a single file, and its path inside the folder or its file name. A remote entry has `null` for both. `addedAt` is when it was first imported or added, `updatedAt` when it was last updated from a file, or `null`. Times are ISO 8601 strings in UTC. Mods read it as the catalog entry's `provenance`.
- `buildUserMosaicEntries(entries)`: the catalog's user mosaics, `UserMosaic` (`{ source, place, provenance }`), one per entry in order of addition.
- `buildRemoteEntry(address, now)`: the entry of a mosaic added by URL at `now`.
- `findUserEntry(entries, address)` and `findStoredEntry(entries, address)`: the entry at an address, or `null`. `findStoredEntry` gives `null` for a remote entry too.
- `readExportFileName(entry)`: the name a stored entry is exported under, the last segment of its provenance path, so `maps/nobel_map.yaml` gives `nobel_map.yaml`.

### Matching

A picked file matches the stored entry with the same folder name and the same path: `my-mosaics` and `maps/nobel_map.yaml`, or `null` and `nobel_map.yaml` for a single file. A matching file is that entry's update, at the entry's address. A folder imported again keeps the root of its earlier import, so new files of the folder join its root and relative references between them resolve. A single file that matches nothing gets a root of its own.

### The review

`ImportReview`: `{ folder, rows, ignoredCount }`. Files whose name does not end in `.yaml` or `.yml` are never read: `ignoredCount` counts them. Each row (`ImportReviewRow`) has the file's `path`, its `status`, the mosaic's `title`, the `error` that says why it is not a mosaic, its `warnings`, the `address` it is stored at, its `root`, the picked `text`, and the `entry` it updates or removes.

| Status (`ImportStatus`) | Shown as | Meaning | Checked when the review opens | Can be checked |
| --- | --- | --- | --- | --- |
| `new` | New | a mosaic file that matches no entry | yes | yes |
| `changed` | Changed | a mosaic file whose text differs from its entry's stored text | yes | yes |
| `unchanged` | Unchanged | a mosaic file with the same text as its entry | no | no |
| `invalid` | Not a mosaic | the mosaic loader refused it, with its message, or it is larger than 1 MB (`larger than 1 MB`, `MAX_MOSAIC_BYTES`) | no | no |
| `missing` | Not in the folder | an entry of the picked folder whose path the picked files do not have | no | yes |

**Warnings.** For each relative `mod` or `collection` reference that resolves to an `opentesela-browser:` address the store does not hold and that the picked files do not have, the row warns `"<reference>" is not in this browser, so the mosaic will not open until it is`, naming the reference as written. The file can still be imported.

### Planning functions

- `planImport(picked, folderName, sources)`: the review of picked files (`PickedFile`, with each file's path inside the picked folder, or its file name when `folderName` is `null`).
- `planUpdate(picked, entry, sources)`: the review of one picked file as the update of a stored entry, whatever the file's name: one row, `changed`, `unchanged` or `invalid`. The file is read at the entry's path, so its references resolve as they will once stored.
- `ReviewSources`: what a review reads besides the picked files: the current `entries`, `storedFiles` (a `BrowserFileReader`, to compare texts), `readMosaic(address, localFiles)`, which loads a picked file through its `file:///` address with the real mosaic loader, so the review gives the loader's messages, and an optional `createRoot`, by default `crypto.randomUUID()`.
- `listDefaultChecked(review)` and `isCheckableRow(row)`: the rows checked when the review opens, by index, and whether the user can check a row.
- `applyReview(review, checked, now)`: the `BrowserDatabaseChanges` of the checked rows, by index. New and changed files are put with their entries. An update keeps the entry's address and `addedAt`, and sets `updatedAt` to `now`. A checked missing entry is deleted with its file. Rows that cannot be checked change nothing. `now` is passed in, so tests choose the time.

Example:

```ts
import { createMemoryBrowserDatabase } from "./lib/core/storage/index.ts";
import { applyReview, listDefaultChecked, planImport } from "./lib/user_catalog/index.ts";

const database = createMemoryBrowserDatabase<UserCatalogEntry>();
const review = await planImport(pickedFiles, "my-mosaics", {
  entries: await database.readEntries(),
  storedFiles: database,
  readMosaic: readPickedMosaic,
});
// review.rows[0] is { path: "maps/nobel_map.yaml", status: "new", … }
await database.apply(applyReview(review, listDefaultChecked(review), new Date()));
```
