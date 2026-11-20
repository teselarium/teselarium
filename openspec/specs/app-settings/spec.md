# app-settings Specification

## Purpose

Gives users one place to adjust the app: the Settings page with the theme choice and the sidebar's optional sections, how those choices are kept in the app's storage, and what switching a section off does and does not change.

## Requirements

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

### Requirement: Remembered site decisions in Settings
The Mod permissions group SHALL list the remembered site decisions (see `site-consent`) grouped by mod file address, sorted by title, then address. Each group SHALL be collapsed when the page opens and show a group checkbox, the mod's title as remembered, its address, its allowed and refused counts, and a Remove all button. Expanded, it SHALL list each decision with a checkbox, checked when allowed, its verb and host, `Allowed` or `Refused`, and a Remove button. With none, it SHALL say so.

#### Scenario: One remembered allow
- **WHEN** the user remembered Allow for `show` `https://upload.wikimedia.org` of the mod `Probe` at `https://mods.example.net/probe/mod_conf.yaml`, and opens `#/settings`
- **THEN** the Mod permissions group shows one collapsed group with a checked group checkbox, `Probe`, `https://mods.example.net/probe/mod_conf.yaml`, `1 allowed` and a Remove all button
- **AND** once the group is expanded, it lists `show content from https://upload.wikimedia.org` with its checkbox checked and `Allowed`, and a Remove button

#### Scenario: A remembered refusal
- **WHEN** the user remembered Show without them for that permission
- **THEN** the group shows an unchecked group checkbox and `1 refused`, and once expanded lists the permission with its checkbox unchecked and `Refused`

#### Scenario: Decisions of two mods
- **WHEN** the user remembered decisions for `show` and `connect` of `Probe`, and for `show` of `Atlas` at `https://mods.example.net/atlas/mod_conf.yaml`
- **THEN** the group shows two collapsed groups, `Atlas` then `Probe`
- **AND** none of their decisions is shown until its group is expanded

#### Scenario: Some allowed, some refused
- **WHEN** the user remembered Allow for `show` and Show without them for `connect` of `Probe`, and opens `#/settings`
- **THEN** the group checkbox of `Probe` is mixed and the group shows `1 allowed, 1 refused`

#### Scenario: No remembered decision
- **WHEN** the user remembered no decision and opens `#/settings`
- **THEN** the Mod permissions group says that no decision is remembered

#### Scenario: The cost is stated
- **WHEN** the user opens `#/settings`
- **THEN** the Mod permissions group says that each site a mod is allowed to use can see that the user used that mod

### Requirement: Changing a remembered decision
Checking or unchecking a decision SHALL change it to allowed or refused, in the list and in the app's storage at once, and SHALL update its group's counts and group checkbox. It SHALL apply to mods started after it: the next time that mod is opened, the permission SHALL be granted or denied as changed, without asking. Running mods SHALL keep their permissions, and no frame SHALL be reloaded.

#### Scenario: Allow a remembered refusal
- **WHEN** the user remembered Show without them for `show` `https://upload.wikimedia.org` of `Probe`, checks it in Settings and then opens `Probe`
- **THEN** no site consent dialog is shown and images from `https://upload.wikimedia.org` load

#### Scenario: Running mod keeps its policy after a change
- **WHEN** `Probe` runs with the remembered allow and the user unchecks it in Settings
- **THEN** `Probe` still shows images from `https://upload.wikimedia.org`, and no frame was reloaded

### Requirement: Changing every decision of a mod
Checking a group checkbox that is unchecked or mixed SHALL allow every remembered decision of that mod, and unchecking a checked one SHALL refuse every one, without expanding the group. The change SHALL be kept and applied as when changing one decision.

#### Scenario: Allow all of a mod
- **WHEN** the group checkbox of `Probe` is mixed and the user checks it without expanding the group
- **THEN** the group checkbox is checked, the group shows `2 allowed`, and the app's storage holds both decisions of `Probe` as allowed

#### Scenario: Refuse all of a mod
- **WHEN** every decision of `Probe` is allowed and the user unchecks its group checkbox
- **THEN** the group checkbox is unchecked, the group shows `2 refused`, and opening `Probe` shows no site consent dialog and blocks images from `https://upload.wikimedia.org`

