## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold, in order, the mod's name, its version in a capsule, an information button, a Share button and, for a sandbox opened with a collection, the "Reload tiles" button. Its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** a mod opened from a run link runs with a collection
- **THEN** the stage bar shows, from left to right, the mod's name, its version in a capsule, the information button, the Share button, the "Reload tiles" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
- **AND** the stage bar is a single row

#### Scenario: No collection
- **WHEN** a mod opened from a run link runs without a collection
- **THEN** the stage bar has no "Reload tiles" button and its other items keep their order

#### Scenario: Close button last
- **WHEN** a mod opened from a run link runs
- **THEN** the close button is the stage bar's rightmost item, after a separator

#### Scenario: Home mod without a close button
- **WHEN** a home mod is shown at `#/`
- **THEN** the fullscreen button is the stage bar's rightmost item, and no separator follows it

### Requirement: Name while loading or after a failure
Until the mod file is loaded, the stage bar SHALL show "Loading mod…" in place of the name and version. When the sandbox failed before its mod file was loaded, it SHALL show "Mod not loaded". Once the mod file is loaded, it SHALL show the mod's name and version, even when the sandbox failed later.

#### Scenario: Missing mod file
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404
- **THEN** the stage bar shows "Mod not loaded" and no version capsule

#### Scenario: Missing collection
- **WHEN** a mod is opened with a collection that answers HTTP 404
- **THEN** the stage bar shows the mod's name and version

#### Scenario: Cancelled API question
- **WHEN** a mod with `api: "^0.2.0"` is opened and the user presses "Cancel"
- **THEN** the stage bar shows the mod's name and version

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

### Requirement: Empty levels are dimmed
A message button whose level has no messages SHALL be dimmed, with no capsule, and SHALL stay focusable. Its popover SHALL say "No errors.", "No warnings." or "No notifications.".

#### Scenario: Sample mod has no issues
- **WHEN** a mod runs with a collection, and neither the mod file nor the collection has an issue
- **THEN** the errors and warnings buttons are dimmed, and the errors popover says "No errors."

#### Scenario: Keyboard reaches an empty level
- **WHEN** the visible sandbox has no warnings and the user moves the focus with Tab
- **THEN** the warnings button receives the focus

### Requirement: Information popover
The information button SHALL open a popover with the mod's source, the collection's location when the sandbox was opened with one, and the sandbox's run link, as text the user can select. The popover SHALL have no copy button: the Share menu copies the link.

#### Scenario: Sample mod with its collection
- **WHEN** a mod runs with a collection and the user presses the information button
- **THEN** the popover shows the mod file's source, the collection's location and the run link, and no "Copy link" button

#### Scenario: Mod that did not load
- **WHEN** a run link names a mod folder that does not exist and the user presses the information button
- **THEN** the popover shows the run link's mod reference resolved against the app's address, and the run link

### Requirement: Notification of reloaded tiles
When "Reload tiles" loads the collection again, the sandbox SHALL get an `info` message from the app whose source is the collection's location and whose text gives the number of tiles the mod received and the number of collection issues. A reload whose collection cannot be loaded SHALL give its error and no notification.

#### Scenario: Reload done
- **WHEN** a mod runs with a collection that now lists two tiles and the user presses "Reload tiles"
- **THEN** the notifications popover lists an item labeled "App" that names 2 tiles and 0 issues

#### Scenario: Reload failed
- **WHEN** the collection answers HTTP 404 when the user presses "Reload tiles"
- **THEN** an error names the collection's location, and no new notification is added

### Requirement: Notification of the loaded collection
When a mod opened with a collection starts, the sandbox SHALL get an `info` message from the app whose source is the collection's location and whose text gives the number of tiles the mod received.

#### Scenario: Sample collection
- **WHEN** a mod starts with a collection of three tiles of its type
- **THEN** the notifications popover lists an item labeled "App" that names 3 tiles

#### Scenario: No collection
- **WHEN** a mod starts without a collection
- **THEN** the notifications button is dimmed

### Requirement: Messages from the mod in the stage bar
Each `ui.notify` the engine accepts SHALL add a message from the mod to the mod's sandbox, with the request's level and text, and with the request's `source` or, without one, the mod's source. A hidden sandbox SHALL keep the message and show it when it is visible again.

#### Scenario: Default source
- **WHEN** a running mod sends `ui.notify` with `{ "message": "Saved" }`
- **THEN** the notifications popover lists `Saved`, labeled "Mod", whose source is the mod's source

#### Scenario: Hidden mod notifies
- **WHEN** the mod explorer opened the mod viewer and the hidden explorer sends `ui.notify` with `{ "message": "Done" }`
- **THEN** the viewer's stage bar does not list `Done`, and going back to the explorer lists it

### Requirement: Fullscreen button
The stage bar SHALL have an icon button whose accessible name and tooltip are "Fullscreen" while the visible sandbox has a running mod frame, and none while its mod loads, waits for an answer or failed. Pressing it SHALL show the visible mod fullscreen (see `stage-layout`).

#### Scenario: Running mod
- **WHEN** a mod runs
- **THEN** the stage bar has a button named "Fullscreen"

#### Scenario: Failed sandbox
- **WHEN** a run link names a mod file that cannot be loaded
- **THEN** the stage bar has no button named "Fullscreen"

#### Scenario: Waiting for an answer
- **WHEN** a mod whose `api` range does not match is opened and the API question is shown
- **THEN** the stage bar has no button named "Fullscreen"
