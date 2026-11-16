# Proposal

## Why

A run link (`#/run?mod=…&collection=…`) pairs a mod with a collection, but only in the address bar. It cannot change the mod's config. It cannot adapt a collection whose field names differ from the mod's tile type. It cannot let the data's author declare the media hosts the data needs. Mosaics are the third object of OpenTesela, next to tiles and mods, and so far they exist only as a stale section of `docs/opentesela_spec.md`.

This change makes mosaics real: shareable files that the engine reads and opens. They are the base for the default mosaics of mods (`rework-mod-file-format`), and for the mosaic explorer, the mosaic viewer and the sample mosaics (`add-mosaic-explorer`).

The case that drives it is the Nobel laureates on the country map. The laureate tiles have `name` and `birth_country`. `country_map` requires `title` and `country`. Today none of the 17 laureates reach the map.

## What Changes

- **Mosaic file format.** A YAML file with a `mosaic` mapping:
  - `title` (required) and `description`;
  - `mod`: a mod reference;
  - `collection`: an optional collection reference;
  - `config`: overrides the mod's config;
  - `aliases`: maps the tile type's field names to the names a collection uses;
  - `permissions`, holding only `show`: the hosts the data's media need.

  Paths in the file resolve against the file's own location. A folder reference means the `mosaic.yaml` in it.
- **Opening a mosaic.**
  - The run link `#/run?mosaic=<reference>&<params>` opens the mosaic's mod with its collection.
  - `context.config` is the mod's config deep-merged with the mosaic's. The tiles are renamed by the aliases before the tile type validates them.
  - A link to a mosaic cannot also have `mod`, `collection` or `tile`, and `mosaic` becomes a reserved link name.
- **New engine methods.**
  - `mosaics.inspect { mosaic }` reads a mosaic file without opening it.
  - `mosaics.open { mosaic, params?, replace? }` opens it in a new sandbox, or in place of the requester.
  - Both need the `open` permission for the mosaic file's origin.
- **New mount context key.** `mosaic`: `{ source, title, description }`, or `null` for a mod not opened from a mosaic.
- **Mosaic permissions.** A mosaic can declare `show` permissions, never `connect`, `embed`, `code` or `open`.
  - A mosaic from the app's origin is granted them.
  - For a mosaic from another origin, the site consent dialog asks. The mosaic's lines appear apart from the mod's, decisions are remembered per mosaic file, and Settings lists them.
  - The grants last only for that sandbox.
  - The mosaic file's origin becomes a content host.
- **Stage bar.** For a mosaic, the stage bar shows the mosaic's title before the mod's, and the information popover shows the mosaic file's address.
- **Collection references.** A collection reference that names a folder, without `.yaml` or `.yml`, means the `collection.yaml` in it. This applies everywhere a collection is named: run links, `mods.open`, `mods.check`, `collections.inspect` and mosaics. Mods, collections and mosaics then follow one reference rule: a file, a folder holding the file by convention (`mod_conf.yaml`, `collection.yaml`, `mosaic.yaml`), or, for mods only, a default mod name.
- **Mod API version.** `0.1.12` becomes `0.1.13`.
- **Docs.** The mosaic sections of `docs/opentesela_spec.md` and `docs/mod_plugin_spec.md` are rewritten to the new format, and the `# TODO` stubs of `docs/modules/lib/mosaic/` and `docs/modules/mosaics/` get their content.

Out of scope:
- The mosaic explorer, the mosaic viewer, the sample mosaics and the Mosaics section (`add-mosaic-explorer`).
- Default mosaics and the `name` → `title` rename (`rework-mod-file-format`).
- Storage slots per mosaic (`rework-mod-file-format`).
- `mods.check { mosaic }` (`rework-mod-file-format`).

## Mod API version bump

**Patch, `0.1.12` → `0.1.13`.** Every part is an addition:
- two methods, `mosaics.inspect` and `mosaics.open`;
- a mount context key, `mosaic`;
- a run link field, `mosaic`;
- a collection reference form, the folder.

A mod not opened from a mosaic gets the same context, config, tiles and grants as before.

Reserving `mosaic` as a link name could break a mod that reads a `mosaic` parameter or passes one in `mods.open`'s `params`. That is the same case as `tile` in `0.1.12`. No shipped, test or known mod does either, and a minor bump would make every `^0.1.x` mod ask the user before it starts, so it is taken as a patch.

A collection location that ends in neither `.yaml` nor `.yml` is now read as a folder. No shipped, sample, fixture or known collection is named that way.

Following the bump rule, the app takes at least a patch bump.

## Capabilities

### New Capabilities
- `mosaic-loading`: the mosaic file format, mosaic references, how a mosaic file is fetched, parsed and checked, and the loaded mosaic as plain data.

### Modified Capabilities
- `mod-stage`: `#/run?mosaic=…` opens a mosaic; a run link with a non-empty `mosaic` is not Home; mosaic links conflict with `mod`, `collection` and `tile`; mosaic load failures; reloading a mosaic's tiles.
- `mod-engine-api`: the mount context's `mosaic` and merged `config`; aliases applied before validation; `mosaics.inspect` and `mosaics.open`; their permission and visibility rules; `mosaic` reserved in `mods.open` params; references in `mosaics.*`.
- `mod-sandbox`: the mosaic file's origin as a content host; a mosaic's `show` grants; blocked-request reports that point to the mosaic file.
- `site-consent`: asking about a foreign mosaic's `show` lines, shown apart from the mod's, and remembered per mosaic file; `mosaics.inspect` never asks.
- `app-settings`: remembered mosaic decisions listed and changed in the Mod permissions group.
- `stage-bar`: the mosaic's title in the bar, its loading and failure labels, and its address in the information popover.
- `collection-loading`: a collection reference that names a folder means its `collection.yaml`.
- `mod-api-version`: the version is `0.1.13`.

## Impact

- **New code:** `src/lib/mosaic/`, a mosaic file loader beside `src/lib/mod/`.
- **Engine:**
  - `src/lib/core/engine/`: a new `mosaics_methods.ts`, mosaic launch inputs in `mod_launch.ts`, the reserved name in `mods_methods.ts`, `mod_api_version.ts`, and the surface guard's `0.1.13` entry.
  - `default_mods/mod_api.d.ts` and its type test.
- **Stage:** `src/lib/core/stage/run_links.ts`, `stage_routes.ts` and `stage_sandboxes.ts`.
- **Sandbox and permissions:** content hosts and reports in `src/lib/core/sandbox/`, and grants in `src/lib/core/permissions/`.
- **App:**
  - `src/main/stage/`: `SiteConsentDialog`, `StageBar` and `ModInfoPopover`;
  - `src/main/settings/`: `site_decisions.ts` and `SiteDecisionList`.
- **Collection references:** `src/lib/tile/`.
- **Tests and docs:**
  - unit tests beside each module, and e2e tests for run links, consent, Settings and the stage bar;
  - the docs listed above, plus the engine, stage, sandbox, tile and settings READMEs.
- **No new dependencies.** Existing mods, collections and run links keep working unchanged.
