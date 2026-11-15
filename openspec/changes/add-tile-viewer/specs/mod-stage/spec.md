# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Several sandboxes, at most one visible
Each sandbox SHALL have an id that the app gives it, unique in the page. Opening a link, whether the user followed it or a mod asked for it, SHALL create a new sandbox and hide the visible one without stopping it, unless the mod asked to replace itself (see "Replace the visible sandbox"). Activating a sidebar section SHALL instead show an open sandbox when the section has one to show. At most one sandbox SHALL be visible at a time, and none while a page is shown. Hiding or showing a sandbox SHALL NOT reload its frame.

#### Scenario: Second link hides the first mod
- **WHEN** a mod is running and the user follows a run link to another mod
- **THEN** two mod frames are in the page, only the second is visible, and the first is still running

#### Scenario: A page hides the mods
- **WHEN** a mod is running and the user opens Settings
- **THEN** no mod frame is visible, the mod's frame is still in the page, and its mod is still running

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
