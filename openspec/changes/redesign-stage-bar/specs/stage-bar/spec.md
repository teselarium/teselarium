# Spec Delta

## Purpose

Shows the visible sandbox's mod and its messages in one row above the mod's frame: which mod runs, what the app and the mod reported while it started and ran, sorted by level and marked read or unread, and the app's controls for that sandbox.

## ADDED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold, in order, the mod's name, its version in a capsule, an information button and, for a sandbox opened with a collection, the "Reload tiles" button. Its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator and, when the sandbox has one, the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the stage bar shows, from left to right, `Book List`, `1.0.0` in a capsule, the information button, the "Reload tiles" button, the errors, warnings and notifications buttons and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** the sample book list mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button and its other items keep their order

#### Scenario: Close button last
- **WHEN** the sample book list mod runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the name and version. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name and version, even when the sandbox failed later.

#### Scenario: Missing mod file
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing`
- **THEN** the stage bar shows "Mod not loaded" and no version capsule

#### Scenario: Missing collection
- **WHEN** the app is opened with the sample book list mod and a collection that answers HTTP 404
- **THEN** the stage bar shows `Book List` and `1.0.0`

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the stage bar shows the mod's name and version

### Requirement: Sandbox messages
Each sandbox SHALL keep its own messages, each with a level (`error`, `warning` or `info`), a producer (the app or the mod), a source and a text. Messages SHALL be listed in the order they were found: mod file issues, collection issues, tile link issues, then the other messages as they arrive, such as permission issues, blocked requests, mount failures, a stopped mod, load failures, the app's notifications and the mod's own messages.

#### Scenario: Issues stay with their sandbox
- **WHEN** a mod with a blocked request is hidden by opening the sample book list mod
- **THEN** the stage bar shows no warnings, and going back shows the warning about the blocked request again

#### Scenario: Missing range comes first
- **WHEN** a mod file without `api` is opened with a collection that has a tile that does not match the mod's type
- **THEN** the warnings popover's first item is the warning about the missing `api` range, followed by the tile's warning

#### Scenario: Blocked request while the mod runs
- **WHEN** a running mod requests an image from an undeclared host
- **THEN** the warnings count goes up by one, and the warnings popover lists a warning that names the host and `permissions.show`

### Requirement: Sandbox errors are messages
When a sandbox shows an error instead of its frame, such as a load failure, a switched-off default mod or a cancelled API question, the same error SHALL be an `error` message from the app, so the errors count includes it.

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the errors popover lists one error labeled "App" that names `^0.2.0` and the app's mod API version

### Requirement: Each message names its producer
Each item in a popover SHALL show its producer as the fixed label "App" or "Mod", followed by the source and the text, and the two labels SHALL look different. A mod SHALL NOT be able to choose or change the label: the mod's title, source and text never replace it.

#### Scenario: Message from the app
- **WHEN** a mod file without `api` is opened and the user opens the warnings popover
- **THEN** the warning about the missing `api` range is labeled "App"

#### Scenario: Message from the mod
- **WHEN** a running mod sends `ui.notify` with `{ "message": "Saved", "level": "warning" }` and the user opens the warnings popover
- **THEN** the item `Saved` is labeled "Mod"

#### Scenario: Mod titled like the app
- **WHEN** a mod titled `App` sends `ui.notify` with `{ "message": "Sign in again" }`
- **THEN** the item `Sign in again` is labeled "Mod"

### Requirement: Message buttons show their counts
The errors, warnings and notifications buttons SHALL each show the number of the visible sandbox's messages of their level, in a capsule over the bottom-right corner of the icon. A count above 99 SHALL be shown as `99+`. Each button's accessible name and tooltip SHALL give the level, the exact count and the number of unread messages.

#### Scenario: Two warnings
- **WHEN** the visible sandbox has two warnings and no other messages
- **THEN** the warnings button shows `2` in its capsule

#### Scenario: Many errors
- **WHEN** the visible sandbox has 142 errors
- **THEN** the errors button shows `99+`, and its accessible name gives `142`

### Requirement: Message buttons keep their size
The message buttons SHALL be the same size, whatever their counts, and a count changing SHALL NOT move any item of the stage bar. A capsule SHALL NOT cover the next button or the separator.

#### Scenario: Count grows
- **WHEN** the warnings count of the visible sandbox goes from 0 to 7 and then to 120
- **THEN** the size and position of every stage bar button stay the same

#### Scenario: Capsule clear of the close button
- **WHEN** the notifications button shows `99+`
- **THEN** its capsule does not overlap the separator or the close button

### Requirement: Empty levels are dimmed
A message button whose level has no messages SHALL be dimmed, with no capsule, and SHALL stay focusable. Its popover SHALL say "No errors.", "No warnings." or "No notifications.".

#### Scenario: Sample mod has no issues
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the errors and warnings buttons are dimmed, and the errors popover says "No errors."

#### Scenario: Keyboard reaches an empty level
- **WHEN** the visible sandbox has no warnings and the user moves the focus with Tab
- **THEN** the warnings button receives the focus

### Requirement: Message popovers
Pressing a message button SHALL open a popover, drawn by the app outside every mod frame, that lists the visible sandbox's messages of that level in the order they were found. Each item SHALL show its producer, source and text, with the text as plain text.

#### Scenario: Errors popover
- **WHEN** a mod whose collection has a tile that does not match its type, and that sends `ui.notify` with `{ "message": "Broken", "level": "error" }`, runs, and the user presses the errors button
- **THEN** the popover lists the tile's issue and then `Broken`, and lists no warning or notification

#### Scenario: Plain text
- **WHEN** a mod sends `ui.notify` with `{ "message": "<b>Saved</b>" }` and the user opens the notifications popover
- **THEN** the item shows the text `<b>Saved</b>` with no bold text

### Requirement: Unread messages
A level's capsule SHALL be filled in the level's color while that level has unread messages, and muted once all of them were read. Opening a level's popover SHALL mark every message of that level read. Messages SHALL start unread, including the ones the sandbox had when it was first shown, and each sandbox SHALL keep its own read state.

#### Scenario: Read after opening
- **WHEN** the visible sandbox has one unread warning and the user opens the warnings popover
- **THEN** the warnings capsule becomes muted

#### Scenario: New message after reading
- **WHEN** the user opened the warnings popover and then a new warning arrives
- **THEN** the warnings capsule is filled again

#### Scenario: Read state stays with its sandbox
- **WHEN** the user read the warnings of a first mod, opened a second mod with unread warnings, and goes back
- **THEN** the first mod's warnings capsule is muted

### Requirement: New messages draw attention
When a message arrives while its sandbox is visible, its level's button SHALL flash once. With reduced motion requested by the user's system, it SHALL NOT flash, and the filled capsule alone SHALL mark it. A new error SHALL also be announced politely to assistive technologies.

#### Scenario: Blocked request flashes
- **WHEN** the visible mod requests an image from an undeclared host
- **THEN** the warnings button flashes once and its capsule is filled

#### Scenario: Reduced motion
- **WHEN** the user's system asks for reduced motion and a new warning arrives in the visible sandbox
- **THEN** the warnings button does not flash and its capsule is filled

### Requirement: Dismiss notifications
Each item in the notifications popover SHALL have a dismiss button whose accessible name names the message. Dismissing SHALL remove the message from its sandbox and lower the count. With two or more notifications, the popover SHALL have a "Clear all" button that dismisses all of them. Errors and warnings SHALL NOT have a dismiss button.

#### Scenario: Dismiss one
- **WHEN** the visible sandbox has two notifications and the user dismisses the first
- **THEN** the notifications count is `1` and the popover lists only the second

#### Scenario: Clear all
- **WHEN** the visible sandbox has three notifications and the user presses "Clear all"
- **THEN** the notifications button is dimmed and the popover says "No notifications."

#### Scenario: Warnings stay
- **WHEN** the user opens the warnings popover
- **THEN** its items have no dismiss button

### Requirement: Messages from a mod are limited
A sandbox SHALL keep at most 100 messages from its mod. When a new one arrives past that limit, the oldest message from the mod SHALL be dropped, and the popover of its level SHALL end with a note that says how many older messages from the mod were dropped. Messages from the app SHALL never be dropped.

#### Scenario: Mod sends too many
- **WHEN** a mod sends `ui.notify` 105 times with `level` `info`
- **THEN** the notifications count is 100, and the notifications popover ends with a note that 5 older messages from the mod were dropped

#### Scenario: App errors stay
- **WHEN** a mod with a tile issue sends `ui.notify` 200 times with `level` `warning`
- **THEN** the warnings popover still lists the tile's issue

### Requirement: Information popover
The information button SHALL open a popover with the mod's source, the collection's location when the sandbox was opened with one, and the sandbox's run link with a "Copy link" button. "Copy link" SHALL copy the full address of the app with the run link's hash, and SHALL say "Copied" for a moment.

#### Scenario: Sample mod with its collection
- **WHEN** the sample book list mod runs with the sample collection and the user presses the information button
- **THEN** the popover shows the mod file's source, the collection's location and the run link

#### Scenario: Copy the link
- **WHEN** the user presses "Copy link" in the information popover of the app at `https://example.org/`
- **THEN** the clipboard holds `https://example.org/` followed by the sandbox's run link hash, and the button says "Copied"

