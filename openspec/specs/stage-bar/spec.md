# stage-bar Specification

## Purpose

Shows the visible sandbox's mod and its messages in one row above the mod's frame: which mod runs, what the app and the mod reported while it started and ran, sorted by level and marked read or unread, and the app's controls for that sandbox.

## Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold the sandbox's title, as capsules for a combination sandbox (see "Combination capsules") or as a plain title otherwise, then the sites chip when the sandbox has one (see "Sites chip"), then the edit button when the sandbox has one (see "Edit button"), then the "More actions" button. On a wide bar (see "The bar folds as it narrows"), its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. On a narrow bar, its right side SHALL hold the messages button and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** a mod opened from a run link runs with a collection
- **THEN** the stage bar shows, from left to right, the mod capsule, the collection capsule, the mosaic capsule, the edit button, the "More actions" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** the mod viewer, which the catalog does not list, runs from a run link without a collection
- **THEN** the stage bar shows the mod's name and version as a plain title, then the "More actions" button, and its other items keep their order

#### Scenario: Close button last
- **WHEN** a mod opened from a run link runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

#### Scenario: Home mod without a close button
- **WHEN** a home mod is shown at `#/`
- **THEN** the fullscreen button is the stage bar's rightmost item, and no separator follows it

#### Scenario: Phone
- **WHEN** a mod opened from a run link runs on a 360×740 viewport
- **THEN** the stage bar's right side holds the messages button, a separator and the close button, in that order
- **AND** the page cannot scroll sideways and the close button is fully inside the viewport

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the mod's name, in the mod capsule of a combination sandbox. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name, even when the sandbox failed later. The mod capsule SHALL NOT show the version, which the mod list's details page shows (see "Details page" in `combination-pickers`).

#### Scenario: Missing mod file
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404
- **THEN** the stage bar shows "Mod not loaded" and no version

#### Scenario: Missing collection
- **WHEN** a mod is opened with a collection that answers HTTP 404
- **THEN** the mod capsule shows the mod's name and no version

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.3.0"` is opened and the user presses "Cancel"
- **THEN** the mod capsule shows the mod's name and no version

### Requirement: Sandbox messages
Each sandbox SHALL keep its own messages, each with a level (`error`, `warning` or `info`), a producer (the app or the mod), a source and a text. Messages SHALL be kept in the order they were found: mod file issues, collection issues, tile link issues, then the other messages as they arrive, such as permission issues, blocked requests, mount failures, a stopped mod, load failures, the app's notifications and the mod's own messages.

#### Scenario: Issues stay with their sandbox
- **WHEN** a mod with a blocked request is hidden by opening another mod that has no issues
- **THEN** the stage bar shows no warnings, and going back shows the warning about the blocked request again

#### Scenario: Missing range found first
- **WHEN** a mod file without `api` is opened with a collection that has a tile that does not match the mod's type
- **THEN** the warnings popover lists the tile's warning, followed by the warning about the missing `api` range, which was found first

#### Scenario: Blocked request while the mod runs
- **WHEN** a running mod requests an image from an undeclared host
- **THEN** the warnings count goes up by one, and the warnings popover lists a warning that names the host and `permissions.show`

### Requirement: Sandbox errors are messages
When a sandbox shows an error instead of its frame, such as a load failure, a switched-off default mod or a cancelled API question, the same error SHALL be an `error` message from the app, so the errors count includes it.

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.3.0"` is opened and the user presses "Cancel"
- **THEN** the errors popover lists one error labeled "App" that names `^0.3.0` and the app's mod API version

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
- **WHEN** a mod runs with a collection, and neither the mod file nor the collection has an issue
- **THEN** the errors and warnings buttons are dimmed, and the errors popover says "No errors."

#### Scenario: Keyboard reaches an empty level
- **WHEN** the visible sandbox has no warnings and the user moves the focus with Tab
- **THEN** the warnings button receives the focus

