# Design

## Context

See proposal.md (Why) for motivation. The required behavior is in specs/mod-app-actions and specs/mod-sandbox. This change is implemented after `add-mod-theme`, and its code examples assume that change is in place (theme tokens in `stage.css`, `theme` in the session options).

Current state:

- Requests are answered by handler tables per namespace (`STORAGE_METHODS`, `MODS_METHODS`) merged into `ENGINE_METHODS` in `mod_session.ts`. A handler gets a `ModMethodContext` and returns a promise of plain data, or throws `ModMethodError(code, message)`. The session awaits it, so a handler can stay pending for as long as the user needs.
- The engine reaches the stage only through callbacks it is given. `onOpenLink(link)` returns `false` when the sandbox is not the visible one, and `mods.open` turns that into `-32002` "only the visible mod can open mods".
- The stage publishes a frozen snapshot after every change. Visibility changes in `followHistory`, `openStageLink` and `closeSandbox`, all through `applyStageChange`. A mod that navigates its frame is stopped in `frameLoadedAgain`. A stopped session drops every later message, including answers to pending requests (`sendToMod`).
- Frame loader notifications (`sandbox.blocked`, `sandbox.mountFailed`) become issues in the session, and `reportIssue` reports each distinct issue once per session.
- `SandboxFrame` renders `<iframe sandbox="allow-scripts" srcDoc=… />` with no `allow` attribute.

Browser behavior, checked while preparing this design in the installed Playwright Chromium (1.64) with a sandboxed `srcdoc` frame:

- Without `allow="fullscreen"` on the `<iframe>`, `document.fullscreenEnabled` is `false` in the frame and `requestFullscreen()` rejects with "Disallowed by permissions policy". With it, `requestFullscreen()` after a click inside the frame resolves.
- `alert`, `confirm` and `prompt` show nothing (no dialog reaches the page) and return `undefined`, `false` and `null`. A script in the frame can replace `window.confirm`, and later calls use the replacement.
- After a click inside the frame, the app page has no user activation (`navigator.userActivation.isActive` is `false`). The frame's origin is opaque, so its activation does not reach the app. Headless Playwright does not block popups, so a test cannot show the blocker. But a real browser blocks `window.open` from a page without activation, so the app can only open a tab from a click on its own page.

## Goals / Non-Goals

**Goals:**

- Every action leaves the frame only as data, and the app performs it from a click on its own page, after showing exactly what will happen.
- No new trust decision inside the frame: no new sandbox flag, no change to the content policy, no new permission category.
- Plain answers for mod authors: every action answers `true` or `false`, and misuse fails with the existing `-32602` and `-32002`.

**Non-Goals:**

- Styling the action dialog beyond the theme tokens and a layout that fits the stage.
- Translating the dialog texts. The app has no i18n yet (`react-i18next` in `docs/stack.md` is not adopted). Texts stay in one module so they can move later.

## Decisions

### D1. Module layout

```
src/lib/core/sandbox/
  sandbox_loader.js      # + replaces alert, confirm, prompt and print (D7)
  sandbox_messages.ts    # + SANDBOX_DIALOG_BLOCKED_METHOD, readBlockedDialog
  sandbox_reports.ts     # + describeBlockedDialog
src/lib/core/engine/
  app_actions.ts         # AppAction, LinkAction, SaveFileAction, ConfirmAction, the size limit (D2)
  links_methods.ts       # LINKS_METHODS: links.open, readLinkUrl (D3)
  files_methods.ts       # FILES_METHODS: files.save, readSaveFile (D3)
  ui_methods.ts          # UI_METHODS: ui.confirm, readConfirm (D3)
  mod_methods.ts         # + onRequestAction in ModMethodContext (D4)
  mod_session.ts         # + the three tables in ENGINE_METHODS, the dialogBlocked issue
src/lib/core/stage/
  stage_actions.ts       # the action queue: add, answer, drop (D5)
  stage_controller.ts    # + requestStageAction, answerStageAction, the current action in the snapshot
src/main/stage/
  ActionDialog.tsx       # the modal dialog (D6)
  action_effects.ts      # openLinkInNewTab, downloadFile, formatFileSize (D6)
  SandboxFrame.tsx       # + allow="fullscreen" (D8)
  StageView.tsx          # + ActionDialog, leaving fullscreen (D8)
```

The import directions of `add-mod-sandbox` stay. `src/main/stage` imports the action types through the stage's `index.ts`, which re-exports them from the engine as types only.

### D2. Actions are data

```ts
type AppAction = LinkAction | SaveFileAction | ConfirmAction;
interface LinkAction { kind: "link"; url: string }                    // normalized href
interface SaveFileAction { kind: "save"; name: string; type: string; bytes: Uint8Array }
interface ConfirmAction { kind: "confirm"; message: string; confirmLabel: string; cancelLabel: string }
```

