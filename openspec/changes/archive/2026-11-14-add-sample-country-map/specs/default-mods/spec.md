# Spec Delta

## MODIFIED Requirements

### Requirement: Mod explorer vanilla config
The mod explorer's vanilla config SHALL list the sample book list mod, then the sample flashcards mod, then the sample country map mod, and use `mod_viewer` as viewer.

#### Scenario: Select the flashcards sample
- **WHEN** the user selects `Flashcards` in the mod explorer with its vanilla config
- **THEN** the mod viewer is the visible mod and shows `Flashcards`
- **AND** the app's address is a run link with `mod=mod_viewer` and the flashcards mod's source as `target`

#### Scenario: Vanilla explorer lists the country map sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Country Map` after `Flashcards`, with the country map mod's description
