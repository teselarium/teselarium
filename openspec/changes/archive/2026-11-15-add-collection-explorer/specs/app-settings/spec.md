# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, a Privacy group holding the "Load media linked by tiles" switch, and a Mod permissions group listing the remembered site decisions. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** Mosaics says `Coming soon`, and Tiles does not
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on
- **AND** the Mod permissions group, after the Privacy group, says that no decision is remembered

### Requirement: Switch a section off
Switching an optional section off SHALL remove its item from the sidebar at once, and switching it on SHALL bring the item back at its place, without reloading the page or any frame. Coming-soon sections SHALL be switched the same way.

#### Scenario: Hide Guides
- **WHEN** the user switches Guides off on the Settings page
- **THEN** the sidebar has no Guides item, and no frame was reloaded

#### Scenario: Hide a coming-soon section
- **WHEN** the user switches Mosaics off
- **THEN** the sidebar has no Mosaics item

#### Scenario: Hide Tiles
- **WHEN** the user switches Tiles off
- **THEN** the sidebar has no Tiles item, and `#/run?mod=collection_explorer` still runs the collection explorer

#### Scenario: Show it again
- **WHEN** the user switches Guides off and then on again
- **THEN** the Guides item is back between Mosaics and Settings
