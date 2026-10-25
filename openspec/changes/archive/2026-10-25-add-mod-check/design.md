# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `prepareModLaunch` in `src/lib/core/engine/mod_launch.ts` resolves the reference, loads the mod (`loadMod`: the mod file, then the entrypoint), loads and validates the link's collection (`loadModTiles`), grants the permissions and builds the `ModLaunch`: the mount context, the content hosts, the frame document, `apiCompatible`, the file issues (the missing-range warning) and the permission issues. Any error propagates, so the first failing file ends the launch.
- The engine's errors for files carry the failing file: `FileFetchError`, `YamlParseError`, `ModFormatError`, `CollectionFormatError` and `TileTypeError` all have `source`.
- `src/lib/core/engine/mod_api_version.ts` holds `MOD_API_VERSION`, `matchModApiRange` and `describeMissingApiRange`. `src/lib/mod/` and `src/lib/tile/` do not import the engine.
- Request handlers get a `ModMethodContext`. `mods.open` reaches the stage through `onOpenLink`, which is `false` when the sandbox is not the visible one. `links.open`, `files.save` and `ui.confirm` reach it through `onRequestAction`, which is `null` in that case.
- The session (`mod_session.ts`) answers requests, and turns the frame loader's notifications (`sandbox.blocked`, `sandbox.dialogBlocked`, `sandbox.mountFailed`) into issues through `onIssue`. It answers an unknown method with `-32601` and a message that is not a request with `-32600`. Handlers raise `-32602` for bad params. Nothing outside the session sees these answers.
- The frame loader (`sandbox_loader.js`) reports a failed import or mount. It does not report a mount that finished.
- The stage library has no DOM. `StageView` renders one `SandboxFrame` per sandbox in the snapshot. A frame's first `load` calls `attachFrame`, which connects the session, and a later `load` calls `frameLoadedAgain`, which stops the mod ("The mod left its page and was stopped.").
- Storage slots are keys of the `ModStorage` the stage gets (`localStorage` in the app). `src/test/memory_storage.ts` has a `Map`-backed one for tests only.
- Unit tests stand in for a frame with `createFakeFrame` (`src/test/fake_frames.ts`), and play the mod's side of the channel through the transferred port.

## Goals / Non-Goals

**Goals:**
- A check of a mod and the launch of that mod build their frame, policy, permissions and mount context the same way, from the same code.
- The bundle check runs without a DOM, so a Node script can call it later.
- The check's whole flow (bundle check, frame, settle time, limit, recording) is covered by unit tests with a fake frame. e2e tests cover what needs a browser: the mod's code running, the hidden frame and the viewer.

**Non-Goals:**
- Permission issues of the checked mod as findings. `mods.inspect` already tells which permissions would be granted, and the viewer shows them.
- Watching the mod after the settle time. Timers and requests that start later are not recorded.
- Pushing `theme.changed` to a check frame. A check lasts at most about 11 seconds.
- Sharing loaded files between a check and an open sandbox of the same mod. A check loads every file again.

## Decisions

### The bundle check lives in the engine

`src/lib/core/engine/mod_bundle_check.ts` exports `checkModBundle(source, collectionLocation, options)`. It returns a `ModBundleCheck`: the `findings`, the `LoadedMod` (or `null` when the mod file or the entrypoint failed) and the `ModTiles` to mount (or `null` without a collection). It never throws for a file. Each step catches its own error and turns it into a finding, whose source is the error's `source` when it has one and whose message is the error's message:

1. The mod file (`loadModFile`). An error here ends the check: there is nothing else to load.
2. The `api` range, with `matchModApiRange`: a missing range is the warning of `describeMissingApiRange`, the same text the stage shows. A mismatch is a warning naming the range and `MOD_API_VERSION`.
3. The entrypoint.
4. The tile type, when the mod has one (`buildTileValidator`).
5. The collection: the given location, or else the mod's `sampleCollection`, or none. It is loaded, validated with the type's validator and reduced to the tiles of the type, as `loadModTiles` does. Its issues become findings with their own level and source. When the type failed, the collection is not loaded: it could not be validated.

The order of the steps is the order of the findings, so the range finding comes right after the mod file's, as in the stage bar.

The engine already has every piece: the loader, the tile functions and the range matching. It has no DOM dependency, so a Node script can import it. `mod_launch.ts` exports the tile selection it uses (`selectModTiles(collection, validator)`), so the bundle check and `loadModTiles` share it, and `loadMod` gets a sibling in `src/lib/mod/`, `loadModCode(modFile, options)`, so the entrypoint can be its own step.

