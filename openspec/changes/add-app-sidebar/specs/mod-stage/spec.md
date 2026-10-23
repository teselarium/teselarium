# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Home mod`
- TO: `### Requirement: Home`

- FROM: `### Requirement: Several sandboxes, one visible`
- TO: `### Requirement: Several sandboxes, at most one visible`

## MODIFIED Requirements

### Requirement: Home
The app SHALL show Home for an empty hash, for `#/`, and for any hash that is neither a run link with a non-empty `mod` nor the address of a page. Home SHALL be the target of the registry's Home section: a page in the vanilla app, or a mod that an instantiation chooses, which runs in a sandbox like any other mod. The app page SHALL keep the `OpenTesela` heading.

#### Scenario: No hash
- **WHEN** the app is opened with no hash
- **THEN** the page shows the `OpenTesela` heading and the Home page, and no mod frame is visible

#### Scenario: Unknown hash
- **WHEN** the app is opened at `#/mods/view`
- **THEN** the Home page is shown

#### Scenario: Home as a mod
- **WHEN** an instantiation sets the Home section's target to the mod `mod_explorer` and the app is opened with no hash
- **THEN** the mod explorer is the visible mod

### Requirement: Several sandboxes, at most one visible
Each sandbox SHALL have an id that the app gives it, unique in the page. Opening a link, whether the user followed it or a mod asked for it, SHALL create a new sandbox and hide the visible one without stopping it. Activating a sidebar section SHALL instead show an open sandbox when the section has one to show. At most one sandbox SHALL be visible at a time, and none while a page is shown. Hiding or showing a sandbox SHALL NOT reload its frame.

#### Scenario: Second link hides the first mod
- **WHEN** the sample book list mod is running and the user follows a run link to another mod
- **THEN** two mod frames are in the page, only the second is visible, and the first is still running

#### Scenario: A page hides the mods
- **WHEN** the sample book list mod is running and the user opens Settings
- **THEN** no mod frame is visible, the book list's frame is still in the page, and its mod is still running

### Requirement: Close a sandbox
The stage bar SHALL have a close button (×) for the visible sandbox, except for a home mod shown at `#/`. Closing SHALL stop the mod, remove its frame, and show the sandbox that opened it when that sandbox is still open, or Home otherwise. The current history entry SHALL be replaced by the entry of what is shown.

#### Scenario: Close the viewer
- **WHEN** the mod explorer opened the mod viewer and the user presses × on the viewer
- **THEN** the viewer's frame is removed and the explorer is visible in the state it was left in

#### Scenario: Close a mod opened from a link
- **WHEN** the user opened a run link directly and presses ×
- **THEN** the mod's frame is removed and the Home page is shown

#### Scenario: Home mod has no close button
- **WHEN** an instantiation's Home section targets the mod `mod_explorer` and that mod is visible at `#/`
- **THEN** the stage bar has no close button

#### Scenario: The explorer can be closed
- **WHEN** the user opened Mods in the vanilla app
- **THEN** the stage bar has a close button, and pressing it removes the explorer's frame and shows the Home page

### Requirement: The visible frame fills the stage area
The visible sandbox's frame SHALL fill the stage area: the page's width left beside the sidebar, and the viewport height left under the app header and the stage bar, following the window's size and the sidebar's width. The frame's size SHALL NOT depend on the mod's content: content taller than the frame SHALL scroll inside the frame, not the page. The frame SHALL be at least 16rem tall; when less room is left, the page scrolls.

#### Scenario: Frame reaches the bottom of the viewport
- **WHEN** the sample book list mod runs in a 1280×800 viewport
- **THEN** the page does not scroll and the frame's bottom edge is within 24 pixels of the viewport's bottom edge

#### Scenario: Window resized
- **WHEN** the viewport is resized from 1280×800 to 1024×600 while the sample book list mod runs
- **THEN** the frame's bottom edge is within 24 pixels of the new viewport's bottom edge

#### Scenario: Tall content scrolls inside the frame
- **WHEN** a mod whose content is 3000 pixels tall runs in a 1280×800 viewport
- **THEN** the frame's height is the same as for the sample book list mod, the frame's document can scroll, and the page does not scroll

#### Scenario: Small viewport
- **WHEN** the sample book list mod runs in a 1280×300 viewport
- **THEN** the frame is 16rem tall and the page can scroll

#### Scenario: Frame beside the sidebar
- **WHEN** the sample book list mod runs in a 1280×800 viewport with the sidebar expanded
- **THEN** the frame's left edge is right of the sidebar's right edge, and its right edge is within 24 pixels of the viewport's right edge

## ADDED Requirements

### Requirement: Pages in the history
Showing a page SHALL give it a history entry in the same history as the sandboxes. Back and forward SHALL move between pages and sandboxes, showing each sandbox in the state it was left in. Reloading the app page on a page's entry SHALL show that page. Opening a link or a section after going back SHALL drop the forward entries, pages included, and close every sandbox that no remaining entry points to.

#### Scenario: Back from a page to a mod
- **WHEN** a mod sets a value in its frame's memory, the user opens Settings and presses the browser's back button
- **THEN** the mod is visible again, its frame was not reloaded and the value is still in its memory

#### Scenario: Forward to a page
- **WHEN** the user went back from Settings to a mod and presses the browser's forward button
- **THEN** the Settings page is shown

#### Scenario: Reload on a page
- **WHEN** the user opened About and the app page is reloaded
- **THEN** the About page is shown, and the browser's back button shows what was shown before About

#### Scenario: New section after going back
- **WHEN** the user opened the book list through a link, then Settings, went back twice to Home, and opens Mods
- **THEN** the book list's frame is removed
