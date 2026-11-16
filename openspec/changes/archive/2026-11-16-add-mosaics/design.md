# Design

## Context

See proposal.md (Why). The current launch path:

```
run link {mod, collection|tile, params}
  -> loadModLaunchInputs (src/lib/core/engine/mod_launch.ts)
       mod file + entrypoint (src/lib/mod)  ->  collection or tile (src/lib/tile)
  -> grants (src/lib/core/permissions/mod_grants.ts)
       same origin: all declared; other origin: site decisions or consent dialog
  -> content policy (src/lib/core/sandbox/sandbox_policy.ts)
  -> validated, path-resolved tiles + config -> mount context
```

The constraints that shape this design:

- `context.config` comes only from `mod_conf.yaml`, and `params` are strings. There is no channel for overriding config.
- Validation runs on the loaded tiles "as written". Path resolution changes only the copy given to the mod (`mod-engine-api`, "Only the tiles given to mods are resolved").
- A grant belongs to a mod source. Remembered decisions are `{ mod, title, category, host, allowed }` under `opentesela.site-decisions` (`src/main/settings/site_decisions.ts`).
- The stage owns the history, and run links are data (`RunLink` in `src/lib/core/stage/run_links.ts`). Mods never build addresses.
- `open` is checked per subject (`OpenSubject = "mods" | "collections"`) against the target file's origin.

## Goals / Non-Goals

**Goals:**

- One place in the launch path where a mosaic becomes ordinary launch inputs: a mod, a collection, a merged config, aliased tiles and extra `show` grants. Everything after that point is unchanged.
- `src/lib/mosaic/` is pure data, like `src/lib/mod/`: it reads and checks files and decides nothing about trust.
- Mods not opened from a mosaic see no difference.

**Non-Goals:**

- Mosaics in section targets (`{ mosaic }` targets in the registry). The Mosaics section will run `mosaic_explorer`, a mod link (`add-mosaic-explorer`).
- A mosaic of a single tile. A mosaic has a collection or none.
- Storage slots per mosaic. In this change, a mod opened from a mosaic keeps its mod-wide slot (`rework-mod-file-format`).
- Checking mosaics (`rework-mod-file-format`).

## Decisions

### D1. The engine opens mosaics; a viewer does not translate them

The launch reads the mosaic. A mosaic viewer does not turn it into `mods.open { mod, collection }`. Only the launch can merge config, rename fields before validation and add grants to the content policy, and `#/run?mosaic=…` has to work as a shared link with no viewer in between.

*Alternative:* a mosaic as data that viewers turn into a mod link. That needs no API change, but it drops `config`, `aliases` and `permissions`, so the laureates' map could not work.

### D2. The run link gets a `mosaic` field; a mosaic link has nothing else

`RunLink` gains an optional `mosaic`. A link with a non-empty `mosaic` and a non-empty `mod`, `collection` or `tile` is a conflict: a new error class beside `RunLinkConflictError`, refused before any request, in the same way. The route test becomes "non-empty `mod` or non-empty `mosaic`". `buildRunLink` writes `mosaic` first, then the params, so the address of a mosaic link never shows the mod or collection the file names.

*Alternative:* `#/run?mod=…&mosaic=…`, where the mosaic adds config to an explicit mod. It is redundant with the mosaic's own `mod`, and its conflicts need rules.

### D3. Launch: the mosaic expands into launch inputs

`loadModLaunchInputs` gets a first step. When `link.mosaic` is set, it loads the mosaic file (`loadMosaicFile`), then continues with `{ mod: mosaic.mod, collection: mosaic.collection, tile: null, params: link.params }` as today. The checks for switched-off mods and API ranges therefore run unchanged on the mosaic's mod.

`ModLaunchInputs` gains `mosaic` (the loaded mosaic, or `null`). Building the launch then:

- merges the config (`mergeMosaicConfig`, D6);
- renames the loaded tiles' metadata with `applyMosaicAliases` (D7), and then builds and runs the validator, so validation sees the aliased metadata;
- adds the mosaic file's origin to the content hosts;
- passes the mosaic's `show` lines to the grant step (D9).