### Requirement: Message popovers
Pressing a message button SHALL open a popover, drawn by the app outside every mod frame, that lists the visible sandbox's messages of that level newest first, so a new message arrives at the top. A message is as new as when it was added to the sandbox: an issue that "Reload tiles" found again is new. Each item SHALL show its producer, source and text, with the text as plain text.

#### Scenario: Errors popover
- **WHEN** a mod whose collection lists a tile file that answers HTTP 404, and that sends `ui.notify` with `{ "message": "Broken", "level": "error" }`, runs, and the user presses the errors button
- **THEN** the popover lists `Broken` and then the tile's error, and lists no warning or notification

#### Scenario: New message on top
- **WHEN** the warnings popover is open and a new warning arrives
- **THEN** the new warning is the popover's first item

#### Scenario: Reloaded issue on top
- **WHEN** a mod sent a warning, the collection file now has a tile that does not match the mod's type, and the user presses "Reload tiles"
- **THEN** the warnings popover lists the tile's warning first, then the mod's warning

#### Scenario: Plain text
- **WHEN** a mod sends `ui.notify` with `{ "message": "<b>Saved</b>" }` and the user opens the notifications popover
- **THEN** the item shows the text `<b>Saved</b>` with no bold text

### Requirement: Unread messages
A level's capsule SHALL be filled in the level's color while that level has unread messages, and muted once all of them were read. Opening a level's popover SHALL mark every message of that level read, and closing it SHALL mark read the messages that arrived while it was open. Messages SHALL start unread, including the ones the sandbox had when it was first shown, and each sandbox SHALL keep its own read state.

#### Scenario: Read after opening
- **WHEN** the visible sandbox has one unread warning and the user opens the warnings popover
- **THEN** the warnings capsule becomes muted

#### Scenario: New message after reading
- **WHEN** the user opened and closed the warnings popover, and then a new warning arrives
- **THEN** the warnings capsule is filled again

#### Scenario: Read state stays with its sandbox
- **WHEN** the user read the warnings of a first mod, opened a second mod with unread warnings, and goes back
- **THEN** the first mod's warnings capsule is muted

### Requirement: Unread items stand out
In a message popover, each message that was unread when the popover opened, and each message that arrives while it is open, SHALL be marked with a light background in its level's color and a dot whose accessible text is "Unread", so color is not the only cue. The other items SHALL be plain. The marks SHALL stay until the popover closes. Each item SHALL keep the place of the dot, so an item does not move when its mark comes or goes.

#### Scenario: Unread items stand out
- **WHEN** the user read one warning, a second warning arrives, and the user opens the warnings popover
- **THEN** the second warning is marked "Unread" and the first is plain

#### Scenario: Items read on the last opening are plain
- **WHEN** the user opened and closed the warnings popover and opens it again
- **THEN** no item of the popover is marked "Unread"

#### Scenario: Message arriving while the popover is open
- **WHEN** a new warning arrives while the warnings popover is open
- **THEN** the popover lists it marked "Unread"
- **AND** once the popover closes, the warnings capsule is muted

#### Scenario: Marks do not move items
- **WHEN** the warnings popover lists one item marked "Unread" and one plain item
- **THEN** the producer labels of both items line up

### Requirement: Popovers and menus close on a click outside
An open popover, menu or list of the stage bar SHALL close when the user clicks outside it, including inside the visible mod's frame. A click inside the mod's frame SHALL still reach the mod. When it closes because of a click in the mod's frame, the focus SHALL stay in the frame.

#### Scenario: Click in the mod's frame
- **WHEN** the notifications popover is open over a running mod and the user clicks inside the mod's frame
- **THEN** the popover closes and the mod receives the click

#### Scenario: Share menu
- **WHEN** the "More actions" menu, which now holds "Copy link", is open and the user clicks inside the mod's frame
- **THEN** the menu closes and the mod receives the click

#### Scenario: Mod list
- **WHEN** the mod list is open and the user clicks inside the mod's frame
- **THEN** the list closes and the mod receives the click

