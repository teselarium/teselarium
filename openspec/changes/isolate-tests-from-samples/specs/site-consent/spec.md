## MODIFIED Requirements

### Requirement: Ask before a mod from another origin starts
When a mod whose mod file is served from another origin than the app declares a permission that has no remembered decision for that mod, the app SHALL show the site consent dialog before the mod's frame is created. The dialog SHALL be drawn by the app, outside every frame. A mod from the app's origin, a mod that declares no permission and a mod whose every declared permission has a remembered decision SHALL start without it.

#### Scenario: Foreign mod with a declared permission
- **WHEN** the user opens a mod at `https://mods.example.net/probe/mod_conf.yaml` that declares `show` for `https://upload.wikimedia.org`, with no remembered decision
- **THEN** the site consent dialog is shown and the mod has no frame yet

#### Scenario: Mod from the app's origin
- **WHEN** the user opens a mod served from the app's origin that declares `show` for a host
- **THEN** no site consent dialog is shown and images from that host load

#### Scenario: Foreign mod without permissions
- **WHEN** the user opens a mod from another origin that declares no permission
- **THEN** no site consent dialog is shown and the mod starts
