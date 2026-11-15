# Proposal

## Why

With mosaics in place (`add-mosaics`), the mod file still carries concerns that belong elsewhere, and the formats name things inconsistently:

- **`name` means two things.** A mod's `name` is an identifier that nothing in the app reads: the source is the mod's identity. A collection's `name` is the text shown as its title.
- **The sample collection belongs to a mosaic.** `sample_collection` pairs a mod with data, which is what a mosaic is. `country_map`'s points outside its own folder.
- **Some `show` permissions belong to the data.** `book_list` and `country_map` declare `show` for Open Library, archive.org and Wikimedia only because their sample books' covers load from there.
- **Storage follows a mod everywhere.** A slot is keyed by the mod's source, so a mod's state follows it into every collection and mosaic. For example, `flashcards` applies the study fields chosen for one deck to any other deck.

These are breaking changes to the mod API. Every mod and collection that exists today is in this repository and is updated here, so they are grouped into one change.

## What Changes

- **BREAKING:** `name` is dropped from the mod file and collection file formats, and `title` is required in both.
  - A mod file's `name` becomes an ignored key, so a mod file with both keeps loading.
  - A collection file's `name` is replaced by `title`.
  - `context.mod.name` and `mods.inspect`'s `name` are removed.
  - The collection index, loaded collections and `collections.inspect` answer `title` in place of `name`.
- **BREAKING:** `sample_collection` is replaced by `default_mosaic`, the path of the mod's default mosaic file, resolved against the mod file. `mods.inspect` answers `defaultMosaic` in place of `sampleCollection`. A `sample_collection` key becomes ignored.
- **`mods.check` with no collection checks the mod's default mosaic.** It uses the mosaic's collection, merged config, aliases and `show` grants, then runs the mod's tests. A mod without a default mosaic is checked with no tiles, as today. A default mosaic that names another mod is a `bundle` error.
- **New `mosaics.check { mosaic }`.** It runs the bundle and mount checks the way the mosaic opens its mod, without the mod's tests. Two findings are specific to mosaics:
  - an alias for a field the tile type does not declare;
  - a config key the mod's config does not have.

  Check reports gain `mosaic`, the checked mosaic file's address or `null`.
- **BREAKING:** a storage slot is keyed by the mod's source and its context. The context is the mosaic when the mod was opened from one, otherwise the collection, otherwise the tile, otherwise none. Values stored under the old per-mod keys are no longer read, and there is no migration.
- **Default mods:**
  - the mod viewer drops the "Name" row, shows the default mosaic, and replaces "Run with sample tiles" with "Open default mosaic", which sends `mosaics.open`;
  - the collection explorer, the collection viewer and the tile viewer show a collection's `title`;
  - the tile viewer's sample collection becomes its default mosaic.
- **Samples:**
  - `book_list`, `country_map` and `flashcards` each get a `mosaic.yaml` default mosaic with their former sample collection;
  - the `show` permissions of `book_list` and `country_map` move into their default mosaics;
  - the sample collections use `title`;
  - every sample declares `api: "^0.1.14"`, the first mod API version with `default_mosaic`.
- **Every other mod and collection file in the repository** (fixtures, e2e test mods and the files tests build) follows the new formats.
- **Docs** that show mod files, collection files, `mods.inspect`, the mount context, storage or checks are updated.

Out of scope:
- The mosaic explorer, the mosaic viewer and its "Check mosaic" button, the two showcase mosaics and the Mosaics section (`add-mosaic-explorer`).
- A mod-wide storage scope.
- Reworking the 10 Open Library cover links.

## Mod API version bump

**Patch, `0.1.13` → `0.1.14`, taken as a patch as `0.1.12` was.** This change removes:
- the mod file key `name` and its required status;
- the mod file key `sample_collection`;
- the mount context key `mod.name`;
- `mods.inspect`'s `name` and `sampleCollection`.

It renames `collections.inspect`'s `name` to `title`, and it changes what a storage slot holds. Under the "Mod API version" rule of `docs/modules/lib/core/engine/README.md`, each of these would call for a minor bump.

The precedent is `0.1.12`, which made `tile` a reserved link name. It could break a mod, but no shipped, test or known mod was affected, so it was taken as a patch. The same holds here, more strongly:
- the project has not been shared with users;
- every mod and collection that exists is in this repository and is moved to the new formats in this change.

A minor bump would only make every `^0.1.x` range stop matching, which would mean editing every shipped range and every test that uses `^0.2.0` as "another API", with no reader to protect. The minor rule stays for when mods exist outside the repository.

The additions are `default_mosaic`, `defaultMosaic`, `mosaics.check` and the report's `mosaic`. Mods that rely on them declare `^0.1.14`.

Following the bump rule, the app takes a **patch** bump: the change breaks no user or instantiation, since there are none yet.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `mod-loading`: `title` required, `name` no longer read, `default_mosaic` in place of `sample_collection`, and the loaded mod's fields.
- `collection-loading`: `title` in place of `name` in the collection file, the loaded collection and the index.
- `mod-engine-api`: the mount context's `mod` without `name`; `mods.inspect` with `defaultMosaic`; `collections.inspect` with `title`; storage slots per mod and context.
- `mod-check`: default mosaic checks; `mosaics.check` and its findings; the report's `mosaic`.
- `mod-api-version`: version `0.1.14`.
- `default-mods`: the mod viewer's metadata, run choices and cases; collection titles in the explorer, the viewer and the tile viewer; the default mods folder text.
- `sample-book-list`, `sample-country-map`, `sample-flashcards`: their mod files, default mosaics and API ranges.

## Impact

- **Libraries:** `src/lib/mod/` (format, loader, types), `src/lib/tile/` (collection format and index), `src/lib/core/storage/` (slot keys).
- **Engine:** `mod_inspection.ts`, `mod_launch.ts`, `mod_bundle_check.ts`, `mod_check_report.ts`, `mosaics_methods.ts` (`mosaics.check`), `storage_methods.ts`, `mod_api_version.ts` and the surface guard's `0.1.14` entry.
- **Stage:** `stage_checks.ts`, for checks with a mosaic.
- **Default mods:** `default_mods/*/mod_conf.yaml`, fixtures and the `src/` of the mod viewer, the collection explorer, the collection viewer and the tile viewer. `default_mods/mod_api.d.ts` and its type test.
- **Samples:** `public/samples/mods/*/` (mod files, new `mosaic.yaml` files) and `public/samples/tiles/*/collection.yaml`.
- **Tests:** the fixtures in `src/test/fixtures/` and `e2e/test_mods/`, and the mod and collection files tests build inline. Test API ranges (`TEST_MOD_API_RANGE`) are unchanged.
- **Docs:**
  - `docs/opentesela_spec.md` and `docs/mod_plugin_spec.md`;
  - the READMEs of the mod, tile, storage, engine and mosaic libraries;
  - the docs of the mod viewer, mod explorer, collection explorer and tile viewer;
  - `default_mods/README.md`.
- **Depends on `add-mosaics`,** which must be archived first: its specs are the base of the `mod-engine-api` mount context, `mod-api-version` and `mosaic-loading` text this change builds on.
- **Stored values start over once:** values mods stored before this change are no longer read. Today that is `book_list`'s `columns` and `flashcards`' `study_fields`, in the browsers of the people working on the project.