#### Scenario: Other mods unchanged
- **WHEN** the user checks the group checkbox of `Probe`
- **THEN** the decisions of `Atlas` stay as they were

### Requirement: Removing a remembered decision
Removing a decision with its Remove button, or every decision of a mod with its group's Remove all button, SHALL drop them from the list and from the app's storage at once, without asking. A group left without decisions SHALL disappear. Removal SHALL apply to mods started after it: the next time that mod is opened, its permissions SHALL be asked again. Running mods SHALL keep their permissions, and no frame SHALL be reloaded.

#### Scenario: Asked again after removing
- **WHEN** the user removes the remembered allow of `Probe` and then opens `Probe`
- **THEN** the site consent dialog lists `show content from https://upload.wikimedia.org`

#### Scenario: Running mod keeps its permission
- **WHEN** `Probe` runs with the remembered allow and the user removes it in Settings
- **THEN** `Probe` still shows images from `https://upload.wikimedia.org`, and no frame was reloaded

#### Scenario: Remove all of a mod
- **WHEN** the user remembered two decisions of `Probe` and one of `Atlas`, and chooses Remove all in the group of `Probe` without expanding it
- **THEN** the group of `Probe` disappears and the group of `Atlas` stays
- **AND** the app's storage keeps only the decision of `Atlas`

#### Scenario: Asked again after removing all
- **WHEN** the user chooses Remove all for `Probe` and then opens `Probe`
- **THEN** the site consent dialog lists every permission that `Probe` declares

### Requirement: Sites always played from in Settings
The Mod permissions group SHALL also list each host the user chose to always play from (see `media-players`), as `play media from <host>` for every mod, with a Remove button. Removing it SHALL apply to the next player of that host, which SHALL ask again. A player already shown SHALL keep playing.

#### Scenario: Remembered player site
- **WHEN** the user checked Always play from `www.youtube-nocookie.com`, pressed Play, and opens `#/settings`
- **THEN** the Mod permissions group lists `play media from www.youtube-nocookie.com` for every mod, with a Remove button

#### Scenario: Asked again after removing
- **WHEN** the user removes it and a mod then opens a YouTube player of its tiles
- **THEN** the player dialog asks before contacting the site

### Requirement: Remembered mosaic decisions in Settings
The Mod permissions group SHALL also list the remembered decisions of mosaics (see `site-consent`), one group per mosaic file address, sorted with the mods' groups by title, then address. A mosaic's group SHALL say that it is a mosaic, and show its title as remembered, its address, its counts, its group checkbox and its Remove all button. Checking, unchecking and removing its decisions SHALL work as for a mod's, and apply to that mosaic only.

#### Scenario: One remembered mosaic allow
- **WHEN** the user remembered Allow for `show` `https://covers.openlibrary.org` of the mosaic `Nobel books` at `https://mosaics.example.net/nobel/mosaic.yaml`, and opens `#/settings`
- **THEN** the Mod permissions group shows a collapsed group that says it is a mosaic, with `Nobel books`, `https://mosaics.example.net/nobel/mosaic.yaml` and `1 allowed`

#### Scenario: A mod and a mosaic
- **WHEN** the user remembered decisions for the mod `Probe` and the mosaic `Nobel books`
- **THEN** the group lists `Nobel books`, then `Probe`, and only the first says that it is a mosaic

#### Scenario: Removing a mosaic's decision
- **WHEN** the user removes the remembered allow of the mosaic `Nobel books` and opens it again
- **THEN** the site consent dialog lists the mosaic's `show content from https://covers.openlibrary.org`
- **AND** the decisions of mods are unchanged

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

### Requirement: Recently used in Settings
The Catalog group SHALL say how many mods, collections, mosaics and combinations are recently used (see `recently-used`), and that the app keeps them only on this device. While any is kept, it SHALL have a "Clear" button that clears recently used at once, without reloading any frame.

#### Scenario: Count after trying combinations
- **WHEN** two mods, one collection, no mosaic and one combination are recently used, and the user opens `#/settings`
- **THEN** the Catalog group says 2 mods, 1 collection, 0 mosaics and 1 combination are recently used, and shows "Clear"

#### Scenario: Clear
- **WHEN** the user presses "Clear"
- **THEN** the Catalog group says that nothing is recently used, has no "Clear" button, and no frame was reloaded
