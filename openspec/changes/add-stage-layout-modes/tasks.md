# Tasks

## 1. Width tokens and the reading width of pages

- [ ] 1.1 In `src/lib/core/theme/theme_tokens.ts`, add `--ot-content-width` (`80rem`) and `--ot-reading-width` (`45rem`) with `defineSharedToken`, after `--ot-shadow` (design.md, D6). Update `theme_tokens.test.ts` so "Token names" lists both, and check that both have the same value in each color scheme. Verify `npx vitest run src/lib/core/theme` passes.
- [ ] 1.2 In `src/main/pages/MarkdownPage.tsx`, give `.page-body` in `PAGE_HOST_RULES` `max-width: var(--ot-reading-width)` and `margin-inline: auto`. Add e2e cases to `e2e/app_pages.spec.ts` for the `app-pages` scenarios "Wide page area" (2560×1080) and "Narrow page area" (600×800). Verify `npx playwright test e2e/app_pages.spec.ts` passes.
- [ ] 1.3 Document both tokens in the token table of `docs/modules/lib/core/theme/README.md`, and the reading width of pages in its pages section. Verify by reading that the README's token list matches `THEME_TOKENS`.

## 2. The layout in the stage and the engine

- [ ] 2.1 Add `src/lib/core/stage/stage_layout.ts` (design.md, D2) with:
  - `FrameLayout`: `"contained" | "theater" | "fullscreen"`;
  - a pure `readSandboxLayout(theaterMode, fullscreenSandboxId, sandboxId)`.

  Cover in `stage_layout.test.ts`:
  - each of the three results;
  - a fullscreen id that names another sandbox.

  Verify `npx vitest run src/lib/core/stage/stage_layout.test.ts` passes.
- [ ] 2.2 In `src/lib/core/engine/mod_session.ts`:
  - make `buildMountContext` add `layout` next to `theme`;
  - add `pushLayoutChanged(session, layout)`, which sends `layout.changed` with `{ layout }`;
  - add `layout` to `ModContext`, and to whatever `LaunchContext` omits for `theme`.

  Add session tests for the context key and the event's params (plain data, structured clone). Verify `npx vitest run src/lib/core/engine` passes.
- [ ] 2.3 In the stage (design.md, D2):
  - `createStage` takes `theaterMode` as an option and keeps it, with `fullscreenSandboxId: null`;
  - add `changeStageTheaterMode` and `changeStageFullscreen` to `stage_controller.ts`. Each reads every runtime's layout before and after the change, pushes `layout.changed` only to the runtimes whose layout changed, and publishes a snapshot with `isTheaterMode`;
  - sessions read their layout when their frame connects, through a `readLayout` service next to `readTheme` in `stage_sandboxes.ts`;
  - check frames in `stage_checks.ts` always pass `"contained"`;
  - closing the fullscreen sandbox clears `fullscreenSandboxId`.

  Export the new functions from the stage's `index.ts`. Add cases to `stage_controller.test.ts` for the `stage-layout` scenarios:
  - "Hidden mod follows";
  - "New sandboxes start in the current mode";
  - "Theater turned on while the mod loads";
  - "Fullscreen mod keeps its layout" (no event);
  - "Check frames are contained".

  Verify `npx vitest run src/lib/core/stage` passes.
- [ ] 2.4 Bump the mod API to `0.1.9`:
  - `MOD_API_VERSION` in `src/lib/core/engine/mod_api_version.ts`;
  - a new `0.1.9` entry in `mod_api_surface.test.ts`, with the event `layout.changed` and the mount context key `layout`, leaving older entries as they are;
  - every test and e2e expectation of `0.1.8` that means the current version.

  Verify `npx vitest run` passes and `grep -rn '"0.1.8"' src e2e` lists only the surface guard's history.
