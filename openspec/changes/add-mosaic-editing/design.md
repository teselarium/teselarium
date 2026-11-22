# Design

## Context

See proposal.md, "Why". This change starts from the code as `rename-catalog-vocabulary` and `add-user-catalog` left it. What it builds on:

- **Loading.** `loadMosaicFile` fetches a file, then `buildLoadedMosaic(parseYaml(file))` reads it (`src/lib/mosaic/mosaic_loader.ts`). The YAML parser is `js-yaml`, under the plain-data rules of `parseYaml`, and keeps no comments.
- **Checks.** `checkMosaicAliases` and `checkMosaicConfig` (`src/lib/core/engine/mosaic_findings.ts`) give the mosaic warnings of `mosaics.check`. `countMatchingTiles` (`src/lib/core/combinations/tile_counts.ts`) counts the tiles that validate as a tile type, as the stage bar's scores do. `applyMosaicAliases` renames fields.
- **User catalog** (from `add-user-catalog`):
  - the `BrowserDatabase` (IndexedDB `opentesela`, version 1, stores `files` and `user-catalog`);
  - the pure planning functions of `src/lib/user_catalog/`;
  - the dialogs of `src/main/user_catalog/`, rendered by `UserCatalogDialog`, which `StageView` shows next to `ActionDialog`;
  - the `userCatalog.*` handlers, which turn requests into app actions;
  - the start order: `main.tsx` opens the database in parallel with the start. The stage's `browserFiles` reader waits for the opening, but the catalog lists no user mosaic until the entries are read, and then running mods get `catalog.changed`. A database that cannot be opened gives an empty, read-only user catalog (`openBrowserDatabase` resolves to `null`).
- **Consent.** Site decisions are remembered per mosaic address and line (`site-consent`), read by the stage before each start, and listed in Settings.
- **Mods.** A default mod can bundle npm packages (`default_mods/README.md`), and has a storage slot per context through `storage.*`. `mods.open` with `replace: true` replaces the requester.

## Goals / Non-Goals

**Goals:**

- One implementation of the mosaic file format's rules, in the app. The viewer edits text and fields and asks the app what they mean. It never parses or writes mosaic YAML itself.
- Comment-keeping edits, so a user's own file stays recognizable after it goes through the form and is exported.
- Every write still goes through an app dialog: the save confirmation, the history dialog, the folder export. The viewer holds only a draft.

**Non-Goals:**

- Replacing `js-yaml` in the loader. What a mosaic file may hold stays exactly what it is today.
- Validating while typing in a code editor with inline marks (plain textarea, by decision).
- A form for `config`.
- Merging the two sides of a conflict line by line. The choices are whole texts.

## Decisions

### 1. The app edits the YAML; the viewer sends fields

- `mosaics.edit { content, edits }` applies the form's edits in the app, in `src/lib/mosaic/mosaic_document.ts`, with the `yaml` package's document API (`parseDocument`, `setIn`, `deleteIn`, `toString`). That keeps comments, key order and the style of untouched values.
- The viewer keeps the draft's text as the source of truth, sends each form change as `edits`, and replaces its text with the answer.
- After each edit, `mosaic_document.ts` checks the result with the loader's own `parseYaml` and `buildLoadedMosaic`. An edit can never produce text the loader would refuse for a reason the edit introduced.
- Alternatives:
  - bundle `yaml` into the viewer. Rejected: two places would know the mosaic format, and a replacement viewer would have to reimplement it;
  - switch the loader to `yaml`. Rejected for this change: it changes what the loader accepts (dates, tags, duplicate keys) and needs its own review. The two packages only overlap here, where `yaml` writes and `js-yaml` still decides what is valid.

### 2. Validation reuses the check's parts, on text in memory

- `validateMosaicDraft(content, address, options)` in the engine:
  1. builds a `FetchedFile` `{ source: address ?? DRAFT_ADDRESS, content }` and reads it with `parseYaml` and `buildLoadedMosaic`, mapping a `js-yaml` mark to its line;
  2. for a new draft, refuses relative `mod` and `collection`;
  3. loads the mod file and its tile type (`loadModFile`, the validator), and the collection (`loadTileCollection`), through the stage's `fetchOptions`;
  4. returns `checkMosaicAliases`, `checkMosaicConfig`, the type's fields, the collection's field names, and `countMatchingTiles` after `applyMosaicAliases`;
  5. returns the draft's fields as written (`readDraftFields` of `mosaic_document.ts`): title, description, mod, collection, config, aliases and `show` lines, or `null` when the text cannot be read. The viewer fills its form from them, so it never reads YAML itself, also after an edit in the YAML tab.
