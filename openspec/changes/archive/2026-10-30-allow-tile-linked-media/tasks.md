# Tasks

## 1. Collecting tile links

- [x] 1.1 Add `src/lib/core/sandbox/private_hosts.ts` with `isPrivateHost(hostname)` as in design.md: drop one trailing `.`, check the name rules, and check dotted-quad IPv4 addresses against a table of `[first address, prefix length]` ranges. Write `private_hosts.test.ts` first, with cases named after the spec scenarios "Names", "Addresses" and "Public hosts", plus the edges of `172.16.0.0/12` and `100.64.0.0/10`, and `new URL("http://2130706433/").hostname` and `new URL("http://0x7f.1/").hostname` ("Other forms of an address"). Verify `npx vitest run src/lib/core/sandbox/private_hosts.test.ts` passes.
- [x] 1.2 Add `src/lib/core/sandbox/tile_links.ts` with the `TileLinks` type and `collectTileLinks(tiles, contentHosts, granted)`, following the six steps of design.md, with explicit loops and no function deeper than three levels of indentation. Put the "cannot express" checks in their own functions and the two issue messages in constants: `Not loading <url>: the sandbox cannot allow this address.` and `Not loading <url>: tiles from other sites cannot link addresses on your computer or network.` Share the `show` host listing with `sandbox_policy.ts` rather than copying it. Write `tile_links.test.ts` first, with cases named after the scenarios of "Media linked by tiles", "A tile link allows only the linked file", "Tile links the sandbox cannot express" and "Private network guard", plus the extra cases listed under Tests in design.md. Verify `npx vitest run src/lib/core/sandbox/tile_links.test.ts` passes.
- [x] 1.3 Export `collectTileLinks` and `TileLinks` from `src/lib/core/sandbox/index.ts`. Do not export `isPrivateHost`, which only the sandbox module uses. Verify `npx vitest run src/lib/core/sandbox/index.test.ts` passes, and update it if it lists the exports.

## 2. Policy and reports

- [x] 2.1 Give `buildSandboxPolicy` the required third argument `tileLinkSources`, added after the sorted hosts in `img-src` and `media-src` only. Update `sandbox_policy.test.ts` with a case that has two sources (in `img-src` and `media-src`, not in `style-src`, `font-src`, `connect-src`, `frame-src` or `script-src`), and keep the default policy case equal to the README's text when given `[]`. Verify the test passes.
- [x] 2.2 Add the `hintsTileLinks` argument to `describeBlockedRequest`, and add the redirect sentence to the undeclared message for `img-src` and `media-src`. Add `describeNewTileLinks(count, collectionSource)` with the singular and plural messages of design.md, and export it. In `sandbox_reports.test.ts`, add cases named "Tile link that redirects", "No hint for other categories" and "No hint with the setting off", one for a denied permission without the hint, and the singular and plural notices. Verify the test passes.
- [x] 2.3 Document it in `docs/modules/lib/core/sandbox/README.md`. In the content policy table, `img-src` and `media-src` get `+ tile links`. Add a "Media linked by tiles" section after "Images next to tiles" covering:
  - which strings are collected and the six steps;
  - what the policy cannot express;
  - the private host list and what the guard does not cover (DNS);
  - that the links are fixed when the mod starts, with the reload notice;
  - the setting, and that linked sites see the reader;
  - a note for tile authors: link the file itself, at its final address, not a page or a redirect.

  Add the hint to "Blocked request reports". Add `collectTileLinks`, the new `buildSandboxPolicy` argument and `describeNewTileLinks` to "Module Details". Add a short note for tile authors under "Tiles and Tile Collections" in `docs/opentesela_spec.md` that links the new section. Verify each message quoted in the docs matches the constants in the code.

## 3. Launch and session

- [x] 3.1 Add `loadsTileLinkedMedia` to `buildModLaunch` and `ModLaunchRequest`, and add `tileLinks: TileLinks | null` to `ModLaunch`. With the setting on, collect from `modTiles.tiles` (or `[]` without a collection) with the launch's content hosts and `grants.granted`, and pass `tileLinks.sources` to `buildSandboxPolicy`. With it off, pass `null` and `[]`. Leave `buildModContext` unchanged. In `mod_launch.test.ts`, check `tileLinks` and the policy with the setting on and off, a mod from another origin getting the links, and that the mount context equals what it was before. Verify the test passes.
- [x] 3.2 Add `hintsTileLinks` to `ModSession`, set from `launch.tileLinks !== null` in `connectModSession`, and pass it from `reportBlockedRequest`. In `mod_session.test.ts`, check that a blocked `img-src` report has the hint with a launch built with the setting on, and no hint with it off. Verify the test passes.
- [x] 3.3 Update the "Launch" part of `docs/modules/lib/core/engine/README.md`: the new `buildModLaunch` argument and `ModLaunch.tileLinks`, and that the mount context does not list the links. Verify the README's `buildModLaunch` signature matches the code.

