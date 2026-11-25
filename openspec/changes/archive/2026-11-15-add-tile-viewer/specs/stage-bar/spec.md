# Spec Delta

## MODIFIED Requirements

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
