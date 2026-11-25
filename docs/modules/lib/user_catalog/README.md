# User Catalog Module

## Introduction

The user catalog holds the mosaics users keep for themselves, next to what the instance offers: mosaics imported from their files and stored in this browser, and remote mosaics added by URL. Its mosaics join the [catalog](../core/engine/README.md#reading-the-catalog) after the instance catalog's and the default mosaics.

This library is the domain logic of the user catalog: its entries, their provenance and sync state, the review that plans an import or an update, the plans of a save and a restore, the versions each stored mosaic keeps, and the archive of an exported folder. It is pure: its planning functions return new values and write nothing. The entries and the stored files live in the [browser database](../core/storage/README.md#browser-database), the app's dialogs and the user catalog store (see [main](../../main/README.md)) apply the plans, and stored files are read at their `teselarium-browser:` addresses by the [files module](../files/README.md).

## Module Details

Implemented in `src/lib/user_catalog/`. Other modules import only from the public entry point `src/lib/user_catalog/index.ts`.

### Entries and provenance

- `UserCatalogEntry`: `{ address, place, root, provenance, syncedAt }`.
  - `address`: the stored file's `teselarium-browser:` address, or the remote mosaic file's `http:` or `https:` address. Two entries never have the same address.
  - `place` (`UserCatalogPlace`): `"browser"` for a stored entry, `"remote"` for one added by URL.
  - `root`: the root of the stored file's address (`teselarium-browser:///<root>/<path>`), made once per imported folder or single file, or `null` for a remote entry.
  - `provenance` (`UserCatalogProvenance`): `{ folder, path, addedAt, updatedAt, changedSinceExport, copiedFrom }`. A stored entry has the picked folder's name, or `null` for a single file or a mosaic saved in the app, and its path inside the folder or its file name. A remote entry has `null` for both. `addedAt` is when it was first imported, saved or added, `updatedAt` when it was last updated, from a file or by a save, or `null`. `changedSinceExport` says whether its text changed since it was last synced (see [Sync state](#sync-state)), and is always `false` for a remote entry. `copiedFrom` is the address a saved copy was copied from, or `null`. Times are ISO 8601 strings in UTC. Mods read it as the catalog entry's `provenance`.
  - `syncedAt`: the `savedAt` of the [version](#versions) it was last imported, updated from a file or exported with, or `null` for a remote entry and for a mosaic saved in the app and never exported. Mods do not see it.
- `buildUserMosaicEntries(entries)`: the catalog's user mosaics, `UserMosaic` (`{ source, place, provenance }`), one per entry in order of addition.
- `buildRemoteEntry(address, now)`: the entry of a mosaic added by URL at `now`.
- `findUserEntry(entries, address)` and `findStoredEntry(entries, address)`: the entry at an address, or `null`. `findStoredEntry` gives `null` for a remote entry too.
- `readExportFileName(entry)`: the name a stored entry is exported under, the last segment of its provenance path, so `maps/nobel_map.yaml` gives `nobel_map.yaml`.
- `upgradeStoredEntry(entry)`: an entry of a version 1 database in its version 2 form, for the database's upgrade (see the [storage module](../core/storage/README.md#the-upgrade-from-version-1)): `changedSinceExport` `false`, `copiedFrom` `null`, and a stored entry synced with its "imported" version, whose time is its `updatedAt`, or its `addedAt`.

### Versions

Each stored mosaic keeps the texts it had, as the [browser database](../core/storage/README.md#versions-and-their-pruning)'s versions: `{ address, savedAt, kind, text }`, where `kind` is `"imported"` (its import, or a "Keep both"), `"updated"` (an update from a file, or "Take the file"), `"saved"` (a save in the app) or `"restored"` (a version restored from the history). Every plan of this module that changes a stored file's text puts one version with the new text, at the write's time, so the newest version is always the current text and a replaced text is still the version before it.

- `pruneVersions(versions, syncedAt)`: the keys of the versions to delete so that a mosaic keeps its 20 newest versions (`MAX_KEPT_VERSIONS`) and, always, the one at `syncedAt`. A mosaic imported and then saved 21 times keeps 21 versions: the 20 newest saves and the imported one. Each plan prunes the versions it adds to, in the same change.
- `readSyncedText(versions, syncedAt)`: the text of the synced version, or `null` when there is none.
- `buildVersion(address, savedAt, kind, text)`: the version a write puts.

### Sync state

A stored entry is *changed since export* when its text differs from the text it was last imported, updated from a file or exported with: the text of its `syncedAt` version. A mosaic saved in the app and never exported has no such text, so it is changed since export. `isChangedSinceExport(text, syncedText)` says which, and each plan stores the answer in the provenance as it writes:

- an import, an update from a file, "Take the file" and "Keep both" sync the entry with their new version, so it is not changed;
- a save or a restore keeps `syncedAt`, and compares the saved text with the synced text, so saving the synced text again makes the entry unchanged;
- an export, alone or with its folder, syncs the entry with its current version and adds no version, since the text did not change.

### Matching

A picked file matches the stored entry with the same folder name and the same path: `my-mosaics` and `maps/nobel_map.yaml`, or `null` and `nobel_map.yaml` for a single file. A matching file is that entry's update, at the entry's address. A folder imported again keeps the root of its earlier import, so new files of the folder join its root and relative references between them resolve. A single file that matches nothing gets a root of its own.

### The review

`ImportReview`: `{ folder, rows, ignoredCount }`. Files whose name does not end in `.yaml` or `.yml` are never read: `ignoredCount` counts them. Each row (`ImportReviewRow`) has the file's `path`, its `status`, the mosaic's `title`, the `error` that says why it is not a mosaic, its `warnings`, the `address` it is stored at, its `root`, the picked `text`, the `entry` it updates or removes, the entry's `versions` (keys, newest first, which a write prunes), the `keepBothRoot` of a conflict (the root "Keep both" stores the file at, made when the review is planned), and `replacesLocalChanges` (see `planUpdate`).

A file that matches a stored entry is compared with the entry's stored text and with its synced text, the text it was last imported, updated from a file or exported with (`classifyMatchingFile(fileText, storedText, syncedText)`, a pure function of the three texts):

| Status (`ImportStatus`) | Shown as | Meaning | Checked when the review opens | Can be checked |
| --- | --- | --- | --- | --- |
| `new` | New | a mosaic file that matches no entry | yes | yes |
| `changed` | Changed | only the file differs from the synced text | yes | yes |
| `unchanged` | Unchanged | the file has the stored text, also when both sides made the same change | no | no |
| `changed-here` | Changed here only | only the stored text differs from the synced text: the file is what it was, and importing keeps the text edited here | no | no |
| `conflict` | Changed here and in the file | both differ from the synced text, and from each other. It offers its [choices](#conflict-choices) instead of a checkbox | no | no |
| `invalid` | Not a mosaic | the mosaic loader refused it, with its message, or it is larger than 1 MB (`larger than 1 MB`, `MAX_MOSAIC_BYTES`) | no | no |
| `missing` | Not in the folder | an entry of the picked folder whose path the picked files do not have | no | yes |

A mosaic saved in the app and never exported has no synced text, so a matching file that differs from it is a conflict.

#### Conflict choices

`ConflictChoice`, none chosen at first:

- `"keep-mine"` ("Keep mine"): the stored text stays, and nothing changes;
- `"take-file"` ("Take the file"): the file's text replaces the stored text at the same address, as an update. The replaced text stays in the history, as the version before the new one;
- `"keep-both"` ("Keep both"): the stored entry stays, and the file is imported as a new single-file entry, at its own root (`keepBothRoot`), named `<name> (from file).yaml` after the file's name: `maps/nobel_map.yml` gives `nobel_map (from file).yaml`.

**Warnings.** For each relative `mod` or `collection` reference that resolves to a `teselarium-browser:` address the store does not hold and that the picked files do not have, the row warns `"<reference>" is not in this browser, so the mosaic will not open until it is`, naming the reference as written. The file can still be imported.

### Planning functions

- `planImport(picked, folderName, sources)`: the review of picked files (`PickedFile`, with each file's path inside the picked folder, or its file name when `folderName` is `null`).
- `planUpdate(picked, entry, sources)`: the review of one picked file as the update of a stored entry, whatever the file's name: one row, `changed`, `unchanged` or `invalid`. The file is read at the entry's path, so its references resolve as they will once stored. The user picked the file to replace the entry, so a file that differs is `changed`, even when the entry changed here too. When the entry is changed since export, the row's `replacesLocalChanges` is `true`, and the update dialog says that the changes made here are replaced, and kept in the history.
- `ReviewSources`: what a review reads besides the picked files: the current `entries`, `storedFiles` (a `BrowserFileReader`, to compare texts), `storedVersions` (a `StoredVersionReader`, `readVersions(address)`, for the synced texts and the versions to prune), `readMosaic(address, localFiles)`, which loads a picked file through its `file:///` address with the real mosaic loader, so the review gives the loader's messages, and an optional `createRoot`, by default `crypto.randomUUID()`.
- `listDefaultChecked(review)` and `isCheckableRow(row)`: the rows checked when the review opens, by index, and whether the user can check a row.
- `canApplyReview(review, checked, choices)`: whether "Import" can apply the review: a checkable row is checked, or every conflict has a choice.
- `applyReview(review, checked, now, choices?)`: the `BrowserDatabaseChanges` of the checked rows and of the conflict choices (a map from row index to `ConflictChoice`), by index. New and changed files are put with their entries and a version (`"imported"` or `"updated"`). An update keeps the entry's address and `addedAt`, sets `updatedAt` to `now`, syncs the entry with its new version, and prunes the entry's versions. A checked missing entry is deleted with its file and versions. Each conflict follows its choice, and one without a choice changes nothing. Rows that cannot be checked change nothing. `now` is passed in, so tests choose the time.

### Saves and restores

`planSave(request)` plans the save confirmation's write (see the [main module](../../main/README.md#the-user-catalog)) from a `SaveRequest`: the `draft`'s text, its `title`, the stored `entry` it replaces or `null` for a new mosaic, the `copiedFrom` address of a copy, the entry's `versions`, `now`, the version's `kind` (`"saved"`, or `"restored"` for a version restored from the history) and an optional `createRoot`. It answers a `SavePlan`, `{ address, changes }`:

- a stored mosaic's file is replaced at the same address, `updatedAt` is `now`, and `changedSinceExport` compares the draft with the synced text;
- a new mosaic becomes a stored entry of its own root, as a single file named after its title by `buildSaveFileName(title)`: lower case, accents dropped, each run of other characters an underscore, then `.yaml`, so "Laureates, my way" gives `laureates_my_way.yaml`, and `mosaic.yaml` when no letter or digit is left. Its provenance has no folder, that path, `addedAt` `now`, `changedSinceExport` `true` and `copiedFrom`, and its `syncedAt` is `null`;
- in both cases, one version of the draft's kind, and the history pruned.

### Exports

- `planExportSync(entry, currentVersion)`: the changes after one stored entry was exported: it is synced with its current version, the `savedAt` of its newest version, so it is unchanged since export. No version is added.
- `buildFolderArchive(archived, folder)`: the export of a folder, from the stored entries with their text and current version (`ArchivedEntry`, `{ entry, text, currentVersion }`). It answers a `FolderArchive`, `{ bytes, changes }`: the `.zip` bytes, built with `fflate`'s `zipSync`, holding each stored entry of `folder` at its provenance path with its stored text, so unzipping it over the folder replaces the files in place; and the changes that sync each of those entries. Entries of other folders are left out.

Example:

```ts
import { createMemoryBrowserDatabase } from "./lib/core/storage/index.ts";
import { applyReview, listDefaultChecked, planImport } from "./lib/user_catalog/index.ts";

const database = createMemoryBrowserDatabase<UserCatalogEntry>();
const review = await planImport(pickedFiles, "my-mosaics", {
  entries: await database.readEntries(),
  storedFiles: database,
  storedVersions: database,
  readMosaic: readPickedMosaic,
});
// review.rows[0] is { path: "maps/nobel_map.yaml", status: "new", … }
await database.apply(applyReview(review, listDefaultChecked(review), new Date()));
```
