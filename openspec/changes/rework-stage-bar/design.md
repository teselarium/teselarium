# Design

## Context

See proposal.md for why. The current state this builds on:

- `src/main/stage/StageBar.tsx` renders the bar from a `SandboxSnapshot`. It keeps one `OpenPanel` (a message level, `"mod-info"` or `"share"`) per sandbox, closes it on a frame focus (`listenForFrameFocus`) and on a sandbox change, and wraps shadcn `Popover`. `ShareMenu.tsx` copies the link, and `ModInfoPopover.tsx` shows sources.
- `SandboxSnapshot` (`stage_controller.ts`) has `mod`, `mosaic` (`title`, `source`), `mosaicReference`, `modReference` and `collection`. It has no tile, no link params, no collection title and no aliases. Its only mosaic grants are in `siteConsent.mosaic` (the opening mosaic or the `sites` one), and only while the site consent question is open.
- The stage already opens a link "in place" for `mods.open` with `replace` (`openStageLink(…, { replace })`): the new sandbox takes the requester's opener, section and history entry. Back and forward reopen closed sandboxes from their links.
- `add-mosaic-sites-link` gives run links `sites`: a mosaic whose `show` lines are granted to another mod, held as `LaunchMosaicGrants` with `role: "sites"`.
- The lib already has what a tile-match count needs: `loadModFile`, `buildTileValidator`, `loadTileCollection` (6 parallel tile loads), `validateTileCollection`, `readTileCollectionIndex` and `loadMosaicFile`.
- `add-app-catalog` gives the engine `buildCatalogListing` and the stage the resolved catalog and the default-mosaics flag.
- Tailwind is v4, so container queries (`@container`, `@min-[…]:`) are built in. The shadcn `command` component and its `cmdk` dependency are not vendored yet.

## Goals / Non-Goals

**Goals:**
- Keep the rules about what a choice opens in pure, unit-tested lib functions. The React layer only renders and calls them.
- Measure tile-match counts once per pair and only for lists the user opens.
- Keep the bar's right side and the message machinery untouched.

**Non-Goals:**
- Creating or saving a mosaic from an unsaved combination: the dashed capsule is only the place for it later.
- Counting with aliases. Counts are raw tile-type matches, because a plain pair has no aliases.
- Collections declaring their own `show` hosts. That's a later change.
- A compatibility matrix view.

## Decisions

### The snapshot carries the link and what the capsules show

`SandboxSnapshot` gains:
- `link`: the run link as resolved, with `mod`, `collection`, `tile`, `mosaic`, `sites` and `params`;
- `collectionTitle` (`string | null`) and `tile` (resolved address or `null`);
- in `mosaic`: `aliases` and its `show` lines;
- `sites`: `{ source, title, lines: { host, reason, granted }[] } | null`, null until the sites mosaic is loaded or when it failed.

The bar and the lists derive everything from it, so a choice never needs to look into the runtime.

*Alternative:* letting the UI re-read the mosaic file would make two loads of one file, which can disagree after an edit.

### Choice links are pure functions

`src/lib/core/stage/combination_links.ts` holds `buildModChoice(link, modSource)`, `buildCollectionChoice(link, choice)` (a collection source or `"none"`) and `buildMosaicChoice(mosaicSource)`. They encode the rules of `combination-pickers`:
- keep the collection or tile;
- turn a mosaic link into `mod + collection + sites`;
- keep or drop `params` and `sites`;
- return `null` for the current entry.

"Stop using these sites" is `buildSitesDrop(link)`. Each rule gets one unit test.

### `openStageCombination` = replace semantics plus a new entry

A new stage function `openStageCombination(stage, sandboxId, link)` opens like `replace` (the opener and section are inherited, then the previous sandbox is closed), but pushes a new history entry instead of reusing the current one, dropping forward entries as `openStageLink` does. For the home mod at `#/` it delegates to `openStageLink` without `replace`. The shared steps are extracted from the replace path, so the two stay one implementation with a flag for the history step.

*Alternatives:*
- Keeping the previous sandbox hidden makes Back instant, but every try keeps a running frame, so ten tries mean ten frames.
- Using plain `replace` loses Back, which users expect when "trying combinations".

### `sites` comes from `add-mosaic-sites-link`

This change only builds links with `sites` (`buildModChoice`, `buildSitesDrop`) and reads the `sites` mosaic's title and lines from the snapshot. Parsing, granting, consent and the failure warning are that change's. The snapshot's `sites` field is filled from its `LaunchMosaicGrants` with `role: "sites"`.

### A core module measures combinations, cached per page