#### Scenario: The mod keeps the keyboard
- **WHEN** the notifications popover is open over a running mod and the user clicks inside the mod's frame
- **THEN** the popover closes and the focus stays in the mod's frame

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
A sandbox SHALL keep at most 100 messages from its mod for each level. When a new message from the mod arrives past the limit of its level, the oldest message from the mod of that level SHALL be dropped, and the popover of that level SHALL end with a note that says how many older messages from the mod were dropped. Messages from the app SHALL never be dropped.

#### Scenario: Mod sends too many
- **WHEN** a mod sends `ui.notify` 105 times with `level` `info`
- **THEN** the notifications count is 100, and the notifications popover ends with a note that 5 older messages from the mod were dropped

#### Scenario: App errors stay
- **WHEN** a mod with a tile issue sends `ui.notify` 200 times with `level` `warning`
- **THEN** the warnings popover still lists the tile's issue

#### Scenario: Notifications drop no error or warning
- **WHEN** a mod sends `ui.notify` once with `level` `error`, once with `level` `warning`, and then 105 times with `level` `info`
- **THEN** the errors and warnings popovers still list the mod's error and warning, with no note about dropped messages

### Requirement: Notification of reloaded tiles
When "Reload tiles" loads the collection or the tile again, the sandbox SHALL get an `info` message from the app whose source is the collection's or the tile's location and whose text gives the number of tiles the mod received and the number of collection issues. A reload whose collection or tile cannot be loaded SHALL give its error and no notification.

#### Scenario: Reload done
- **WHEN** a mod runs with a collection that now lists two tiles and the user presses "Reload tiles"
- **THEN** the notifications popover lists an item labeled "App" that names 2 tiles and 0 issues

#### Scenario: Reload failed
- **WHEN** the collection answers HTTP 404 when the user presses "Reload tiles"
- **THEN** an error names the collection's location, and no new notification is added

#### Scenario: Tile reload failed
- **WHEN** a mod runs with a `tile` that answers HTTP 404 when the user presses "Reload tiles"
- **THEN** an error names the tile's location, no new notification is added, and the mod keeps its tile

### Requirement: Notification of the loaded collection
When a mod opened with a collection or a tile starts, the sandbox SHALL get an `info` message from the app whose source is the collection's or the tile's location and whose text gives the number of tiles the mod received.

#### Scenario: Sample collection
- **WHEN** a mod starts with a collection of three tiles of its type
- **THEN** the notifications popover lists an item labeled "App" that names 3 tiles

#### Scenario: No collection
- **WHEN** a mod starts without a collection
- **THEN** the notifications button is dimmed

#### Scenario: Single tile
- **WHEN** a mod without a tile type starts with a `tile`
- **THEN** the notifications popover lists an item labeled "App" whose source is the tile's location and that names 1 tile

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
- **WHEN** a running mod sends `ui.notify` with `{ "message": "Saved" }`
- **THEN** the notifications popover lists `Saved`, labeled "Mod", whose source is the mod's source

#### Scenario: Hidden mod notifies
- **WHEN** the mod explorer opened the mod viewer and the hidden explorer sends `ui.notify` with `{ "message": "Done" }`
- **THEN** the viewer's stage bar does not list `Done`, and going back to the explorer lists it

### Requirement: Theater mode button
On a wide bar (see "The bar folds as it narrows"), the stage bar SHALL have a theater mode toggle button whose accessible name and tooltip are "Theater mode", and which is pressed (`aria-pressed="true"`) while theater mode is on. On a narrow bar, the "More actions" menu SHALL hold a "Theater mode" item instead, checked while theater mode is on. Pressing either SHALL turn theater mode on or off (see `stage-layout`). It SHALL be offered for every visible sandbox, also while its mod loads or after it failed.

#### Scenario: Turn theater mode on
- **WHEN** theater mode is off and the user presses the theater mode button
- **THEN** theater mode is on and the button's `aria-pressed` is `"true"`

