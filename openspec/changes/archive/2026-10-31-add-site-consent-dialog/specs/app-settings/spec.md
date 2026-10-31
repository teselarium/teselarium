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