`src/lib/core/combinations/` exports `createCombinationCatalog({ fetchOptions, readCatalog })`, a mutable store with `subscribe` and snapshot reads, the same pattern as the other stores used through `use_store_snapshot.ts`. It keeps promise caches keyed by resolved source:
- mod summaries: title, version and type source, from `loadModFile`;
- collection summaries: from `readTileCollectionIndex`;
- mosaic summaries: title, mod, collection and aliases, from `loadMosaicFile`;
- loaded collections and tiles: from `loadTileCollection`, once per collection;
- validators: from `buildTileValidator`, once per type source;
- counts: per mod and collection or tile, `{ matching, total } | "any" | error`.

`readCatalog` comes from a new stage export, `readStageCatalog(stage)`: today's private `readStageCatalog` in `stage_controller.ts`, which gives the listing `catalog.list` answers, with the current default-mosaics switch. Exporting it keeps the page and the mods reading one catalog.

`requestCounts(modSources, target)` starts only the measures a list shows. Tile loads use the loader's existing parallel limit. `dropCollection(source)` is called when the stage reloads the tiles of that collection or tile. It holds no UI state.

*Alternative:* counting through the engine (`mods.check`) would run frames and the bundle check, which is far too heavy for a list.

### Recently used is an app store fed by the stage

`src/main/settings/recently_used.ts` mirrors `site_decisions.ts`:
- the key is `opentesela.recently-used`, holding `{ mods, collections, mosaics }`, each a list of up to 10 sources;
- stored entries are checked on read;
- a write failure keeps the in-memory state.

`StageOptions` gains `onFilesLoaded(entry)`, with `entry` being `{ kind: "mod" | "collection" | "mosaic", source }`. The stage calls it for sandboxes opened from a mosaic, a collection or a tile, when each file loads, never for the `sites` mosaic. `main.tsx` wires it to the store. The UI decides "combination sandbox" from the snapshot, the catalog and recently used (`isCombinationSandbox`, pure).

### Lists: one generic component on shadcn Command

`npx shadcn@4.22.1 add command` vendors `command.tsx` and adds `cmdk`, listed in the vendor README. `src/main/stage/CombinationList.tsx` wraps `Popover` and `Command`. It takes groups of rows (`title`, `secondary` line, `count`, marks, `disabled`, `onChoose`) and a footer (details and explorer link). `ModList.tsx`, `CollectionList.tsx` and `MosaicList.tsx` only build rows from the combination catalog and the snapshot.

Sorting happens once, when a list opens, from the counts known at that moment, and is kept in the component's state, so arriving counts never move rows. `StageBarPanel` grows to `"mod-list" | "collection-list" | "mosaic-list" | "more" | "sites"`, so the existing one-open-panel rule, the frame-focus close and the sandbox-change close cover the lists for free.

### Width ladder with container queries, both layouts rendered

The bar's `<section>` becomes an `@container`. The full capsule row and the single folded capsule are both rendered. Container variants (`@max-[479px]:hidden`, `@min-[480px]:hidden`) show one of them. `display: none` removes the hidden one from the accessibility tree, so names never repeat. The version is hidden below 960px, and the mod and collection titles below 720px, with their accessible names unchanged.

Shrink order comes from `flex-shrink` weights (collection 3, mod 2, mosaic 1, swapped for an unsaved combination) with `min-w-0`, `max-w-[16rem]` and `truncate`. The right side keeps `shrink-0`. No JavaScript measures anything, so a width change cannot move the right side, and e2e can test each step by sizing the viewport.

*Alternative:* a `ResizeObserver` that picks a layout would re-render on every resize and is harder to test.

### Overflow menu replaces Share

`MoreActionsMenu.tsx` takes over `ShareMenu.tsx`'s copy logic and feedback announcements, adding "Reload tiles" when `canReloadTiles`. `ModInfoPopover.tsx` is deleted, and its source lines move into the lists' footers through a shared `SourceDetails` component.

### Specs order

This change's `app-settings` delta and its catalog references start from `add-app-catalog`'s texts, and its swaps rely on `add-mosaic-sites-link`. Both are archived.

## Risks / Trade-offs

- [Opening a list measures many pairs, each loading a whole collection's tiles] → Tiles load once per collection and validators once per type file. Only the open list's rows are measured. A 51-tile collection is the largest sample.
- [Back after a swap reloads the previous combination's frame, so its in-frame state is lost] → Accepted when choosing replace semantics. The mod's storage slot keeps what it stored.
- [A mod swap silently carries a mosaic's hosts to another mod] → The shield chip shows the hosts and the mosaic they come from, with a one-click drop. The grant rules themselves are reviewed in `add-mosaic-sites-link`.
- [Recently used is a local history of what the user opened] → Stored only in the app's storage, unreachable by mods. Settings says so and offers "Clear".
- [The stage bar e2e suite is largely rewritten] → Unchanged requirements (messages, theater, fullscreen, close) keep their tests. Only the left side's tests are replaced.
- [Both folded and unfolded layouts are in the DOM] → Only one is displayed. Component tests query by role, so hidden duplicates are not found.
## Migration Plan

No data migration. Links made before keep working. Rollback is a revert. Stored recently used entries are then ignored.
