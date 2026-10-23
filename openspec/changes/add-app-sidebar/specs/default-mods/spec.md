# Spec Delta

## MODIFIED Requirements

### Requirement: Default mods folder
Default mods SHALL live in the default mods folder, `./default_mods/` next to the app, one folder per mod named after the mod, each with a `mod_conf.yaml`. They SHALL be served from the app's origin, so they get their declared permissions. A default mod name SHALL resolve to the folder of that name in the default mods folder, whatever `name` the mod file declares, so an instantiation replaces a default mod by putting another mod in its folder.

#### Scenario: Explorer from the default folder
- **WHEN** the app at `https://example.org/` opens the Mods section
- **THEN** the mod's source is `https://example.org/default_mods/mod_explorer/mod_conf.yaml` and its `open` permission is granted

#### Scenario: Replaced viewer
- **WHEN** the default mods folder's `mod_viewer/mod_conf.yaml` declares `name: "fancy_viewer"` and the explorer opens `mod_viewer`
- **THEN** that mod is opened

### Requirement: Default mod settings
The app SHALL have default mod settings with the default mods folder and the list of switched-off default mods. The vanilla app SHALL use `./default_mods/` and no switched-off mods. Which mod, if any, is shown for `#/` SHALL be decided by the Home section of the sidebar's registry, not by the default mod settings.

#### Scenario: Vanilla settings
- **WHEN** the vanilla app is opened and the user opens Mods
- **THEN** the mod explorer runs, and opening the mod viewer is allowed

#### Scenario: Vanilla home is not a mod
- **WHEN** the vanilla app is opened with no hash
- **THEN** no mod frame is visible and the Home page is shown
