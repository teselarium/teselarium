# Spec Delta

## MODIFIED Requirements

### Requirement: Mod explorer
The mod explorer `mod_explorer` SHALL declare `open` for `"*"`, and SHALL list each mod reference in its config's `mods` with the title and description it gets from `mods.inspect`. A reference that cannot be inspected SHALL be listed with the reference and the error message. Selecting a mod SHALL send `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter. The vanilla config SHALL list the sample book list mod, then the sample flashcards mod, and use `mod_viewer` as viewer.

#### Scenario: Vanilla explorer lists the sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Book List` with the description `A grid of book covers, with a card for each book that shows its details and text.`

#### Scenario: Vanilla explorer lists the flashcards sample
- **WHEN** the mod explorer runs with its vanilla config
- **THEN** its frame lists `Flashcards` after `Book List`, with the flashcards mod's description

#### Scenario: Select a mod
- **WHEN** the user selects `Book List` in the mod explorer
- **THEN** the mod viewer is the visible mod and shows `Book List`
- **AND** the app's address is a run link with `mod=mod_viewer` and the sample mod's source as `target`

#### Scenario: Mod that cannot be inspected
- **WHEN** the explorer's `mods` list holds `./samples/mods/missing`
- **THEN** its frame lists `./samples/mods/missing` with a message that names `404`
