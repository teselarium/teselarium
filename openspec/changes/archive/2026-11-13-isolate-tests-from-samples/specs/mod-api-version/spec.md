## MODIFIED Requirements

### Requirement: Matching mods start without asking
A mod whose `api` range matches the app's mod API version SHALL start with no dialog and no issue about its API.

#### Scenario: Sample mod
- **WHEN** the app is opened at the run link of a mod whose `api` range matches the app's mod API version
- **THEN** no dialog is shown, the mod runs, and the stage bar shows no errors and no warnings

## REMOVED Requirements

### Requirement: Sample and default mods declare the API range
**Reason**: It mixes the shipped sample with the default mods. The sample's range belongs to `sample-book-list`.
**Migration**: "Default mods declare the API range" keeps the default mods' range. `sample-book-list` › "Mod file" declares the sample's `api: "^0.1.5"`, and its "Sample matches the app's API" scenario replaces the sample's part of "Shipped mods match".

## ADDED Requirements

### Requirement: Default mods declare the API range
Every default mod SHALL declare `api: "^0.1.0"`.

#### Scenario: Default mods match
- **WHEN** the mod explorer and the mod viewer are each opened
- **THEN** neither of them shows the dialog or has an issue about its API