- [ ] 2.5 Document the layout in `docs/modules/lib/core/engine/README.md`:
  - `layout.changed` in the events table, "Added in mod API `0.1.9`";
  - `layout` in the mount context table;
  - the version `0.1.9` in the Mod API version section and in the `api` row.

  Describe the stage's layout state in `docs/modules/lib/core/stage/README.md`. Verify by reading that both READMEs name the three layouts and the version `0.1.9`.

## 3. The layout inside the frame

- [ ] 3.1 In `src/lib/core/sandbox/sandbox_loader.js` (design.md, D5):
  - set `document.documentElement.dataset.otLayout` from the mount context before `mount`;
  - handle `layout.changed` before the mod's handlers: update the attribute, and the pending context while the mod is not mounted yet;
  - ignore any value other than the three layouts.

  Verify `npx vitest run src/lib/core/sandbox` passes.
- [ ] 3.2 In `src/lib/core/theme/base_stylesheet.css`, add the rule `html[data-ot-layout="contained"] body { max-width: var(--ot-content-width); margin-inline: auto; }` inside the `opentesela` layer (design.md, D6). Make sure it contains no closing style tag. Verify `npx vitest run src/lib/core/theme` passes.
- [ ] 3.3 In `default_mods/mod_api.d.ts`, add `layout` to the mount context type and the `layout.changed` event with its params. Verify `npx tsc -b` passes.
- [ ] 3.4 Add `e2e/stage_layout.spec.ts`. Mods turn theater on through the stage directly, or through stored values, until group 4 adds the button. Cover the `stage-layout` scenarios:
  - "Attribute at mount", "Attribute before the handlers" and "Opted-out mod gets the attribute";
  - "Default mount context";
  - "Wide stage area", "Narrow stage area", "Theater fills the frame", "Mod keeps the full width" and "Opted-out mod has no limit";
  - "Same frame in both layouts" and "Wheel beside the content".

  Add the fixture mods these need under `e2e`'s existing fixture folders. Verify `npx playwright test e2e/stage_layout.spec.ts` passes.
- [ ] 3.5 Document the layouts for mod authors in `docs/modules/lib/core/theme/README.md`, under "Write HTML, get the app's look": the content width, the attribute, the event, and the one-line opt-out `body { max-width: none; }`. Mention them in `docs/mod_plugin_spec.md`. Verify by reading that both docs show the opt-out rule as written in 3.2.

## 4. Theater mode button and the remembered choice

- [ ] 4.1 Add `src/main/stage/theater_setting.ts` following `tile_media_setting.ts` (design.md, D7):
  - `THEATER_MODE_KEY = "opentesela.theater-mode"`;
  - `readStartTheaterMode`, which is true only for a stored `true`;
  - `createTheaterSetting`;
  - `changeTheaterMode`, which writes the value when the storage allows, then calls `changeStageTheaterMode`.

  Cover in `theater_setting.test.ts`:
  - stored `true`;
  - missing value;
  - unknown value (`"maybe"`);
  - a storage that throws on read and on write.

  Verify `npx vitest run src/main/stage/theater_setting.test.ts` passes.
- [ ] 4.2 In `src/main.tsx`, pass `readStartTheaterMode(window.localStorage)` to `createStage` and create the theater setting next to the others. Pass it through `App` and `StageView` to `StageBar`. Verify `npx tsc -b` passes.
- [ ] 4.3 In `StageBar.tsx` (design.md, D8):
  - after the message buttons, add a separator and the "Theater mode" `StageBarIconButton`, with `RectangleHorizontal` and `aria-pressed` from `isTheaterMode`;
  - keep the second separator and × conditional on `canClose`.

  Add `StageBar` tests:
  - the button's name, tooltip and `aria-pressed` in both states;
  - pressing it calls `changeTheaterMode`;
  - it is shown for a loading and a failed sandbox.

  Verify `npx vitest run src/main/stage` passes.
