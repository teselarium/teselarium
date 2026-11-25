# Spec Delta

## ADDED Requirements

### Requirement: Tile viewer's collection
The tile viewer's collection SHALL be the mount context's `collection` when it is not `null`, and the collection named by the `from` parameter otherwise. With a `collection`, `from` SHALL be ignored. Without either, the viewer SHALL have no collection.

#### Scenario: Opened from the collection viewer
- **WHEN** the viewer is opened with a `tile` and a `from`, and no `collection`
- **THEN** its collection is `from`

#### Scenario: Another collection chosen in the stage bar
- **WHEN** the viewer shows a tile opened from the collection viewer, and the user chooses another collection of twelve tiles in the stage bar's collection list
- **THEN** the visible tile viewer shows the first tile of that collection, with that collection's title and `1 of 12`
- **AND** its Previous button is disabled and its Next button is enabled

#### Scenario: Stale from with a collection
- **WHEN** the viewer is opened with a `collection` and a `from` that names another collection, which also lists the viewer's tile
- **THEN** its frame shows the title of the `collection` and the tile's position in it, not in `from`

#### Scenario: Opened from its default mosaic
- **WHEN** the viewer is opened from its default mosaic
- **THEN** its frame shows the title of the mosaic's collection and `1 of <n>`

#### Scenario: Neither a collection nor from
- **WHEN** the viewer is opened with a `tile` and no `from`
- **THEN** its frame shows the tile, and neither a collection's title nor a position

## MODIFIED Requirements

### Requirement: Tile viewer opens linked tiles
A click on a link of the metadata or of the body whose address's path ends with `.md`, in any letter case, SHALL be cancelled and SHALL send `mods.open` for the mod in the tile viewer's config's `tile_viewer`, with the link's address as `tile`, in a new sandbox. The request SHALL carry the viewer's collection's source as the `from` parameter only when the linked tile is in that collection.

#### Scenario: Link to another tile in the body
- **WHEN** the viewer shows a tile whose body links `./fahrenheit_451.md` and the user clicks the link
- **THEN** a new tile viewer showing that tile is visible, and no action dialog is shown
- **AND** pressing back shows the first tile viewer

#### Scenario: Linked tile outside the collection
- **WHEN** the viewer was opened with `from`, and the user clicks a link to a tile that the collection does not list
- **THEN** the new tile viewer's link has no `from`

#### Scenario: Linked tile in the opening collection
- **WHEN** the viewer was opened with a `collection`, and the user clicks a link to a tile that the collection lists
- **THEN** the new tile viewer's link has that collection's source as `from`

### Requirement: Tile viewer shows its place in a collection
When the tile viewer has a collection, it SHALL inspect it with `collections.inspect`. When its tile's source is in the collection's tiles, it SHALL show the collection's title, as a button that opens the mod in its config's `collection_viewer` with the collection's source as `target` in a new sandbox, and the tile's position as `<i> of <n>`. Otherwise it SHALL show neither.

#### Scenario: Tile in its collection
- **WHEN** the viewer is opened with the third tile of a collection of sixteen as `tile` and that collection as `from`
- **THEN** its frame shows the collection's title and `3 of 16`

#### Scenario: Open the collection
- **WHEN** the viewer shows its place in a collection and the user activates the collection's title
- **THEN** a collection viewer showing that collection is visible

#### Scenario: Tile no longer in the collection
- **WHEN** the viewer is opened with a `from` collection that does not list its tile
- **THEN** its frame shows the tile, and neither the collection's title nor a position

### Requirement: Tile viewer steps through its collection
When the tile viewer shows its place in a collection, it SHALL have Previous and Next buttons. Each SHALL send `mods.open` for the mod in its config's `tile_viewer` with the neighbouring tile of the collection as `tile`, the collection's source as `from` and `replace` `true`. Previous SHALL be disabled on the first tile and Next on the last; the list SHALL NOT wrap around.

#### Scenario: Next tile
- **WHEN** the viewer shows tile 3 of 16 and the user presses Next
- **THEN** the visible tile viewer shows tile 4 with `4 of 16`
- **AND** pressing back shows what was visible before tile 3 was opened

#### Scenario: Last tile
- **WHEN** the viewer shows tile 16 of 16
- **THEN** the Next button is disabled and the Previous button is enabled

#### Scenario: Next from the opening collection
- **WHEN** the viewer was opened with a `collection` and the user presses Next
- **THEN** the request is a `mods.open` with the second tile of that collection as `tile`, that collection's source as `params.from` and `replace` `true`

### Requirement: Tile viewer reports a collection it cannot read
When the tile viewer's collection cannot be inspected, the tile viewer SHALL still show its tile, without a place in a collection, and SHALL send `ui.notify` with level `"warning"`, the collection's address as `source` and a message that gives the reason.

#### Scenario: Missing from collection
- **WHEN** the viewer is opened with a `from` that answers HTTP 404
- **THEN** its frame shows the tile
- **AND** the sandbox has a warning from the mod whose source is that address and whose text names `404`