#### Scenario: Turn theater mode off
- **WHEN** theater mode is on and the user presses the theater mode button
- **THEN** theater mode is off and the button's `aria-pressed` is `"false"`

#### Scenario: Shown for a failed sandbox
- **WHEN** a run link names a mod file that cannot be loaded
- **THEN** the stage bar has the theater mode button

#### Scenario: From the menu on a phone
- **WHEN** theater mode is off, a mod runs on a 360×740 viewport, and the user chooses "Theater mode" in the "More actions" menu
- **THEN** theater mode is on, and the menu's "Theater mode" item is checked the next time it opens

### Requirement: Fullscreen button
On a wide bar (see "The bar folds as it narrows"), the stage bar SHALL have an icon button whose accessible name and tooltip are "Fullscreen" while the visible sandbox has a running mod frame, and none while its mod loads, waits for an answer or failed. On a narrow bar, the "More actions" menu SHALL hold a "Fullscreen" item in the same cases instead. Pressing either SHALL show the visible mod fullscreen (see `stage-layout`).

#### Scenario: Running mod
- **WHEN** a mod runs
- **THEN** the stage bar has a button named "Fullscreen"

#### Scenario: Failed sandbox
- **WHEN** a run link names a mod file that cannot be loaded
- **THEN** the stage bar has no button named "Fullscreen"

#### Scenario: Waiting for an answer
- **WHEN** a mod whose `api` range does not match is opened and the API question is shown
- **THEN** the stage bar has no button named "Fullscreen"

#### Scenario: From the menu on a phone
- **WHEN** a mod runs on a 360×740 viewport and the user opens the "More actions" menu
- **THEN** the menu holds a "Fullscreen" item, and the stage bar has no button named "Fullscreen"

### Requirement: Mosaic name while loading or after a failure
For a run link with a `mosaic`, until the mosaic file is loaded the stage bar SHALL show one capsule "Loading mosaic…" in place of the three capsules, and when the sandbox failed before the mosaic file was loaded, "Mosaic not loaded". Once the mosaic file is loaded, the mosaic capsule SHALL show the mosaic's title, and the mod and collection capsules follow their own rules.

#### Scenario: Missing mosaic file
- **WHEN** a run link names a mosaic file that answers HTTP 404
- **THEN** the stage bar shows "Mosaic not loaded" and no version

#### Scenario: Missing mod of a mosaic
- **WHEN** a mosaic names a mod folder whose mod file answers HTTP 404
- **THEN** the mosaic capsule shows the mosaic's title and the mod capsule shows "Mod not loaded"

### Requirement: Combination sandboxes
A combination sandbox SHALL be one opened from a mosaic, from a link with a collection or a tile, or from a link whose mod the catalog or recently used holds. Any other sandbox, such as an explorer or a viewer opened without a collection or tile, SHALL show its mod's name and version as a plain title, with no capsule and no list.

#### Scenario: Catalog mod without a collection
- **WHEN** the user chose "None" in the collection list of a Book List sandbox
- **THEN** the new sandbox is a combination sandbox, and its collection capsule shows "None"

#### Scenario: Mod viewer
- **WHEN** the mod viewer runs with a `target` and no collection
- **THEN** the stage bar shows the mod viewer's title and version plainly and has no capsule

### Requirement: Combination capsules
A combination sandbox's title SHALL be three capsules, in order: the mod capsule, a `+`, the collection capsule, an arrow, and the mosaic capsule. Each SHALL have an icon of its kind, its title and a chevron, and SHALL open its list (see `combination-pickers`). The `+` and the arrow SHALL be hidden from assistive technologies. Each capsule's accessible name SHALL be its kind and its full title, as the capsule shows it, such as "Mod: Country Map".

