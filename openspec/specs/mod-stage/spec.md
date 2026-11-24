# mod-stage Specification

## Purpose

Opens mods from shareable links, each in its own sandbox, and navigates between them and the app's pages like pages of one site: several sandboxes stay open at once, at most one is visible and none while a page is shown, the browser's back and forward buttons return to a page or to a sandbox in the state it was left in, and a close button closes a sandbox. A stage bar shows the visible mod, the issues found while starting and running it, and can reload its tiles. Mods never own a route: they are values of the link's parameters. It comes with a very simple sample mod.

## Requirements

### Requirement: Open a mod from a run link
The app SHALL open a mod for the address hash `#/run`, with the query parameter `mod` (a mod reference), the optional parameter `collection` (location of a collection file), the optional parameter `tile` (location of a tile file) and any other parameters, which the mod receives in its context. Relative references and locations SHALL be resolved against the app's address. Each run link SHALL open in a new sandbox, which becomes the visible one, and the stage bar SHALL show the mod's title and version.

#### Scenario: Link with a mod and a collection
- **WHEN** the app is opened at a run link with a `mod` and a `collection` of three tiles of the mod's type
- **THEN** the stage bar shows the mod's name and version, and the mod receives the three tiles

#### Scenario: Link without a collection
- **WHEN** the app is opened at a run link with a `mod` and no `collection`
- **THEN** the mod runs with no tiles and no collection file is requested

#### Scenario: Encoded values
- **WHEN** the app is opened with a run link whose `mod` is the percent-encoded absolute URL of a mod file
- **THEN** the mod runs

#### Scenario: Tile is not a parameter of the mod
- **WHEN** the app is opened at a run link with a `mod`, a `tile` and `from=x`
- **THEN** the mod's context `params` is `{ "from": "x" }`

### Requirement: Home
The app SHALL show Home for an empty hash, for `#/`, and for any hash that is neither a run link with a non-empty `mod` or a non-empty `mosaic` nor the address of a page. Home SHALL be the target of the registry's Home section: a page in the vanilla app, or a mod that an instantiation chooses, which runs in a sandbox like any other mod. The app page SHALL keep the `Teselarium` heading.

#### Scenario: No hash
- **WHEN** the app is opened with no hash
- **THEN** the page shows the `Teselarium` heading and the Home page, and no mod frame is visible

#### Scenario: Unknown hash
- **WHEN** the app is opened at `#/mods/view`
- **THEN** the Home page is shown

#### Scenario: Home as a mod
- **WHEN** an instantiation sets the Home section's target to the mod `mod_explorer` and the app is opened with no hash
- **THEN** the mod explorer is the visible mod

#### Scenario: Run link with an empty mosaic
- **WHEN** the app is opened at `#/run?mosaic=`
- **THEN** the Home page is shown

### Requirement: Several sandboxes, at most one visible
Each sandbox SHALL have an id that the app gives it, unique in the page. Opening a link, whether the user followed it or a mod asked for it, SHALL create a new sandbox and hide the visible one without stopping it, unless the mod asked to replace itself (see "Replace the visible sandbox"). Activating a sidebar section SHALL instead show an open sandbox when the section has one to show. At most one sandbox SHALL be visible at a time, and none while a page is shown. Hiding or showing a sandbox SHALL NOT reload its frame.

#### Scenario: Second link hides the first mod
- **WHEN** a mod is running and the user follows a run link to another mod
- **THEN** two mod frames are in the page, only the second is visible, and the first is still running

#### Scenario: A page hides the mods
- **WHEN** a mod is running and the user opens Settings
- **THEN** no mod frame is visible, the mod's frame is still in the page, and its mod is still running

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

### Requirement: Show load failures
When the mod file, its entrypoint, its tile type file, the collection file or the tile file of the link cannot be loaded, the sandbox SHALL show an error naming the file that failed and the reason, and SHALL NOT start a mod frame. The same failure SHALL also be an error from the app in the stage bar, whose source is the address of the file that failed and whose text is the reason. The sandbox SHALL keep its history entry and its close button.

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

#### Scenario: Missing tile
- **WHEN** a run link names a mod and a tile that answers HTTP 404
- **THEN** the stage shows an error that names the tile's resolved address and `404`
- **AND** no mod frame is shown

#### Scenario: Tile that cannot be parsed
- **WHEN** a run link names a tile whose frontmatter is not valid YAML
- **THEN** the stage shows an error that names the tile's resolved address and says that its markdown cannot be parsed

### Requirement: Switched-off default mods are not opened
When a link names a default mod that is switched off, by name or by any other reference, the sandbox SHALL show an error saying that the mod is switched off, SHALL NOT request its files and SHALL NOT start a mod frame. The same error SHALL also be an error from the app in the stage bar, whose source is the mod reference resolved against the app's address.