- [ ] 4.4 Update `e2e/stage_bar.spec.ts` for "One-row stage bar": the new order, and "Home mod without a close button". Add "Turn theater mode on", "Turn theater mode off" and "Shown for a failed sandbox". Add the `stage-layout` cases "Theater layout", "Choice kept after a reload", "Unknown stored value", "Storage cannot be written", "Mods cannot reach the choice" and "Theater turned on" to `e2e/stage_layout.spec.ts`, using the button. Verify `npx playwright test e2e/stage_bar.spec.ts e2e/stage_layout.spec.ts` passes.
- [ ] 4.5 Describe the theater mode button in the stage bar layout of the main `README.md` and of `docs/modules/lib/core/stage/README.md`. Verify by reading that both list the right side of the bar in the spec's order.

## 5. Fullscreen

- [ ] 5.1 In `StageView.tsx` (design.md, D3):
  - listen for `fullscreenchange` on the app document;
  - find the sandbox whose frame is `document.fullscreenElement`, through the `data-sandbox-id` of the frame's parent;
  - call `changeStageFullscreen` with that sandbox's id, or with `null`;
  - remove the listener on unmount.

  Keep `leaveFullscreen` on a change of visible sandbox. Verify `npx vitest run src/main/stage` passes, with a `StageView` test that dispatches `fullscreenchange`.
- [ ] 5.2 Add the "Fullscreen" `StageBarIconButton` (lucide `Maximize`), after the theater button, only for a running sandbox with a frame document (design.md, D4 and D8). When pressed, it:
  - calls `requestFullscreen()` on the visible sandbox's iframe, found by `data-sandbox-id` in the stage view;
  - closes the bar's open panel;
  - focuses the frame.

  When the promise rejects, the stage adds a `warning` message from the app, through a new stage function, whose source is the mod's source and whose text says fullscreen is not available, with the error's message. In `stage.css`, give `.sandbox-frame:fullscreen` `border: 0` and `border-radius: 0`. Add `StageBar` tests:
  - the button is shown only while the mod runs;
  - pressing it requests fullscreen on the frame;
  - a rejection adds the warning.

  Verify `npx vitest run src/main/stage src/lib/core/stage` passes.
- [ ] 5.3 Add e2e cases to `e2e/stage_layout.spec.ts` for:
  - "Fullscreen from the stage bar";
  - "Fullscreen asked by the mod";
  - "Leaving fullscreen" (Escape returns to `theater` when it is on);
  - "Frame fills the screen";
  - "Escape leaves fullscreen";
  - "Fullscreen refused", by making `requestFullscreen` reject in the page.

  Add "Running mod", "Failed sandbox" and "Waiting for an answer" to `e2e/stage_bar.spec.ts`. Check that the existing `e2e/mod_sandbox.spec.ts` fullscreen cases still pass. Verify `npx playwright test e2e/stage_layout.spec.ts e2e/stage_bar.spec.ts e2e/mod_sandbox.spec.ts` passes.
- [ ] 5.4 Describe the fullscreen button in the main `README.md` and in `docs/modules/lib/core/stage/README.md`: what it shows, Esc, and the warning when it is refused. Verify by reading that the stage README's fullscreen notes match `stage-layout`'s "Fullscreen the visible mod".

## 6. Integration

- [ ] 6.1 Run the whole suite and check the look by hand:
  - run `npm run lint`, `npm run format:check`, `npm run build`, `npm test` and `npm run test:e2e`, and verify each passes;
  - with `npm run dev` at a 2560-pixel-wide window, check the book list, the mod explorer and the mod viewer in contained, theater and fullscreen;
  - check the Home page at the reading width.
- [ ] 6.2 Run `openspec validate add-stage-layout-modes --strict` and verify it reports the change as valid.

## 7. Release note

- [ ] 7.1 Add `.changeset/add-stage-layout-modes.md` with `"opentesela": patch`. Per the "Bump rule" of `docs/releasing.md`, the app is `0.x`, and the mod API's patch bump (`0.1.8` to `0.1.9`, an addition) bumps the app at least as much. Its one-line summary is: "Mods are centered at a readable width on wide screens, pages at a reading width, and the stage bar has a theater mode button and a fullscreen button." Verify `npx changeset status` lists the change with a patch bump.