#### Scenario: Laureates on the map
- **WHEN** the mosaic "Nobel laureates on the map" runs
- **THEN** the capsules show `Country Map`, `Nobel Prize in Literature laureates` and `Nobel laureates on the map`, and no version
- **AND** the collection capsule's accessible name is "Collection: Nobel Prize in Literature laureates"
- **AND** the mod capsule's accessible name is "Mod: Country Map"

#### Scenario: Tooltip of a cut title
- **WHEN** the mod capsule's title of "Nobel laureates on the map" is cut with an ellipsis and the pointer rests on it
- **THEN** its tooltip says "Mod: Country Map", with no version

### Requirement: Capsule contents
The mod capsule SHALL show the mod's title, without its version. The collection capsule SHALL show the collection's title once its file is loaded, "Loading collection…" before, "Collection not loaded" after a failure, the decoded file name of the tile for a tile link, or "None". The mosaic capsule SHALL show the mosaic's title, or, for a sandbox not opened from a mosaic, "Unsaved combination" with a dashed border. A sandbox shown with a plain title (see "Combination sandboxes") SHALL keep the mod's name and version in that title.

#### Scenario: Unsaved combination
- **WHEN** a run link opens Book List with the laureates' collection
- **THEN** the mosaic capsule says "Unsaved combination" and has a dashed border

#### Scenario: Missing collection file
- **WHEN** a run link names a collection that answers HTTP 404
- **THEN** the collection capsule shows "Collection not loaded"

#### Scenario: Wide bar
- **WHEN** "Nobel laureates on the map" runs on a 2560×1080 viewport
- **THEN** the mod capsule shows `Country Map` and no version

#### Scenario: Plain title keeps its version
- **WHEN** the mod viewer runs from a run link without a collection
- **THEN** the stage bar shows the mod viewer's title and its version

### Requirement: Sites chip
For a sandbox opened with `sites`, the stage bar SHALL show a chip after the mosaic capsule with a shield icon and the number of `show` lines of that mosaic, named "Sites from <mosaic title>". Pressing it SHALL open a popover that lists each line's host, reason and whether it was granted, and has a button "Stop using these sites" that opens the same combination without `sites`.

#### Scenario: Kept covers
- **WHEN** the user chose Flashcards in the mod list of "Books by Nobel laureates"
- **THEN** a chip named "Sites from Books by Nobel laureates" shows `4`, and its popover lists `https://covers.openlibrary.org` as granted

#### Scenario: Stop using them
- **WHEN** the user presses "Stop using these sites"
- **THEN** a sandbox runs Flashcards with the laureates' books from a run link with no `sites`, and the stage bar has no chip

### Requirement: More actions menu
The "More actions" button (`…`) SHALL open a menu that holds "Copy link" and, for a sandbox opened with a collection or a tile, "Reload tiles". On a stage bar under 288px wide, it SHALL also hold the edit button's action, when the sandbox has one (see "Edit button"). On a narrow stage bar (see "The bar folds as it narrows"), it SHALL also hold "Theater mode" and, while the sandbox has a running mod frame, "Fullscreen" (see "Theater mode button" and "Fullscreen button"). Every item's icon and label SHALL start at the same distance from the menu's left edge; "Theater mode" SHALL show its check, while theater mode is on, at the item's end. "Copy link" SHALL copy the full address of the app with the sandbox's run link as its hash, close the menu, and show "Link copied" at the button for a moment, also announced to assistive technologies, or "Cannot copy the link" when the clipboard refuses.

#### Scenario: Copy the link
- **WHEN** the user opens the "More actions" menu of the app at `https://example.org/` and chooses "Copy link"
- **THEN** the clipboard holds `https://example.org/` followed by the sandbox's run link hash, the menu closes, and "Link copied" shows at the button

#### Scenario: Copy refused
- **WHEN** the user chooses "Copy link" and the clipboard refuses the text
- **THEN** "Cannot copy the link" shows at the button

#### Scenario: No collection
- **WHEN** the user opens the "More actions" menu of a sandbox without a collection or a tile
- **THEN** the menu holds "Copy link" and no "Reload tiles"