#### Scenario: Link to a switched-off viewer
- **WHEN** `mod_viewer` is switched off and the app is opened at `#/run?mod=./default_mods/mod_viewer/`
- **THEN** the stage shows an error that names `mod_viewer` and says that it is switched off
- **AND** no file under `./default_mods/mod_viewer/` is requested
- **AND** the stage bar shows "Mod not loaded" and its errors popover lists the same error, labeled "App"

### Requirement: Reload the tiles
For a sandbox opened with a collection or a tile, the stage bar SHALL have a "Reload tiles" icon button, with "Reload tiles" as its accessible name and tooltip, that loads and validates the collection or the tile again and pushes the result to the running mod as a `tiles.changed` event, without restarting the mod. New collection issues SHALL replace the previous collection issues in the sandbox's messages, and SHALL be unread. A sandbox opened without a collection or a tile SHALL have no "Reload tiles" button.

#### Scenario: Reload after the collection changed
- **WHEN** a mod is running with a collection, the collection file now lists two tiles, and the user presses "Reload tiles"
- **THEN** the mod receives the two tiles and the frame was not reloaded

#### Scenario: No collection, no reload
- **WHEN** a mod runs without a collection
- **THEN** the stage bar has no "Reload tiles" button

#### Scenario: Reloaded issues are unread
- **WHEN** the user read the warnings of a sandbox, the collection file now has a tile that does not match the mod's type, and the user presses "Reload tiles"
- **THEN** the warnings popover lists the tile's issue and the warnings capsule is filled

#### Scenario: Reload a tile
- **WHEN** a mod is running with a `tile`, the tile file's `title` changed, and the user presses "Reload tiles"
- **THEN** the mod receives the tile with the new `title` and the frame was not reloaded

### Requirement: The visible frame fills the stage area
The visible sandbox's frame SHALL fill the stage area: the page's width left beside the sidebar, or the whole width when the sidebar is hidden, and the viewport height left under the stage bar, following the window's size and the sidebar's width. The frame's size SHALL NOT depend on the mod's content: content taller than the frame SHALL scroll inside the frame, not the page. The frame SHALL be at least 16rem tall; when less room is left, the page scrolls.

#### Scenario: Frame reaches the bottom of the viewport
- **WHEN** a mod runs in a 1280×800 viewport
- **THEN** the page does not scroll and the frame's bottom edge is within 24 pixels of the viewport's bottom edge

#### Scenario: Window resized
- **WHEN** the viewport is resized from 1280×800 to 1024×600 while a mod runs
- **THEN** the frame's bottom edge is within 24 pixels of the new viewport's bottom edge

#### Scenario: Hidden sidebar widens the frame
- **WHEN** a mod runs in a 1280×800 viewport with the sidebar collapsed, and the user hides the sidebar
- **THEN** the frame is wider than before, its left edge is within 24 pixels of the viewport's left edge, and it was not reloaded

#### Scenario: Tall content scrolls inside the frame
- **WHEN** a mod whose content is 3000 pixels tall runs in a 1280×800 viewport
- **THEN** the frame's height is the same as for a mod with short content, the frame's document can scroll, and the page does not scroll

#### Scenario: Small viewport
- **WHEN** a mod runs in a 1280×300 viewport
- **THEN** the frame is 16rem tall and the page can scroll

#### Scenario: Frame beside the sidebar
- **WHEN** a mod runs in a 1280×800 viewport with the sidebar expanded
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

### Requirement: Open a single tile
For a run link with the parameter `tile`, the location of one tile file, the app SHALL load that tile before the mod's frame starts and give it to the mod as the tiles of a collection holding only that tile, with no collection file requested. A tile SHALL open the same way whether collections list it or not.

#### Scenario: Link with a tile
- **WHEN** the app is opened at `#/run?mod=tile_viewer&tile=https%3A%2F%2Fexample.org%2Ffixtures%2Ftiles%2Fbooks%2Fkallocain.md`
- **THEN** the tile viewer runs with one tile whose source is `https://example.org/fixtures/tiles/books/kallocain.md`
- **AND** no collection file is requested

#### Scenario: Tile in no collection
- **WHEN** a run link's `tile` is a markdown file that no collection lists
- **THEN** the mod receives that tile

#### Scenario: Relative tile location
- **WHEN** the app at `https://example.org/` is opened at a run link whose `tile` is `./fixtures/tiles/books/kallocain.md`
- **THEN** the mod receives the tile whose source is `https://example.org/fixtures/tiles/books/kallocain.md`

#### Scenario: Media of the tile
- **WHEN** a mod is opened with a `tile` that has `image: "https://media.example.net/covers/kallocain.jpg"`, "Load media linked by tiles" is on, and the mod shows that URL
- **THEN** the image loads

