# Stage Module

## Introduction

The stage opens mods from shareable links, each in its own sandbox, and navigates between them and the app's pages like pages of one site. Several sandboxes stay open at once, and at most one is visible: none while a page is shown. The browser's back and forward buttons return to a page, or to a sandbox in the state it was left in, and a close button (×) closes a sandbox. Mods never own a route: they are values of the link's parameters.

The stage is the only owner of the browser history. It sees the app's sections as plain data (`StageOptions.routing`): which ids are page sections, what Home is, and the mod link of each mod section. It never sees the sidebar, its icons or the markdown of a page.

### Routes

An address hash is one of three routes:

- **Run link**: `#/run?mod=…` with a non-empty `mod`, or `#/run?mosaic=…` with a non-empty `mosaic`, opens a sandbox (below). `#/run?mosaic=` is Home.
- **Page**: `#/<section>` shows the index page of a page section, and `#/<section>/<page>` its page named `<page>`. `<section>` must be one of `routing.pageSections`, and `<page>` must match `[A-Za-z0-9_-]+`. The name is checked on the raw hash, before anything is built from it, so `..`, `/` and their encoded forms (`#/guides/..%2Fabout%2Findex`) never get through. The Home section's index page has the address `#/`, and `#/home` means the same.
- **Home**: every other hash, including `""`, `#/` and old links such as `#/mods/view`. Home is `routing.home`: the index page of a page section (the vanilla app), or a mod. A Home mod opens at `#/` in a sandbox like any other mod, without a close button.

What a page shows is up to the app (`src/main/pages/`): the stage only records which page an entry shows.

### Run links

A run link's address hash is:

```
#/run?mod=<reference>&collection=<location>&<params>
#/run?mod=<reference>&tile=<location>&<params>
#/run?mosaic=<reference>&<params>
```

