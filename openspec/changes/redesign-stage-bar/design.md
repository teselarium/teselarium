# Design

## Context

See proposal.md for the motivation, and the `stage-bar` spec for the behavior.

How the code works today:
- The stage keeps each sandbox's issues in `SandboxRuntime` (`src/lib/core/stage/stage_sandboxes.ts`) as four arrays: `fileIssues`, `collectionIssues` (replaced by "Reload tiles"), `tileLinkIssues` (replaced by a reload when tile links are on) and `issues`, which holds the permission issues, then what the session reports while the mod runs. `startRuntime` resets `issues` to the launch's issues when the mod starts. `readSandboxIssues` joins the four arrays in that order. `SandboxSnapshot.issues` hands the result to `StageBar` and `IssueList` in `src/main/stage/`.
- Every issue is a `ModIssue` (`level`, `source`, `message`, where `level` is `"warning" | "error"`). The engine and the check use the same type.
- `ModSession.onIssue` dedupes issues by level, source and message, so a blocked request repeated in a loop is reported once.
- Load failures, a switched-off mod and a cancelled API question all go through `failRuntime`, which only sets `errorMessage`. The file errors (`FileFetchError`, `MarkdownParseError`, `YamlParseError`) carry the address of the file that failed in `source`.
- The engine's request handlers get a `ModMethodContext` with hooks into the stage (`onOpenLink`, `onRequestAction`, `onCheckMod`). The mount check, the case frames and the list frames each pass their own hooks (`stage_checks.ts`, `stage_check_cases.ts`).
- `src/vendor/shadcn/` has Tooltip but no Popover and no DropdownMenu. The theme has `destructive`, `warning`, `primary` and `muted` tokens, and no info token.

## Goals / Non-Goals

**Goals:**
- One message model, used for the app's issues, the app's notifications and the mod's notifications, and owned by the stage, so that read state, dismissing and the cap on mod messages are rules of the domain that unit tests can check without React.
- Keep `ModIssue`, `context.issues`, `tiles.changed` and the check report's `findings` exactly as they are for the engine and for mods.

**Non-Goals:**
- Changing how the session dedupes issues.
- Changing what the mount check records, other than notifications.
- Persisting messages.
- New theme tokens.

## Decisions

### D1. The stage bar becomes its own capability

`mod-stage` today mixes navigation (sandboxes, history, pages) with what the bar shows. The bar now has more than a dozen rules of its own, so they go in a new `stage-bar` spec. `mod-stage` keeps the requirements that are about sandboxes themselves: load failures, the switched-off mod, "Reload tiles" and close.
- *Alternative:* add every requirement to `mod-stage`. That spec already has 13 requirements, and keeping it in one piece would hide the bar's rules among the navigation rules.

### D2. `SandboxMessage` is a stage type, with an id and a producer

In `src/lib/core/stage/`, a new module `stage_messages.ts` defines:
- `MessageLevel`, which is `IssueLevel | "info"`.
- `MessageProducer`, which is `"app" | "mod"`.
- `SandboxMessage`, with `id` (a number, increasing within the sandbox), `level`, `producer`, `source` and `text`.

`ModIssue` and `IssueLevel` stay as they are. `info` lives only in the stage, so mods, the engine's issue paths and the check never see it, as the `mod-engine-api` delta requires.
- *Alternative:* add `info` to `IssueLevel`. That level is shared by tile validation, `context.issues` and check findings, so a mod could receive a level it has never seen. That is the compatibility trap this change avoids.

### D3. The runtime holds messages; read and dismissed state live with them

`SandboxRuntime` keeps its groups, but each group holds `SandboxMessage`s. `issues` is renamed `messages`: the arrival list, which takes app issues, notifications and mod messages in order. The runtime gains:
- `nextMessageId`.
- `readMessageIds: Set<number>`.
- `droppedModMessages: Record<MessageLevel, number>`.

Messages get their id when they are added:
- A reload builds new collection and tile link messages with new ids, so they are unread, as the `mod-stage` delta requires.
- A dismissed notification is removed from `messages`. Only messages with level `info` can be dismissed, and they only ever live in `messages`.
- The mod's cap counts the `producer: "mod"` items of each level in `messages`. Past 100 in a level, the oldest one of that level is removed and that level's dropped count goes up by one. App messages are never removed.
  - *Alternative:* one cap for the mod's messages of every level. A mod sending many notifications would then push out its own errors and warnings, which matter more.
- Read state is a set of ids, not a "read up to" mark per level. Collection messages come before the arrival list but are replaced with new ids, so a single mark could not express their state.

New stage functions, exported from the stage's index for the page:
- `markMessagesRead(stage, sandboxId, level)`.
- `dismissMessage(stage, sandboxId, messageId)`, which ignores errors and warnings.
- `clearNotifications(stage, sandboxId)`.