#### Scenario: Shared tile link after a reload
- **WHEN** a sandbox was opened with a `tile`, the user copies its link and opens it in a new page
- **THEN** the mod runs with the same tile

### Requirement: A link has a collection or a tile
A run link SHALL NOT have both a non-empty `collection` and a non-empty `tile`. Such a link SHALL open a sandbox that shows an error saying that a link cannot have both, SHALL request no collection or tile file, and SHALL NOT start a mod frame.

#### Scenario: Both in a link
- **WHEN** the app is opened at a run link with both a `collection` and a `tile`
- **THEN** the stage shows an error that says a link cannot have both a collection and a tile
- **AND** no mod frame is shown and neither file is requested

### Requirement: Replace the visible sandbox
When the visible mod opens a link with `replace`, the app SHALL create the new sandbox, make it visible in the current history entry in place of the requesting sandbox, with that entry's address becoming the new run link, and then close the requesting sandbox and stop its mod. No history entry SHALL be added and forward entries SHALL be kept.

#### Scenario: Next tile replaces the current one
- **WHEN** the collection viewer opened the tile viewer for tile 3, and the tile viewer opens tile 4 with `replace`
- **THEN** the tile viewer for tile 4 is visible, the address is its run link, and the frame of tile 3 is no longer in the page
- **AND** pressing back once shows the collection viewer

#### Scenario: Dialogs of the replaced mod
- **WHEN** a mod with an open action dialog is replaced
- **THEN** the dialog is removed without acting

### Requirement: A replacing sandbox takes the replaced one's place
The new sandbox SHALL have the replaced sandbox's opener and belong to its section. Closing it SHALL show that opener when it is still open, or Home otherwise. A section whose last place was the replaced sandbox SHALL show the new one when the user comes back to it.

#### Scenario: Close after a replace
- **WHEN** the collection viewer opened the tile viewer, which replaced itself with the next tile, and the user closes the visible sandbox
- **THEN** the collection viewer is visible in the state it was left in

#### Scenario: Section after a replace
- **WHEN** the tile viewer opened from Tiles replaced itself, and the user opens Home and then Tiles again
- **THEN** the replacing tile viewer is visible and the Tiles item is the current one

### Requirement: Open a mosaic from a run link
The app SHALL open a mosaic for the address hash `#/run` with the query parameter `mosaic` (a mosaic reference) and any other parameters, which the mod receives in its context. The app SHALL load the mosaic file, then open its mod with its collection as a run link with that `mod` and `collection` would, in a new sandbox that becomes the visible one. Relative references in the link SHALL be resolved against the app's address.

#### Scenario: Laureates on the map
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_map.yaml`, whose mosaic names `country_map` and the laureates' collection
- **THEN** the country map mod runs in a new visible sandbox with the laureates' collection
- **AND** the address is still a run link whose only field is that `mosaic`

#### Scenario: Link parameters reach the mod
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_map.yaml&from=x`
- **THEN** the mod's context `params` is `{ "from": "x" }`

#### Scenario: Mosaic of a switched-off mod
- **WHEN** a mosaic names `mod_viewer`, `mod_viewer` is switched off, and the app is opened at a run link to that mosaic
- **THEN** the sandbox shows the error that says `mod_viewer` is switched off, and no file of `mod_viewer` is requested

#### Scenario: Mosaic of a mod for another API
- **WHEN** a mosaic names a mod with `api: "^0.3.0"`
- **THEN** the app asks the mod API question before starting the mod, as for a run link to that mod

### Requirement: A mosaic link has no mod, collection or tile
A run link with a non-empty `mosaic` SHALL NOT also have a non-empty `mod`, `collection`, `tile` or `sites`. Such a link SHALL open a sandbox that shows an error saying that a link to a mosaic cannot also have a mod, a collection, a tile or sites. It SHALL request no file and SHALL NOT start a mod frame.

