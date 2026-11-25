## MODIFIED Requirements

### Requirement: The action dialog names the mod
The action dialog SHALL be drawn by the app, outside every mod frame, and SHALL show the asking mod's title and source. A mod SHALL NOT be able to change, hide or press the dialog. While the dialog is open, the rest of the app and the mod frames SHALL NOT respond to the pointer or the keyboard.

#### Scenario: Sample mod asks
- **WHEN** a running mod sends `ui.confirm`
- **THEN** the dialog is in the app page, not in the mod's frame, and shows the mod's title and source

#### Scenario: Frame cannot be used behind the dialog
- **WHEN** the action dialog is open and the user clicks a button in the mod's frame
- **THEN** the mod's frame does not receive the click
