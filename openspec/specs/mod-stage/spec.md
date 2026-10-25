# mod-stage Specification

## Purpose

Opens mods from shareable links, each in its own sandbox, and navigates between them and the app's pages like pages of one site: several sandboxes stay open at once, at most one is visible and none while a page is shown, the browser's back and forward buttons return to a page or to a sandbox in the state it was left in, and a close button closes a sandbox. A stage bar shows the visible mod, the issues found while starting and running it, and can reload its tiles. Mods never own a route: they are values of the link's parameters. It comes with a very simple sample mod.

## Requirements

### Requirement: Open a mod from a run link
The app SHALL open a mod for the address hash `#/run`, with the query parameter `mod` (a mod reference), the optional parameter `collection` (location of a collection file) and any other parameters, which the mod receives in its context. Relative references and locations SHALL be resolved against the app's address. Each run link SHALL open in a new sandbox, which becomes the visible one, and the stage bar SHALL show the mod's title and version.

#### Scenario: Link with a mod and a collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml`
- **THEN** the stage bar shows `Book List` and `1.0.0`, and the mod's frame lists the three sample books

#### Scenario: Link without a collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list`
- **THEN** the sample book list mod runs with no tiles and no collection file is requested

#### Scenario: Encoded values
- **WHEN** the app is opened with a run link whose `mod` is the percent-encoded absolute URL of the sample book list mod file
- **THEN** the sample book list mod runs

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

### Requirement: Back and forward keep the sandbox state
Each opened sandbox SHALL get its own browser history entry. Going back or forward to the entry of a sandbox that is still open SHALL show that sandbox in the state it was left in. Going to an entry whose sandbox was closed, or any entry after the page was reloaded, SHALL open its link again in a new sandbox.

#### Scenario: Back to the previous mod
- **WHEN** a mod sets a value in its frame's memory, a second mod is opened, and the user presses the browser's back button
- **THEN** the first mod is visible again, its frame was not reloaded and the value is still in its memory

#### Scenario: Forward again
- **WHEN** the user went back from a second mod and presses the browser's forward button
- **THEN** the second mod is visible again and its frame was not reloaded

#### Scenario: Back after a page reload
- **WHEN** a second mod was opened, the app page is reloaded and the user presses the browser's back button
- **THEN** the first mod's link is opened again in a new sandbox

### Requirement: Opening after going back drops the forward entries
When a link is opened while the visible sandbox is not the last history entry, the forward entries SHALL be dropped, as a browser drops them, and every sandbox that no remaining entry points to SHALL be closed.

#### Scenario: New link after going back
- **WHEN** the user opened mod A, then mod B, went back to mod A and opens mod C
- **THEN** mod B's sandbox is closed and its frame is removed

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

### Requirement: Show the mod issues
The stage bar SHALL list every issue of the visible sandbox found while starting and running its mod, in the order they were found: tile collection issues, permission issues, blocked requests, mount failures and a stopped mod. Each item SHALL show the level, the source and the message. With no issues, it SHALL say so. Each sandbox SHALL keep its own issues.

#### Scenario: Sample mod has no issues
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the stage bar says that there are no issues

#### Scenario: Foreign mod permission issue is listed
- **WHEN** a mod from another origin that declares a `show` permission is opened
- **THEN** the issue list has a warning whose source is the mod's source and whose message names the permission

#### Scenario: Blocked request is listed while the mod runs
- **WHEN** a running mod requests an image from an undeclared host
- **THEN** the issue list gains a warning that names the host and `permissions.show`

#### Scenario: Issues stay with their sandbox
- **WHEN** a mod with a blocked request is hidden by opening the sample book list mod
- **THEN** the stage bar says that there are no issues, and going back shows the blocked request again

### Requirement: Show load failures
When the mod file, its entrypoint, its tile type file or the collection file cannot be loaded, the sandbox SHALL show an error naming the file that failed and the reason, and SHALL NOT start a mod frame. The sandbox SHALL keep its history entry and its close button.

#### Scenario: Missing mod file
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing`
- **THEN** the stage shows an error that names the mod file's resolved address and `404`
- **AND** no mod frame is shown

#### Scenario: Missing collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/missing.yaml`
- **THEN** the stage shows an error that names the collection's resolved address
- **AND** no mod frame is shown

### Requirement: Switched-off default mods are not opened
When a link names a default mod that is switched off, by name or by any other reference, the sandbox SHALL show an error saying that the mod is switched off, SHALL NOT request its files and SHALL NOT start a mod frame.

#### Scenario: Link to a switched-off viewer
- **WHEN** `mod_viewer` is switched off and the app is opened at `#/run?mod=./default_mods/mod_viewer/`
- **THEN** the stage shows an error that names `mod_viewer` and says that it is switched off
- **AND** no file under `./default_mods/mod_viewer/` is requested

### Requirement: Reload the tiles
For a sandbox opened with a collection, the stage bar SHALL have a "Reload tiles" button that loads and validates the collection again and pushes the result to the running mod as a `tiles.changed` event, without restarting the mod. New collection issues SHALL replace the previous collection issues in the list. A sandbox opened without a collection SHALL have no "Reload tiles" button.

#### Scenario: Reload after the collection changed
- **WHEN** the sample mod is running with the sample collection, the collection file now lists two books, and the user presses "Reload tiles"
- **THEN** the mod's frame lists two books and the frame was not reloaded

#### Scenario: No collection, no reload
- **WHEN** the sample book list mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button

### Requirement: Sample book list mod
The sample mod `book_list` SHALL list the tiles it receives with each book's title, authors and cover image, and SHALL declare the sample books as its sample collection. Selecting a book SHALL highlight it and store its source in the mod's storage slot, and the selection SHALL be highlighted again when the mod is opened later.

#### Scenario: Books with covers
- **WHEN** the sample mod runs with the sample collection from the app's origin
- **THEN** the frame shows the three books with their titles, authors and cover images

#### Scenario: Selection is remembered
- **WHEN** the user selects "Kallocain" in the sample mod and the app page is reloaded
- **THEN** "Kallocain" is highlighted in the sample mod

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
