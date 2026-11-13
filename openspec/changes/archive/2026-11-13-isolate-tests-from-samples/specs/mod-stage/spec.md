## MODIFIED Requirements

### Requirement: Open a mod from a run link
The app SHALL open a mod for the address hash `#/run`, with the query parameter `mod` (a mod reference), the optional parameter `collection` (location of a collection file) and any other parameters, which the mod receives in its context. Relative references and locations SHALL be resolved against the app's address. Each run link SHALL open in a new sandbox, which becomes the visible one, and the stage bar SHALL show the mod's title and version.

#### Scenario: Link with a mod and a collection
- **WHEN** the app is opened at a run link with a `mod` and a `collection` of three tiles of the mod's type
- **THEN** the stage bar shows the mod's name and version, and the mod receives the three tiles

#### Scenario: Link without a collection
- **WHEN** the app is opened at a run link with a `mod` and no `collection`
- **THEN** the mod runs with no tiles and no collection file is requested

#### Scenario: Encoded values
- **WHEN** the app is opened with a run link whose `mod` is the percent-encoded absolute URL of a mod file
- **THEN** the mod runs

### Requirement: Several sandboxes, at most one visible
Each sandbox SHALL have an id that the app gives it, unique in the page. Opening a link, whether the user followed it or a mod asked for it, SHALL create a new sandbox and hide the visible one without stopping it. Activating a sidebar section SHALL instead show an open sandbox when the section has one to show. At most one sandbox SHALL be visible at a time, and none while a page is shown. Hiding or showing a sandbox SHALL NOT reload its frame.

#### Scenario: Second link hides the first mod
- **WHEN** a mod is running and the user follows a run link to another mod
- **THEN** two mod frames are in the page, only the second is visible, and the first is still running

#### Scenario: A page hides the mods
- **WHEN** a mod is running and the user opens Settings
- **THEN** no mod frame is visible, the mod's frame is still in the page, and its mod is still running

### Requirement: Show load failures
When the mod file, its entrypoint, its tile type file or the collection file cannot be loaded, the sandbox SHALL show an error naming the file that failed and the reason, and SHALL NOT start a mod frame. The same failure SHALL also be an error from the app in the stage bar, whose source is the address of the file that failed and whose text is the reason. The sandbox SHALL keep its history entry and its close button.

#### Scenario: Missing mod file
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404
- **THEN** the stage shows an error that names the mod file's resolved address and `404`
- **AND** no mod frame is shown

#### Scenario: Missing collection
- **WHEN** a run link names a mod and a collection that answers HTTP 404
- **THEN** the stage shows an error that names the collection's resolved address
- **AND** no mod frame is shown

#### Scenario: Load failure in the errors popover
- **WHEN** a run link names a mod folder whose mod file answers HTTP 404, and the user opens the errors popover
- **THEN** it lists one error labeled "App" whose source is the mod file's resolved address and whose text names `404`

### Requirement: Reload the tiles
For a sandbox opened with a collection, the stage bar SHALL have a "Reload tiles" icon button, with "Reload tiles" as its accessible name and tooltip, that loads and validates the collection again and pushes the result to the running mod as a `tiles.changed` event, without restarting the mod. New collection issues SHALL replace the previous collection issues in the sandbox's messages, and SHALL be unread. A sandbox opened without a collection SHALL have no "Reload tiles" button.

#### Scenario: Reload after the collection changed
- **WHEN** a mod is running with a collection, the collection file now lists two tiles, and the user presses "Reload tiles"
- **THEN** the mod receives the two tiles and the frame was not reloaded

#### Scenario: No collection, no reload
- **WHEN** a mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button

#### Scenario: Reloaded issues are unread
- **WHEN** the user read the warnings of a sandbox, the collection file now has a tile that does not match the mod's type, and the user presses "Reload tiles"
- **THEN** the warnings popover lists the tile's issue and the warnings capsule is filled

### Requirement: The visible frame fills the stage area
The visible sandbox's frame SHALL fill the stage area: the page's width left beside the sidebar, and the viewport height left under the app header and the stage bar, following the window's size and the sidebar's width. The frame's size SHALL NOT depend on the mod's content: content taller than the frame SHALL scroll inside the frame, not the page. The frame SHALL be at least 16rem tall; when less room is left, the page scrolls.

#### Scenario: Frame reaches the bottom of the viewport
- **WHEN** a mod runs in a 1280×800 viewport
- **THEN** the page does not scroll and the frame's bottom edge is within 24 pixels of the viewport's bottom edge

#### Scenario: Window resized
- **WHEN** the viewport is resized from 1280×800 to 1024×600 while a mod runs
- **THEN** the frame's bottom edge is within 24 pixels of the new viewport's bottom edge

#### Scenario: Tall content scrolls inside the frame
- **WHEN** a mod whose content is 3000 pixels tall runs in a 1280×800 viewport
- **THEN** the frame's height is the same as for a mod with short content, the frame's document can scroll, and the page does not scroll

#### Scenario: Small viewport
- **WHEN** a mod runs in a 1280×300 viewport
- **THEN** the frame is 16rem tall and the page can scroll

#### Scenario: Frame beside the sidebar
- **WHEN** a mod runs in a 1280×800 viewport with the sidebar expanded
- **THEN** the frame's left edge is right of the sidebar's right edge, and its right edge is within 24 pixels of the viewport's right edge

## REMOVED Requirements

### Requirement: Sample book list mod
**Reason**: It describes the shipped book list sample, which `sample-book-list` owns, and the core's tests should not depend on an example.
**Migration**: `sample-book-list` keeps every behavior. Its "Mod file" requirement declares the sample collection and holds "Books with covers". "Selection is remembered" was the same check as "Remembered books per row" › "Choice kept across starts", which stays.