#### Scenario: Keyboard
- **WHEN** the user moves the focus to the "More actions" button and presses Enter
- **THEN** the menu opens with "Copy link" focused

#### Scenario: Wide bar keeps the menu short
- **WHEN** a mod runs on a 1280×800 viewport and the user opens the "More actions" menu
- **THEN** the menu holds no "Theater mode", no "Fullscreen" and no edit item

#### Scenario: Items line up on a phone
- **WHEN** a mod with a collection runs on a 360×740 viewport, theater mode is on, and the user opens the "More actions" menu
- **THEN** the icons of "Copy link", "Reload tiles" and "Theater mode" share their left edge, within 1 pixel, and the check of "Theater mode" is right of its label

### Requirement: Long titles
No capsule SHALL be wider than 16rem. A title that does not fit SHALL end with an ellipsis, and its capsule's tooltip SHALL give the full title. When the capsules do not fit, the collection capsule SHALL shrink first, then the mod capsule, then the mosaic capsule. For a sandbox not opened from a mosaic, the mosaic capsule SHALL shrink before the mod capsule.

#### Scenario: Long collection title
- **WHEN** the bar is too narrow for the three titles of "Nobel laureates on the map"
- **THEN** the collection capsule's title is cut with an ellipsis first, and hovering it shows the full title

### Requirement: The bar folds as it narrows
The stage bar SHALL be narrow when it is under 480px wide, or when its capsules, at their minimum width, do not fit beside the bar's other items; otherwise it SHALL be wide. A bar that is narrow because its capsules did not fit SHALL become wide again once they fit. The left side SHALL follow the stage bar's width:
- at least 720px: everything shown;
- 480px to 719px: the mod and collection capsules show only their icons;
- on a narrow bar: one capsule that looks like the mosaic capsule, with its icon and its title (see "Capsule contents"), so "Unsaved combination" with a dashed border for a sandbox not opened from a mosaic. Its accessible name SHALL be "Combination: <that title>". Its menu SHALL have "Mosaic: <mosaic capsule's title>", "Mod: <mod capsule's title>" and "Collection: <collection capsule's title>" rows that open their lists.

No capsule SHALL be narrower than its padding, its icon, its chevron and the gaps between them, so its icons always stay inside it. The right side SHALL fold on a narrow bar as "One-row stage bar" says. A change of width while the bar stays wide, or stays narrow, SHALL NOT move any item of the bar's right side.

#### Scenario: Narrow bar
- **WHEN** the stage bar of "Nobel laureates on the map" is 660px wide
- **THEN** the mod and collection capsules show only their icons, with their full titles in their accessible names, and the mosaic capsule shows its title

#### Scenario: Titles from 720px
- **WHEN** the stage bar of "Nobel laureates on the map" is 800px wide
- **THEN** the three capsules show their titles

#### Scenario: Phone width
- **WHEN** the stage bar is 400px wide
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and its menu's "Collection: Nobel Prize in Literature laureates" row opens the collection list

#### Scenario: Folded unsaved combination keeps the mosaic's look
- **WHEN** the stage bar of "Nobel laureates on the map" is 400px wide and the user chooses Flashcards in the mod list
- **THEN** the folded capsule has the mosaic icon, says "Unsaved combination" with a dashed border, and is named "Combination: Unsaved combination"
- **AND** its menu's rows say "Mosaic: Unsaved combination" and "Mod: Flashcards"

#### Scenario: Capsules never break
- **WHEN** the stage bar of "Nobel laureates on the map" is 630px wide, where its capsules have to shrink beside the edit button
- **THEN** every capsule's icon and chevron are inside the capsule's box, and every item of the stage bar is inside the bar

#### Scenario: Folds when the capsules do not fit
- **WHEN** the stage bar of "Nobel laureates on the map" is at least 480px wide but too narrow for its capsules at their minimum width
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and the right side holds the messages button
- **AND** once the bar is wide enough for the capsules, it shows the mod, collection and mosaic capsules and the errors, warnings and notifications buttons again

