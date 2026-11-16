# Design

## Context

See proposal.md (Why). This change builds on `add-mosaics`, archived on 2026-11-16. It reuses that change's:

- mosaic loader (`src/lib/mosaic/`), `mergeMosaicConfig` and `applyMosaicAliases`;
- launch steps in `mod_launch.ts`: `loadLaunchMosaic`, `expandMosaicRequest` (the mosaic's mod and collection as an ordinary request), `loadLaunchMod` and `loadLaunchTiles`, which `loadModLaunchInputs` chains;
- mosaic grants: `grantMosaicPermissions`, applied by `grantLaunchMosaic`, and kept apart from the mod's grants until `buildModLaunch` joins them through its `mosaicGrants` parameter, so each refused line is reported with what declared it;
- `mosaics.*` in `mosaics_methods.ts`.

What it touches today:

- **Mod files:** `src/lib/mod/mod_format.ts` reads `name` (required), `title` (defaults to `name`) and `sample_collection`. `MOD_FILE_KEYS` feeds the surface guard.
- **Collection files:** `src/lib/tile/collection_format.ts` reads `collection.name`. Loaded collections and indexes carry `name`.
- **Storage:** `src/lib/core/storage/mod_storage.ts` keys values as `"opentesela.mod-storage:" + JSON.stringify([modSource, key])`. The storage handlers know only the mod's source.
- **Checks:** `checkModBundle` in `src/lib/core/engine/mod_bundle_check.ts` takes `collectionLocation ?? modFile.sampleCollection`. `runStageCheck` (`src/lib/core/stage/stage_checks.ts`) builds the mount check's launch with `buildModLaunch` and `grantModPermissions` alone, with no mosaic grants. `onCheckMod` receives a `ModCheckRequest`, `{ source, collection }`.
- **Readers of the old fields:**
  - `.name`: four default mods, `mod_inspection.ts`, `mod_launch.ts` and the e2e probes (`mod_routes.ts`, `layout_probes.ts`, `theme_probes.ts`);
  - `sampleCollection`: the mod viewer, the bundle check and many fixtures.

## Goals / Non-Goals

**Goals:**

- One mod API break, with every shipped, fixture and test file moved in the same change, so `npm run test:e2e:samples` proves the samples on `0.1.14`.
- A check of a mod with its default mosaic and a check of any mosaic share one code path.
- Storage contexts are derived by the engine from the launch link, and mods never choose them.

**Non-Goals:**

- No reader for the former keys. `name` and `sample_collection` are simply ignored, as unknown keys already are, and a collection file with only `name` fails.
- No cleanup of values stored under the former storage keys. They stay in `localStorage`, unread.
- No change to the mosaic file format.

## Decisions

### D1. `title` replaces `name`; former keys are ignored, not migrated

- **Mod files:** `title` is required and `name` joins the ignored keys. A mod file that has both (every mod file the docs ever showed) keeps loading. A mod file with only `name` fails with "`title` must be a non-empty string".
- **Collection files:** `title` replaces `name` with the same rule.
- **`MOD_FILE_KEYS`** drops `name` and `sample_collection` and gains `default_mosaic`.

*Alternative:* read `name` as `title` with a deprecation warning. That needs a warning channel the mod loader does not have, the user chose to keep only `title`, and there is no mod outside the repository to protect.

### D2. `default_mosaic` is an explicit path in the mod file

`default_mosaic` is resolved against the mod file, as `type_path` and `test_path` are, and is never fetched by `loadModFile` or `mods.inspect`. Each mod that has a sample collection today gets a `mosaic.yaml` next to its `mod_conf.yaml`, whose `mod` is `"./"`, which resolves back to the mod file:

| Mod | Default mosaic's collection | `show` hosts moved from the mod |
|---|---|---|
| `public/samples/mods/book_list/` | `./book_collection.yaml` | Wikimedia, Open Library, archive.org, `*.archive.org` |
| `public/samples/mods/country_map/` | `../../tiles/literature_nobel_laureates_books/collection.yaml` | the same four |
| `public/samples/mods/flashcards/` | `./flashcard_collection.yaml` | none |
| `default_mods/tile_viewer/` | `./fixtures/tiles_collection.yaml` | none |
| `e2e/test_mods/tiles/` and the `src/test/fixtures/` mods | their current sample collection | none |

*Alternative:* a conventional `mosaic.yaml` found without a key. That costs a request that may answer 404 for every mod, and it hides the link between the files.

### D3. One check pipeline, started from a mod or from a mosaic

`checkModBundle` takes a check target instead of `(mod, collectionLocation)`, and `ModCheckRequest` carries the same target:

```
{ mod, collection }   collection given      -> as today, the mod's own config and grants
{ mod }               no collection         -> the mod's defaultMosaic, if any, as below
{ mosaic }            mosaics.check         -> load the mosaic, then as below
```

With a mosaic:

1. Load the mosaic file. A failure is a `bundle` error, and the report's `source` is `null` while the mod is still unknown.
2. Resolve the mosaic's mod with `expandMosaicRequest`, so a default mod name resolves as it does when the mosaic is opened. For a default mosaic, compare it with the mod's source. A mismatch is a `bundle` error.
3. Load the mod and refuse a switched-off one as a `bundle` error.
4. Run the existing steps with `mosaic.collection`: entrypoint, libraries, tile type, collection, with the aliases applied before validation.
5. Add the mosaic findings (D4).

The mount check receives the merged config, the aliased tiles and the grants including the mosaic's lines. `runStageCheck` gets the mosaic's grants from `grantLaunchMosaic` and passes them to `buildModLaunch` as `mosaicGrants`, beside `grantModPermissions` for the mod, so a check mounts exactly what opening the mosaic would. A foreign mosaic's lines count as granted only with a remembered allow, as in `mosaics.inspect`. A refused mosaic line is reported as the mosaic's, as when the mosaic is opened (`add-mosaics` D9).

Tests run only for `mods.check`. They belong to the mod and use its fixtures.

`mosaics.check` lives in `mosaics_methods.ts`. Its param and permission checks mirror `mosaics.inspect`, and it goes through the same `onCheckMod` stage hook, with the target as data.

*Alternative:* `mods.check { mosaic }`, the shape named during exploration. It would mix two target shapes in one validator, which is what `add-mosaics` avoided by adding `mosaics.open` instead of `mods.open { mosaic }`.

### D4. Mosaic findings are static and cheap

Both findings are `bundle` warnings whose source is the mosaic file:

- **Alias fields:** each field of `aliases` must be among the top-level `properties` and `optionalProperties` of the tile type's `ref` definition. A mod without a tile type gets no alias finding, since every field is accepted.
- **Config keys:** walk the mosaic's config. A key missing from the mod's config at the same path is reported as `config.<path>`. The walk descends only where both values are mappings. A list, or a scalar replaced by a mapping, is a replacement, not an unknown key.

*Rejected:* a finding for declared `show` hosts that nothing loaded during the mount check. The mount check ends 1 second after `mount`, so covers that load lazily, or only when a card opens, would be reported as unused. That would be noise the author learns to ignore.

### D5. Storage keys gain a context the engine derives

The key becomes `"opentesela.mod-storage:" + JSON.stringify([modSource, context, key])`. The context is:

- the mosaic's source when the launch had a mosaic;
- otherwise the collection's source;
- otherwise the tile's source;
- otherwise `""`.

`readModValue` and `writeModValue` take a `ModSlot` (`{ mod, context }`) instead of `modSource`. The session builds the slot once from its launch inputs and gives it to `STORAGE_METHODS`. "Reload tiles" does not change it. The check's throwaway storage is unchanged.

The old two-element keys can never equal a three-element key, so old values are unreachable without any deletion, as the spec asks.

*Alternatives:*
- Keep the mod-wide slot and add contexts later. But the per-deck `study_fields` bug exists today.
- Let mods pick a scope. That is an API surface with no user yet, deferred as a mod-wide scope.

### D6. Readers move to `title`

- **Collection explorer, collection viewer, tile viewer:** read `inspection.title`.
- **Mod viewer:**
  - drops the "Name" row and shows "Default mosaic" with the address, where it showed the sample collection;
  - "Run with sample tiles" becomes "Open default mosaic", still the primary button, sending `mosaics.open { mosaic: inspection.defaultMosaic }`;
  - its fixture `listed_mod` gets a `default_mosaic`.
- **`default_mods/mod_api.d.ts`:**
  - `ModInspection` loses `name` and `sampleCollection` and gains `defaultMosaic`;
  - `CollectionInspection` gets `title`;
  - the context's `mod` loses `name`;
  - the check report gains `mosaic`;
  - `mosaics.check` is typed.

### D7. Mod API `0.1.14`, a patch by the `0.1.12` precedent

- `MOD_API_VERSION` becomes `0.1.14`. The surface guard gets a `0.1.14` entry:
  - without the `mod.name` context key and the `name` and `sample_collection` file keys;
  - with `default_mosaic` and `mosaics.check`.
- The engine README's version note for `0.1.14` says what breaks, and why it was taken as a patch: no mod or collection outside the repository exists, and all of them move in this change.
- The sample mods declare `^0.1.14`, the first version with `default_mosaic`, as `book_list`'s `^0.1.5` names the first version with `<ot-tile-body>`. The default mods keep `^0.1.0`, as `mod-api-version` requires, since they ship with the app.
- `TEST_MOD_API_RANGE` and the "another API" examples (`^0.2.0`) stay as they are.

*Alternative:* a minor bump to `0.2.0`, as the API rule reads. Every `^0.1.x` range would stop matching. That means editing every shipped and test range and moving every "another API" example (about ten spec scenarios and their fixtures) off `^0.2.0`, with no mod outside the repository to protect.

## Risks / Trade-offs

- **[A collection file with only `name` stops loading]** → Every collection that exists is in this repository and moves in this change. The error names `title` and the file, and the changeset says so.
- **[Stored mod state starts over once]** → Today that is `book_list`'s books per row and `flashcards`' study fields, in the browsers of the people working on the project.
- **[Taking breaking changes as patches becomes a habit]** → The version note records the reason, which holds only while no mod or collection exists outside the repository. Once the project is shared, the minor rule of the engine README applies.
- **[A bare run link of `book_list` or `country_map` no longer loads the redirecting Open Library covers]** → They load when the mod is opened from its default mosaic, which is what "Open default mosaic" and the explorers lead to. The other covers still load as media linked by tiles. The `sample-country-map` spec records this.
- **[`add-mosaics` and this change modify the same requirements (mount context, mod API version)]** → This change's text is written on top of `add-mosaics`'s. `add-mosaics` was archived on 2026-11-16, and this change validates against the updated main specs.
- **[Wide mechanical edits across fixtures and inline test files]** → Tasks move them module by module, with that module's tests, so each group stays green.

## Migration Plan

1. Apply on top of the archived `add-mosaics` (2026-11-16).
2. Ship with an app patch bump. The changeset says that mods and collections need `title`, that `sample_collection` becomes `default_mosaic`, and that mods' stored values start over.
3. **Rollback:** revert the change.
   - Values stored in the new slots become unreachable to the older app, and values in the old keys come back.
   - Mod files written without `name` fail on the older app, since `name` was required there.
