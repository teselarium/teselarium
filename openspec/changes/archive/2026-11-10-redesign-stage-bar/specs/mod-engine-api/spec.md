# Spec Delta

## ADDED Requirements

### Requirement: Notify the user
`ui.notify` with `{ message, level, source }` SHALL add a message from the mod to the stage bar of the mod's sandbox and resolve with `null`, without a dialog and without any permission. `level` SHALL be `"info"` (the default), `"warning"` or `"error"`. `source`, when given, SHALL name what the message is about, and SHALL default to the mod's source. The engine SHALL accept it from hidden mods too.

#### Scenario: Notification with the defaults
- **WHEN** the visible sample book list mod sends `ui.notify` with `{ "message": "Saved" }`
- **THEN** the request resolves with `null`, no dialog is shown, and the sandbox has an `info` message from the mod whose source is the mod's source and whose text is `Saved`

#### Scenario: Error about a tile
- **WHEN** a mod sends `ui.notify` with `{ "message": "Cannot read the rating", "level": "error", "source": "https://example.org/books/kallocain.md" }`
- **THEN** the sandbox has an error from the mod whose source is `https://example.org/books/kallocain.md`

#### Scenario: Hidden mod
- **WHEN** the mod explorer opened the mod viewer, and the hidden explorer sends `ui.notify` with `{ "message": "Done" }`
- **THEN** the request resolves with `null` and the explorer's sandbox has the message

#### Scenario: Same message twice
- **WHEN** a mod sends `ui.notify` with `{ "message": "Saved" }` twice
- **THEN** the sandbox has two messages `Saved`

### Requirement: Notification params are checked
The engine SHALL answer `ui.notify` with error code `-32602`, and add no message, when `message` is not a non-empty string of at most 1000 characters, when `level` is present but not `"info"`, `"warning"` or `"error"`, or when `source` is present but not a non-empty string of at most 1000 characters. The message SHALL name `ui.notify` and the field.

#### Scenario: Message too long
- **WHEN** a mod sends `ui.notify` with a message of 1001 characters
- **THEN** the response has an error with code `-32602` whose message names `ui.notify` and `message`

#### Scenario: Unknown level
- **WHEN** a mod sends `ui.notify` with `{ "message": "Saved", "level": "success" }`
- **THEN** the response has an error with code `-32602` whose message names `ui.notify` and `level`, and the sandbox has no new message

#### Scenario: Missing message
- **WHEN** a mod sends `ui.notify` with `{}`
- **THEN** the response has an error with code `-32602` whose message names `ui.notify` and `message`

### Requirement: Mods receive only collection issues
The `issues` of the mount context and of `tiles.changed` SHALL hold only the issues of loading and validating the collection, each with level `"warning"` or `"error"`. Notifications, from the app or from mods, and the other messages of the stage bar SHALL NOT be sent to mods.

#### Scenario: Loaded collection notification stays in the app
- **WHEN** the sample book list mod starts with the sample collection
- **THEN** its mount context's `issues` is empty, while the stage bar has the notification that the collection was loaded

#### Scenario: Reload sends no notification
- **WHEN** the user presses "Reload tiles" for the sample mod
- **THEN** the `tiles.changed` event's `issues` has no item with level `"info"`