*Alternatives:* (a) the bundle check in `src/lib/mod/` with the API version passed in. Rejected: it would also need the tile functions and the engine's tile selection, and the mod library would grow a dependency on the tile library only for this. (b) Moving `mod_api_version.ts` out of the engine. Rejected: the version describes the engine's API, and nothing else needs it outside the engine.

### One launch builder for opening and checking

`prepareModLaunch` is split: it resolves, loads the mod and the link's tiles, then calls a new `buildModLaunch(mod, link, modTiles, appOrigin)`, which grants the permissions and builds the policy, the frame document, the context and the issues. A check calls `buildModLaunch` with the bundle check's mod and tiles and a link with no params. So the check frame gets the content policy, the permissions and the mount context the mod would get if it were opened, without loading anything twice.

### The report is built by one pure function

`src/lib/core/engine/mod_check_report.ts` holds `ModCheckFinding` (`step`, `level`, `source`, `message`), `ModCheckReport` and `buildModCheckReport(source, findings, mountChecked)`, which sets `status` from the levels. The report is plain data: strings, booleans and an array of plain objects.

### `mods.check` asks the stage, like `mods.open`

`MODS_METHODS` gets `"mods.check"`. The handler reads `mod` (required) and `collection` (absent, `null` or a non-empty string), and then:

- resolves the reference against the app's address;
- runs `checkModAccess`, so the `open` grant and the switched-off list are checked before any request;
- calls a new `ModMethodContext.onCheckMod({ source, collection })`.

`onCheckMod` returns `null` when the sandbox is not the visible one. The handler then raises `-32002` with `mods.check: only the visible mod can check mods`. Otherwise it returns the report's promise, and the handler answers with the report.

The param reading shares `readOpenCollection` with `mods.open`, which gets the method name as an argument, so both messages name their own method.

### The stage runs a check outside its sandboxes

`src/lib/core/stage/stage_checks.ts` holds a `StageCheck`: an id, the requesting sandbox's id, the launch, the session, the findings so far, the timers and the report's resolver. The stage keeps them in `stage.checks`, apart from `state.sandboxes` and `runtimes`. So a check has no history entry, no sandbox snapshot and no stage bar item, and it never goes through the `asking` status or the mismatch dialog.

`checkStageMod(stage, requesterId, request)`:

1. returns `null` unless the requester is the visible sandbox;
2. resolves the collection location against the app's address, and runs `checkModBundle`;
3. when a finding is an error, resolves the report at once with `mountChecked` `false`. The entrypoint is never run;
4. otherwise builds the launch with `buildModLaunch`, adds the check to `stage.checks` and publishes. The snapshot gets `checks`: one `{ id, sandboxDocument, title }` per check.

The check ends when it settles, times out or is stopped. Its timers are cleared, its session is stopped, it is removed from `stage.checks`, the stage publishes and the report resolves with `mountChecked` `true`. Closing the requesting sandbox ends its checks at once, and their reports go nowhere because the requester's session is stopped.

### A hidden check frame in the page

`src/main/stage/CheckFrame.tsx` renders one frame per entry of `snapshot.checks`, from `StageView`, outside the list of sandboxes. It has the same `sandbox="allow-scripts"` and `srcdoc` as `SandboxFrame`. Its first `load` calls `attachCheckFrame(stage, id, window)`, and a later `load` calls `checkFrameLoadedAgain(stage, id)`. When the check ends, its entry leaves the snapshot and React removes the frame.

The frame is hidden by layout, not by `display: none`: it has the stage's size, sits behind the stage with `opacity: 0` and `pointer-events: none`, and has `inert` and `aria-hidden="true"`. Browsers may throttle animation frames in a frame that is not rendered, and a mod that measures its layout or waits for an animation frame while mounting would then hang or see a size of zero. `inert` keeps the mod from taking the focus away from the viewer.

*Alternative:* `display: none`, or a frame of zero size. Rejected for the reason above. An e2e test checks a mod whose `mount` awaits `requestAnimationFrame`.

### The frame loader reports a finished mount

`sandbox_loader.js` sends a new notification, `sandbox.mounted`, when the mod's `mount` resolves. `sandbox_messages.ts` gets `SANDBOX_MOUNTED_METHOD`. The session calls a new optional `ModSessionOptions.onMounted` for it, and for `sandbox.mountFailed` after reporting the failure. So "the mount finished" means either one. Running sandboxes pass no `onMounted`, and they behave as before.

`sandbox.*` notifications are the loader's protocol, not the mod API: the surface guard does not record them, and they need no bump.

