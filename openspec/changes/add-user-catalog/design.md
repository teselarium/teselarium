# Design

## Context

See proposal.md, "Why". This change starts from the code as `rename-catalog-vocabulary` left it. Today:

- **Files.** `fetchFile(location, options)` (`src/lib/files/file_fetcher.ts`) reads `file:` addresses from an injected `localFiles` map and fetches the rest. Picked files already get virtual `file:///` addresses (`indexLocalFiles`), so relative paths resolve inside a picked folder.
- **Fetch options.** The stage builds one `fetchOptions` in `createStage` (`stage_controller.ts`). Every launch, inspection, check and the stage bar's measures use it.
- **Catalog.** `buildCatalog(instanceCatalog, includesDefaultMosaics, fetchOptions)` builds the merged `Catalog` that `catalog.list` answers. `readStageCatalog` builds it anew for each request. `changeStageCatalogDefaultMosaics` pushes `catalog.changed`.
- **Trust.** `collectContentHosts` keeps only `http:` and `https:` origins. `isFromAppOrigin` compares `new URL(source).origin`, which is `"null"` for a custom scheme, so a stored mosaic is never granted as the app's origin.
- **App actions.** A request that needs the user is checked into an `AppAction` (`app_actions.ts`). The stage queues it, and `ActionDialog.tsx` shows it in a native `<dialog>` opened with `showModal()`. The visible-mod rule and "one dialog at a time" already live there.
- **Settings stores.** `src/main/settings/` keeps small stores in `localStorage` through `stored_json.ts`, read with `src/main/use_store_snapshot.ts`.
- **Tests.** Vitest runs in Node or jsdom, which have no IndexedDB. Playwright runs Chromium for most tests, and Chromium, Firefox and WebKit for the tests tagged `@frames`.

## Goals / Non-Goals

**Goals:**

- A stored mosaic goes through the same loader, inspection, check and launch as a remote one. The only difference is where the text is read from.
- Domain logic (addresses, matching, the review, provenance, the catalog marks) is pure and tested at the unit level. IndexedDB stays behind one small interface.
- The store is generic enough for the collection importer: it stores files by address, not mosaics.

**Non-Goals:**

- A second copy of the mosaic loader for picked files: the review reads them through `file:///` addresses with `localFiles`, as today.
- Syncing other tabs (see Risks).
- Remembering site decisions or mod storage slots of a removed mosaic differently: they stay, as they do for a mosaic that disappears from a site.

## Decisions

### 1. Addresses: `opentesela-browser:///<root>/<path>`

- The scheme follows the prefix convention for shared namespaces, and names where the file lives. It is a non-special URL scheme, so `new URL("../tiles/x/", "opentesela-browser:///r1/maps/a.yaml")` resolves to `opentesela-browser:///r1/tiles/x/`, as relative references need.
- `<root>` is a random id (`crypto.randomUUID()`), made once per imported folder or single file. A later import of the same folder name reuses its root, so updated files keep their addresses, and with them the mod's storage slot and the site decisions.
- Helpers in the files module: `BROWSER_FILE_PROTOCOL`, `isBrowserFileAddress(source)` and `buildBrowserFileAddress(root, path)`, which encodes each path segment as `indexLocalFiles` does.
- Alternative: one address per entry, such as `opentesela-browser:///<id>.yaml`. Rejected, because relative references between files of a folder would not resolve, which the collection importer will need.

### 2. Reading: an injected reader, like `localFiles`

- `FileFetchOptions` gets `browserFiles?: BrowserFileReader`, whose `readText(address)` resolves with the text or `null`.
- `fetchFile` reads `opentesela-browser:` addresses through it, and never through `fetch`. `null`, or no reader, raises `FileFetchError` with the reason `it is not stored in this browser`.
- The stage adds the reader to its single `fetchOptions`, so launches, `*.inspect`, checks and the stage bar all read stored files with no other change.
- The files module stays storage-agnostic. It knows the scheme, not IndexedDB.