#### Scenario: The title is readable on a phone
- **WHEN** "Nobel laureates on the map" runs on a 360×740 viewport
- **THEN** its capsule is at least 80px wide and shows the start of the mosaic's title

### Requirement: Stage bar beside the hamburger chip
While the sidebar is hidden, the stage bar SHALL start after the hamburger chip and a gap, so the chip never covers it. The stage bar and the sidebar's first row SHALL share the same top edge and height in every sidebar state, so the hamburger button and the stage bar are one row. The frame under the stage bar SHALL keep the full width left of the chip.

#### Scenario: Bar after the chip
- **WHEN** a mod is visible on a 1280×800 viewport and the sidebar is hidden
- **THEN** the stage bar's left edge is right of the hamburger button's right edge, and the mod's frame's left edge is left of the hamburger button's right edge

#### Scenario: One row with the sidebar's heading row
- **WHEN** a mod is visible on a 1280×800 viewport and the sidebar is expanded
- **THEN** the stage bar's top edge and height are those of the sidebar's first row, within 1 pixel

#### Scenario: Folding follows the space left
- **WHEN** the sidebar is hidden and the stage bar of "Nobel laureates on the map" is 660px wide after the chip
- **THEN** the mod and collection capsules show only their icons

### Requirement: Messages button on a narrow bar
On a narrow stage bar (see "The bar folds as it narrows"), one messages button SHALL take the place of the errors, warnings and notifications buttons. It SHALL show the icon of the most severe level that has messages (errors, then warnings, then notifications), or the notifications icon, dimmed, when there is none. Its capsule SHALL give the total count, as `99+` above 99, filled in the color of the most severe level with unread messages and muted once all are read.

#### Scenario: Errors and notifications
- **WHEN** the visible sandbox has one unread error and two unread notifications, and the stage bar is 340px wide
- **THEN** the stage bar has one messages button, with the errors icon and `3` in a capsule filled in the errors' color

#### Scenario: All read
- **WHEN** the user opened and closed the messages popover of that sandbox
- **THEN** the messages button's capsule shows `3` and is muted

#### Scenario: No messages
- **WHEN** the visible sandbox has no messages and the stage bar is 340px wide
- **THEN** the messages button is dimmed, shows the notifications icon and no capsule, and stays focusable

#### Scenario: Accessible name
- **WHEN** the visible sandbox has one unread error and two read notifications, and the stage bar is 340px wide
- **THEN** the messages button's accessible name gives 1 error, 0 warnings, 2 notifications and 1 unread

### Requirement: Messages popover on a narrow bar
Pressing the messages button SHALL open one popover that lists the visible sandbox's messages grouped by level, errors first, then warnings, then notifications, each group under its level's heading and newest first. A level without messages SHALL be left out, and a sandbox without messages SHALL show "No messages.". The items SHALL behave as in the level popovers: unread marks, read state, dismiss buttons and "Clear all" for notifications.

#### Scenario: Grouped messages
- **WHEN** the visible sandbox has one error and two notifications, the stage bar is 340px wide and the user presses the messages button
- **THEN** the popover shows the heading "Errors" with the error, then the heading "Notifications" with the two notifications, newest first, and no "Warnings" heading

#### Scenario: Opening marks everything read
- **WHEN** the user opens the messages popover of a sandbox with unread messages of two levels
- **THEN** the items are marked "Unread" while it is open, and once it closes the messages button's capsule is muted

#### Scenario: Dismiss from the grouped popover
- **WHEN** the messages popover lists two notifications and the user dismisses the first
- **THEN** the popover lists one notification and the capsule's count is one lower

#### Scenario: Empty
- **WHEN** the visible sandbox has no messages and the user presses the messages button
- **THEN** the popover says "No messages."

