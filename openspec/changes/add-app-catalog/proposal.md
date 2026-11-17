# Proposal

## Why

The app has no list of its own of the mods, collections and mosaics it offers. Each explorer keeps a list in its config (`mods`, `collections`, `mosaics`), so the lists are written in three places, and no other part of the app can read them. The next change, `rework-stage-bar`, needs those lists for the stage bar's mod, collection and mosaic dropdowns. Giving the app one catalog first removes the duplication and gives every part of the app the same source.

## What Changes

- An **app catalog**: the mods, collections and mosaics the instantiation offers, three ordered lists of references, set in `src/main/` next to the default mod settings. The vanilla catalog lists the sample mods, the sample collections and the sample mosaics that the explorers list today.
- The catalog is checked when the app starts. An entry that is empty, cannot be resolved, or resolves to the same file as an earlier entry of its list stops the app with an error that names the entry, as an invalid section registry does. A switched-off default mod is left out of the catalog's mods.
- A new engine request **`catalog.list`** answers the catalog with resolved addresses. It needs no permission. While "List the default mosaics of mods" is on, the mosaics list also holds the default mosaic of each listed mod, after the catalog's own mosaics and marked with its mod.
- A new engine event **`catalog.changed`**, pushed to every running mod with the new catalog when that switch changes, so an explorer that is already open lists the change without a reload.
- A **"Catalog" group** on the Settings page, with the switch "List the default mosaics of mods", off by default and remembered in the app's storage. It is meant for mod authors, to try a mod's own mosaic next to the others.
- The mod explorer, the collection explorer and the mosaic explorer **list the catalog** instead of their config. **BREAKING** for whoever edited those configs: the `mods`, `collections` and `mosaics` config keys are removed and ignored. The mosaic explorer marks a default mosaic with "Default mosaic of <mod title>".
- The test API's `answer` also accepts **`catalog.list`**, so the explorers' cases list their own fixtures and never depend on the shipped catalog.
- Mod API version **0.1.14 → 0.1.15**.

Mod API version bump: **patch** (`0.1.14` → `0.1.15`). The change adds a method (`catalog.list`), an event (`catalog.changed`) and a method that `answer` accepts in the test API. Both are additions that no existing mod can break on, which the "Mod API version" section of the engine's README counts as a patch. Removing the explorers' config keys does not touch the mod API: it changes the config of three default mods, not the engine, the mount context or the mod file format. The app gets a patch bump too.

## Capabilities

### New Capabilities
- `app-catalog`: the app's catalog of mods, collections and mosaics. Covers what the instantiation sets, how entries are resolved and checked at start, the vanilla catalog, switched-off default mods, and how default mosaics join the mosaics list.

### Modified Capabilities
- `mod-engine-api`: adds the `catalog.list` request and the `catalog.changed` event.
- `mod-tests`: `answer` accepts `catalog.list` with a catalog, and an unanswered `catalog.list` gets the app's catalog.
- `mod-api-version`: the mod API version becomes `0.1.15`.
- `app-settings`: adds the Catalog group with the "List the default mosaics of mods" switch, and how the switch is remembered.
- `default-mods`: the three explorers list the catalog instead of their config, the mosaic explorer marks default mosaics, the vanilla config requirements become the vanilla catalog's, and the explorers' cases script `catalog.list` with fixtures.

## Impact

- **Engine** (`src/lib/core/engine/`): new `catalog_methods.ts` (`CATALOG_METHODS`) added to `ENGINE_METHODS`, and a `catalog.changed` push like `theme.changed`. The resolved catalog and a reader for the switch are added to `ModMethodContext`, `ModSessionOptions` and the stage's sandbox and check services. `MOD_API_VERSION` and the surface guard get a `0.1.15` entry.
- **Stage** (`src/lib/core/stage/`): `StageOptions` takes the catalog and the switch's start value, and the stage gets a setter, as for "Load media linked by tiles", that pushes `catalog.changed` to the running sessions.
- **Sandbox test runner** (`src/lib/core/sandbox/`): `catalog.list` becomes an answerable method, its value is checked, and the case engine answers with it.
- **App** (`src/main/`): new `app_catalog.ts` (vanilla catalog) and its start checks, wired in `src/main.tsx`. The start error screen also reports catalog errors. New setting module for the switch, and the Settings page's Catalog group.
- **Default mods**: `mod_explorer`, `collection_explorer` and `mosaic_explorer` read `catalog.list` and follow `catalog.changed`, drop their config lists, and update their cases. `default_mods/mod_api.d.ts` types `catalog.list` and `catalog.changed`.
- **Docs**: engine README (methods table, version notes), mod guide (scripted answers), main README (catalog), explorer docs, Settings docs, default mods README.
- **Tests**: unit tests for the catalog checks, the handler and the setting. Explorer cases. e2e for the vanilla lists, the switch and its marking, and the start error.
- No new dependency.
