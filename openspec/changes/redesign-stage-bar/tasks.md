# Tasks

## 1. Sandbox messages in the stage

- [x] 1.1 Add `src/lib/core/stage/stage_messages.ts` with `MessageLevel`, `MessageProducer` and `SandboxMessage`, and pure functions that:
  - build a message with the runtime's next id;
  - mark the messages of one level read;
  - dismiss one `info` message;
  - clear all `info` messages;
  - add a mod message under the cap of 100, removing the oldest mod message and counting it in `droppedModMessages` (design.md, D2 and D3).

  Cover each in `stage_messages.test.ts`, including:
  - dismissing an error is ignored;
  - the 101st mod message drops the oldest mod message and no app message;
  - "Clear all" leaves the errors and warnings.

  Verify `npx vitest run src/lib/core/stage/stage_messages.test.ts` passes.
- [x] 1.2 In `stage_sandboxes.ts`:
  - make the runtime's groups hold `SandboxMessage`s with ids;
  - rename `issues` to `messages`;
  - add `nextMessageId`, `readMessageIds`, `droppedModMessages` and the resolved mod reference;
  - make `readSandboxIssues` return the messages in the spec's order. Reloaded collection and tile link messages get new ids.

  Update `stage_sandboxes.test.ts` so the existing order cases read messages, and add "Reloaded issues are unread". Verify `npx vitest run src/lib/core/stage` passes.
- [x] 1.3 In `stage_controller.ts`:
  - replace `SandboxSnapshot.issues` with `messages` (`id`, `level`, `producer`, `source`, `text`, `isRead`), `droppedModMessages`, `modReference` and `collection`;
  - add `markMessagesRead`, `dismissMessage` and `clearNotifications`, each publishing a snapshot, and export them from the stage's `index.ts`.

  Update `stage_controller.test.ts` and add cases:
  - read state stays with its sandbox after going to another mod and back;
  - dismissing lowers the `info` count;
  - an unknown sandbox or message id does nothing.

  Verify `npx vitest run src/lib/core/stage` passes.
- [x] 1.4 Update `docs/modules/lib/core/stage/README.md`:
  - rename the "Issues and load failures" section to "Messages and load failures", covering the levels, producers, order, ids, read state, dismissing and the cap;
  - update the Public API list (`SandboxSnapshot` fields and the three new functions) and the `stage_messages.ts` row of the file table.

  Verify each statement matches `stage_messages.ts` and `stage_controller.ts`.

## 2. Failures and the app's notifications