- `mod` is a mod reference (see the [mod module](../../mod/README.md)): a default mod name such as `mod_viewer`, a folder or a mod file.
- `collection` is the optional reference of a collection: the collection file, or a folder, which means the `collection.yaml` in it (`collection=./samples/tiles/literature_nobel_laureates` reads `./samples/tiles/literature_nobel_laureates/collection.yaml`, see the [tile module](../../tile/README.md#collection-loader)).
- `tile` is the optional location of one tile file. The mod gets it as the tiles of a collection holding only that tile, validated with the mod's tile type as a collection's tiles are, and no collection file is requested. A tile opens the same way whether collections list it or not.
- Without a `collection` or a `tile`, the mod gets no tiles. An empty `collection` or `tile` is the same as none.
- A link has a collection or a tile, not both. A link with both opens a sandbox that shows `A link cannot have both a collection and a tile.`, requests no file and starts no frame (`RunLinkConflictError`, see [Messages and load failures](#messages-and-load-failures)).
- `mosaic` is a mosaic reference (see the [mosaic module](../../mosaic/README.md#mosaic-references)): a mosaic file, or a folder, which means the `mosaic.yaml` in it. The stage loads the mosaic file, then opens its mod with its collection as a link with that `mod` and `collection` would, with the mosaic's config, aliases and `show` permissions (see the [engine module](../engine/README.md#launch)). The address stays the mosaic link: it never shows the mod or the collection the file names.
- A link to a mosaic has no `mod`, `collection` or `tile`. A link with a non-empty `mosaic` and any of them opens a sandbox that shows `A link to a mosaic cannot also have a mod, a collection or a tile.`, requests no file and starts no frame (`MosaicLinkConflictError`).
- Every other parameter is passed to the mod as `context.params`, in link order, with the first value of a repeated key. `mod`, `collection`, `tile` and `mosaic` are reserved: they are never in `params`. The engine's `RUN_LINK_RESERVED_NAMES` lists them, and `mods.open` and `mosaics.open` refuse them in their `params`.
- Values are percent-encoded, and relative ones are resolved against the app's address when the mod is launched. So a link means the same in the address bar, in a `mods.open` request and after a reload, also under a sub-path such as GitHub Pages' `/<repo>/`.

Examples, for an app at `https://example.org/`:

| Address hash | Opens |
|---|---|
| `#/` | Home (the Home page in the vanilla app) |
| `#/guides/first_steps` | the page `first_steps` of the Guides section |
| `#/run?mod=mod_explorer` | the mod explorer |
| `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml` | the sample mod with the sample books |
| `#/run?mod=./samples/mods/book_list` | the sample mod without tiles |
| `#/run?mod=./samples/mods/book_list&tile=./samples/mods/book_list/books/kallocain.md` | the sample mod with the one book `kallocain.md` |
| `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` | the mod viewer, showing the sample mod |
| `#/run?mod=./samples/mods/country_map&collection=./samples/tiles/literature_nobel_laureates` | the country map with the collection file `./samples/tiles/literature_nobel_laureates/collection.yaml` |
| `#/run?mosaic=./samples/mosaics/nobel_map.yaml&from=x` | the mosaic's mod with its collection, and `params` `{ "from": "x" }` |
| `#/run?mosaic=./samples/mosaics/nobel_map` | the mosaic file `./samples/mosaics/nobel_map/mosaic.yaml` |
| `#/run?mosaic=./samples/mosaics/nobel_map.yaml&mod=mod_viewer` | an error: a link to a mosaic cannot also have a mod |
| `#/run?mosaic=` | Home |

`buildRunLink` writes `mosaic` when present, `mod` unless it is the empty `mod` of a mosaic link, then `collection` and `tile` when present, then the params. A mosaic link is the `RunLink` `{ mod: "", collection: null, tile: null, mosaic, params }`. Mods never build these addresses. A mod sends `mods.open` with `{ mod, collection, tile, params, replace }`, or `mosaics.open` with `{ mosaic, params, replace }`, and the stage turns it into the run link.

### Sandboxes and their ids

Each sandbox gets an id from the stage, `sandbox-1`, `sandbox-2`, …, unique in the page. Mods never choose ids. Sandboxes are kept in creation order, so rendering never moves a frame (moving an iframe in the DOM reloads it).

Each sandbox records its link, its hash, its section, whether it is the Home mod, and its opener: the sandbox whose mod opened it with `mods.open`, or none for a link the user followed or a section opened.

### What is visible

Opening a link, whether the user followed it or a mod asked for it, creates a new sandbox and hides the visible one without stopping it, unless the mod asked to replace itself (see [Replacing a sandbox](#replacing-a-sandbox)). Showing a page hides the visible sandbox the same way. At most one sandbox is visible, and none while a page is shown. Only the visible mod can open mods or ask the user for an action: a mod hidden behind a page can do neither.

### History entries and positions

Each entry points to a view: a sandbox, or a page of a page section. Pages and sandboxes share one history, so back and forward move between them. Several entries may point to one sandbox. The stage stores the entry's position and section in its state, `{ opentesela: { position, section } }`, and keeps a list of entries that maps each position to its view and section. The browser keeps that state across reloads. A missing or invalid `section` (anything but a non-empty string) reads as `null`.

- **First load, a typed address, or a link followed in the page**: the entry has no stage state. Its page is shown, or its link opens in a new sandbox, at the next position, and the entry is replaced with the position and section in its state, and with the canonical address (`#/` for Home). On the very first load the position is `0`.
- **Back and forward**: the entry has a position. When its view is a page, or a sandbox that is still open, it is shown again, the sandbox in the state it was left in. Otherwise (after a reload, or when its sandbox was closed) the address's page is shown, or its link opens in a new sandbox that takes the entry, with the stored section.
- **`mods.open`**: a new sandbox at the next position, in the opener's section, with a pushed entry whose address is the run link. With `replace`, the new sandbox takes the current entry instead, whose address becomes the run link (see below).
- **A section** (`openStageSection`): a pushed entry, see below.

### Opening after going back

When a link, a page or a section opens while the current entry is not the last one, the forward entries are dropped, pages included, as a browser drops them. Every sandbox that no remaining entry points to is closed: its mod is stopped and its frame removed.

### Sections and tab-bar navigation

Every entry belongs to one section or to none, and the snapshot's `activeSection` is the current entry's section:

- A section opened with `openStageSection` sets it.
- `mods.open` copies the opener's section, so a viewer opened by the explorer stays in Mods.
- A typed address or a followed link: a page belongs to its section, the Home mod to the Home section, and a run link to the first section whose mod link it exactly equals (same `mod`, `collection`, `tile` and params, with a section link written without `tile` equal to a link whose `tile` is `null`), or to none. `#/run?mod=mod_explorer` is in Mods; `#/run?mod=./samples/mods/book_list` is in no section.
- An entry with stage state keeps its stored section, so membership survives a reload.

`openStageSection(stage, section)` works like a tab bar. The stage remembers, for each section, its **root** (the sandbox of the section's own mod link that no mod opened: the one the section opened, or after a reload the restored one with that link) and its **last** view (the view of the latest entry shown in the section). This memory is derived from what is shown and never stored. A closed sandbox is cleared from it. Activating a section pushes an entry, in that section, that shows:

- the section's last view, when the user comes from another section and there is one;
- otherwise the section's start: the index page of a page section; for a mod section, its root while it is open, or a new sandbox for its link, which becomes the root. The Home section's mod opens at `#/` as the Home mod.

So repeated visits to Mods keep one explorer, Mods shows the viewer where the user left it, and activating Mods while in Mods returns to the explorer. No frame is reloaded: the new entry points to the open sandbox. After a reload the memory is empty, so the worst case is the section's start.

### Replacing a sandbox

`mods.open` with `replace: true` opens the link in place of the requesting sandbox, so that stepping through tiles turns pages instead of piling up history entries and frames. `openStageLink(stage, link, openerId, { replace: true })` applies `replaceStageEntry`, one pure transition of `stage_state.ts`:

1. the new sandbox gets the requester's opener and the current entry's section;
2. the current entry, at the same position and with the same section, points to it, and is written with `writeStageEntry("replace")` and the new run link;
3. the requester is closed, as `closeSandbox` closes one: its session is stopped, its frame removed, its actions dropped without acting and its checks ended.

No entry is added and forward entries are kept. Other entries that pointed to the requester stay, and open their link again when visited, as after any close. Back goes to what was shown before the requester, and closing the new sandbox shows the requester's opener when it is still open, or Home.

The section memory needs no rule of its own: the closed requester is cleared from it, then the new sandbox becomes the section's last view, so coming back to the section shows it. A replaced root leaves the section without a root, so its start opens again, as after closing a root.

The requester's session is stopped before `onOpenLink` returns, so its request gets no answer. Replacing is refused with `"home-mod"` for the Home mod at `#/` (the engine answers `-32002`), and with `"not-visible"`, like any `mods.open`, for a sandbox that is not the visible one. Nothing is opened then.

### Closing

The stage bar has × for the visible sandbox, except for the Home mod opened at `#/`. Closing stops the mod and removes its frame, then shows the sandbox that opened it when it is still open, or Home otherwise: the Home page, or a new Home mod sandbox, in the Home section. The current history entry is replaced with the address of what is shown. Other entries that pointed to the closed sandbox stay, and open their link again when visited.

### Messages and load failures

Each sandbox keeps its own messages, which the stage bar shows for the visible sandbox (see the [main module](../../../main/README.md#page-layout)). `stage_messages.ts` defines them:

- **Levels** (`MessageLevel`): `error`, `warning` and `info`. `info` is a notification. It exists only in the stage: `ModIssue`, the mount context's `issues`, `tiles.changed` and the check's findings keep the issue levels `error` and `warning`, so a mod never receives `info`.
- **Producers** (`MessageProducer`): `app` for everything the app found or tells, and `mod` for the mod's own `ui.notify` messages (see the [engine module](../engine/README.md#telling-the-user-something)). The producer is set by the stage, never by the mod.
- **Order**: mod file issues (the warning of a mod that declares no `api` range), tile collection issues, tile link issues (the links left out of the policy, see [Media linked by tiles](../sandbox/README.md#media-linked-by-tiles)), then the arrival list: permission issues, the site consent notification, the loaded collection notification, then whatever arrives while the sandbox lives (blocked requests, mount failures, a stopped mod, load failures, reload notifications and the mod's messages), in order. `readSandboxMessages` joins the four groups in that order. The stage bar shows each level newest first, by id (see the [main module](../../../main/README.md#the-stage-bar)).
- **Ids**: each message gets an id from its sandbox when it is added, `1`, `2`, …, so a newer message has a higher id. "Reload tiles" replaces the collection and tile link issues with new messages, with new ids, so they are unread again.
- **Read state**: messages start unread, including the ones a sandbox had when it was first shown. `markMessagesRead(stage, sandboxId, level)` adds the ids of every message of that level to the sandbox's read ids, which the page calls when the user opens a level's popover, and again when it closes, for the messages that arrived while it was open. Read state is a set of ids, not a mark per level, because reloaded collection messages come before the arrival list.
- **Dismissing**: only `info` messages can be dismissed, and they only live in the arrival list. `dismissMessage(stage, sandboxId, messageId)` removes one, and `clearNotifications(stage, sandboxId)` removes them all and leaves the errors and warnings. An unknown sandbox or message id, or an error or warning, changes nothing.
- **The mod's cap**: a sandbox keeps at most 100 messages from its mod for each level (`MAX_MOD_MESSAGES`), so 300 at most. A new one past the cap of its level removes the oldest message from the mod of that level and counts it in `droppedModMessages` for that level. So many notifications never push out the mod's errors or warnings, and messages from the app are never removed.

Every message stays in memory only: a page reload or a new sandbox starts again with none.

When the mosaic file, the mod file, its entrypoint, its tile type file, the collection or the tile cannot be loaded, a link names a switched-off default mod, a link has both a collection and a tile, or a link to a mosaic also has a mod, a collection or a tile, the sandbox shows the error and no frame, and keeps its history entry and its ×. A mosaic file that cannot be loaded, or does not follow the mosaic file format, requests neither the mod nor the collection. The same error is an `error` message from the app, whose text is the error's message. Its source is:

- the file that failed, for the errors that name one (`FileFetchError`, `MarkdownParseError`, `YamlParseError`, `ModFormatError`, `MosaicFormatError`, `CollectionFormatError`, `TileTypeError`): the mosaic file, the mod file, the entrypoint, the tile type file, the collection or the tile;
- the link's mosaic reference resolved against the app's address, for a link to a mosaic that also has a mod, a collection or a tile (`MosaicLinkConflictError`);
- otherwise the loaded mod's source, for a cancelled mod API question, or the link's mod reference resolved against the app's address, for a switched-off default mod or a link with both a collection and a tile.

The stage bar shows a mosaic's title before the mod's name once the mosaic file is loaded, and "Loading mosaic…" or "Mosaic not loaded" before (see the [stage bar](../../../main/README.md#the-stage-bar)), from the snapshot's `mosaicReference` and `mosaic`.

The runtime keeps the mosaic once its mosaic file is loaded (`loadLaunchMosaic`), then the mod once its mod file is loaded (`loadLaunchMod`, with the request `expandMosaicRequest` gives for a mosaic, then `loadLaunchTiles` for the collection or the tile, see the [engine module](../engine/README.md#launch)). So the snapshot's `mosaic` is set after a failure of the mosaic's mod, and its `mod` after a later failure, such as a missing collection or a cancelled mod API question. Each stays `null` when its own file did not load. Once the mosaic is loaded, the snapshot's `modReference` and `collection` are the mosaic's mod and collection.

The app adds three notifications, each an `info` message from the app:

| When | Source | Text |
|---|---|---|
| A mod opened with a collection or a tile starts | The collection or the tile | `Loaded the collection: the mod received 3 tiles.` |
| "Reload tiles" loaded the collection or the tile again | The collection or the tile | `Reloaded the tiles: the mod received 2 tiles, with 0 collection issues.` |
| The user answered the site consent question | The mod's source | `Allowed the mod to show content from https://upload.wikimedia.org. Refused to let the mod exchange data with https://api.example.net. The answer is remembered.` |

The counts say `1 tile` and `1 collection issue` in the singular, so a mod opened with a tile gets `1 tile`, or `0 tiles` when the tile is not of its type. The site consent notification lists the allowed lines, then the refused ones, each as its category's verb and its host, leaves out a part with no line, and ends with `The answer is remembered.` or `The answer is not remembered.`. Escape refuses every line and is not remembered. The site consent notification is built with the answer and passed to the start, because the start resets the arrival list to the launch's issues.

"Reload tiles", for a sandbox opened with a collection or a tile, loads and validates the collection or the tile again (for a mosaic, with the tiles renamed by the mosaic's aliases before they are validated, and without requesting the mosaic file again: the config, the aliases and the grants stay those of the start), pushes `tiles.changed` to the running mod and replaces the collection issues. The launch's `tilesKind` and `tilesSource` say which file to load. The mod file issues stay. A reload whose collection or tile cannot be loaded makes that error the only collection issue, adds no notification and pushes nothing, so the mod keeps its tiles. A sandbox opened without a collection or a tile has no "Reload tiles" (`canReloadTiles` is `false`).

The files the tiles link are fixed in the frame's policy when the mod starts. When "Load media linked by tiles" was on as the mod started, a reload also replaces the tile link issues: it collects the links of the reloaded tiles against the launch's content hosts and granted permissions, and lists, in order:

1. when the reloaded tiles link files the launch's policy does not allow, one warning whose source is the collection or the tile: `The reloaded tiles link 1 file that this mod does not allow yet. Open the mod again to show it.`, or `The reloaded tiles link 3 files that this mod does not allow yet. Open the mod again to show them.`;
2. the left-out links of the reloaded tiles, so a link no longer in the tiles stops being reported.

Each reload compares against the launch, not the previous reload, since the frame keeps the launch's policy. When the collection cannot be loaded, the tile link issues stay as they were. Opening the mod again builds a new policy with the new links.

### Questions before a mod starts

A sandbox can ask the user up to two questions once its mod and its collection are loaded (`loadLaunchMod` and `loadLaunchTiles`, see the [engine module](../engine/README.md#launch)), always in this order, and before its frame exists:

1. **The mod API question**, when the mod's `api` range does not match the app's mod API version (see the [engine module](../engine/README.md#mod-api-version)).
2. **The site consent question**, when the mod comes from another origin than the app and declares permissions with no remembered decision for it (`listConsentLines`, see the [permissions module](../permissions/README.md)).

While it asks, the runtime is `asking`, with the loaded mod kept as its `pending` inputs and its `question` (`"api"` or `"sites"`), so the stage bar shows the mod's title, version and source, but the snapshot has no frame document. Its launch is built only when the mod starts, with `grantModPermissions` over the remembered decisions and the answers, so the frame's policy is final from the start. A mod with nothing to ask starts at once.

- The snapshot's `apiMismatch` holds the mod's `range` and the app's `apiVersion` while the sandbox asks the mod API question, and its `siteConsent` holds the `lines` (`key`, `category`, `host`, `reason`, in the order declared) while it asks the site consent question. At most one of them is set, and the page shows the matching dialog for the visible sandbox (see the [main module](../../../main/README.md)).
- `answerApiMismatch(stage, sandboxId, runAnyway)` answers the first. "Run anyway" goes on to the site consent question, or starts the mod when there is nothing to ask. "Cancel" fails the sandbox with an error naming the range and the mod API version, and no frame; it keeps its history entry and its ×, and the site consent question is never asked.
- `answerSiteConsent(stage, sandboxId, answer)` answers the second and starts the mod. `answer` is a `SiteConsentAnswer` (`allowed`, the keys of the checked lines, and `remember`), or `null` for Escape. The lines in `allowed` are granted and the others refused. With `remember`, one decision per line, allowed or refused, is passed to `StageOptions.rememberSiteDecisions`. `null` refuses every line and remembers nothing.
- Only the visible sandbox, while it is still asking that question, can be answered, so a late or repeated answer does nothing.
- The questions are derived from the snapshot, not queued: going back hides the sandbox, and so its question, and the mod stays unstarted; going forward to the same entry asks again. Closing the sandbox stops its runtime, which ignores any answer.
- Nothing remembers the mod API answer: a reload of the page, the same link opened again or a `mods.open` creates a new sandbox, which asks again. A remembered site decision is read again by every later launch, so removing it in Settings asks again the next time, and running mods keep their policy.
- A mod whose files cannot be loaded fails as before, without a question.

### Actions the user answers

A mod asks the app to open a link, save a file or confirm something with `links.open`, `files.save` and `ui.confirm` (see the [engine module](../engine/README.md)). The engine checks the params into an action, and the stage queues it until the user answers in the page's action dialog.

- Only the visible sandbox, while its mod is running, can ask. Any other gets no queued action, and the engine answers `-32002`.
- The stage has one queue, oldest first. The snapshot's `action` is the oldest one, with the asking mod's title and source, and later ones wait their turn, so the page shows one dialog at a time.
- Each queued action has an id from the stage, `1`, `2`, …, and the page answers the id it shows, so a double click or a late answer cannot answer the next action. An unknown id does nothing.
- After every stage change (back, forward, a followed or opened link, a close) and when a mod navigates its frame, every action whose sandbox is no longer visible or no longer running is removed and answers `false`. A stopped mod's session drops that answer, so the mod gets none.

### Mod checks

A mod asks the stage to check another mod with `mods.check` (see the [engine module](../engine/README.md#inspecting-and-opening-mods)). Only the visible sandbox can ask: for any other, `checkStageMod` returns `null` and the engine answers `-32002`.

- The stage runs the bundle check first (`checkModBundle`). With an error finding, or when the requester stopped running meanwhile, the report resolves at once with `mountChecked` `false`, and the mod's code is never run.
- Otherwise it builds the launch with `buildModLaunch`, as opening the mod would, with the bundle check's mod and tiles and no params, and adds a check to `stage.checks`. Checks are kept apart from `state.sandboxes`, `runtimes` and the history: a check has no history entry, no sandbox snapshot and no stage bar item, it never changes the address, the visible sandbox or its messages, and it never becomes `asking`. A mod written for another API is mounted without a question: its range is a bundle warning in the report. A mod from another origin is mounted with the permissions the remembered decisions allow (`StageOptions.readSiteDecisions`) and the others denied, without the site consent question.
- A check runs one frame at a time: the mount check's, then, for a mod with tests, a list frame and one frame per case (see [Tests of a check](#tests-of-a-check)). Each frame has a `key` that changes for each new frame. The snapshot's `checks` lists one `{ id, key, sandboxDocument, title }` per check that runs a frame now; a check that is fetching its test file runs none, and is left out. The page renders a hidden frame for each, outside the sandboxes, keyed by `key`, so each frame of a check is a new iframe with a fresh page. It calls `attachCheckFrame(stage, id, key, frameTarget)` on the frame's first `load` and `checkFrameLoadedAgain(stage, id, key)` on any later one. Both ignore a key that is not the check's frame now, so the late `load` of a replaced frame changes nothing.
- `attachCheckFrame` connects the frame's session with a throwaway slot (`createMemoryStorage()`, one per frame, dropped with it; the stage's storage is never read nor written) and the current theme, and starts the frame's limit. For the mount check's frame, the limit is `CHECK_MOUNT_LIMIT_MS`, 10 seconds. When `mount` finishes (`sandbox.mounted`, or `sandbox.mountFailed`), the limit is cleared and the settle time starts: `CHECK_SETTLE_MS`, 1 second, after which the mount check ends. When the limit fires first, the check gets the `mount` error `The mod's mount did not finish within 10 seconds.` and ends. Only these first seconds of the mounted mod are watched.
- While it runs, the check records `mount` findings: every issue of its session (a mount failure, blocked requests and dialogs), each request answered with `-32600`, `-32601` or `-32602`, the requests that would need the user, and the mod's `ui.notify` errors and warnings. `links.open`, `files.save` and `ui.confirm` resolve with `false` as if the user cancelled, `mods.open` and `mods.check` are refused with `-32002`, and each is a warning naming the method. No action is queued, so no dialog is shown. `ui.notify` resolves with `null`, and is not a request that needs the user: a notification with level `error` or `warning` is a finding at that level, with the notification's source and text as its source and message, and `info` is none. Nothing reaches a stage bar.
- A mount check frame that loads again ends its check with the `mount` error `The mod left its page and was stopped.`
- A mount check without an error, for a mod with `test_path` whose requester still runs, goes on with the mod's tests. Otherwise the check ends after it.
- A check ends after its mount check or its last case, when a limit fires, when its mount check frame or list frame loads again, or when its requester is closed. Its frame's timers are cleared, its session is stopped, it leaves `stage.checks` so the page removes its frame, and the report resolves with `mountChecked` `true`, and `testsChecked` `true` once the cases started. The report of a closed requester goes nowhere, since its session is stopped.
- Checks get no `theme.changed`: each frame lasts at most about 11 seconds. Their frames are never shown, so their mount context's `layout` is always `"contained"`, and they get no `layout.changed`.

#### Tests of a check

The mod's tests (see the [guide to writing mod tests](../../../mod_plugin_spec.md#mod-tests)) run in the same check, after the mount check:

1. **Fetch**: the mount check's frame is removed, and `loadModTestCode` fetches the test file. Only now is it requested: never when the mod is opened or inspected, nor when a bundle or mount error ends the check first. A test file that cannot be loaded is a `test` error whose source is the test file and whose message is the load error's, and the check ends with `testsChecked` `false`.
2. **List**: a frame with `buildModTestDocument(launch)` (the mod's content policy and theme, with the test runner) is connected with `test: { code, caseName: null }`. It reports the case names (`sandbox.testsListed`), or why there are none (`sandbox.testsFailed`), which is the `test` error `The tests could not be listed: <message>`, after which no case runs and the check ends. An empty list of names is the same error. When the list frame does not report within `CHECK_CASE_LIMIT_MS`, the check gets the `test` error `The test file did not register its tests within 10 seconds.` and ends.
3. **Cases**: one frame per name, in order, each with a new key, so a new iframe, and a new throwaway slot: nothing a case does is seen by another case, or by the mod's real slot. Each is connected with `test: { code, caseName }` and runs until `sandbox.caseFinished`, or for at most `CHECK_CASE_LIMIT_MS`, 10 seconds from its frame's first `load`, after which it fails with `The test did not finish within 10 seconds.` A case frame that loads again fails with `The mod left its page and was stopped.` A failing case does not stop the others. When a case ends, its frame is removed and the next one starts; after the last one, the check ends.

The case logic lives in `stage_check_cases.ts`:

- **Answer queues**: each case keeps one queue per method. `sandbox.answerQueued` adds the case's scripted answer to it. `links.open`, `files.save` and `ui.confirm` resolve with the oldest queued answer, or with `false` without one. `mods.open` answers `null` with a queued answer, and nothing opens, or `-32002` without one. `mods.check` is refused with `-32002`. None of them adds a finding, and no action is queued, so no dialog is shown. The engine checks the params before the case's callbacks run, so a `links.open` with a bad URL (`-32602`) leaves its queued answer for the next one. The notification and the mod's later request travel on the same port, and the handlers reach the callbacks without awaiting anything first, so the answers are used in the order the requests arrive.
- **`test` findings**: what the mount check records as `mount` findings becomes a `test` finding with the same level and source and a message prefixed with `In the test "<name>": `: blocked requests and dialogs, and each request answered with `-32600`, `-32601` or `-32602`. A failing `mount` is not a finding, since the case's `mount` call rejects with it. A `ui.notify` resolves with `null` and is no finding, whatever its level: the case reads it from `requests`, which records every request with its result. A failed case adds, after its own findings, the `test` error `The test "<name>" failed: <message>`, whose source is the test file.
- **Results**: each case gives `{ name, status, message }`, kept in order for the report's `tests`.

### The theme

The stage keeps the app's current theme, built from the resolved color scheme (see the [theme module](../theme/README.md)). It does not know where the color scheme comes from: the app tells it with `changeStageColorScheme`.

The stage learns "Load media linked by tiles" the same way: `StageOptions.loadsTileLinkedMedia` is the start value, and the app calls `changeStageTileLinkedMedia` when the user switches it. Each sandbox launch and each mod check reads the current value, so a change applies to mods opened or checked after it. Running sandboxes keep their launch and their frame, and the stage publishes nothing, since the snapshot does not change.

- A mod's session connects, on the frame's first `load`, with the theme current at that moment, so a mod opened while the color scheme changes mounts with the new one.
- When the color scheme changes, every running mod, visible or hidden, gets `theme.changed` once. A mod still loading gets nothing: it connects with the new theme. A change to the current color scheme pushes nothing.

### App catalog

The stage keeps the app's catalog (`StageOptions.catalog`, a `ResolvedAppCatalog` that `main.tsx` resolved and checked with `resolveAppCatalog`, see the [engine module](../engine/README.md#app-catalog)) and the value of "List the default mosaics of mods" (`StageOptions.catalogDefaultMosaics` is the start value). Every session, the running sandboxes' and the checks' alike, gets a `readCatalog` that builds the listing anew with `buildCatalogListing`, the catalog and the switch's current value, so `catalog.list` always answers the current catalog (see [Reading the catalog](../engine/README.md#reading-the-catalog)). A case that scripts `catalog.list` is answered with its own catalog instead (see [Tests of a check](#tests-of-a-check)).

Unlike "Load media linked by tiles", the switch reaches running mods. The app calls `changeStageCatalogDefaultMosaics` when the user switches it:

- It stores the value, so every `catalog.list` from then on answers with it.
- It builds the listing once and pushes `catalog.changed` with it to every running mod, visible or hidden, with no frame reloaded (`pushSandboxCatalog`). A mod still loading gets nothing: it reads the catalog with `catalog.list` once it runs.
- Each change counts on `stage.catalogGeneration`. A listing that finished after a newer change is dropped, so two quick changes leave the mods on the second one's catalog.

### Frame layout

Each mod frame has a layout, `contained`, `theater` or `fullscreen`, which mods get as `context.layout` and with `layout.changed` since mod API `0.1.9` (see the [engine module](../engine/README.md#frame-layout)). The stage keeps two facts, not a layout per sandbox:

- `stage.theaterMode`, whether theater mode is on. `StageOptions.theaterMode` is the start value, and the app calls `changeStageTheaterMode` when the user presses the stage bar's theater mode button. The snapshot's `isTheaterMode` follows it.
- `stage.fullscreenSandboxId`, the sandbox whose frame is the app page's fullscreen element, or `null`. The page calls `changeStageFullscreen` on each `fullscreenchange`, whoever started it. Closing that sandbox clears it.

The stage bar's right side is, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button while the visible sandbox has a running mod frame, then, when the sandbox has a close button, a separator and × (see the [main module](../../../main/README.md#the-stage-bar)):

- **Theater mode** turns theater mode on or off for every running mod, visible or hidden, and the choice is remembered across reloads. It is shown for every visible sandbox, also while its mod loads or after it failed.
- **Fullscreen** shows the visible mod's frame fullscreen: the frame alone, without its border and rounded corners, and without the stage bar. The frame is not reloaded, and its layout becomes `fullscreen`. Esc, or the browser's own exit, leaves fullscreen and shows the frame under the stage bar again, in the layout theater mode gives it. A mod that shows one of its own elements fullscreen gets the `fullscreen` layout too, since the app page's fullscreen element is then its frame. When the browser refuses, as an app embedded without `allow="fullscreen"` or iOS Safari on iPhone does, the sandbox gets a `warning` from the app, "Fullscreen is not available: <the browser's reason>", whose source is the mod's source (`warnFullscreenRefused`), and the mod keeps running.

`readSandboxLayout(theaterMode, fullscreenSandboxId, sandboxId)` in `stage_layout.ts` reads a sandbox's layout from them: `fullscreen` when its id is the fullscreen one, otherwise `theater` or `contained`. Everything else follows from it:

- A mod's session connects, on the frame's first `load`, with the layout current at that moment, so a mod opened while theater mode is turned on mounts with `theater`.
- `changeStageTheaterMode` and `changeStageFullscreen` read every runtime's layout before and after the change, and push `layout.changed` only to the running mods whose layout changed, visible or hidden, once each. A fullscreen mod keeps its layout when theater mode is toggled, so it gets nothing. A mod still loading gets nothing: it connects with the new layout. Neither reloads a frame.
- Check frames always mount with `contained`.

### The frame size

The visible sandbox's frame fills the stage area: the page's width left beside the sidebar, and the viewport height left under the app header and the stage bar. It follows the window's size and the sidebar's width, and never depends on the mod's content: content taller than the frame scrolls inside the frame, not the page. The frame is at least 16rem tall; when less room is left, the page scrolls. It keeps this size in the `contained` and `theater` layouts alike: the content width limit is inside the frame (see [Frame layout](#frame-layout)). The layout lives in `src/main/app.css` and `src/main/stage/stage.css`.

## Module Details

Implemented in `src/lib/core/stage/`. Other modules import only from the public entry point `src/lib/core/stage/index.ts`.

### The stage files

The work behind the public API is split so each file has one reason to change:

| File | Owns |
|---|---|
| `stage_routes.ts` | Addresses: what a hash means (run link, page or Home), page addresses, and which section a link belongs to. The only file that calls the run link reader of `run_links.ts`. |
| `stage_history.ts` | History entries: the only file that calls `History` (`pushState`, `replaceState`), and reads and writes the stage's `{ position, section }`. |
| `stage_sections.ts` | The section memory: each section's root and last view. |
| `stage_sandboxes.ts` | The runtime of one sandbox: launch, frame, session, messages, reload and stop. |
| `stage_messages.ts` | The sandbox messages: `MessageLevel`, `MessageProducer`, `SandboxMessage`, and the pure functions that number them, mark a level read, dismiss notifications and add a mod message under the cap. |
| `stage_notifications.ts` | The texts of the app's notifications: the loaded collection, the reloaded tiles and the site consent answer. |
| `stage_actions.ts` | The queue of actions waiting for the user: add, show the oldest, answer by id, drop. |
| `stage_layout.ts` | The layout of a frame: `FrameLayout` and `readSandboxLayout`, a pure function of theater mode and the fullscreen sandbox. |
| `stage_checks.ts` | The mod checks: the bundle check, the check's phases and frames, the mount check's session and its answers, the settle time and the limits, fetching the test file, and ending a check. |
| `stage_check_cases.ts` | The tests of a check: the session hooks of list and case frames, the answer queues, the case results, the `test` findings and `CHECK_CASE_LIMIT_MS`. |
| `stage_controller.ts` | Connects them: applies each state change by writing history, starting and stopping runtimes, and publishing a snapshot. |

`stage_state.ts` holds the pure stage state (sandboxes, entries with their view and section, position): each function returns the new state with the sandboxes to open and close, and the controller applies them. All of these are browser-free apart from the `postMessage` targets and the `History` subset they receive, so they are tested in Node.

### Public API

- `createStage(options)`: builds a stage. `StageOptions` are `history` (the `state`, `pushState` and `replaceState` of `History`), `defaults` (`DefaultModSettings`), `routing` (below), `appOrigin`, `baseUrl` (the app's address), `storage` (`localStorage`), an optional `fetch`, `colorScheme`, the color scheme the app starts with, `loadsTileLinkedMedia`, whether "Load media linked by tiles" is on as the app starts, `catalog`, the app's `ResolvedAppCatalog`, `catalogDefaultMosaics`, whether "List the default mosaics of mods" is on as the app starts, `theaterMode`, whether theater mode is on as the app starts, `readSiteDecisions()`, which returns the remembered `SiteDecision` list and is read before each site consent question, each mod start, each mod check and each `mods.inspect`, and `rememberSiteDecisions(decisions)`, which keeps the decisions of an answer whose Remember was checked. The stage never touches `localStorage` for them.
- `followHistory(stage, hash, historyState)`: follows the current entry, on start and on each `popstate`.
- `openStageSection(stage, section)`: activates a section, as the sidebar does. Returns `false`, and does nothing, for an id that is neither a page section nor a mod section.
- `openStageLink(stage, link, openerId, options?)`: opens a `RunLink` a mod asked for, in a new sandbox, or with `options.replace` in place of the opener (see [Replacing a sandbox](#replacing-a-sandbox)). Returns the engine's `OpenLinkOutcome`: `"opened"`, `"not-visible"` when the opener is not the visible sandbox, or `"home-mod"` when it asks to replace the Home mod. The sessions call it through their `onOpenLink`.
- `closeSandbox(stage, id)`: the × button.
- `reloadTiles(stage, id)`: the "Reload tiles" button.
- `markMessagesRead(stage, sandboxId, level)`: marks every message of a level of a sandbox read, when its popover opens and when it closes. Does nothing for an unknown sandbox.
- `dismissMessage(stage, sandboxId, messageId)`: dismisses one notification. Errors, warnings, an unknown sandbox or an unknown id change nothing, and publish nothing.
- `clearNotifications(stage, sandboxId)`: dismisses every notification of a sandbox ("Clear all"). Does nothing for an unknown sandbox.
- `attachFrame(stage, id, frameTarget)`: on a frame's first `load`, connects its mod's session.
- `frameLoadedAgain(stage, id)`: on any later `load` of a frame: its mod navigated, so it is stopped with the issue `The mod left its page and was stopped.` and its frame removed.
- `attachCheckFrame(stage, id, key, frameTarget)`: on the first `load` of the check `id`'s frame `key`, connects its session and starts its 10-second limit. A key that is not the check's frame now is ignored.
- `checkFrameLoadedAgain(stage, id, key)`: on any later `load` of a check frame: the mount check and the listing end the check with an error, and a case fails, with `The mod left its page and was stopped.` A key that is not the check's frame now is ignored.
- `checkStageMod(stage, requesterId, request)`, not exported: checks the mod of a `ModCheckRequest` (`source`, `collection`) and resolves with its `ModCheckReport`, or returns `null` when the requester is not the visible sandbox. The sessions call it through their `onCheckMod`.
- `answerStageAction(stage, id, accepted)`: answers the action the page shows, so the mod's request resolves with `accepted` and the next action is shown. Does nothing for an unknown id.
- `answerApiMismatch(stage, sandboxId, runAnyway)`: answers the mod API question of the visible `asking` sandbox: `true` goes on to the site consent question or starts the mod, `false` fails the sandbox with the cancel error. Does nothing for a sandbox that is not visible or not asking it.
- `answerSiteConsent(stage, sandboxId, answer)`: answers the site consent question of the visible `asking` sandbox and starts the mod (see [Questions before a mod starts](#questions-before-a-mod-starts)). Does nothing for a sandbox that is not visible or not asking it.
- `requestStageAction(stage, sandboxId, action)`, not exported: queues an action and resolves with the user's answer, or returns `null` when the sandbox is not the visible one or not running. The sessions call it through their `onRequestAction`.
- `changeStageColorScheme(stage, colorScheme)`: switches the stage's theme and pushes `theme.changed` to every running mod, visible or hidden. Does nothing when the color scheme is the current one. The stage's current `Theme` is `stage.theme`.
- `changeStageTheaterMode(stage, isOn)`: turns theater mode on or off, pushes `layout.changed` to every running mod whose layout changed, visible or hidden, and publishes the snapshot. Does nothing when theater mode already is `isOn`.
- `changeStageFullscreen(stage, sandboxId)`: records the sandbox whose frame is fullscreen, or `null` for none, pushes `layout.changed` to the mods whose layout changed, and publishes the snapshot. Does nothing when it is already the one.
- `warnFullscreenRefused(stage, sandboxId, reason)`: adds the `warning` from the app that fullscreen is not available, with the browser's `reason`, to a sandbox, and publishes the snapshot. Does nothing for an unknown sandbox.
- `changeStageTileLinkedMedia(stage, isOn)`: switches "Load media linked by tiles" for the mods launched and checked from now on (`stage.loadsTileLinkedMedia`). Running sandboxes keep their launch, and nothing is published.
- `changeStageCatalogDefaultMosaics(stage, isOn)`: switches "List the default mosaics of mods" (`stage.catalogDefaultMosaics`), and pushes `catalog.changed` with the new catalog to every running mod, visible or hidden (see [App catalog](#app-catalog)). Resolves once the push is done. Nothing is published, since the snapshot does not change.
- `readStageSnapshot(stage)` and `subscribeStage(stage, listener)`: a frozen `StageSnapshot` that is new after every change, for React's `useSyncExternalStore`. `subscribeStage` returns the function that unsubscribes.
- Types: `Stage`, `StageOptions`, `StageRouting`, `StageHome`, `SectionLink`, `StageSnapshot` (`sandboxes`, `checks`, `action`, `visible`, `activeSection` and `isTheaterMode`), `CheckSnapshot` (`id`, `key`, `sandboxDocument`, `title`), `VisibleView` (`{ kind: "sandbox", id }`, `{ kind: "page", section, page }` with `page: null` for the index, or `null` before the first entry), `ActionSnapshot` (`id`, `mod` with `title` and `source`, and `action`), `ActionMod`, the engine's `AppAction`, `LinkAction`, `SaveFileAction` and `ConfirmAction` re-exported as types, so the page imports them from the stage, `SandboxSnapshot` (`id`, `hash`, `isVisible`, `canClose`, `status`, `mod`, set once the mod file is loaded, `mosaic` with `title` and `source`, set once the mosaic file of a mosaic link is loaded, otherwise `null`, `mosaicReference`, the link's mosaic reference resolved against the app's address or `null` for a mod link, `sandboxDocument`, `canReloadTiles`, `messages`, every `MessageSnapshot` in the order above, `droppedModMessages`, the count per level of the mod's messages the cap dropped, `modReference`, the link's mod reference resolved against the app's address (for a mosaic link, `""` until the mosaic file is loaded, then the mosaic's mod), `collection`, the link's collection resolved the same way or `null` (for a mosaic link, the mosaic's collection once its file is loaded), `errorMessage`, `apiMismatch` with `range` and `apiVersion` only while asking the mod API question, otherwise `null`, and `siteConsent` with `lines` only while asking the site consent question, otherwise `null`), `SiteConsentLine` (`key`, `category`, `host`, `reason`, `subject`: `"mod"` or `"mosaic"`, what declared the line; a mosaic line's `key` starts with `mosaic `, so a mod and its mosaic can declare the same host), `SiteConsentAnswer` (`allowed`, `remember`), `MessageSnapshot` (`id`, `level`, `producer`, `source`, `text`, `isRead`), `MessageLevel`, `MessageProducer`, `DroppedMessageCounts`, `SandboxStatus` (`loading`, `asking`, `failed`, `running` or `stopped`), `StageHistory`, `FrameLayout` (`contained`, `theater` or `fullscreen`).

### Routing options

`StageOptions.routing` is plain data the app builds from its section registry (`src/main/sections/`):

```ts
interface StageRouting {
  pageSections: readonly string[]; // ids whose target is a page, e.g. ["home", "guides", "settings", "about"]
  home:
    | { kind: "page"; section: string } // Home is that section's index page, at #/
    | { kind: "mod"; section: string; link: RunLink }; // Home is a mod, at #/
  sectionLinks: readonly { section: string; link: RunLink }[]; // mod sections, in sidebar order
}
```

`home.section` is the Home section's id, used for membership and for the close fallback. A section listed in neither `pageSections` nor `sectionLinks` is unknown to the stage: its addresses show Home.

### How the page wires the stage

`src/main.tsx` builds the stage once at module level, outside React, so StrictMode's double effect run in dev does not launch mods twice:

```ts
import { createStage, followHistory } from "./lib/core/stage/index.ts";
import { DEFAULT_MODS } from "./main/default_mods.ts";

const stage = createStage({
  history: window.history,
  defaults: DEFAULT_MODS,
  routing, // built from the available sections
  appOrigin: location.origin,
  baseUrl: document.baseURI,
  storage: localStorage,
  colorScheme: "light",
  loadsTileLinkedMedia: true,
  catalog, // resolveAppCatalog(APP_CATALOG, …).catalog
  catalogDefaultMosaics: false,
  readSiteDecisions, // from the site decisions store
  rememberSiteDecisions,
});
followHistory(stage, location.hash, history.state);
window.addEventListener("popstate", function followPopState(): void {
  followHistory(stage, location.hash, history.state);
});
```

Fragment navigations fire `popstate` too, so `hashchange` is not needed. The app's theme (`src/main/theme/app_theme.ts`) passes the resolved color scheme as `colorScheme` and calls `changeStageColorScheme` when it changes. The tile media setting (`src/main/settings/tile_media_setting.ts`) passes its start value as `loadsTileLinkedMedia` and calls `changeStageTileLinkedMedia` when it is switched. The catalog setting (`src/main/settings/catalog_setting.ts`) passes its start value as `catalogDefaultMosaics` and calls `changeStageCatalogDefaultMosaics` when it is switched. The theater setting (`src/main/stage/theater_setting.ts`) passes its start value as `theaterMode`, and calls `changeStageTheaterMode` when the stage bar's button is pressed. `StageView` calls `changeStageFullscreen` on each `fullscreenchange`, and `warnFullscreenRefused` when a fullscreen request is refused. The site decisions store (`src/main/settings/site_decisions.ts`) gives `readSiteDecisions` and `rememberSiteDecisions`. `App` then renders the page the snapshot's `visible` names, if any, and `StageView`, which stays mounted, reads the snapshot with `useSyncExternalStore`, renders every sandbox in creation order (hidden unless visible), and calls `attachFrame`, `frameLoadedAgain`, `closeSandbox` and `reloadTiles`. Apart from them, it renders a hidden `CheckFrame` per entry of the snapshot's `checks`, which calls `attachCheckFrame` and `checkFrameLoadedAgain`. Its `ActionDialog` shows the snapshot's `action`, performs it from the accept button's click and calls `answerStageAction`. Its `ApiMismatchDialog` shows the visible sandbox's `apiMismatch` while it is asking, and calls `answerApiMismatch`. Its `SiteConsentDialog` shows the visible sandbox's `siteConsent`, and calls `answerSiteConsent`.

### Why no router library

TanStack Router was listed in `docs/stack.md` and was removed for this change:

- The app has three kinds of address (run links, pages and Home). Nested routes, loaders, preloading and code splitting would go unused, and typed search params are about 50 lines in `run_links.ts`.
- The stage alone must decide what each history entry means: show an open sandbox, or open its link in a new one. With a router, the router resolves the navigation first and the stage reacts, so two layers read one navigation. TanStack Router also keeps its own keys in `history.state`, where the stage keeps its positions.
- Frames must never remount. Route-driven rendering mounts the matched route's component, so the routes would render nothing and the stage would sit beside the outlet, working around the router.
- The history code is tested in Node with a fake `History` subset. A router needs a router instance and its async navigation in every stage test.

Pages that are not mods (Home, Guides, Settings and About) did not change this: they are stage entries next to the sandboxes, so the stage stays the one writer of the history and back, forward and reload keep their rules across pages and mods. Adopting a router would replace `stage_routes.ts`, `stage_history.ts` and `run_links.ts` only; the stage state and the sandboxes would not change. An embedding page that also writes `history.state` would overwrite the stage's positions: the stage then treats the entry as new and opens its link again, and `stage_history.ts` is the one file to change to share the state.