The engine checks and decodes the params once, into an action the app can perform without more checks. `bytes` holds the file content, encoded as UTF-8 for text or decoded from base64, so the size the dialog shows is the size that is downloaded, and the 20 MB limit (`MAX_SAVE_BYTES = 20 * 1024 * 1024`) applies to the downloaded file. Actions never cross `postMessage`: they go from the session to the stage and the page in the same window. So `Uint8Array` is fine, although responses to mods stay plain data (`true` or `false`).

- Alternative considered: keep the base64 text and decode in the app. Rejected: the size check and the decode error both belong to the request's validation, and decoding twice is waste.

### D3. The request handlers

One handler table per namespace, as in `add-mod-sandbox`:

- `links.open`: `readLinkUrl` requires a string that `URL.canParse` accepts with no base (so relative addresses fail), with the protocol `http:` or `https:` and an empty `username` and `password`. The action keeps `url.href`, the normalized address, which is also what the dialog shows and opens. For an internationalized host name, `href` shows the punycode form, so look-alike letters cannot hide the real host.
- `files.save`: `name` is checked as in the spec. `encoding` is absent, `"text"` or `"base64"`. `type` is absent or a string that has a `/` and no control characters or spaces. Base64 is checked against `^[A-Za-z0-9+/]*={0,2}$` with a length that is a multiple of 4, then decoded with `atob`.
- `ui.confirm`: `message` is a non-empty string of at most 1000 characters. `confirmLabel` and `cancelLabel` are absent or non-empty strings of at most 40 characters.

Each handler then calls `context.onRequestAction(action)`. A `null` answer means the sandbox is not the visible one: the handler throws `ModMethodError(PERMISSION_DENIED, "<method>: only the visible mod can ask the user")`. Otherwise it returns the promise, which settles when the user answers.

### D4. From the session to the stage

`ModMethodContext` and `ModSessionOptions` gain `onRequestAction: (action: AppAction) => Promise<boolean> | null`, next to `onOpenLink`. `attachSandboxFrame` binds it to `requestStageAction(stage, runtime.id, …)`, the same way `onOpenLink` is bound.

### D5. The action queue in the stage

`stage_actions.ts` keeps the stage's queue as a list of `{ id, sandboxId, action, resolve }`, oldest first. The `id` is a counter, so the page can answer the action it shows and not a later one.

- `requestStageAction(stage, sandboxId, action)` returns `null` when the sandbox is not the visible one. Otherwise it adds an entry, publishes, and returns its promise.
- The snapshot gains `action: ActionSnapshot | null`: the first entry, with the action, the mod's title and source from the runtime's launch, and the entry's id. Only the first entry is shown (spec "One action dialog at a time").
- `answerStageAction(stage, id, accepted)` resolves the entry and removes it, then publishes, so the next entry shows. An unknown id does nothing (a double click, or an action dropped meanwhile).
- After every `applyStageChange` and in `frameLoadedAgain`, `dropLeftActions` resolves with `false` and removes every entry whose sandbox is no longer the visible one or no longer `running` (spec "A mod that leaves gets no"). For a stopped mod, the session drops the answer, so the mod gets none.

- Alternative considered: refusing a second request while a dialog is open. Rejected: a mod would need retry logic for an ordinary sequence (two questions in a row), and a queue costs a list.
- Alternative considered: one queue per sandbox. Rejected: only the visible sandbox can ask, and leaving drops the others. One stage queue is enough.

### D6. The action dialog in the page

`ActionDialog` renders a native `<dialog>` and calls `showModal()` when the snapshot has an action. `showModal` makes the rest of the page inert, frames included, so the mod cannot be clicked behind it (spec "Frame cannot be used behind the dialog"). The browser draws it in the top layer, above everything the page has. It is in the app's DOM, where a frame with an opaque origin cannot reach.

Content, as plain text through React (never as HTML):

- Heading: the mod's title, with its source on the next line.
- Link: "wants to open this address in a new tab:" and the full `href`, wrapping anywhere. Buttons Open and Cancel.
- Save: "wants to save a file:", the name and the size (`formatFileSize`: bytes under 1 KB, else KB or MB with at most one decimal, so 2048 bytes is `2 KB`). Buttons Save and Cancel.
- Confirm: "asks:" and the message, keeping its line breaks (`white-space: pre-wrap`). Buttons with the given labels.

The accept button's click handler performs the action before answering, because the browser only allows the tab or the download during that click:

- `openLinkInNewTab(url)`: `window.open(url, "_blank", "noopener,noreferrer")`, so the new tab has no `opener` and no `Referer` to the app's page.
- `downloadFile(action)`: a `Blob` from `bytes` and `type`, an object URL, a temporary `<a download="name">` clicked and removed, then the URL revoked on the next task.

