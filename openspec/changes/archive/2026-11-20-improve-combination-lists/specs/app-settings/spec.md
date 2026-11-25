# Spec Delta

## MODIFIED Requirements

### Requirement: Recently used in Settings
The Catalog group SHALL say how many mods, collections, mosaics and combinations are recently used (see `recently-used`), and that the app keeps them only on this device. While any is kept, it SHALL have a "Clear" button that clears recently used at once, without reloading any frame.

#### Scenario: Count after trying combinations
- **WHEN** two mods, one collection, no mosaic and one combination are recently used, and the user opens `#/settings`
- **THEN** the Catalog group says 2 mods, 1 collection, 0 mosaics and 1 combination are recently used, and shows "Clear"

#### Scenario: Clear
- **WHEN** the user presses "Clear"
- **THEN** the Catalog group says that nothing is recently used, has no "Clear" button, and no frame was reloaded
