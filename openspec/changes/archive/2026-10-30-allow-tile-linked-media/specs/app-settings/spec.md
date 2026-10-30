# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, and a Privacy group holding the "Load media linked by tiles" switch. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** Tiles and Mosaics say `Coming soon`
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on

### Requirement: Versions on the Settings page
The Settings page SHALL have a Version group, after the Appearance, Sidebar and Privacy groups, that shows the app's version, as written in the app's `package.json` when the app was built, and the app's mod API version. Each SHALL be labeled, as `OpenTesela` and `Mod API`, and shown as plain text that the user can select and copy.

#### Scenario: Vanilla versions
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the Version group shows `OpenTesela` with the version of the app's `package.json` and `Mod API` with the app's mod API version

#### Scenario: Version follows the build
- **WHEN** the app's `package.json` version is changed to `0.2.0` and the app is built again
- **THEN** the Version group shows `OpenTesela` `0.2.0`

#### Scenario: Copy the versions
- **WHEN** the user selects the text of the Version group and copies it
- **THEN** the copied text includes both versions

## ADDED Requirements

### Requirement: Load media linked by tiles
The "Load media linked by tiles" switch SHALL decide whether mods may load the images, video and audio their tiles link (see `mod-sandbox`). The group SHALL say that linked sites can see that the user viewed the tile. A change SHALL apply to mods started after it, and SHALL NOT change running mods or reload any frame.

#### Scenario: Switched off before opening a mod
- **WHEN** the user switches "Load media linked by tiles" off and then opens a mod with a tile that has `image: "https://media.example.net/cover.jpg"`
- **THEN** the mod cannot show `https://media.example.net/cover.jpg`

#### Scenario: Running mod keeps its policy
- **WHEN** a mod runs with a tile that has `image: "https://media.example.net/cover.jpg"`, the user switches the setting off, and the mod shows that URL
- **THEN** the image loads and no frame was reloaded

#### Scenario: Applies when the mod is opened again
- **WHEN** after switching it off the user closes that mod and opens the same link again
- **THEN** the mod cannot show `https://media.example.net/cover.jpg`

### Requirement: The media switch is remembered
The "Load media linked by tiles" switch SHALL be kept in the app's storage, under a key that no mod storage slot can use, and restored when the app is opened again. With no stored value, or a value that is not `true` or `false`, it SHALL be on. When the storage cannot be read or written, the switch SHALL still apply until the page is closed.

#### Scenario: Kept after a reload
- **WHEN** the user switches "Load media linked by tiles" off and reloads the app page
- **THEN** the switch is off and mods opened then cannot show the files their tiles link

#### Scenario: Unknown stored value
- **WHEN** the stored value of the switch is `"maybe"`
- **THEN** the switch is on

#### Scenario: Storage cannot be written
- **WHEN** writing to the app's storage fails and the user switches the setting off
- **THEN** the switch is off, mods opened afterwards cannot show the files their tiles link, and no error is shown

#### Scenario: Mods cannot reach the switch
- **WHEN** the user switched the setting off and a running mod sends `storage.get` with any key
- **THEN** the result is never the stored switch
