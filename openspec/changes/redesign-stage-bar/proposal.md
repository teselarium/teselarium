# Proposal

## Why

The stage bar puts the mod's title, version and full source on one line and lists every issue of the sandbox underneath, always expanded. A mod with many tile issues pushes its frame down and leaves it less height, the "No issues." line takes room even when nothing is wrong, and the user cannot tell how many problems there are without reading the whole list. Pressing "Reload tiles" gives no feedback unless the tiles visibly change, and a mod has no way to tell the user anything outside its frame other than a modal `ui.confirm`.

## What Changes

- **One-row stage bar**: on the left, the mod's name, its version in a capsule, an information button and an icon button that reloads the tiles. On the right, buttons for errors, warnings and notifications, a separator and the close button (×). The issue list under the bar goes away, so the frame gets that height back.
- **Message buttons with counts**: each level's button shows its count in a capsule over the icon's bottom-right corner, shown as `99+` above 99. The capsule is filled while the level has unread messages and muted once they were read. A button with no messages is dimmed but stays focusable. The buttons keep the same size whatever their count. Opening a button shows a popover with that level's messages, which marks them read. When a new message arrives in the visible sandbox, its button flashes once, unless the user asked for reduced motion.
- **Who produced each message**: each item shows "App" or "Mod", fixed labels the app sets and that a mod cannot change, then the message's source and text.
- **A new notification level**: `info` messages are listed under the notifications button, and the user can dismiss them one by one or all at once. Errors and warnings cannot be dismissed. The app adds three notifications: tiles reloaded, collection loaded, and site consent answered.
- **Mods can notify**: a new request, `ui.notify { message, level?, source? }`, adds an `info`, `warning` or `error` message from the mod to its sandbox. It needs no permission, is plain text of at most 1000 characters, and is accepted from hidden mods too. The app keeps at most 100 messages from the mod per sandbox and notes how many older ones it dropped. Messages from the app are never dropped.
- **Information popover**: shows the mod's source, the collection's location when there is one, and the run link with a "Copy link" button that copies the full address.
- **Loading and load failures**: while the mod file loads, the bar says "Loading mod…". When the mod file failed to load, it says "Mod not loaded". Every load failure is also an App error under the errors button, whose source is the file that failed.
- **The check and mod tests**: during a mount check, `ui.notify` answers `null`, and the mod's `error` and `warning` notifications become `mount` findings at the same level. In test cases, notifications are not findings; a case reads them from `requests`, which already records every request.

## Capabilities

### New Capabilities

- `stage-bar`: what the stage bar shows for the visible sandbox and how the user works with it. This covers the layout, the sandbox's messages (levels, producer, order, limits), the message buttons and their counts, unread state, popovers, dismissing, the information popover, the loading and failed states, and the app's own notifications. It takes over the stage bar part of `mod-stage`, which is left with navigation between sandboxes and pages.

### Modified Capabilities

- `mod-stage`: "Show the mod issues" moves to `stage-bar`. Load failures also become errors in the stage bar. "Reload tiles" is an icon button that keeps the accessible name "Reload tiles". The scenarios that read "No issues." now look for no errors and no warnings.
- `mod-engine-api`: the new `ui.notify` request, and its place in the methods table.
- `mod-check`: what the mount check records gains the mod's `error` and `warning` notifications. `ui.notify` is not a request that needs the user.
- `mod-tests`: a case records no finding for the mod's notifications.
- `mod-api-version`: the mod API version becomes `0.1.8`, and the scenario that reads "no issues" in the stage bar now reads no errors and no warnings.

## Impact

- **Code**:
  - `src/lib/mod/`: the message type gains `info` and a producer, outside the tile issues that mods receive.
  - `src/lib/core/stage/`: the sandbox keeps its messages with ids, read state, dismissals and the cap on mod messages. Load failures and the three app notifications become messages. The snapshot exposes messages instead of `issues`.
  - `src/lib/core/engine/`: the `ui.notify` handler and a new session hook for it.
  - The check and the case frames handle the new hook.
  - `src/main/stage/`: a new `StageBar` with message buttons, popovers and the information popover. `IssueList` is replaced.
  - shadcn's Popover is added to `src/vendor/shadcn/`.
- **Tests**:
  - e2e: the helpers and specs that read the stage bar's issue list or "No issues." (`e2e/mod_routes.ts`, `e2e/app_layout.ts`, `mod_sandbox`, `mod_stage`, `mod_api_version`, `mod_engine_api` and `default_mods`) move to the message buttons and popovers.
  - Unit: tests for the sandbox messages, `ui.notify` and the check.
  - The surface guard records `0.1.8`.
- **Docs**: the stage README (messages and the bar), the main README (the stage bar's layout), the engine README (`ui.notify`, the version), the mod plugin spec (notifying from a mod, the check's findings), and the shadcn zone README (Popover).
- **Mod API version**: patch, `0.1.7` to `0.1.8`. `ui.notify` is a new method. The mount context, the events and `context.issues` are unchanged: `info` never reaches a mod, and `tiles.changed` still carries errors and warnings only. Existing mods keep working, and `^0.1.0` ranges still match. The "Mod API version" section of the engine's README counts this as an addition.
- **App version**: patch while the app is `0.x`, the same bump as the mod API.
- **Out of scope**:
  - Telling the mod that the user dismissed or read a message.
  - Keeping messages or read state across a page reload.
  - Links or rich text in messages.
  - A new theme colour for info.
  - Linking an item to the tile or file it names.
