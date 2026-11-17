# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, a Privacy group holding the "Load media linked by tiles" switch, and a Mod permissions group listing the remembered site decisions. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** no section says `Coming soon`
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on
- **AND** the Mod permissions group, after the Privacy group, says that no decision is remembered

#### Scenario: Coming-soon section of an instantiation
- **WHEN** an instantiation's registry has an optional section `Example Section` marked as coming soon, and `#/settings` is opened
- **THEN** the Sidebar group shows a switch labeled `Example Section` that says `Coming soon`

### Requirement: Section switches are remembered
The section switches SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. A stored switch for a section the registry no longer has SHALL be ignored and dropped. An optional section with no stored switch SHALL be on. When the storage cannot be read or written, the switches SHALL still apply until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user switches Mosaics off and reloads the app page
- **THEN** the sidebar has no Mosaics item and its switch is off

#### Scenario: Removed section is dropped
- **WHEN** the stored switches hold `removed_section` off and the registry has no `removed_section` section
- **THEN** the app starts normally, and the next stored value has no `removed_section`

#### Scenario: New section starts on
- **WHEN** an instantiation adds an optional section `new_section`, labeled New Section, and the stored switches have no `new_section`
- **THEN** the sidebar shows the New Section item

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user switches Guides off
- **THEN** the sidebar has no Guides item and no error is shown

#### Scenario: Mods cannot reach the switches
- **WHEN** the user switched Guides off and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored section switches