The launch runs in steps: `loadLaunchMosaic` (the conflict check of D2, then the mosaic file), `expandMosaicRequest` (the mosaic's mod and collection as an ordinary request), `loadLaunchMod` and `loadLaunchTiles`. `loadModLaunchInputs` chains them, and the stage calls them one by one, so it knows the mosaic when its mod fails, and the mod when its collection fails.

"Reload tiles" repeats the collection load, the aliases and the validation from the stored inputs. It does not read the mosaic file again, because the content policy is fixed at the start.

`src/lib/mosaic/` exports `resolveMosaicReference`, `loadMosaicFile`, `mergeMosaicConfig`, `applyMosaicAliases`, `MosaicFormatError` and the `LoadedMosaic` type. All of them are pure apart from the fetch. It reuses `src/lib/files` for fetching and YAML, `resolveModReference` for `mod`, the new collection reference resolver (D4) for `collection`, and the `show` host checks of `src/lib/mod/mod_permissions.ts`, which become exported.

### D4. One reference rule, with the folder convention in each loader

| Object | File by convention | Default names |
|---|---|---|
| mod | `mod_conf.yaml` | yes (the default mods folder) |
| collection | `collection.yaml` | no |
| mosaic | `mosaic.yaml` | no |

A path ending in `.yaml` or `.yml` is the file. Any other path is a folder: `/` is added and the query and fragment are dropped. That is what `resolveModReference` already did for mods. The rule moves into one function, `resolveFileReference` in `src/lib/files`, which the mod, collection and mosaic resolvers call with their own file name.

`src/lib/tile` gets `resolveCollectionReference`, which `loadTileCollection` and `readCollectionIndex` call first. So run links, `mods.open`, `mods.check`, `collections.inspect` and mosaics all accept folders without changes of their own. References inside a mosaic resolve against the mosaic file. References in requests and links resolve against the app's address, as today.

*Alternative:* keep collections as file locations only. It is simpler, but it leaves two vocabularies, and the user chose the unified rule.

### D5. `mosaics.open` is a method of its own

`mosaics.open { mosaic, params?, replace? }` sits beside `mosaics.inspect`. It hands `{ mosaic, params }` to the same `onOpenLink(link, { replace })` and maps the same outcomes (`"opened"`, `"not-visible"`, `"home-mod"`) to the same refusals, with messages that name `mosaics.open`.

*Alternative:* `mods.open { mosaic }`, the default we discussed during exploration. It would turn `mods.open`'s rule "`mod` is a non-empty string" into "exactly one of `mod` or `mosaic`, and with `mosaic` no `collection` or `tile`", which mixes two link shapes in one validator. The namespaces stay parallel instead: `mods.*` for mods, `collections.*` for collections, `mosaics.*` for mosaics.

### D6. Config merge: deep for mappings, replace for everything else

`mergeMosaicConfig(modConfig, mosaicConfig)` returns a new mapping and changes neither input:

- for each key of the mosaic's config, when both values are mappings, the result is their merge, recursively;
- otherwise the result is the mosaic's value, `null` included;
- keys only the mod has keep their values.

Lists are replaced, not concatenated or merged by index. A mosaic that wants to extend a list writes the whole list.

*Alternatives:* a shallow merge, which would force `map: { zoom: 3 }` to repeat `center`; or JSON Merge Patch, where `null` deletes a key. Deleting keys has no use yet, and `null` as a value is clearer.

### D7. Aliases rename before validation, at the top level only

`applyMosaicAliases(metadata, aliases)` returns new metadata. For each field in `aliases` order that the metadata lacks, the first listed name that is present is renamed to the field. The value is kept, and so is the key's position: the metadata is rebuilt in key order, with the field written where the alias was.

- **Rename, not copy.** Copying would leave both `name` and `title`. `country_map`'s card lists every key except `title` and `image`, so a laureate card would show `name: Bob Dylan` under the heading `Bob Dylan`, and `birth_country` beside `country`. With renaming, a tile still matches any type it matched as written, apart from the renamed names.
- **The format refuses ambiguity** (`mosaic-loading`, "Alias format"). A name listed under two fields, or a name that is also a field, is a format error, so the result never depends on processing order.
- **Top level only.** Nested paths (`author.name`) can come later as an addition.

Aliases change the loaded tiles of that launch, which are then validated and path-resolved as before. The tile loader, `source` and `body` are untouched.

### D8. `open` is checked against the mosaic file's origin only

`OpenSubject` gains `"mosaics"`. `mosaics.inspect` and `mosaics.open` check the requester's `open` grant against the mosaic file's origin before any request. The mod the mosaic names is not checked against the requester's `open`.

Checking it would mean loading the mosaic before answering. Opening a mosaic is the same act as a user following its link, and the mod opened still gets its own API question and site consent. The explorers and viewers hold `open: "*"`, so in practice this only matters to a mod that limits `open` to some hosts. The engine README records this as the rule.

### D9. A mosaic's `show` lines join the sandbox's grants

`grantMosaicPermissions` applies the site-owner rule to the mosaic's `show` lines, beside `grantModPermissions`, which is unchanged. The launch gets the mosaic with its grants (`grantLaunchMosaic`) and joins them: the sandbox's `granted` and `denied` lists hold the mod's lines, then the mosaic's. They stay apart until the launch because a joined list cannot tell which refused line is the mosaic's when the mod and the mosaic declare the same host, and each refused line is reported with what declared it.

- A mosaic file from the app's origin: every mosaic line is granted.
- A mosaic file from another origin: remembered mosaic decisions apply, and lines without one are asked.
- `listConsentLines` returns the lines with a subject, `{ subject: "mod" | "mosaic", … }`, and `SiteConsentDialog` draws one group per subject, each with its title and address. Allow, Show without them, Escape and Remember act on all lines at once.
- **Stored decisions:** a mosaic decision is `{ mosaic, title, category, host, allowed }`, with `mosaic` in place of `mod`. The validator accepts entries with exactly one of the two keys. Existing entries are therefore valid as they are, and an older app drops a mosaic entry as invalid rather than misreading it.
- **Settings:** `SiteDecisionList` groups by subject and address, and labels mosaic groups.
- **Mount context:** `context.permissions` lists the mosaic's lines in the same `{ category, host, reason }` shape. A mod therefore sees one effective permission set, the same one the content policy enforces.
- **Blocked requests:** `describeBlockedRequest` learns whether the sandbox has a mosaic, and for `show`-category blocks names the mosaic file as the second place to declare the host. A refused host that the mosaic declares is reported as the mosaic's: "the mosaic declares it in permissions.show, but the permission was not granted".

*Alternative:* a separate dialog for the mosaic. That is two questions for one link, and the user cannot see both parties side by side.

*Alternative:* `grantModPermissions` taking the mosaic and returning the joined grants, the first plan. The launch could then not attribute a refused line to the mosaic when the mod declares the same host, so a report could name the wrong file.

### D10. The mosaic file's origin is a content host

The mosaic file is a file the engine read to start the mod. Under the existing rule, this lets a mosaic author show media from their own site, as a collection author already can.

### D11. Stage bar and mount context

- `StageBar` shows `mosaic.title` before the mod's name. The mod's name is drawn muted, so the mosaic reads as the subject and the mod as how it is shown.
- The loading labels gain the mosaic step.
- `ModInfoPopover` lists the mosaic's address first.
- The mount context gets `mosaic: { source, title, description } | null`. It never includes `config`, `aliases` or `permissions`: the mod already receives their effect.

### D12. Mod API surface

`MOD_API_VERSION` becomes `0.1.13`. The surface guard gets a `0.1.13` entry with:

- the methods `mosaics.inspect` and `mosaics.open`;
- the mount context key `mosaic`, and the keys of its mapping.

Further changes:

- `default_mods/mod_api.d.ts` declares `MosaicInspection`, `mosaics.inspect`, `mosaics.open` and `context.mosaic`, and the type test (`mod_api_types.test.ts`) checks them.
- The run link's reserved names become `mod`, `collection`, `tile` and `mosaic`, in one constant, `RUN_LINK_RESERVED_NAMES`, that the stage, `mods.open` and `mosaics.open` all read. It is declared beside `RunLink` in the engine (`mod_launch.ts`), because the stage depends on the engine, not the reverse.

## Risks / Trade-offs

- **[A collection location without `.yaml` or `.yml`]** It is now read as a folder. → No shipped, sample, fixture or e2e collection is named that way. The engine README records the rule, and the error of a missing `collection.yaml` names the full address, so the cause is visible.
- **[Renaming surprises a mod that expects the original name]** For example, a mod that shows `name`. → Aliases apply only inside a mosaic, chosen by its author for that mod. The mod viewer and the planned "Check mosaic" will show the result.
- **[Reserving `mosaic` breaks a mod using that parameter]** → Same reasoning as `tile` in `0.1.12`: no known mod does. Recorded in the version notes.
- **[A consent dialog with two parties is harder to read]** → Groups with titles and addresses, and the same buttons. Mosaics from the app's origin never ask, so the samples show no dialog.
- **[`open` does not limit which mods a mosaic can lead to]** → D8. The opened mod still asks for its own trust.
- **[Content policy size]** Mosaic lines are hosts, so a mosaic that declares the host of thousands of tile links makes the policy smaller, not larger.

## Migration Plan

- **No data migration.** Stored site decisions keep their shape, and mosaic decisions use a new key.
- **No mod changes.** Every shipped mod keeps working unchanged under `^0.1.x`.
- **Rollback:** reverting the change. Stored mosaic decisions are then ignored and dropped by the older validator. Mosaic links open Home on an app without mosaics, since they have no `mod`.

## Open Questions

- Whether the Settings group keeps the name "Mod permissions" now that it also lists mosaics, or becomes "Site permissions". This is a label change that can follow with its own spec update, and nothing else depends on it.
