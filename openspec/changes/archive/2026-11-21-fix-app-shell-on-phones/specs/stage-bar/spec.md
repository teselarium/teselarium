# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: One-row stage bar
While a sandbox is visible, the stage bar SHALL be one row above its frame. Its left side SHALL hold the sandbox's title, as capsules for a combination sandbox (see "Combination capsules") or as a plain title otherwise, then the "More actions" button. On a wide bar (see "The bar folds as it narrows"), its right side SHALL hold, in order, the errors, warnings and notifications buttons, a separator, the theater mode button, the fullscreen button when the sandbox has a running mod frame and, when the sandbox has a close button, a separator and the close button. On a narrow bar, its right side SHALL hold the messages button and, when the sandbox has a close button, a separator and the close button. No list of messages SHALL be shown under the bar.

#### Scenario: Sample mod with its collection
- **WHEN** a mod opened from a run link runs with a collection
- **THEN** the stage bar shows, from left to right, the mod capsule, the collection capsule, the mosaic capsule, the "More actions" button, the errors, warnings and notifications buttons, the theater mode button, the fullscreen button and the close button
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

### Requirement: The bar folds as it narrows
The stage bar SHALL be narrow when it is under 480px wide, or when its capsules, at their minimum width, do not fit beside the bar's other items; otherwise it SHALL be wide. A bar that is narrow because its capsules did not fit SHALL become wide again once they fit. The left side SHALL follow the stage bar's width:
- at least 960px: everything shown;
- 720px to 959px: no version in the mod capsule, which moves to the mod list's details;
- 480px to 719px: the mod and collection capsules show only their icons;
- on a narrow bar: one capsule with the mosaic's title, or the mod's for an unsaved combination, whose menu has "Mosaic", "Mod" and "Collection" rows that open their lists.

No capsule SHALL be narrower than its padding, its icon, its chevron and the gaps between them, so its icons always stay inside it. The right side SHALL fold on a narrow bar as "One-row stage bar" says. A change of width while the bar stays wide, or stays narrow, SHALL NOT move any item of the bar's right side.

#### Scenario: Narrow bar
- **WHEN** the stage bar of "Nobel laureates on the map" is 600px wide
- **THEN** the mod and collection capsules show only their icons, with their full titles in their accessible names, and the mosaic capsule shows its title

#### Scenario: Phone width
- **WHEN** the stage bar is 400px wide
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and its menu's "Collection" row opens the collection list

#### Scenario: Capsules never break
- **WHEN** the stage bar of "Nobel laureates on the map" is 575px wide, as on a landscape phone with the sidebar expanded, where its capsules have to shrink
- **THEN** every capsule's icon and chevron are inside the capsule's box, and every item of the stage bar is inside the bar

#### Scenario: Folds when the capsules do not fit
- **WHEN** the stage bar of "Nobel laureates on the map" is at least 480px wide but too narrow for its capsules at their minimum width
- **THEN** the left side holds one capsule `Nobel laureates on the map`, and the right side holds the messages button
- **AND** once the bar is wide enough for the capsules, it shows the mod, collection and mosaic capsules and the errors, warnings and notifications buttons again

#### Scenario: The title is readable on a phone
- **WHEN** "Nobel laureates on the map" runs on a 360×740 viewport
- **THEN** its capsule is at least 120px wide and shows the start of the mosaic's title

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

### Requirement: More actions menu
The "More actions" button (`…`) SHALL open a menu that holds "Copy link" and, for a sandbox opened with a collection or a tile, "Reload tiles". On a narrow stage bar (see "The bar folds as it narrows"), it SHALL also hold "Theater mode" and, while the sandbox has a running mod frame, "Fullscreen" (see "Theater mode button" and "Fullscreen button"). "Copy link" SHALL copy the full address of the app with the sandbox's run link as its hash, close the menu, and show "Link copied" at the button for a moment, also announced to assistive technologies, or "Cannot copy the link" when the clipboard refuses.

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
- **THEN** the menu holds no "Theater mode" and no "Fullscreen" item
