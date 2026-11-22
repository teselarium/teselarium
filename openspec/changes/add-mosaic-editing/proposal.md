# Proposal

## Why

After `add-user-catalog`, users can keep mosaics in the browser, but cannot make one: they can't name an unsaved combination, give it aliases or `show` permissions, or change a mosaic they imported. This is what started the plan: an edit button for the mosaic the user is looking at. A new combination is often broken at first, for example missing aliases, so the user fixes it in the editor and saves it only then.

This change makes the mosaic viewer the place where a mosaic is viewed and edited.

## What Changes

**Edit mode in the mosaic viewer**
- An "Edit" button switches the viewer from viewing to editing the same mosaic. The default mod keeps its name, `mosaic_viewer`.
- One draft, two views:
  - **Form**: title, description, mod, collection, aliases and `show` lines. Config is shown read-only next to the mod's defaults, and is edited in YAML.
  - **YAML**: a plain monospace textarea with the problems listed under it, each with its line when it has one.
- The YAML text is the source of truth. The form changes only the lines it touches, so comments and order are kept. While the YAML doesn't parse, the form is unavailable and says why.
- **Live hints** while editing: errors, the check's warnings (an alias for a field the tile type lacks, an unknown config key), the tile type's fields, the collection's field names, and how many tiles match with the draft's aliases.
- **Draft kept while away**: the draft is kept in the viewer's storage slot until it is saved or discarded, so leaving the page loses nothing.

**Where editing starts**
- In the stage bar, an edit button with a pencil icon, between the mosaic capsule and "More actions", one click away down to a 360px wide phone. On a smaller screen, "More actions" holds it:
  - **"Edit mosaic"** for a stored mosaic;
  - **"Edit a copy"** for a remote, instance or default mosaic;
  - **"Edit as a new mosaic"** for an unsaved combination with a collection or none. Nothing is stored until the user saves. Its draft is titled after the combination (`<mod> + <collection>`), and gets the combination's mod and collection, and the `show` lines of its `sites` mosaic, if any.
- In the mosaic viewer: "Edit" for a stored mosaic, "Edit a copy" for any other.
- A copy's relative `mod` and `collection` references are rewritten as absolute addresses, so the copy opens from the browser.

**Saving, and consent at save**
- Saving goes through an app confirmation. It shows what changes (title, mod, collection, aliases, config, and `show` lines added and removed), with the new hosts highlighted.
- Confirming saves a new version and remembers Allow for the confirmed `show` lines of that mosaic, so opening it asks nothing more for them. Imported or updated lines are still asked when the mosaic opens.
- A new mosaic, from a copy or an unsaved combination, becomes a stored entry of the user catalog, as a single file named after its title, and the viewer opens it.

**Version history**
- Each stored mosaic keeps its last 20 versions: saves, updates from a file, and the imported text.
- A "History…" dialog lists them with their time and kind. Restoring one saves it as a new version, through the same confirmation.

**Files and export, now that a stored mosaic can change**
- Each stored entry knows whether it changed since it was last imported or exported. The mosaic explorer and the viewer say "Changed since export".
- **Conflicts**: the import review gets a "Changed here and in the file" status, for entries changed in the browser while their file changed too. The choices are keep mine, take the file, or keep both, which imports the file as a new entry.
- **Folder export**: "Export folder" downloads a `.zip` with every stored entry of one imported folder at its path, so unzipping it over the folder updates it. It needs a small zip dependency (`fflate`).

**Mod API** (patch bump, `0.1.18` to `0.1.19`)
- New methods:
  - `mosaics.validate`: the problems and hints for a draft;
  - `mosaics.edit`: the form's changes applied to the YAML text, keeping comments;
  - `userCatalog.save`, `userCatalog.history` and `userCatalog.exportFolder`, which open app dialogs.
- `mosaics.inspect` also answers `content`, the mosaic file's text, so the viewer can start a draft from it.
- Provenance gains `changedSinceExport` and `copiedFrom`.
- The test API answers the new dialogs.

