## ADDED Requirements

### Requirement: Mod viewer checks the mod
The mod viewer SHALL have a "Check mod" button that sends `mods.check` with the viewed mod's source, and the typed collection when the user gave one. While the check runs, the button SHALL be disabled and the viewer SHALL say that the mod is being checked. The viewer SHALL then show the report's status and each finding with its step, level, source and message, or the error message when the request fails.

#### Scenario: Sample mod passes
- **WHEN** the viewer shows the sample book list mod and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check passed with no findings
- **AND** the mod viewer is still the visible mod

#### Scenario: Failing mod
- **WHEN** the viewer shows a mod whose entrypoint answers HTTP 404 and the user presses "Check mod"
- **THEN** the viewer's frame shows that the check failed, with a bundle error that names the entrypoint's address and `404`

#### Scenario: Checking in progress
- **WHEN** the user presses "Check mod" for a mod whose `mount` takes 3 seconds
- **THEN** until the report arrives, the button is disabled and the viewer says that the mod is being checked