`SandboxSnapshot` replaces `issues` with:
- `messages`: frozen `{ id, level, producer, source, text, isRead }`, in the spec's order.
- `droppedModMessages`.
- `modReference`: the link's mod reference, resolved against the app's address.
- `collection`: the resolved collection location, or `null`.

The page derives the counts from `messages`, so the snapshot holds no count that could disagree with the list.

### D4. `ui.notify` reaches the stage through a new context hook

`ui_methods.ts` gains `ui.notify`. It reads and checks `message`, `level` and `source` with the same length rule as `ui.confirm` (1000), and calls a new `ModMethodContext.onNotify(notification)`, where the notification is `{ level, source, text }` with `source` already defaulted to the mod's source. The handler returns `null`, and visibility doesn't matter, so it never calls `askUser`. `ModSessionOptions` gains `onNotify`, which is passed through as the other hooks are.

Notifications skip `reportIssue`'s dedupe: each request is a separate event, and the cap bounds the spam.

Hooks per caller:
- The stage's sandboxes add a `producer: "mod"` message.
- The mount check records `error` and `warning` as `mount` findings with the notification's source and text, and ignores `info`.
- Case frames and list frames ignore it. A case already gets the request in `requests`.

The `UI_METHODS` doc comment changes from "questions the app asks the user" to "the app's UI for the mod".
- *Alternative:* route notifications through `onIssue`. That dedupes them, can't carry `info`, and in the check would turn `info` into a finding.

### D5. Every failure is an app error; app notifications are added by the stage

`failRuntime` also appends an app `error` message. Its source is the error's `source` when the error has one (the file errors), and otherwise the resolved mod reference: for a switched-off mod or a cancelled API question, the mod's source when the mod file was loaded. The runtime stores the link's resolved mod reference when the sandbox is launched.

The app's notifications:
- **Collection loaded:** when `startRuntime` builds `messages` from the launch, it appends this notification when `launch.collectionSource` is not `null`, with `launch.context.tiles.length`.
- **Site consent answered:** `answerSandboxSiteConsent` builds its notification from the consent lines and the decisions, and passes it to the start. `startRuntime` resets `messages` at start, so a notification pushed before that reset would be lost. The notification is therefore part of what the start builds: launch issues, then the consent notification, then the collection notification.
- **Tiles reloaded:** `reloadSandboxTiles` appends this notification after a successful load, with the number of tiles the mod received and the number of collection issues. A failed load adds only its error.

### D6. The UI: project components over shadcn Popover, Tooltip and Button

shadcn's Popover and DropdownMenu are added to the vendored zone (`npx shadcn@4.22.1 add popover` and `npx shadcn@4.22.1 add dropdown-menu`). Both render in a portal in the app's page, so they are outside every mod frame. The Share button uses DropdownMenu rather than a Popover of buttons, for the menu's role, arrow keys and focus on the first item, and so later ways to share are new items. Under `src/main/stage/`:
- `StageBar` lays out the row.
- `MessageButton` is the icon button with its capsule, flash and tooltip, one per level.
- `MessagePopover` lists one level, with the dismiss and "Clear all" buttons for `info` and the dropped-messages note.
- `MessageItem` shows the producer label, source and text, and the unread mark.
- `ModInfoPopover` shows the source, collection and run link, as selectable text.
- `ShareMenu` is the Share button and its menu, with "Copy link".

`IssueList` is removed.

Rules for the buttons:
- **Fixed size:** each message button is shadcn's `icon-sm` Button with `position: relative`. The capsule is absolutely placed at the bottom right, with a min-width that fits `99+` and `tabular-nums`, so it never changes the button's box. The gap between message buttons, and before the separator, is wide enough for a `99+` capsule.
- **Colors:**
  - error: `destructive`
  - warning: `warning`
  - info: `primary`
  - read: the capsule is muted (`bg-muted text-muted-foreground`)
  - empty level: the icon is dimmed with `text-muted-foreground` and reduced opacity, not `disabled`, so the button stays focusable
- **Producer labels:** "App" is an outline Badge, and "Mod" is a secondary Badge with the mod's icon, so the two look different without depending on color alone.

**Flash and announcement.** `StageBar` keeps, in a ref, the highest message id it has seen per level for the visible sandbox id. When the snapshot of the same sandbox brings a higher id, that level's button gets a one-shot animation class, under Tailwind's `motion-safe:` variant, so reduced motion gets no flash. A new error is written to a visually hidden `aria-live="polite"` region. When the visible sandbox id changes, the ref is reset without flashing, because messages that arrived while a sandbox was hidden don't flash.
- *Alternative:* the stage flags new messages. Whether something flashes depends on what the user saw, which is view state, so it stays in the page.

**Popovers and read state.** Opening a level's popover calls `markMessagesRead` for that level, and closing it calls it again, for the messages that arrived while it was open. While it is open, such a message keeps the capsule filled. Popovers and the Share menu close when the visible sandbox changes.