### Settle time and limit

`attachCheckFrame` connects the session and starts the 10-second limit. `onMounted` clears it and starts the 1-second settle time, after which the check ends. When the limit fires first, the check adds a `mount` error, `The mod's mount did not finish within 10 seconds.`, and ends. The two durations are constants of `stage_checks.ts`. Unit tests use Vitest's fake timers.

### What the check session records

The check connects its session with `connectModSession` and its own options:

- `storage`: a new `createMemoryStorage()` from `src/lib/core/storage/`, one per check. It starts empty and is dropped with the check, and the session never sees the stage's storage. `src/test/memory_storage.ts` re-exports it and keeps its failing variants, so there is one `Map`-backed storage.
- `onIssue`: every issue (a mount failure, blocked requests and dialogs) becomes a `mount` finding with the issue's level, source and message.
- `onErrorResponse`, a new optional session option: the session calls it with the request's method (or `null` for a message that is not a request) and the error, for every error response it sends. The check keeps `-32600`, `-32601` and `-32602` as `mount` errors whose message names the method and holds the response's message.
- `onOpenLink`: records a `mount` warning naming `mods.open`, and returns `false`, so the handler answers `-32002`.
- `onRequestAction`: records a `mount` warning naming the action's method (`links.open`, `files.save` or `ui.confirm`, from the action's `kind`), and returns `Promise.resolve(false)`, as if the user cancelled.
- `onCheckMod`: records a `mount` warning naming `mods.check`, and returns `null`, so the handler answers `-32002`.

`checkFrameLoadedAgain` adds a `mount` error with the stage's message for a mod that left its page, and ends the check.

*Alternative:* a "check mode" flag in the session that answers the requests that need the user itself. Rejected: the session would then know about checks, and the stage already decides how each of these requests is answered.

### The mod viewer

`public/default_mods/mod_viewer/main.js` gets a "Check mod" button next to the run buttons, only in the view of a mod. It sends `mods.check` with the viewed mod's source, and with the collection field's value when the field holds a full address (the same rule as "Run with this collection"). While the request runs, the button is disabled and a `role="status"` message says that the mod is being checked. The report is shown with the viewer's existing builders: a badge for the status (`success`, `warning` or `destructive`) and one list item per finding with its step, level, source and message. A failed request shows the error with the existing alert. The viewer's styles stay layout only.

### Tests mirror the specs

Unit tests:
- `mod_bundle_check.test.ts` for the steps and their order, on the fixture `book_list` mod and the test mods of `src/test/sample_mods.ts`;
- `mod_check_report.test.ts` for the status and the plain data;
- `mods_methods.test.ts` for the params, the grant, the switched-off list and the visible rule;
- `stage_checks.test.ts` for the flow, with a fake frame that plays the loader by sending `sandbox.mounted`, `sandbox.mountFailed` and requests through the mod's port.

e2e tests in `e2e/mod_check.spec.ts`, with one `describe` per requirement of `mod-check`:
- the real mount, the hidden frame, the throwaway slot and the stage left unchanged;
- one test that checks the shipped sample and each default mod through a probe mod with `open` for `"*"`, and expects `"pass"`.

The viewer's tests go into `e2e/default_mods.spec.ts`, under the two new requirement names. New test mods are added to `src/test/sample_mods.ts`, `e2e/sample_mod.ts` and `e2e/mod_routes.ts`.

### The version bump

`MOD_API_VERSION` becomes `0.1.1`. The surface guard gets a `"0.1.1"` entry: the `0.1.0` entry plus `mods.check`. The other places that name the current version follow (see proposal.md - Impact).

## Risks / Trade-offs

- [The browser may still throttle a frame with `opacity: 0`] → The e2e test with a mount that awaits `requestAnimationFrame` shows it. A mod that hangs there gets the 10-second error, which names the mount, not a crash.
- [The mod's code can reach the loader and send `sandbox.mounted` early] → It only shortens its own check. The notification grants nothing, and the mod could already end its `mount` at any time.
- [Only the first second after `mount` is watched] → The report covers starting the mod, not running it, and the docs say so. Mod tests (`add-mod-tests`) will cover running.
- [A check loads every file again, and a mod at another origin is fetched from its site] → The same requests opening the mod would make. The `open` grant is checked first.
- [Several checks at once] → Each has its own frame, slot and timers. The viewer disables its button while a check runs, and every check ends within about 11 seconds.
- [Splitting `prepareModLaunch` and `loadMod` touches the launch path of every mod] → The split moves code without changing it, and the existing launch tests must pass unchanged before the check is added.