### 3. One IndexedDB database, behind one interface

- **Database `opentesela`, version 1**, with two object stores:
  - `files`: the address as key, `{ address, text }` as value;
  - `user-catalog`: the entry's address as key, the `UserCatalogEntry` as value.
- An import, update or removal writes both stores in one transaction, so an entry never points to a missing file.
- `BrowserDatabase` interface:
  - `readText(address)`;
  - `readEntries()`;
  - `apply(changes)`, where changes are files to put, entries to put, and addresses to delete, in one transaction;
  - `clear()`.
- Two implementations: `openBrowserDatabase()` with IndexedDB, and `createMemoryBrowserDatabase()` for unit tests, as `createMemoryStorage()` is for mod storage.
- `openBrowserDatabase()` resolves to `null` when IndexedDB is missing or refuses to open. The app then starts with an empty, read-only user catalog, and the import dialog shows the error of `browser-files`.
- Placed in `src/lib/core/storage/`, next to mod storage: the module that holds the app's storage.
- Alternatives:
  - entries in `localStorage` with the other stores. Rejected: two storages can disagree after a failure, and the collection importer needs IndexedDB anyway;
  - a wrapper library such as `idb`. Rejected: the interface needs three operations, and the project adds a dependency only when needed.

### 4. The user catalog module: pure domain logic

A new `src/lib/user_catalog/`, which knows mosaics, entries and provenance, but not dialogs or IndexedDB:

- `UserCatalogEntry`: `{ address, place, provenance, root }`, where `place` is `"browser"` or `"remote"`, and provenance is as `mod-engine-api` says.
- `planImport(picked, folderName, entries, readMosaic)` builds the review: one row per picked `.yaml` or `.yml` file, `{ path, status, error, warnings, address }`, and the "Not in the folder" rows. `readMosaic` loads a picked file through its `file:///` address, so the review uses the real mosaic loader and its messages.
  - Matching: a row matches an entry with the same root folder name and path.
  - Status: "Changed" or "Unchanged" compares the text.
  - Warnings: a relative `mod` or `collection` whose resolved address is a browser address that is neither stored nor picked.
- `planUpdate(picked, entry, readMosaic)`: the same review for one file and one entry.
- `applyReview(review, checked, now)` returns the `BrowserDatabase` changes. `now` is passed in, so tests choose the time.
- `buildUserMosaicEntries(entries)` gives the catalog's user mosaics.

The planning steps are functions that return new values, so their tests need no storage.

### 5. Catalog marks are computed when the catalog is built

- `buildCatalog` takes the user catalog's entries too, and sets on each entry:
  - `listedBy`: `"instance"`, `"default"` or `"user"`;
  - `place`, from `isBrowserFileAddress(source)`;
  - `provenance`, for user entries.
- The dedupe that already keeps a default mosaic once also keeps a user mosaic at an earlier place (`catalog`, "The user catalog joins the catalog's mosaics").
- `Catalog`'s entry types and `default_mods/mod_api.d.ts` gain the keys. `mod_api_types.test.ts` keeps both sides equal.
- The scripted catalog of the test runner completes missing keys as `mod-tests` says, so existing cases keep working unchanged.

### 6. Requests become app actions, and the app applies them

- **New `AppAction` kinds**:
  - `catalogImport`;
  - `catalogUpdate { address }`;
  - `catalogAdd { suggested }`;
  - `catalogRemove { address, title, place }`.