#### Scenario: Mosaic and mod
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_map.yaml&mod=mod_viewer`
- **THEN** the stage shows an error that says a link to a mosaic cannot also have a mod, a collection, a tile or sites
- **AND** no file is requested and no mod frame is shown

#### Scenario: Mosaic and collection
- **WHEN** the app is opened at a run link with both a `mosaic` and a `collection`
- **THEN** the stage shows the same error and requests no file

#### Scenario: Mosaic and sites
- **WHEN** the app is opened at a run link with both a `mosaic` and a `sites`
- **THEN** the stage shows the same error and requests no file

### Requirement: Show mosaic load failures
When the mosaic file of a link cannot be loaded or does not follow the mosaic file format, the sandbox SHALL show an error naming the mosaic file and the reason. It SHALL request neither the mod nor the collection, and SHALL NOT start a mod frame. The same failure SHALL also be an error from the app in the stage bar, whose source is the mosaic file's address. A failure of the mosaic's mod, tile type, collection or tiles SHALL be shown as for a run link with that mod and collection.

#### Scenario: Missing mosaic file
- **WHEN** a run link names a mosaic file that answers HTTP 404
- **THEN** the stage shows an error that names the mosaic file's resolved address and `404`
- **AND** no mod file is requested and no mod frame is shown

#### Scenario: Mosaic without a title
- **WHEN** a run link names a mosaic file without `title`
- **THEN** the stage shows an error that names the mosaic file and says that `title` must be a non-empty string

#### Scenario: Missing collection of a mosaic
- **WHEN** a mosaic names a collection that answers HTTP 404
- **THEN** the stage shows an error that names the collection's resolved address
- **AND** no mod frame is shown

### Requirement: Reload the tiles of a mosaic
For a sandbox opened from a mosaic with a collection, "Reload tiles" SHALL load the collection again, rename the reloaded tiles with the mosaic's aliases and validate them against the mod's tile type, as at the start. The mosaic file SHALL NOT be requested again: the mod's config, the aliases and the grants SHALL stay those of the start.

#### Scenario: Reloaded laureates keep their aliases
- **WHEN** the laureates' map was opened from its mosaic and the user presses "Reload tiles"
- **THEN** the mod receives `tiles.changed` with the 17 laureates, each with `title` and `country`
- **AND** the mosaic file is not requested again

### Requirement: Sites of a mosaic in a run link
The app SHALL accept `sites` in a run link with `mod`: a mosaic reference, resolved against the app's address. Before the mod's frame starts, the app SHALL load that mosaic file and grant its `show` lines to the sandbox (see `mod-sandbox`), and nothing else of it: its mod, collection, config and aliases SHALL NOT be used, and the mount context's `mosaic` SHALL be `null`. `sites` SHALL NOT be in the mod's `params`.

#### Scenario: Covers kept for another mod
- **WHEN** the app is opened at `#/run?mod=./samples/mods/flashcards&collection=./samples/tiles/literature_nobel_laureates_books/collection.yaml&sites=./samples/mosaics/nobel_books_list.yaml`
- **THEN** Flashcards runs with the books, images from `https://covers.openlibrary.org` load, the mount context's `mosaic` is `null`, and its `params` is `{}`

#### Scenario: Shared link after a reload
- **WHEN** the user copies the link of a sandbox with `sites` and opens it in a new page
- **THEN** the mod runs with the same collection and the same granted lines

### Requirement: A sites mosaic that cannot be loaded
When the mosaic file named by `sites` cannot be loaded or does not follow the mosaic file format, the mod SHALL still start, without its lines. The sandbox SHALL get a `warning` message from the app whose source is the mosaic file's address and whose text gives the reason and says that its sites were not granted.

#### Scenario: Missing sites mosaic
- **WHEN** a run link's `sites` names a mosaic file that answers HTTP 404
- **THEN** the mod runs, and the warnings popover lists an item labeled "App" that names the mosaic file's address and `404`

### Requirement: Open a combination
Choosing an entry in a stage bar list, or "Stop using these sites", SHALL open the chosen run link in a new sandbox that becomes visible, takes the visible sandbox's opener and section, and gets a new history entry with that run link. The previous sandbox SHALL then be closed and its mod stopped. Forward entries SHALL be dropped as for any opened link.

#### Scenario: Back to the previous combination
- **WHEN** the user chose Book List in the mod list of "Nobel laureates on the map" and presses the browser's back button
- **THEN** "Nobel laureates on the map" runs again, in a new sandbox, and the Book List sandbox is still open behind the forward entry

#### Scenario: Close after a swap
- **WHEN** the mosaic explorer opened "Nobel laureates on the map", the user chose another mod in the stage bar, and presses ×
- **THEN** the mosaic explorer is visible in the state it was left in

#### Scenario: Section after a swap
- **WHEN** the user swapped the mod of a mosaic opened from Mosaics, then opens Home and Mosaics again
- **THEN** the swapped sandbox is visible and the Mosaics item is the current one

### Requirement: A home mod is not replaced by a combination
When the visible sandbox is the home mod shown at `#/`, choosing an entry in a stage bar list SHALL open the chosen run link as a followed link does: in a new sandbox whose opener is the home mod, with a new history entry. The home mod SHALL keep running.

#### Scenario: Swap from a home mod
- **WHEN** an instantiation's Home targets Country Map with the laureates' books, and the user chooses Book List in its mod list
- **THEN** Book List is the visible mod, and closing it shows the home mod again
