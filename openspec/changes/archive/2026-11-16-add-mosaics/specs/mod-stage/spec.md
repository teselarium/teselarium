# Spec Delta

## MODIFIED Requirements

### Requirement: Home
The app SHALL show Home for an empty hash, for `#/`, and for any hash that is neither a run link with a non-empty `mod` or a non-empty `mosaic` nor the address of a page. Home SHALL be the target of the registry's Home section: a page in the vanilla app, or a mod that an instantiation chooses, which runs in a sandbox like any other mod. The app page SHALL keep the `OpenTesela` heading.

#### Scenario: No hash
- **WHEN** the app is opened with no hash
- **THEN** the page shows the `OpenTesela` heading and the Home page, and no mod frame is visible

#### Scenario: Unknown hash
- **WHEN** the app is opened at `#/mods/view`
- **THEN** the Home page is shown

#### Scenario: Home as a mod
- **WHEN** an instantiation sets the Home section's target to the mod `mod_explorer` and the app is opened with no hash
- **THEN** the mod explorer is the visible mod

#### Scenario: Run link with an empty mosaic
- **WHEN** the app is opened at `#/run?mosaic=`
- **THEN** the Home page is shown

## ADDED Requirements

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
- **WHEN** a mosaic names a mod with `api: "^0.2.0"`
- **THEN** the app asks the mod API question before starting the mod, as for a run link to that mod

### Requirement: A mosaic link has no mod, collection or tile
A run link with a non-empty `mosaic` SHALL NOT also have a non-empty `mod`, `collection` or `tile`. Such a link SHALL open a sandbox that shows an error saying that a link to a mosaic cannot also have a mod, a collection or a tile. It SHALL request no file and SHALL NOT start a mod frame.

#### Scenario: Mosaic and mod
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_map.yaml&mod=mod_viewer`
- **THEN** the stage shows an error that says a link to a mosaic cannot also have a mod, a collection or a tile
- **AND** no file is requested and no mod frame is shown

#### Scenario: Mosaic and collection
- **WHEN** the app is opened at a run link with both a `mosaic` and a `collection`
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