- **Load caching.** Loads of the same mod and collection are cached per session for 30 seconds, so a burst of validations after typing pauses fetches each file once. "Reload tiles" semantics don't apply here. The viewer waits half a second after typing, and ignores an answer older than its latest request.
- **Permission.** `open` is checked for the mod's and the collection's origins before any load, as `mods.inspect` and `collections.inspect` do. Browser addresses need no `open` grant beyond what `"*"` gives, as for `mosaics.inspect`.
- Alternative: run `mosaics.check` on the draft. Rejected: it mounts the mod in hidden frames, takes seconds, and reports what a mount sees rather than hints for aliases.

### 3. Versions: database version 2 with a `versions` store

- `onupgradeneeded` from 1 to 2 adds the store `versions`, keyed by `[address, savedAt]`, with an index on `address`. Its value is `{ address, savedAt, kind, text }`, where `kind` is `"imported"`, `"updated"`, `"saved"` or `"restored"`.
- The migration writes one `"imported"` version for each existing stored entry, from its current text.
- Every write that changes a stored file, whether an import update, an update from a file, a save, a restore or a conflict choice, adds a version in the same transaction as the file. That is how "Take the file" keeps the replaced text.
- **Pruning** keeps the 20 newest versions and the synced version (decision 4), in the same transaction.
- `BrowserDatabase` gains `readVersions(address)`. `apply(changes)` accepts versions to put and to delete, so it stays one operation, and the memory database implements the same.

### 4. Sync state: the synced text's version

- Each stored entry gains `syncedAt`: the `savedAt` of the version it was last imported, updated from a file or exported with. A new mosaic saved in the app has `null`.
- `changedSinceExport` is computed: the entry's current text differs from that version's text, or `syncedAt` is `null`.
- `planImport`'s statuses (`user-catalog`, "Status of a matching file") compare the file, the stored text and the synced text. They are pure functions of these three texts, tested at the unit level.
- Exporting one entry or a folder sets `syncedAt` to the entry's current version. There is no new version, since the text didn't change.
- Alternative: store a hash of the synced text. Rejected: the version history already keeps the text, and a hash couldn't show the user what they'd lose.

### 5. Saving and consent at save, in one app dialog

- `userCatalog.save` becomes the app action `catalogSave { content, address, copiedFrom }`.
- `SaveMosaicDialog`:
  - validates the draft with the same `validateMosaicDraft`;
  - diffs the loaded draft with the loaded saved version (title, description, mod, collection, aliases by field, config by key, `show` lines by host and reason);
  - shows the result, with added hosts as warning badges.
- **On "Save"**, in this order:
  1. one database transaction writes the file, the entry (new or updated) and the version;
  2. the site decisions store records Allow, remembered, for each `show` line of the saved text under the entry's address;
  3. the user catalog store refreshes the stage's catalog.

  If step 2 fails, the mosaic is saved and its lines are asked when it opens, which is the safe direction.
- **Why the decisions are written by the app, not trusted from the mod**: the mod sends only text. The lines that get allowed are the ones the user saw in the app's dialog. A mod can't save, or allow, lines the user didn't confirm.
- **New mosaics** get a root with `crypto.randomUUID()` and a file name from the title: lower case, `[a-z0-9_]`, `mosaic.yaml` as a fallback. Provenance has `folder: null`.

### 6. The history dialog restores through the save dialog

`HistoryDialog` lists `readVersions(address)`, newest first. "Restore" opens `SaveMosaicDialog` with that version's text, with kind `"restored"`. The same diff and consent rules apply, so a restore that brings back a `show` line is confirmed like any save.

### 7. Folder export as `.zip` with `fflate`

- `userCatalog.exportFolder` builds the archive with `fflate`'s `zipSync`, which has no dependencies and is about 8 kB gzipped for what is used, and hands a `SaveFileAction` to the existing save dialog.
- Paths are the provenance paths, so unzipping over the folder replaces the files in place.
- The 20 MB limit of `files.save` applies.
- Alternative: write a minimal stored (uncompressed) zip writer. Rejected: CRC and header details are easy to get subtly wrong, and the dependency is small and well known.

### 8. Viewer edit mode, inside the default mod

