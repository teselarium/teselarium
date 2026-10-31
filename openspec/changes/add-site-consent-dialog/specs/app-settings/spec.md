# Spec Delta

## MODIFIED Requirements

### Requirement: Settings page
The Settings section SHALL show, at `#/settings`, an Appearance group holding the Theme control, a Sidebar group listing every section of the app in the sidebar's order, a Privacy group holding the "Load media linked by tiles" switch, and a Mod permissions group listing the remembered site decisions. Always-shown sections SHALL say so. Each optional section, coming-soon ones included, SHALL have a switch labeled with its name. A coming-soon section SHALL also say that it is coming soon.

#### Scenario: Vanilla settings page
- **WHEN** the vanilla app is opened at `#/settings`
- **THEN** the page shows the Theme control, and switches labeled Tiles, Mods, Mosaics and Guides, all on
- **AND** Home, Settings and About are listed as always shown, without a switch
- **AND** Tiles and Mosaics say `Coming soon`
- **AND** the Privacy group shows a switch labeled `Load media linked by tiles`, on
- **AND** the Mod permissions group, after the Privacy group, says that no decision is remembered

## ADDED Requirements

### Requirement: Remembered site decisions in Settings
The Mod permissions group SHALL list each remembered site decision (see `site-consent`) with the mod's title as shown when it was decided, the address of its mod file, the category's verb, the host, and whether it was allowed or refused. Each SHALL have a Remove button. With no remembered decision, the group SHALL say so.

#### Scenario: One remembered allow
- **WHEN** the user remembered Allow for `show` `https://upload.wikimedia.org` of the mod `Probe` at `https://mods.example.net/probe/mod_conf.yaml`, and opens `#/settings`
- **THEN** the Mod permissions group lists `Probe`, `https://mods.example.net/probe/mod_conf.yaml`, `show content from https://upload.wikimedia.org` and `Allowed`, with a Remove button

#### Scenario: A remembered refusal
- **WHEN** the user remembered Show without them for that permission
- **THEN** the group lists it as `Refused`

### Requirement: Removing a remembered decision
Removing a decision SHALL drop it from the list and from the app's storage at once. It SHALL apply to mods started after it: the next time that mod is opened, its permission SHALL be asked again. Running mods SHALL keep their permissions, and no frame SHALL be reloaded.

#### Scenario: Asked again after removing
- **WHEN** the user removes the remembered allow of `Probe` and then opens `Probe`
- **THEN** the site consent dialog lists `show content from https://upload.wikimedia.org`

#### Scenario: Running mod keeps its permission
- **WHEN** `Probe` runs with the remembered allow and the user removes it in Settings
- **THEN** `Probe` still shows images from `https://upload.wikimedia.org`, and no frame was reloaded
