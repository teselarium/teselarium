# Spec Delta

## Purpose

Gives users one place to adjust the app: the Settings page with the theme choice and the sidebar's optional sections, how those choices are kept in the app's storage, and what switching a section off does and does not change.

## ADDED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, and a Sidebar group listing every section of the app in the sidebar's order. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** Tiles and Mosaics say `Coming soon`

### Requirement: Switch a section off
Switching an optional section off SHALL remove its item from the sidebar at once, and switching it on SHALL bring the item back at its place, without reloading the page or any frame. Coming-soon sections SHALL be switched the same way.

#### Scenario: Hide Guides
- **WHEN** the user switches Guides off on the Settings page
- **THEN** the sidebar has no Guides item, and no frame was reloaded

#### Scenario: Hide a coming-soon section
- **WHEN** the user switches Tiles off
- **THEN** the sidebar has no Tiles item

#### Scenario: Show it again
- **WHEN** the user switches Guides off and then on again
- **THEN** the Guides item is back between Mosaics and Settings

### Requirement: Hidden sections keep working
Switching a section off SHALL only hide its sidebar item. Links to its pages or its mod SHALL still open them. While a section is hidden, nothing it holds SHALL make a sidebar item current. Once it is switched on again, its item SHALL be marked current when what it holds is shown.

#### Scenario: Explorer through a link while Mods is hidden
- **WHEN** Mods is switched off and the app is opened at `#/run?mod=mod_explorer`
- **THEN** the mod explorer runs and no sidebar item is the current one

#### Scenario: Guides page while Guides is hidden
- **WHEN** Guides is switched off and the app is opened at `#/guides`
- **THEN** the Guides index page is shown

#### Scenario: Current again after switching on
- **WHEN** Mods is switched off, the mod explorer is opened through `#/run?mod=mod_explorer`, and the user switches Mods on again
- **THEN** the Mods item is the current one once the explorer is shown again

### Requirement: Section switches are remembered
The section switches SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A stored switch for a section the registry no longer has SHALL be ignored and dropped. An optional section with no stored switch SHALL be on. When the storage cannot be read or written, the switches SHALL still apply until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user switches Mosaics off and reloads the app page
- **THEN** the sidebar has no Mosaics item and its switch is off

#### Scenario: Removed section is dropped
- **WHEN** the stored switches hold `atlas` off and the registry has no `atlas` section
- **THEN** the app starts normally, and the next stored value has no `atlas`

#### Scenario: New section starts on
- **WHEN** an instantiation adds an optional section `atlas` and the stored switches have no `atlas`
- **THEN** the sidebar shows the Atlas item

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user switches Guides off
- **THEN** the sidebar has no Guides item and no error is shown

#### Scenario: Mods cannot reach the switches
- **WHEN** the user switched Guides off and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored section switches