Then it calls `answerStageAction(stage, id, true)`. Cancel, and the dialog's `cancel` event (Escape), answer `false`. The dialog's buttons and texts use the theme tokens in `stage.css`.

- Alternative considered: rendering the dialog inside the stage bar, without a modal. Rejected: the mod's frame would stay usable, and a mod could time a click under the dialog.
- Alternative considered: performing the action in the stage or the engine after the answer. Rejected: the click activation is gone by then, so the tab would be blocked.

### D7. Blocked browser dialogs

Before the mod's code is imported, the frame loader replaces `window.alert`, `window.confirm`, `window.prompt` and `window.print` with named functions that send `sandbox.dialogBlocked` with `{ name }` and return `undefined`, `false`, `null` and `undefined`, as the browser does for a blocked dialog. The session reads the params with `readBlockedDialog` (`null` for an unknown name) and reports `describeBlockedDialog(name)` as a warning whose source is the mod's source. `reportIssue` already reports each distinct issue once (spec "Reported once").

Messages, held in `sandbox_reports.ts` next to the blocked request messages:

- `alert() is not available in mods. Show the message in the page or in a <dialog> element.`
- `confirm() is not available in mods and always returns false. Use a <dialog> element, or request "ui.confirm" for a confirmation shown by the app.`
- `prompt() is not available in mods and always returns null. Use an <input> in a <dialog> element.`
- `print() is not available in mods.`

A mod can put the originals back. They stay blocked by the sandbox, and only the report is lost, which is acceptable for a diagnostic.

### D8. Fullscreen

`SandboxFrame` adds `allow="fullscreen"`. This is a permissions policy for the frame, not a sandbox flag, so the frame's `sandbox` value stays `allow-scripts`. `StageView` runs an effect keyed on the visible sandbox's id: when it changes and `document.fullscreenElement` is not `null`, it calls `document.exitFullscreen()`, so a hidden frame never keeps the screen.

### D9. Assets next to the mod

No code: the mod file's origin is already a content host (`add-mod-sandbox`, Content hosts), so `show` requests to it are allowed. The change adds tests for both scenarios and documents the pattern `new URL("./icon.svg", context.mod.source)`. It also documents that scripts from the mod's folder still need `code`, because mods are bundled into one entrypoint.

### D10. Tests

Each scenario of the two spec files has a test named after it:

- `lib` (Node): the param readers and their errors, the handlers with a fake `onRequestAction` (visible, hidden, accepted, cancelled), `describeBlockedDialog` and `readBlockedDialog`, the session's dialogBlocked issue once per function, and the stage queue (order, one shown, answer by id, dropped on back, close and stop).
- `app` (jsdom): `ActionDialog` for each kind (texts, plain text message, Escape answers `false`, accept calls the effect then answers `true`), with `window.open` and `URL.createObjectURL` stubbed, and `formatFileSize`.
- Playwright: the new tab with `context.waitForEvent("page")` (address, `window.opener` is `null`), downloads with `page.waitForEvent("download")` (file name and bytes), the dialog in the app page, a click behind it at the frame's coordinates with `page.mouse`, back with the dialog open, a mod stopped with the dialog open, fullscreen after a click, the blocked dialog issues, and assets from both origins with the probe mods of `e2e/mod_routes.ts`.

### D11. Docs

- `docs/modules/lib/core/engine/README.md`: `links.open`, `files.save` and `ui.confirm`, with params, answers, limits and errors.
- `docs/modules/lib/core/sandbox/README.md`: fullscreen, the blocked dialogs with the new `sandbox.dialogBlocked` row in the frame loader messages table, assets next to the mod, and a short "Dialogs in mods" guide (`<dialog>` for anything inside the mod, `ui.confirm` when the app should vouch for the question).
- `docs/modules/lib/core/stage/README.md`: the action queue, the current action in the snapshot, and answering actions.

## Risks / Trade-offs

- [A mod can give itself a misleading title, such as "OpenTesela", to borrow the app's authority in the dialog] → The dialog always shows the mod's source under the title, and mods from other origins have that origin in their source. Mods from the app's origin are trusted by the site owner already. The permission prompt change can add a stronger mark for mods from other sites.
- [A mod can keep asking, one dialog after another] → Each dialog needs a user action, the browser's back button always leaves the mod (which drops its requests), and only the visible mod can ask. A per-mod limit can come later if a real mod abuses it.
- [Popup behavior was not seen being blocked in tests] → Headless Chromium does not block popups. The user activation check in Context is the evidence, and task 8.2 checks the link and the download by hand in Firefox and, if available, WebKit.
- [Large saves hold the bytes in memory twice, in the action and in the `Blob`] → Bounded by 20 MB. The action is dropped as soon as it is answered.

## Migration Plan

No migration. Mods that never call the new requests behave as before, except that calling a blocked browser dialog now adds a warning issue.