All of these are additions that existing mods keep working with.

**Phones and color schemes**
- The stage bar keeps the edit button on a 360px wide phone, where the folded capsule shrinks to at least 80px, and moves it into "More actions" below. The bar's capsules fold a little earlier on a wide bar, as the button takes its place.
- Two fixes in the stage bar, found while testing the button on a phone:
  - the "More actions" items line up: "Theater mode" was indented by its check, which now sits at the item's end;
  - the folded capsule keeps the mosaic capsule's look for an unsaved combination ("Unsaved combination", dashed, the mosaic icon), instead of turning into the mod capsule, and its menu rows say the mod's and the collection's titles.
- The viewer's edit mode follows the viewer's layout on a phone: one column, the form's rows stacking, the textarea at full width, buttons at least 32px.
- The save confirmation and the history dialog are app dialogs that fit a 360×740 viewport.
- The highlighted new hosts and the "Changed since export" mark use theme badge variants, checked in the light and the dark color scheme.

## Capabilities

### New Capabilities

- `mosaic-editing`: drafts, what validating a draft reports, form edits that keep the YAML, the save confirmation and consent at save, copies and mosaics saved from a combination, and version history.

### Modified Capabilities

- `user-catalog`: "Changed since export", the conflict status and its choices in the import review, folder export, copies in provenance, and the colors of the new statuses.
- `mod-engine-api`: `mosaics.validate`, `mosaics.edit`, `userCatalog.save`, `userCatalog.history` and `userCatalog.exportFolder`; `mosaics.inspect` answers `content`; provenance with `changedSinceExport` and `copiedFrom`.
- `mod-app-actions`: "Only the visible mod asks" covers the new dialog requests.
- `mod-tests`: `answer` accepts the new dialog requests, and the scripted catalog accepts the new provenance keys.
- `mod-api-version`: the version is `0.1.19`.
- `default-mods`: the mosaic viewer's edit mode, its entry points, "Changed since export" in the explorer and the viewer, folder export, and their cases.
- `stage-bar`: the edit button between the mosaic capsule and "More actions", and in "More actions" under 288px; aligned "More actions" items; the folded capsule keeps the mosaic's look; the fold widths that move with the button.
- `site-consent`: lines confirmed at save are remembered as allowed for that mosaic.

## Impact

- **Code**:
  - `src/lib/mosaic/` gets comment-keeping edits of a mosaic file (`mosaic_document.ts`) and the draft validation.
  - `src/lib/user_catalog/` gets versions, the sync state, conflicts and folder export.
  - `src/lib/core/storage/` raises the database to version 2, with a `versions` store.
  - The engine gets the new handlers, app actions and the API version.
  - `src/main/` gets the save confirmation and history dialogs, and the stage bar's edit button.
- **Default mods**: `mosaic_viewer` (edit mode, form, YAML, hints, draft), `mosaic_explorer` (the mark), `default_mods/mod_api.d.ts`, and their tests and fixtures.
- **Dependencies**:
  - `yaml`, for comment-keeping edits in the app. Loading keeps `js-yaml`, so what a mosaic file may hold doesn't change.
  - `fflate`, for the `.zip`.
- **Docs**: the mosaic, user catalog, storage, engine, stage and main READMEs, the mosaics module and its viewer and explorer READMEs, and `docs/mod_plugin_spec.md`.
- **Release**: a patch changeset, since the mod API bump is a patch and nothing breaks for users or instantiations.
- **Out of scope**:
  - collapsing the sidebar before the stage bar's capsules fold, so a narrowing window doesn't fold them and then unfold them at the 768px breakpoint (`fit-narrow-stage-bar`);
  - a code editor library;
  - a form for `config`;
  - editing collections or mods;
  - the stage inspector beside a running mosaic;
  - sharing a stored mosaic by link;
  - syncing other open tabs.