## 4. Stage

- [x] 4.1 Add `loadsTileLinkedMedia` to `StageOptions` and `Stage`, and export `changeStageTileLinkedMedia(stage, isOn)` from `src/lib/core/stage/index.ts`. Add the field to `SandboxServices` and `CheckServices`, filled in by `buildSandboxServices` and `buildCheckServices`. Pass it to `prepareModLaunch` in `launchSandbox`, and to `buildModLaunch` in `stage_checks.ts`. Update `src/test/test_stages.ts`, `src/test/check_stages.ts` and `src/test/method_contexts.ts`. In `stage_controller.test.ts`, check that a sandbox launched after `changeStageTileLinkedMedia(stage, false)` has `tileLinks` `null`, and that a running one keeps its launch. In `stage_checks.test.ts`, check that the check frame's policy has the links. Verify the tests pass.
- [x] 4.2 Add `tileLinkIssues` to `SandboxRuntime`, set in `startRuntime` and listed by `readSandboxIssues` after the collection issues. On a successful reload with `launch.tileLinks` not `null`, replace it with the notice (when there are new sources) followed by the reloaded left-out issues. Keep it as it was when the reload fails. In `stage_sandboxes.test.ts`, add cases named "New link after reloading the tiles", "Nothing new" and "Left-out link removed", one for a failed reload, and one for the issue order. Verify the tests pass.
- [x] 4.3 In `docs/modules/lib/core/stage/README.md`, describe the reload notice and the tile link issues, and that the stage gets the setting through `StageOptions` and `changeStageTileLinkedMedia`. Verify the README's issue order matches `readSandboxIssues`.

## 5. Settings

- [x] 5.1 Add `src/main/settings/tile_media_setting.ts` as in design.md (`TILE_MEDIA_SETTING_KEY`, `readStartTileLinkedMedia`, `createTileMediaSetting`, `switchTileLinkedMedia`, `readTileMediaSnapshot`, `subscribeTileMediaSetting`). Write `tile_media_setting.test.ts` first, with the default on, a stored `false`, the "Unknown stored value" scenario, a storage whose `setItem` throws, listeners being called, the stage being told through `changeStageTileLinkedMedia`, and the key not starting with `opentesela.mod-storage:`. Verify the test passes.
- [x] 5.2 In `src/main.tsx`, pass `readStartTileLinkedMedia(window.localStorage)` to `createStage` and create the setting. Pass it through `App` and `PageView` to `SettingsPage` as `tileMedia`. Add the Privacy card between Sidebar and Version, with the label and description of design.md. In `SettingsPage.test.tsx`, check the switch is on by default, switching it calls the store, and the order Appearance, Sidebar, Privacy, Version. Verify `npm test` passes.
- [x] 5.3 In `docs/modules/main/settings/README.md`, add the Privacy group to "What the page holds" and the `opentesela.tile-linked-media` row to "Stored keys". Verify the row's default matches `readStartTileLinkedMedia`.

## 6. End-to-end

- [x] 6.1 In `e2e/mod_sandbox.spec.ts`, add `test.describe` blocks named after the new `mod-sandbox` requirements. Serve collections with `page.route` on `https://tiles.example.net` and media on `https://media.example.net`, following "Tile from another host". Cover these scenarios:
  - "Image linked by a tile", "Audio linked by a tile" and "Mod from another origin";
  - "Other file of the same host" and "Linked file fetched";
  - "Router address in a tile from the web", with a recording route on `http://192.168.1.1/**` that sees no request;
  - "Tile link that redirects", with a `302` to `https://cdn.example.org/cover.jpg`;
  - "New link after reloading the tiles".

  Verify `npx playwright test e2e/mod_sandbox.spec.ts` passes, with the existing tests unchanged.
- [x] 6.2 In `e2e/app_settings.spec.ts`, add tests for the Privacy group in "Vanilla settings page", "Switched off before opening a mod", "Running mod keeps its policy" and "Kept after a reload". Verify `npx playwright test e2e/app_settings.spec.ts` passes.

## 7. Verification

- [x] 7.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Then run `openspec validate allow-tile-linked-media --strict` and verify it is valid.

## 8. Release

- [x] 8.1 Add `.changeset/allow-tile-linked-media.md` with an `"opentesela": patch` bump. Per the "Bump rule" in `docs/releasing.md`, nothing breaks while the app is `0.x`, and the mod API does not bump. Use the one-line summary: "Mods can show the images, audio and video their tiles link to, from any public site, without a permission; Settings has a Privacy switch to turn it off." Verify the file matches the format of the other files in `.changeset/`.
