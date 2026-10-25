## ADDED Requirements

### Requirement: Mod viewer checks the mod
While the mod viewer shows a mod, it SHALL have a "Check mod" button that sends `mods.check` with the viewed mod's source, and the typed collection when the user gave one. Without a mod to show, it SHALL have no such button. While the check runs, the button SHALL be disabled and the viewer SHALL say that the mod is being checked.

#### Scenario: Checking in progress
- **WHEN** the user presses "Check mod" for a mod whose `mount` takes 3 seconds
- **THEN** until the report arrives, the button is disabled and the viewer says that the mod is being checked

#### Scenario: No button without a mod
- **WHEN** the app is opened at `#/run?mod=mod_viewer`
- **THEN** the viewer's frame has no "Check mod" button

### Requirement: Mod viewer shows the check report
The mod viewer SHALL show the report's status as a badge, with `data-ot-variant` `success` for `"pass"`, `warning` for `"warn"` and `destructive` for `"fail"`, and each finding with its step, level, source and message. When the request fails, it SHALL show the error message as an alert. The mod viewer SHALL stay the visible mod.

#### Scenario: Sample mod passes
- **WHEN** the viewer shows the sample book list mod and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check passed, with a `success` badge and no findings
- **AND** the mod viewer is still the visible mod

#### Scenario: Failing mod
- **WHEN** the viewer shows a mod whose entrypoint answers HTTP 404 and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check failed, with a `destructive` badge and a bundle error that names the entrypoint's address and `404`