- **Export** builds the existing `SaveFileAction` from the stored text, so it reuses the save dialog and its download path.
- **Engine handlers** live in `user_catalog_methods.ts`. They check params (`-32602`), check that an address is a stored or user entry, and go through the same visible-mod check as the other actions (`-32002`).
- **The dialogs** live in `src/main/user_catalog/`: `ImportDialog`, `UpdateDialog`, `AddMosaicDialog` and `RemoveMosaicDialog`. `ActionDialog` renders them inside its `<dialog>`, which keeps exception 1 of "UI components": the native top-layer element guards the app from mods. Inside it they use shadcn parts: `Button`, `Badge`, `Checkbox`, `Input`, and a scrolling list.
- **Picking**:
  - "Choose files…" is a hidden `<input type="file" multiple accept=".yaml,.yml">`;
  - "Choose folder…" is a hidden `<input type="file" webkitdirectory>`;
  - the drop zone reads `DataTransferItem.webkitGetAsEntry()` to walk dropped folders.

  All three work in Chromium, Firefox and Safari. The folder name is the first segment of `webkitRelativePath`, or the dropped folder's name.
- **The user catalog store**, `src/main/user_catalog/user_catalog_store.ts`, holds the entries in memory after reading them at start, applies changes through `BrowserDatabase`, and then:
  - calls `refreshStageCatalog(stage)`, the generalized form of today's push in `changeStageCatalogDefaultMosaics`, which pushes `catalog.changed`;
  - tells recently used to forget removed addresses;
  - asks for persistent storage after the first stored file.
- Alternative: let the mosaic explorer apply changes through a write API. Rejected in the exploration. Any mod could then write mosaics whose `show` lines widen its own reach. The app's dialog is where the user decides.

### 7. Start order

`main.tsx` opens the database and reads the entries before creating the stage, as it reads the other stores, and passes `userCatalog` (the entries) and `browserFiles` (the reader) in `StageOptions`. Opening takes a few milliseconds, and the start screen already waits on async work. A failure gives an empty catalog part, never a start error, since the user's data must not stop the app.

### 8. Export names and types

`userCatalog.export` names the file after the last segment of the provenance path, so `maps/nobel_map.yaml` downloads as `nobel_map.yaml`, typed `application/yaml`. The save dialog's checks of `files.save` (name, 20 MB) apply as they are.

### 9. Tests across engines

- The IndexedDB implementation, folder picking and dropping a folder depend on the browser engine. Their e2e tests get a new tag, `@storage`. `buildProjectFilters` runs it in Firefox and WebKit too, as `@frames`.
- Everything else runs in Chromium, as usual.
- Unit tests use `createMemoryBrowserDatabase()`.
- The default mods' cases use scripted answers and scripted catalogs, as `mod-tests` says. A fixture mosaic marked `place: "browser"` with a `provenance` stands for a stored one, so a case never needs a store.

## Risks / Trade-offs

- [Safari, and any browser short of space, may clear the site's storage, and with it the only copy of an imported mosaic.] → The app asks for persistent storage. Settings and the viewer say that stored mosaics are kept only in this browser and can be exported. They were imported from the user's own files, so a copy usually exists, and editing (change 3) will add "changed since export" hints.
- [Two open tabs of the app: an import in one isn't seen in the other until reload, and an import there could overwrite with an older picture of the entries.] → Every write reads the current entries inside its transaction, and only puts or deletes the addresses it changes. Live sync between tabs, for example with a `BroadcastChannel`, is left for later.
- [A folder picked again under the same name but from another place is treated as the same folder.] → The review shows every match as "Changed" or "Not in the folder" before anything is applied, and removals are unchecked by default.
- [Large folders: `webkitdirectory` hands over every file, and media folders can hold thousands.] → Only `.yaml` and `.yml` files are read. The others are counted and never read, and a mosaic file above 1 MB is "Not a mosaic: larger than 1 MB".
- [A run link with a stored mosaic, copied with "Copy link", opens nothing in another browser.] → Accepted for now. The mosaic viewer and Settings say where stored mosaics live. Sharing stays the job of export, and of the inline-link idea for later.
## Migration Plan

Nothing to migrate: the user catalog starts empty. Database version 1 creates the two object stores. A later change that needs another store raises the version in `onupgradeneeded`.
