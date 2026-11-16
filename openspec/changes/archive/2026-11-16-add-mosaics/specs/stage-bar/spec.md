# Spec Delta

## ADDED Requirements

### Requirement: Mosaic title in the stage bar
For a sandbox opened from a mosaic, the stage bar's left side SHALL show the mosaic's title before the mod's name and version, with the mod's name in muted text, and keep the other items and their order. The bar SHALL stay one row.

#### Scenario: Laureates on the map
- **WHEN** the mosaic `Laureates on the map` opens the mod `Country Map` version `1.0.0`
- **THEN** the stage bar shows, from the left, `Laureates on the map`, `Country Map` in muted text, `1.0.0` in a capsule, then the information button
- **AND** the stage bar is a single row

#### Scenario: Mod opened without a mosaic
- **WHEN** a mod is opened from a run link with a `mod`
- **THEN** the stage bar shows no mosaic title

### Requirement: Mosaic name while loading or after a failure
For a run link with a `mosaic`, until the mosaic file is loaded the stage bar SHALL show "Loading mosaic…" in place of the titles and version, and when the sandbox failed before the mosaic file was loaded, "Mosaic not loaded". Once the mosaic file is loaded, the mosaic's title SHALL be shown, and the mod's name follows the rules for a mod.

#### Scenario: Missing mosaic file
- **WHEN** a run link names a mosaic file that answers HTTP 404
- **THEN** the stage bar shows "Mosaic not loaded" and no version capsule

#### Scenario: Missing mod of a mosaic
- **WHEN** a mosaic names a mod folder whose mod file answers HTTP 404
- **THEN** the stage bar shows the mosaic's title and "Mod not loaded"

### Requirement: Information popover of a mosaic
For a sandbox opened from a mosaic, the information popover SHALL also show the mosaic file's address, before the mod's source, as text the user can select.

#### Scenario: Mosaic with a collection
- **WHEN** a mod opened from a mosaic with a collection runs and the user presses the information button
- **THEN** the popover shows the mosaic file's address, the mod file's source, the collection's location and the run link
