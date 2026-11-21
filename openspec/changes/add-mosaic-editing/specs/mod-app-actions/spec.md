# Spec Delta

## MODIFIED Requirements

### Requirement: Only the visible mod asks
The engine SHALL answer `links.open`, `files.save`, `ui.confirm`, `players.open`, `userCatalog.import`, `userCatalog.update`, `userCatalog.add`, `userCatalog.export`, `userCatalog.remove`, `userCatalog.save`, `userCatalog.history` and `userCatalog.exportFolder` from a mod whose sandbox is not the visible one with error code `-32002`, and SHALL NOT show a dialog.

#### Scenario: Hidden mod asks for a confirmation
- **WHEN** the mod explorer opened the mod viewer, and the hidden explorer sends `ui.confirm`
- **THEN** the response has an error with code `-32002` whose message names `ui.confirm` and says that only the visible mod can ask the user
- **AND** no dialog is shown

#### Scenario: Hidden mod asks for a player
- **WHEN** a hidden mod sends `players.open` with a player address of its tiles
- **THEN** the response has an error with code `-32002` whose message names `players.open`, and no dialog is shown

#### Scenario: Hidden mod asks for an import
- **WHEN** a hidden mod sends `userCatalog.import`
- **THEN** the response has an error with code `-32002` whose message names `userCatalog.import`, and no dialog is shown

#### Scenario: Hidden mod asks to save
- **WHEN** a hidden mod sends `userCatalog.save` with a valid draft
- **THEN** the response has an error with code `-32002` whose message names `userCatalog.save`, no dialog is shown, and nothing is saved