#### Scenario: Mod that did not load
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing` and the user presses the information button
- **THEN** the popover shows the run link's mod reference resolved against the app's address, and the run link

### Requirement: Notification of reloaded tiles
When "Reload tiles" loads the collection again, the sandbox SHALL get an `info` message from the app whose source is the collection's location and whose text gives the number of tiles the mod received and the number of collection issues. A reload whose collection cannot be loaded SHALL give its error and no notification.

#### Scenario: Reload done
- **WHEN** the sample mod runs with a collection that now lists two books and the user presses "Reload tiles"
- **THEN** the notifications popover lists an item labeled "App" that names 2 tiles and 0 issues

#### Scenario: Reload failed
- **WHEN** the collection answers HTTP 404 when the user presses "Reload tiles"
- **THEN** an error names the collection's location, and no new notification is added

### Requirement: Notification of the loaded collection
When a mod opened with a collection starts, the sandbox SHALL get an `info` message from the app whose source is the collection's location and whose text gives the number of tiles the mod received.

#### Scenario: Sample collection
- **WHEN** the sample book list mod starts with the sample collection
- **THEN** the notifications popover lists an item labeled "App" that names 3 tiles

#### Scenario: No collection
- **WHEN** the sample book list mod starts without a collection
- **THEN** the notifications button is dimmed

### Requirement: Notification of the site consent answer
When the user answers the site consent question of a sandbox, the sandbox SHALL get an `info` message from the app whose source is the mod's source and whose text names each site allowed and each site refused, with its category, and says whether the answer is remembered.

#### Scenario: Allowed and remembered
- **WHEN** the user allows `show` for `covers.example.org` with Remember checked
- **THEN** the notifications popover lists an item labeled "App" that names `covers.example.org`, says that it was allowed and says that the answer is remembered

#### Scenario: Escape
- **WHEN** the user closes the site consent dialog with Escape
- **THEN** the notification names each declared site as refused and says that the answer is not remembered

### Requirement: Messages from the mod in the stage bar
Each `ui.notify` the engine accepts SHALL add a message from the mod to the mod's sandbox, with the request's level and text, and with the request's `source` or, without one, the mod's source. A hidden sandbox SHALL keep the message and show it when it is visible again.

#### Scenario: Default source
- **WHEN** the sample book list mod sends `ui.notify` with `{ "message": "Saved" }`
- **THEN** the notifications popover lists `Saved`, labeled "Mod", whose source is the mod's source

#### Scenario: Hidden mod notifies
- **WHEN** the mod explorer opened the mod viewer and the hidden explorer sends `ui.notify` with `{ "message": "Done" }`
- **THEN** the viewer's stage bar does not list `Done`, and going back to the explorer lists it
