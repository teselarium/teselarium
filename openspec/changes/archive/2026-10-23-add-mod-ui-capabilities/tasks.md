# Tasks

Each group writes its tests first (TDD) and names each test after the spec scenario it covers, so every scenario in `specs/mod-app-actions` and `specs/mod-sandbox` can be traced to a test. Unit tests run in Node (Vitest project `lib`), component tests in jsdom (project `app`), and frame behavior in Playwright on the built app (design D10). Start after `add-mod-theme` is implemented.

## 1. Actions and their params (design D2, D3)

- [x] 1.1 Create `src/lib/core/engine/app_actions.ts` with `AppAction`, `LinkAction`, `SaveFileAction`, `ConfirmAction` and `MAX_SAVE_BYTES`. Verify with `npm run build` that the types compile.
- [x] 1.2 Add `readLinkUrl` in `links_methods.ts`. Write the tests first for "Script address", "Relative address" and "Address with a password", plus a valid address normalized to its `href` and an internationalized host shown in punycode. Verify with `npm test`.
- [x] 1.3 Add `readSaveFile` in `files_methods.ts`. Write the tests first for "Name with a path", "File too large" and "Broken base64", plus each rejected name of the spec (empty, 256 characters, `.`, `..`, `\`, a control character), a wrong `encoding`, a wrong `type`, the defaults for `type`, and UTF-8 bytes for text. Verify with `npm test`.
- [x] 1.4 Add `readConfirm` in `ui_methods.ts`. Write the tests first for "Message too long" (message and label), plus the default labels. Verify with `npm test`.

## 2. Handlers and the session (design D3, D4)

- [x] 2.1 Add `onRequestAction` to `ModMethodContext` and `ModSessionOptions`, and the handler tables `LINKS_METHODS`, `FILES_METHODS` and `UI_METHODS` merged into `ENGINE_METHODS`. Write the tests first with a fake `onRequestAction`: the action passed for each method, `true` and `false` answers passed through, and "Hidden mod asks for a confirmation" (`null` gives `-32002` naming the method). Update `src/test/method_contexts.ts`. Verify with `npm test`.
- [x] 2.2 Update `docs/modules/lib/core/engine/README.md` with the three requests (D11). Verify that `npm run format:check` passes.

## 3. Blocked browser dialogs (design D7)

- [x] 3.1 Add `SANDBOX_DIALOG_BLOCKED_METHOD` and `readBlockedDialog` to `sandbox_messages.ts`, and `describeBlockedDialog` with the four messages of D7 to `sandbox_reports.ts`. Extend the name test so the frame loader holds the new method name. Verify with `npm test`.
- [x] 3.2 In `sandbox_loader.js`, replace `alert`, `confirm`, `prompt` and `print` before importing the mod, with named functions that send `sandbox.dialogBlocked` and return the blocked values. In `mod_session.ts`, report the warning issue. Write the session tests first: one issue per function after repeated notifications, and unknown names ignored. Verify with `npm test` and `npm run lint`.
- [x] 3.3 Add Playwright tests for "Confirm", "Reported once" and "Each function is named" with a probe mod. Verify with `npm run test:e2e`.

## 4. The action queue in the stage (design D5)

- [x] 4.1 Create `stage_actions.ts` and add `requestStageAction`, `answerStageAction` and the snapshot's `action` to the stage controller, with the session's `onRequestAction` bound in `attachSandboxFrame`. Write the tests first for "Two confirmations" (order, one shown, answered by id, unknown id ignored) and for a hidden sandbox getting `null`. Verify with `npm test`.
- [x] 4.2 Drop left actions after every `applyStageChange` and in `frameLoadedAgain`. Write the tests first for "Back while a dialog is open" (resolves `false`), a closed sandbox, and "Stopped while a dialog is open" (removed, no answer sent). Verify with `npm test`.
- [x] 4.3 Update `docs/modules/lib/core/stage/README.md` with the action queue (D11). Verify that `npm run format:check` passes.

## 5. The action dialog (design D6)

- [x] 5.1 Create `action_effects.ts` with `openLinkInNewTab`, `downloadFile` and `formatFileSize`. Write the `app` tests first: `window.open` called with `noopener,noreferrer`, a `Blob` with the bytes and type downloaded through a temporary link that is removed and its URL revoked, and sizes (`512 bytes`, `2 KB`, `1.5 MB`). Verify with `npm test`.
- [x] 5.2 Create `ActionDialog.tsx` and render it from `StageView`. Write the component tests first: the texts for each kind with the mod's title and source, "Message is plain text", Escape answers `false`, and accept calls the effect before `answerStageAction`. Style it with the theme tokens in `stage.css`. Verify with `npm test` and `npm run lint`.
- [x] 5.3 Add Playwright tests for "Link opened", "Link cancelled", "Text file saved", "Binary file saved", "Save cancelled", "Size shown", "Confirmed with a custom label", "Escape answers no", "Sample mod asks", "Frame cannot be used behind the dialog", "Two confirmations", "Back while a dialog is open" and "Stopped while a dialog is open". Verify with `npm run test:e2e`.

## 6. Fullscreen (design D8)

- [x] 6.1 Add `allow="fullscreen"` to `SandboxFrame` and the effect in `StageView` that leaves fullscreen when the visible sandbox changes. Add Playwright tests for "Fullscreen after a click" and "Opening another mod leaves fullscreen", and check that the existing "Frame sandbox" test still passes. Verify with `npm run test:e2e`.

## 7. Assets next to the mod and the sandbox docs (design D9, D11)

- [x] 7.1 Add Playwright tests for "Asset of a mod from the app's origin" and "Asset of a mod from another origin" with probe mods that serve an `icon.svg` next to their mod file. Verify with `npm run test:e2e`.
- [x] 7.2 Update `docs/modules/lib/core/sandbox/README.md`: fullscreen, the blocked dialogs and the `sandbox.dialogBlocked` row, assets next to the mod (and that scripts still need `code`), and the "Dialogs in mods" guide. Verify that `npm run format:check` passes.

## 8. Integration check

- [x] 8.1 On a clean install (`npm ci`), run `npm run build`, `npm test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed, that each scenario in the two spec files has a test named after it, that imports follow the directions of design D1 with each module imported only through its `index.ts`, and that `git status` shows only the files listed in the proposal's Impact section and this change's folder.
- [x] 8.2 Add Firefox and WebKit as projects in `playwright.config.ts`, so every Playwright test also runs there (design, Risks), including opening the tab, saving the file, Escape, fullscreen after a click and when the visible mod changes, and back with an open dialog. Fix what differs, and record each difference in design.md (Browser differences). Verify that `npm run test:e2e` passes in Chromium, Firefox and WebKit.
