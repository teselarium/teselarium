# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, a Catalog group holding the "List the default mosaics of mods" switch, a Privacy group holding the "Load media linked by tiles" switch, and a Mod permissions group listing the remembered site decisions. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** no section says `Coming soon`
- **AND** the Catalog group, after the Sidebar group, shows a switch labeled `List the default mosaics of mods`, off
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on
- **AND** the Mod permissions group, after the Privacy group, says that no decision is remembered

#### Scenario: Coming-soon section of an instantiation
- **WHEN** an instantiation's registry has an optional section `Example Section` marked as coming soon, and `#/settings` is opened
- **THEN** the Sidebar group shows a switch labeled `Example Section` that says `Coming soon`

## ADDED Requirements

### Requirement: List the default mosaics of mods
The "List the default mosaics of mods" switch SHALL decide whether the catalog's mosaics also hold the default mosaics of the catalog's mods (see `app-catalog`). The group SHALL say that the switch helps when writing a mod. A change SHALL apply at once, to running mods too (see "Catalog changed event" in `mod-engine-api`), and SHALL NOT reload any frame.

#### Scenario: Switched on, then the mosaic explorer opened
- **WHEN** the user opened Mosaics, then switches "List the default mosaics of mods" on and opens Mosaics again
- **THEN** the mosaic explorer lists the two sample mosaics, then the default mosaics of Book List, Flashcards and Country Map, and its frame was not reloaded

#### Scenario: Switched off again
- **WHEN** the user switches it on, then off, and then opens Mosaics
- **THEN** the mosaic explorer lists only the two sample mosaics

### Requirement: The default mosaics switch is remembered
The "List the default mosaics of mods" switch SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. With no stored value, or a value that is not `true` or `false`, it SHALL be off. When the storage cannot be read or written, the switch SHALL still apply until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user switches "List the default mosaics of mods" on and reloads the app page
- **THEN** the switch is on and the catalog's mosaics hold the default mosaics

#### Scenario: Unknown stored value
- **WHEN** the stored value of the switch is `"maybe"`
- **THEN** the switch is off

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user switches the setting on
- **THEN** the switch is on, the catalog's mosaics hold the default mosaics, and no error is shown
