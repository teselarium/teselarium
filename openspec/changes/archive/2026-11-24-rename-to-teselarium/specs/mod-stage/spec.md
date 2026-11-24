## MODIFIED Requirements

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
