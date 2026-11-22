# Proposal

## Why

Users can only open what the instance catalog lists, or follow a link. They cannot keep mosaics of their own: mosaics from their own folder, or a mosaic they found on another site. The later changes, mosaic editing and the collection and mod importers, also need somewhere for the user's content to live.

This change adds the user catalog and the browser files store under it, for mosaics. It builds on `rename-catalog-vocabulary`, which names the catalog's parts.

The direction it follows:
- the same experience on every browser;
- the browser keeps the user's content, and files come in by import and go out by export, with no live link to a file;
- the app owns every trusted step (pickers, the review, writes, removals), and the mosaic explorer and viewer reach them through engine requests, as `files.save` does.

## What Changes

**Browser files**
- A store in the browser's IndexedDB for the text of files the user imports, at addresses of the new scheme `opentesela-browser:`, such as `opentesela-browser:///7f3a…/nobel_map.yaml`.
- The app reads these addresses like any other file, so a mosaic stored in the browser opens, inspects and checks as a remote one does. A relative reference inside it resolves inside the store.
- Only mosaic files are stored. A relative mod or collection reference that leads to a file the store doesn't hold is reported at import, and fails when the mosaic opens.
- The app asks the browser to keep the store (persistent storage), so the browser doesn't clear it when space runs low.

**User catalog**
- The user's own entries, kept in the browser, which join the catalog's mosaics after the instance catalog's mosaics and the default mosaics.
- An entry is either:
  - a mosaic **stored in this browser**, imported from a file or a folder;
  - a **remote** mosaic, added by its URL and not stored.
- Each entry remembers where it came from: the folder name and the path inside it, or the file name, or the URL, and when it was imported, updated or added.

**Catalog marks** (mod API additions)
- Every catalog entry tells who listed it, `listedBy`: `"instance"`, `"default"` or `"user"`.
- Every entry tells where its file lives, `place`: `"remote"` or `"browser"`.
- User entries carry their `provenance`.

**Import, update, add, export, remove** (mod API additions)
Each new engine request opens an app dialog, only for the visible mod, and resolves with `true` once the user confirms or `false` when they cancel:
- `userCatalog.import`: a dialog to choose files or a folder, or drop them. Then a review:
  - each mosaic file found is new, unchanged or changed;
  - a file already imported from the same folder and path is an update;
  - files that are not valid mosaics are listed with their error and not imported;
  - when a folder is picked again, its entries that are no longer in it are listed, and removed only if the user checks them.
- `userCatalog.update { mosaic }`: picks one file to replace one stored entry, with the same review.
- `userCatalog.add`: a dialog to add a mosaic by URL. The app reads the mosaic file first and refuses one it cannot read or that the catalog already lists.
- `userCatalog.export { mosaic }`: downloads a stored mosaic's YAML under its original file name.
- `userCatalog.remove { mosaic }`: a confirmation, then the entry and its stored file are gone. Recently used forgets it too.
- After each change, every running mod gets `catalog.changed`, as when the default mosaics switch changes.

**Mosaic explorer and viewer**
- **Explorer**: each card shows a badge, "Browser" or "Remote", and "Added by you" for user entries, under its title. The explorer gets "Import…" and "Add by URL…" buttons.
- **Viewer**: for a user entry, a "Where it comes from" section with its provenance, and "Update from file…", "Export" and "Remove" for a stored entry ("Remove" only for a remote one). A backup hint says that a stored mosaic is kept only in this browser.

**Settings**
- The existing Catalog group also shows the user's mosaics: how many were added and how many are stored in this browser, whether the browser keeps them persistently, and "Remove all" with a confirmation.

**Trust**: a stored or added mosaic is not from the app's origin, so its `show` lines go through the site consent dialog, as for any other site. Consent at save, for lines the user writes, comes with editing.

**Mod API version**: a patch bump, `0.1.17` to `0.1.18`. The new methods (`userCatalog.import`, `userCatalog.update`, `userCatalog.add`, `userCatalog.export`, `userCatalog.remove`), the new catalog entry keys (`listedBy`, `place`, `provenance`) and the test API's new answers are additions that existing mods keep working with. `catalog.changed` keeps its form, and is also pushed when the user catalog changes.

**Phones and color schemes**
- The import, review, add and remove dialogs are app dialogs, built like the action dialog. On a 360×740 viewport they fit the width, their lists scroll inside them, and their buttons are easy to tap.
- The explorer's badges and the viewer's new section follow the default mods' layout on a phone, as the existing cards and the viewer's tables do.
- New colors are badge variants of the theme, checked in the light and the dark color scheme.

## Capabilities

### New Capabilities

- `browser-files`: the store of imported file text in the browser, its `opentesela-browser:` addresses, how the app reads them, persistent storage.
- `user-catalog`: the user's entries and their provenance, how they join the catalog, and the import, update, add, export and remove flows with their dialogs.

### Modified Capabilities

- `catalog`: the catalog's mosaics also hold the user catalog's, after the default mosaics.
- `mod-engine-api`: the `userCatalog.*` requests; "Read the catalog" gives `listedBy`, `place` and `provenance`; "Catalog changed event" also fires when the user catalog changes.
- `mod-app-actions`: "Only the visible mod asks" covers the `userCatalog.*` requests.
- `mod-tests`: `answer` accepts the `userCatalog.*` requests with a boolean, and the scripted catalog accepts and completes the new entry keys.
- `mod-api-version`: the version is `0.1.18`.
- `default-mods`: the mosaic explorer's badges, "Added by you", "Import…" and "Add by URL…"; the mosaic viewer's provenance section and its actions; their cases.
- `app-settings`: the Catalog group shows the user's mosaics and "Remove all".
- `recently-used`: a removed user entry is no longer recently used.

## Impact

- **Code**:
  - `src/lib/files/` gets a reader for `opentesela-browser:` addresses next to the one for `file:`.
  - `src/lib/core/storage/` gets the IndexedDB database of browser files and user catalog entries.
  - A new `src/lib/user_catalog/` module holds the entries, the import review and the provenance.
  - The engine gets the `userCatalog.*` handlers, new app actions, the catalog entry marks and the API version.
  - The stage passes the browser files reader in its fetch options and builds the catalog with the user catalog.
  - `src/main/` gets the import, review, add and remove dialogs and the Settings group.
  - The test runner gets the new answers.
- **Default mods**: `mosaic_explorer`, `mosaic_viewer`, `default_mods/mod_api.d.ts` and their tests and fixtures.
- **Dependencies**: none new. IndexedDB is used directly, behind a small interface with an in-memory version for unit tests.
- **Docs**: the files, engine, stage, main, settings and sandbox READMEs, the mosaics module and its explorer and viewer READMEs, and `docs/mod_plugin_spec.md`.
- **Release**: a patch changeset, since the mod API bump is a patch and nothing breaks for users or instantiations.
- **Out of scope**:
  - mosaic editing, version history, the stage bar's Edit button, and consent at save (change 3);
  - exporting a folder as a `.zip` (change 3);
  - importing collections, or mods by URL (later changes);
  - storing anything but mosaic files;
  - drag and drop outside the import dialog, since mod frames receive the drops over them;
  - sharing a link to a stored mosaic, which works only in the browser that stores it;
  - updating other open tabs of the app, which see the change after a reload.
