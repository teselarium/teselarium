# Spec Delta

## ADDED Requirements

### Requirement: Mods can go fullscreen
Every mod frame SHALL allow fullscreen, so a mod can show an element of its frame fullscreen after a user action inside the mod. When the visible sandbox changes while an element is fullscreen, the app SHALL leave fullscreen.

#### Scenario: Fullscreen after a click
- **WHEN** the user clicks a button in a running mod whose handler calls `document.body.requestFullscreen()`
- **THEN** the promise resolves and the mod's `document.fullscreenElement` is its `<body>`

#### Scenario: Opening another mod leaves fullscreen
- **WHEN** a mod with `open` granted for `"*"` is fullscreen and sends `mods.open` for the mod viewer
- **THEN** the app's `document.fullscreenElement` is `null` and the mod viewer is visible

### Requirement: Blocked browser dialogs are reported
Inside a mod frame, `alert`, `confirm`, `prompt` and `print` SHALL show nothing and return what the browser returns for a blocked dialog: `undefined`, `false`, `null` and `undefined`. The first call of each function in a running mod SHALL report a warning issue whose source is the mod's source, naming the function and what to use instead. Later calls of the same function SHALL report nothing more.

#### Scenario: Confirm
- **WHEN** a running mod calls `confirm("Delete?")`
- **THEN** the call returns `false`, no dialog appears, and a warning issue is reported whose message says that `confirm()` is not available in mods and names `<dialog>` and `ui.confirm`

#### Scenario: Reported once
- **WHEN** a running mod calls `alert("a")` three times
- **THEN** exactly one warning issue names `alert()`

#### Scenario: Each function is named
- **WHEN** a running mod calls `prompt("Name?")` and `print()`
- **THEN** `prompt` returns `null`, and one warning issue names `prompt()` and another names `print()`

### Requirement: Assets next to the mod
A mod SHALL be able to load images, media, fonts and stylesheets from its own folder by resolving their paths against `context.mod.source`, without declaring a permission, wherever the mod is served from.

#### Scenario: Asset of a mod from the app's origin
- **WHEN** a mod served from the app's origin shows an image at `new URL("./icon.svg", context.mod.source)`
- **THEN** the image loads and no issue is reported

#### Scenario: Asset of a mod from another origin
- **WHEN** the mod at `https://mods.example.net/probe/mod_conf.yaml` shows an image at `new URL("./icon.svg", context.mod.source)`
- **THEN** the image loads from `https://mods.example.net/probe/icon.svg` and no issue is reported