- [x] 2.1 Make `failRuntime` add an app `error` message whose source is the error's `source` for the file errors, and otherwise the resolved mod reference or the loaded mod's source (design.md, D5). Add cases to `stage_sandboxes.test.ts` for:
  - a missing mod file (source is the mod file address, text names `404`);
  - a missing collection (source is the collection's address);
  - a switched-off mod;
  - a cancelled API question.

  Verify `npx vitest run src/lib/core/stage` passes.
- [x] 2.2 Add the three app notifications of design.md, D5:
  - collection loaded, built at start after the launch issues;
  - site consent answered, built from the consent lines and decisions and passed into the start so the reset does not drop it, naming each site with its category, whether it was allowed or refused, and whether the answer is remembered;
  - tiles reloaded, after a successful load, with the tile count and the collection issue count.

  Add cases for "Sample collection" (3 tiles), "No collection", "Allowed and remembered", "Escape", "Reload done" and "Reload failed". Also check that the mount context's `issues` and the `tiles.changed` params hold no `info`. Verify `npx vitest run src/lib/core/stage src/lib/core/engine` passes.
- [x] 2.3 Document the load-failure errors and the three notifications in the "Messages and load failures" section of the stage README. Verify the message texts in the README match the code.

## 3. `ui.notify` in the engine

- [x] 3.1 Add `onNotify` to `ModMethodContext` and to `ModSessionOptions`, passed through as the other hooks are. Add `ui.notify` to `UI_METHODS`:
  - check `message` (non-empty, at most 1000), `level` (`info` by default, `warning` or `error`) and `source` (non-empty, at most 1000), raising `-32602` with `ui.notify` and the field;
  - default `source` to the mod's source;
  - answer `null`, from visible and hidden mods alike, without deduping (design.md, D4);
  - change the `UI_METHODS` doc comment.

  Add `ui_methods.test.ts` cases for:
  - "Notification with the defaults";
  - "Error about a tile";
  - "Same message twice";
  - "Message too long";
  - "Unknown level";
  - "Missing message";
  - a `source` of 1001 characters.

  Verify `npx vitest run src/lib/core/engine` passes.
- [x] 3.2 In `stage_sandboxes.ts`, pass an `onNotify` that adds a `producer: "mod"` message under the cap and publishes a snapshot. Add cases for "Default source", "Hidden mod notifies" and "Mod sends too many". Verify `npx vitest run src/lib/core/stage` passes.
- [x] 3.3 Document `ui.notify` in `docs/modules/lib/core/engine/README.md`: a new row in the methods table marked "Added in mod API `0.1.8`", and a short section next to "Asking the user" with the params, the checks, the defaults, the cap, the App/Mod labels and an example. Add a "Telling the user something" part to `docs/mod_plugin_spec.md`. Verify the example's params pass the checks in `ui_methods.test.ts`.

## 4. Notifications in the check and in test cases

- [x] 4.1 In `stage_checks.ts`, give the mount frame an `onNotify` that records `error` and `warning` as `mount` findings with the notification's source and text and ignores `info`. Give the list frame and the case frames in `stage_check_cases.ts` an `onNotify` that records nothing. Add cases to `stage_checks.test.ts` ("Mod notifies an error while mounting", "Info notification is not a finding", "The check adds nothing to the stage bar") and to `stage_check_cases.test.ts` ("Expected error notification", with the request in `requests`). Verify `npx vitest run src/lib/core/stage` passes.
- [x] 4.2 Update "What the mount check records" in `docs/mod_plugin_spec.md` ("Checking a mod") and "What a case records" in the same file, and the "Mod checks" section of the stage README. Verify they match the cases of 4.1.

## 5. Mod API version

- [x] 5.1 Set `MOD_API_VERSION` to `0.1.8`, and add a `0.1.8` entry to `mod_api_surface.test.ts` with `ui.notify` added to the method names. Update `mod_api_version.test.ts`, the pinned version in `e2e/mod_routes.ts`, and the version in the "Mod API version" section of `docs/modules/lib/core/engine/README.md`. Verify `npx vitest run src/lib/core/engine` passes.

## 6. Stage bar UI

- [x] 6.1 Add shadcn's Popover with `npx shadcn@4.22.1 add popover`, review the diff, and add its row to the components table of `src/vendor/shadcn/README.md` ("stage bar"). Verify `npm run lint` passes and the file is unchanged from the CLI's output.
- [x] 6.2 Add `MessageButton`, `MessageItem` and `MessagePopover` in `src/main/stage/`, following design.md, D6:
  - the capsule at the bottom right with `99+`, filled or muted;
  - dimmed and focusable when empty;
  - an accessible name and tooltip with the exact count and the unread count;
  - the producer Badges;
  - dismiss buttons and "Clear all" for `info` only;
  - the dropped-messages note;
  - "No errors." / "No warnings." / "No notifications.".

  Cover them in `MessageButton.test.tsx` and `MessagePopover.test.tsx`. Verify `npx vitest run src/main/stage` passes.
- [x] 6.3 Add `ModInfoPopover`, with the source (or the resolved mod reference), the collection and the run link, and "Copy link" writing `origin + pathname + search + hash`, which says "Copied" for 2 seconds. Cover it in `ModInfoPopover.test.tsx` with a stubbed clipboard. Verify the tests pass.
- [x] 6.4 Rewrite `StageBar.tsx` as the one-row layout:
  - the name and version capsule, or "Loading mod…" / "Mod not loaded";
  - `[i]`, then "Reload tiles" as an icon button with that accessible name and tooltip;
  - `[E]` `[W]` `[N]`, a separator, then ×.

  Opening a level calls `markMessagesRead`. The flash ref and the polite live region follow design.md, D6, with `motion-safe:`. Remove `IssueList.tsx`. Update `StageView.test.tsx` and add cases for:
  - the order of the items;
  - "Mod not loaded";
  - "Loading mod…";
  - no flash after switching sandboxes;
  - a new error announced in the live region.

  Verify `npx vitest run src/main` passes.
- [x] 6.5 Describe the stage bar's layout, buttons, popovers and unread marks in `docs/modules/main/README.md` ("Page layout"). Verify the description matches `StageBar.tsx`.

## 7. End-to-end

- [x] 7.1 In `e2e/mod_routes.ts`, replace the issue list locator with helpers that open a level's popover and read its items (producer, source, text). Move every `No issues.` and issue-list check in `mod_sandbox`, `mod_stage`, `mod_api_version`, `mod_engine_api`, `default_mods` and `tile_body_routes.ts` to them. Verify `npx playwright test e2e/mod_sandbox.spec.ts e2e/mod_stage.spec.ts e2e/mod_api_version.spec.ts e2e/mod_engine_api.spec.ts e2e/default_mods.spec.ts` passes.
- [x] 7.2 Add `e2e/stage_bar.spec.ts` with a routed mod that sends `ui.notify`. Cover the `stage-bar` spec's scenarios:
  - layout order and a single row;
  - "Mod not loaded";
  - App and Mod labels, including "Mod titled like the app";
  - `99+` with the exact count in the accessible name;
  - sizes and positions unchanged as counts grow;
  - the capsule clear of the close button;
  - read after opening and filled again on a new message;
  - reduced motion (`page.emulateMedia({ reducedMotion: "reduce" })`);
  - dismiss and "Clear all";
  - "Mod sends too many";
  - "Copy link" (clipboard permission);
  - the three app notifications;
  - "Hidden mod notifies";
  - a popover opened over a running mod receiving clicks.

  Verify `npx playwright test e2e/stage_bar.spec.ts` passes in the three browsers.

## 8. Verification

- [x] 8.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Run `openspec validate redesign-stage-bar --strict` and verify it is valid.
- [x] 8.2 Open the built app with the sample mod in light and dark, with a mod that has tile issues and sends notifications, and check by eye in desktop Chromium, Firefox and WebKit:
  - the row's alignment;
  - the capsules at `7` and `99+`;
  - the filled and muted colors;
  - the dimmed buttons;
  - the flash;
  - the popovers.

  Verify each browser's result is written down in the change. For a problem found, write a draft issue and give it to the user; do not open it.

  Results, from Playwright screenshots of the built app (`npm run build`, `npm run preview`) at 1100×700, with the sample mod, a collection with one untyped tile (one tile warning) and the mod's engine exposed to send `ui.notify` (6 warnings, 1 error, then 120 notifications), in light and dark:

  - Chromium: passes. One row, items centered on the bar's middle. Capsules `7` and `99+` sit on the icons' bottom-right corners without moving any button or touching the separator. Filled capsules in `destructive`, `warning` and `primary`, muted ones once read. The empty errors button is dimmed. The flash shows mid-animation. The popovers open under their buttons over the mod's frame, with the App and Mod Badges, dismiss buttons and "Clear all" for notifications, and the dropped-messages note.
  - Firefox: passes, the same as Chromium.
  - WebKit: passes, the same as Chromium.
  - Note, not a problem: the muted capsule (`bg-muted text-muted-foreground`) has low contrast, most in dark, as the design's muted pairing does elsewhere. The 120 notifications also dropped the mod's older warnings and error, as the cap of 100 messages from the mod specifies, and their popovers say so.

## 9. Release

- [x] 9.1 Add `.changeset/redesign-stage-bar.md` with an `"opentesela": patch` bump. The mod API grows from `0.1.7` to `0.1.8` with `ui.notify`, an addition that existing mods keep working with, so the app gets a patch while both are `0.x` (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "The stage bar fits in one row, with counts for errors, warnings and notifications that open their lists, and mods can now send notifications." Verify the file matches the format of the other files in `.changeset/`.
