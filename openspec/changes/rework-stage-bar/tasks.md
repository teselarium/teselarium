# Tasks

## 1. Prerequisite

- [ ] 1.1 Check that `add-app-catalog` and `add-mosaic-sites-link` are applied: `APP_CATALOG`, `catalog.list`, the Catalog group, `RunLink.sites` and mod API `0.1.16` are in the code. Re-read the archived (or still active) `app-settings` text of `add-app-catalog`, and make sure this change's MODIFIED block starts from it. Verify with `openspec validate rework-stage-bar --strict`.

## 2. Stage: snapshot, combination opening and recording

- [ ] 2.1 Extend `SandboxSnapshot` with `link`, `collectionTitle`, `tile`, the mosaic's `aliases` and `show` lines, and `sites`. Verify with `stage_controller.test.ts` cases for a mosaic, a collection, a tile and a `sites` sandbox, and a `sites` that failed.
- [ ] 2.2 Add `combination_links.ts` with `buildModChoice`, `buildCollectionChoice`, `buildMosaicChoice` and `buildSitesDrop`, plus `isCombinationSandbox`. Verify with unit tests for each rule of "Choosing a mod", "Choosing a collection", "Choosing a mosaic" and "Combination sandboxes", including the current-entry `null`, kept and dropped params, and `sites` from a mosaic or kept from a sites link.
- [ ] 2.3 Add `openStageCombination`, extracting the replace path's shared steps, with a new history entry and the home-mod fallback. Export it from the stage's `index.ts`. Verify with `stage_history.test.ts` and `stage_controller.test.ts` cases for "Back to the previous combination", "Close after a swap", "Section after a swap" and "Swap from a home mod".
- [ ] 2.4 Add `onFilesLoaded` to `StageOptions` and call it per "What is recorded". Verify with stage tests: a mosaic link records mod, collection and mosaic, a sites mosaic is not recorded, an explorer is not recorded, and a failed mod file is not recorded.
- [ ] 2.5 Document the snapshot fields, `openStageCombination` and `onFilesLoaded` in the stage README ("Replacing a sandbox", "Public API"). Verify that each new name appears there.

## 3. Combination catalog (counts and summaries)

- [ ] 3.1 Add `src/lib/core/combinations/` with `createCombinationCatalog`, its summary caches, `requestCounts` and `dropCollection`, plus a README. Verify with unit tests on a recording fake fetch for "Laureates without aliases" (`0/17`), "Mod without a tile type" (`any`), a tile target (`1/1` and `0/1`), "Second opening" (no new request), `dropCollection`, and that no entrypoint, library or mosaic file is requested by a count.
- [ ] 3.2 Call `dropCollection` when the stage reloads tiles. Wire the combination catalog in `main.tsx` with `readCatalog` from the stage. Verify with a stage test that "Reload tiles" drops that collection's counts.

## 4. Recently used store and Settings

- [ ] 4.1 Add `src/main/settings/recently_used.ts` (key `opentesela.recently-used`, 10 per kind, newest first, invalid entries dropped, `clear`), wired to `onFilesLoaded` in `main.tsx`. Verify with `recently_used.test.ts` for "Opened again", "Eleventh mod", "Kept after a reload", a stored invalid entry, a storage write failure, and "Mods cannot reach it" (key outside the mod storage prefix).
- [ ] 4.2 Add the recently used line and "Clear" to the Settings page's Catalog group. Verify with `SettingsPage.test.tsx` for "Count after trying combinations" and "Clear", and the vanilla page scenario's new line.
- [ ] 4.3 Document recently used in the Settings docs and `docs/modules/main/README.md`. Verify the docs name the storage key and the limit.

## 5. Stage bar UI

- [ ] 5.1 Vendor shadcn `command` with `npx shadcn@4.22.1 add command`, review the diff, and list it and `cmdk` in `src/vendor/shadcn/README.md`. Verify with `npm run build` and `npm run lint`.
- [ ] 5.2 Add `CombinationList.tsx` (Popover and Command, search, groups, open-time sorting, muted "Not compatible" group with `no match`, disabled error rows with "Remove" for recent ones, footer with details and explorer link). Verify with component tests for search, keyboard and Escape, sorting kept while counts arrive, and the muted group's text labels.
- [ ] 5.3 Add `ModList.tsx`, `CollectionList.tsx` and `MosaicList.tsx`, built from the snapshot, the catalog, recently used and the combination catalog. Verify with component tests for each scenario of "Mod list entries", "Collection list entries", "Mosaics of a pair are marked", "Mosaic list entries", "Mosaic entries say what makes them differ", "Details footer" and "Explorer links", and that choosing calls `openStageCombination` with the `combination_links` result.
- [ ] 5.4 Add the capsules (icons, titles, version, `+` and arrow hidden from assistive technologies, accessible names, loading and failure texts, "None", tile name, "Unsaved combination") and the plain title for other sandboxes. Verify with `StageView.test.tsx` cases for "Combination capsules", "Capsule contents", "Combination sandboxes", "Name while loading or after a failure" and "Mosaic name while loading or after a failure".
- [ ] 5.5 Add `MoreActionsMenu.tsx` (Copy link with feedback, Reload tiles) and `SitesChip.tsx` (count, popover of lines, "Stop using these sites"). Delete `ShareMenu.tsx` and `ModInfoPopover.tsx` and move their tests' still-valid checks. Extend `StageBarPanel` so every new popover follows the outside-click and sandbox-change rules. Verify with component tests for "More actions menu" (all four scenarios), "Sites chip" and the "Popovers and menus close on a click outside" scenarios.
- [ ] 5.6 Make the bar an `@container`, with the shrink weights, `max-w-[16rem]`, truncation with tooltips, and the four width steps with the folded capsule menu. Verify with e2e tests at 1100px, 800px, 600px and 400px bar widths for "Long collection title", "Narrow bar" and "Phone width", and that the right side's buttons keep their positions across the widths.
- [ ] 5.7 Rewrite the left-side tests of `e2e/stage_bar.spec.ts` for the new requirements, and add e2e tests for the swap flows: "Book List on the laureates' map data", "Other collection for the same mod", "None", "Other combination", "Kept covers", "Stop using them", and Back after a swap. Verify that `npm run test:e2e` passes.
- [ ] 5.8 Update the stage bar docs (`docs/modules/main/README.md`, the stage README's "How the page wires the stage", and any guide page that shows the info or Share buttons). Verify that no doc still mentions the information button or the Share menu (`grep -ri "information button\|share menu" docs`).

## 6. Release note

- [ ] 6.1 Add `.changeset/rework-stage-bar.md` with a `patch` bump for `opentesela`: a feature with no breaking change for users or instantiations while the app is `0.x`. Its summary: "The stage bar shows mod + collection -> mosaic as capsules, each with a list to try other combinations, keeps a mosaic's sites when changing its mod, remembers recently used items, and moves Copy link and Reload tiles into a More actions menu." Verify that the file follows the format of the other changesets.

## 7. Verification

- [ ] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that each passes.