### Requirement: Stage bar tooltips need a pointer that can hover
The tooltips of the stage bar, of its capsules and chip, and of the lists it opens SHALL open only on a device whose primary pointer can hover. On a device that cannot, tapping an element SHALL NOT leave a tooltip on screen. Every tooltip's text SHALL also be in its element's accessible name or visible text.

#### Scenario: Tap on a phone
- **WHEN** on a touch-only phone the user taps the messages button, then taps it again to close its popover
- **THEN** no tooltip is shown

#### Scenario: Hover on a desktop
- **WHEN** on a desktop the pointer rests on the theater mode button
- **THEN** a tooltip with the text "Theater mode" is shown

### Requirement: Edit button
A combination sandbox SHALL have an edit button with a pencil icon, whose accessible name and tooltip say what it does:
- "Edit mosaic", for a sandbox opened from a stored mosaic;
- "Edit a copy", for one opened from any other mosaic;
- "Edit as a new mosaic", for a sandbox not opened from a mosaic, with a collection or "None".

#### Scenario: Unsaved combination
- **WHEN** a run link opens Flashcards with the laureates' collection
- **THEN** the stage bar has a button named "Edit as a new mosaic" between the mosaic capsule and the "More actions" button

#### Scenario: Sample mosaic
- **WHEN** "Nobel laureates on the map" runs
- **THEN** the stage bar has a button named "Edit a copy"

### Requirement: Sandboxes without an edit button
A sandbox opened with a tile, and a sandbox shown with a plain title (see "Combination sandboxes"), SHALL have no edit button.

#### Scenario: Tile link
- **WHEN** a run link opens the tile viewer with a tile
- **THEN** the stage bar has no edit button

#### Scenario: Plain title
- **WHEN** the mod viewer runs from a run link without a collection
- **THEN** the stage bar has no edit button

### Requirement: Edit button on a narrow bar
The edit button SHALL be on the bar while the stage bar is at least 288px wide, its width on a 360px wide viewport. On a narrower bar, the "More actions" menu SHALL hold the same action instead, with the same name and the pencil icon (see "More actions menu").

#### Scenario: Edit button on a phone
- **WHEN** an unsaved combination runs on a 360×740 viewport
- **THEN** the edit button is at least 32px, fully inside the stage bar, and the capsule is at least 80px wide and shows the start of its title
- **AND** choosing the button with a tap opens the viewer

#### Scenario: Smaller than a phone
- **WHEN** "Nobel laureates on the map" runs on a 320×640 viewport
- **THEN** the stage bar has no edit button, and the "More actions" menu holds "Edit a copy", which opens the viewer
- **AND** the page cannot scroll sideways

### Requirement: Choosing the edit button
Choosing the edit button, or its item in the "More actions" menu, SHALL open the mosaic viewer in a new sandbox, in the mode its name says (see "Mosaic viewer modes from the link" in `default-mods`), and leave the current sandbox behind it, so back returns to it.

#### Scenario: Back to the mosaic
- **WHEN** "Nobel laureates on the map" runs and the user chooses "Edit a copy", then goes back
- **THEN** the country map runs "Nobel laureates on the map" again

### Requirement: Edit button links
The edit button SHALL open `#/run?mod=mosaic_viewer&target=<mosaic>&mode=edit` for "Edit mosaic", the same with `mode=copy` for "Edit a copy", and `#/run?mod=mosaic_viewer&mode=new&draft_mod=<mod>` for "Edit as a new mosaic", with `draft_collection=<collection>` when the sandbox has one and `draft_sites=<sites>` when it was opened with `sites`. Each address SHALL be the resolved one.

#### Scenario: Edit the combination
- **WHEN** the user chooses "Edit as a new mosaic" in the stage bar of Flashcards with the laureates' collection
- **THEN** the mosaic viewer runs in edit mode with `mode=new`, `draft_mod` the flashcards mod file's address and `draft_collection` the collection file's address, and nothing is stored until the user saves
- **AND** back returns to Flashcards
