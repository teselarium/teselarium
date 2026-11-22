# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, a Catalog group holding the "List the default mosaics of mods" switch, the user catalog's mosaics and the recently used entries, a Privacy group holding the "Load media linked by tiles" switch, and a Mod permissions group listing the remembered site decisions. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** no section says `Coming soon`
- **AND** the Catalog group, after the Sidebar group, shows a switch labeled `List the default mosaics of mods`, off
- **AND** the Catalog group says that you have added no mosaic, and has no "Remove all" button
- **AND** the Catalog group says that nothing is recently used, and has no "Clear" button
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on
- **AND** the Mod permissions group, after the Privacy group, says that no decision is remembered

#### Scenario: Coming-soon section of an instantiation
- **WHEN** an instantiation's registry has an optional section `Example Section` marked as coming soon, and `#/settings` is opened
- **THEN** the Sidebar group shows a switch labeled `Example Section` that says `Coming soon`

## ADDED Requirements

### Requirement: Your mosaics in Settings
The Catalog group SHALL say how many mosaics you added, how many of them are stored in this browser, and whether the browser keeps them persistently or may clear them when space runs low (see `browser-files`). While any is added, it SHALL have a "Remove all" button that removes them after a confirmation (see "Remove all" in `user-catalog`), without reloading any frame.

#### Scenario: Count after importing
- **WHEN** the user imported two mosaics and added one by URL, the browser keeps the storage persistently, and the user opens `#/settings`
- **THEN** the Catalog group says that you added 3 mosaics, 2 of them stored in this browser, that the browser keeps them, and shows "Remove all"

#### Scenario: Not kept persistently
- **WHEN** the browser did not agree to keep the storage and the user opens `#/settings`
- **THEN** the Catalog group says that the browser may clear the stored mosaics when space runs low, and suggests exporting them

#### Scenario: On a phone
- **WHEN** the user opens `#/settings` on a 360×740 viewport with mosaics added
- **THEN** the counts wrap within the group, "Remove all" is at least 32px tall, and the page does not scroll sideways