`MessagePopover` lists a level newest first: the page sorts the level's messages by id, descending. Ids grow as messages are added, and a reload gives the collection issues new ids, so the newest message is always on top. The stage keeps the found order in the snapshot. The order is how the bar shows the messages, not a rule of the domain. The dropped-messages note stays at the end, next to the oldest.
- *Alternative:* reverse the found order. A tile issue from a reload would then stay at the bottom, under older messages.

**Unread marks.** The snapshot's `isRead` turns true right after the popover opens, so it cannot drive the marks. When a level's popover opens, `StageBar` keeps the ids of that level that were unread and the highest id of that level seen then. An item is marked when its id is in that set or above that id, and the record is dropped when the popover closes. A marked item has a light background in its level's color and a dot with visually hidden text "Unread". Every item keeps the dot's place, an empty one when it is not marked, so items do not move when their mark comes or goes. The light background stays `bg-<level>/10`.
- *Alternative:* keep the marks in the stage. What the user saw in an open popover is view state, as the flash is, so it stays in the page.

**Closing on a click in a mod's frame.** Radix closes a popover or menu on a pointer-down in the app's document, which a click inside a frame never reaches. Clicking in a frame moves the focus to it, so `StageBar` listens for the window's `blur` (`frame_focus.ts`), and once the blur has finished it checks `document.activeElement`. When that is an `iframe`, it closes the open popover or menu. It checks after the blur because, when an element of the app had the focus, Firefox fires the blur while the focus is still on the body, and only gives it to the frame afterwards. The popovers and the menu prevent Radix's `onCloseAutoFocus` while the focus is in a frame, so the focus stays with the mod instead of going back to the button. The click itself goes to the mod as usual.
- *Alternative:* a transparent layer over the frame while a popover is open. It would catch the click, so the mod would not receive it.

**Share.** "Copy link" writes the app's address (`origin + pathname + search`) followed by `sandbox.hash` with `navigator.clipboard.writeText`. The menu closes, and the Share button's tooltip is held open for 2 seconds with "Link copied", or "Cannot copy the link" when the write is refused. The same text is written to the bar's polite live region. This reuses the Tooltip, so no toast component is added.

**Name.** The left side picks the name from `status` and `mod`:
- `mod` known: the name and the version capsule.
- `loading` or `asking` without `mod`: "Loading mod…".
- `failed` without `mod`: "Mod not loaded".

### D7. Mod API `0.1.8`, a patch

`ui.notify` is a new method, which the engine README counts as an addition. `MOD_API_VERSION` becomes `0.1.8`, and the surface guard gets a `0.1.8` entry with `ui.notify` in its method names. The mount context, the events, the mod file keys and the test API names are unchanged. The shipped mods keep `^0.1.0`, and `TEST_MOD_API_RANGE` is unchanged. The changeset is a patch, the same bump as the mod API while both are `0.x`.

## Risks / Trade-offs

- **A mod can put an error in a bar that reads as the app's own.** → Fixed, distinct App/Mod labels the mod can't change. Plain text only. A source the mod chooses is shown only after the "Mod" label.
- **New runtime problems can be missed behind a count.** → Unread state that lasts, a one-time flash and a polite announcement for errors.
- **A mod sending notifications in a loop.** → At most 100 kept from the mod per level, so 300 at most, a dropped-messages note, and app messages never dropped. Each notification triggers a snapshot and a re-render, which is no worse than today's unbounded issue reports. A mod that floods requests is already a cost the engine accepts for every method.
- **Many e2e tests read "No issues." or the `Issues` list.** → Change the shared helpers in `e2e/mod_routes.ts` (`stageBar`, the issue list locator) once, to open a level's popover and read its items. Keep the accessible name "Reload tiles" so those tests keep working.
- **The read state is lost on page reload.** → Accepted, since messages themselves are rebuilt on reload. Recorded in the proposal's out of scope.
- **A popover rendered in a portal could end up under a mod frame.** → The portal attaches to the app's body, and frames never cover the app's layers. An e2e test opens a popover over a running mod and clicks an item, and another clicks in the frame to close it.
- **A browser might not move the focus to a frame on a click.** → The popover would then stay open. The e2e test of the click in the frame runs in Chromium, Firefox and WebKit. If one fails, the fallback is the transparent layer over the frame, which costs the mod that click, and is decided with the user before it is built. Outcome: all three browsers move the focus into the frame, Chromium and WebKit in Playwright and Firefox checked by hand in desktop Firefox. Playwright's Firefox fires no window `blur` on such a click, so the e2e cases fire it themselves when it is missing. The transparent layer was not needed.

## Migration Plan

There is no data to migrate. Messages are in memory, as issues are today. The snapshot's `issues` field is removed in the same change that updates its only consumer, `src/main/stage/`. Mods need no change. Rollback is reverting the change. Mods that started calling `ui.notify` would then get `-32601`, which they can feature-detect through `context.api.version`.