- **Structure.** `mosaic_viewer` gets `src/edit_page.ts` (tabs, form, textarea, hints, actions), `src/draft_store.ts` (the kept draft in `storage.*`, keyed `draft:<target>` or `draft:new:<mod>|<collection>`), and `src/draft_edits.ts` (form changes to `edits`).
- **Look.** It keeps the default mods' rules: semantic HTML that gets the app's look, layout-only CSS, and one primary action, "Save".
- **Sources of a draft:**
  - an existing stored mosaic: its text, read from the new `content` field of `mosaics.inspect`'s answer;
  - a copy: the remote text read the same way, then `mosaics.edit` with the resolved `mod` and `collection`;
  - a new mosaic: the skeleton `mosaic:\n  title: "Untitled mosaic"\n`, then `mosaics.edit` with `draft_mod`, `draft_collection`, the `show` lines of `draft_sites`, read with `mosaics.inspect`, and the title `<mod> + <collection>`, or `<mod>` without a collection, from the titles that `mods.inspect` and `collections.inspect` answer. It is the stage bar's name for the combination, without a prefix such as "Untitled mosaic:", which would make the file name long and push the distinct part out of the lists' cut titles. When either inspection fails, the skeleton's title stays.
- `mosaics.inspect` gains `content`, the mosaic file's text, for every mosaic. It is an addition to its answer. The file is already fetched to inspect it, so it costs nothing more.
- **Stored or not.** The viewer knows its target is stored from its `opentesela-browser:` address and a `mosaics.inspect` that succeeds, since the reader of browser files waits for the database. It never decides from a `catalog.list` read at start, which can be empty until the database is open. "Edit" versus "Edit a copy", `mode=edit`, and dropping a kept draft all follow this rule. The provenance section's buttons follow `catalog.changed`, as they already do.
- **Keys.** Ctrl+S or Cmd+S is handled in the frame, so it only acts while the viewer has focus, which is when the user is editing.

### 9. The stage bar's edit row

- `mosaic_list.ts` builds the pinned edit row from the sandbox's link and the catalog entry's `place`, and the row opens its link with the stage's open path, as a viewer link does.
- It reuses the pinned-row rules: always kept by filters, hidden while searching.
- No new component: it is a `CombinationRow` with an action instead of an entry, and a pencil icon from lucide.

## Risks / Trade-offs

- [Two YAML libraries in the app: `js-yaml` decides validity and `yaml` writes edits. They could disagree on a corner case, such as a date-like string or an anchor.] → Every edited text goes back through `parseYaml` and `buildLoadedMosaic` before it is answered (decision 1). The unit tests cover comments, quoted and unquoted strings, flow and block lists, anchors left untouched, and date-like values.
- [Validation loads whole collections, which can be large.] → Debounced by the viewer, cached for 30 seconds per session in the engine, and limited to the files a launch would load anyway. The count is a hint: a timeout or failure shows "count unavailable" and blocks nothing.
- [Consent at save remembers Allow for lines the user may not have read closely.] → The dialog lists each added host as a warning badge, and the decisions appear in Settings under the mosaic, where they can be removed. Imported lines are never allowed this way.
- [The draft in the viewer's storage slot outlives the mosaic, for example after "Remove".] → When it opens, the viewer drops a draft whose stored target no longer inspects (decision 8, "Stored or not"). An early catalog that lacks the target is not a reason, so a run link opened at start keeps its draft.
- [The upgrade to version 2 runs in a tab while another tab still has version 1 open.] → The version 1 build has no `versionchange` handler, so the new tab's opening is blocked until the older tab is closed or reloaded, and until then its stored mosaics don't open. On `blocked`, the user catalog store says that another tab of the app must be closed or reloaded. From version 2 on, a connection closes on `versionchange`, and the store asks for a reload of its tab, so later upgrades aren't blocked.

## Migration Plan

- Database version 1 to 2: add `versions`, write one `"imported"` version per stored entry, and set each entry's `syncedAt` to it. A failed upgrade aborts and leaves the data at version 1. `openBrowserDatabase` then resolves to `null`, as for any opening that fails, so the app starts with the empty, read-only user catalog of `add-user-catalog`, and the next load tries the upgrade again.
- No rollback path is needed for users: the app is not shared yet. A downgrade to the previous build would fail to open a version 2 database. That build's existing `null` path (empty, read-only user catalog) applies, and the data stays in place.

## Open Questions

- Whether the 30-second validation cache should also serve the stage bar's measures of the same collection. That can be decided while implementing, without changing the specs.
