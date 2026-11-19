# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, a Catalog group holding the "List the default mosaics of mods" switch and the recently used entries, a Privacy group holding the "Load media linked by tiles" switch, and a Mod permissions group listing the remembered site decisions. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** no section says `Coming soon`
- **AND** the Catalog group, after the Sidebar group, shows a switch labeled `List the default mosaics of mods`, off
- **AND** the Catalog group says that nothing is recently used, and has no "Clear" button
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on
- **AND** the Mod permissions group, after the Privacy group, says that no decision is remembered

#### Scenario: Coming-soon section of an instantiation
- **WHEN** an instantiation's registry has an optional section `Example Section` marked as coming soon, and `#/settings` is opened
- **THEN** the Sidebar group shows a switch labeled `Example Section` that says `Coming soon`

## ADDED Requirements

### Requirement: Recently used in Settings
The Catalog group SHALL say how many mods, collections and mosaics are recently used (see `recently-used`), and that the app keeps them only on this device. While any is kept, it SHALL have a "Clear" button that clears recently used at once, without reloading any frame.

#### Scenario: Count after trying combinations
- **WHEN** two mods, one collection and no mosaic are recently used, and the user opens `#/settings`
- **THEN** the Catalog group says 2 mods, 1 collection and 0 mosaics are recently used, and shows "Clear"

#### Scenario: Clear
- **WHEN** the user presses "Clear"
- **THEN** the Catalog group says that nothing is recently used, has no "Clear" button, and no frame was reloaded
