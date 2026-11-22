# mod-app-actions Specification

## Purpose

Lets a running mod ask the app to do things for the user that its sandbox forbids: open a link in a new tab, save a file and ask for a confirmation. The app shows each request in its own dialog, which names the mod and which the mod cannot reach, and it acts only when the user accepts.

## Requirements

### Requirement: Open a link
`links.open` with `{ url }`, where `url` is an absolute `http:` or `https:` address, SHALL show the action dialog with the full address and the buttons Open and Cancel. Open SHALL open the address in a new tab that has no access to the app, and the request SHALL resolve with `true`. Cancel SHALL open nothing and resolve with `false`.

#### Scenario: Link opened
- **WHEN** the visible mod sends `links.open` with `{ "url": "https://example.org/books?id=1" }` and the user presses Open
- **THEN** a new tab opens at `https://example.org/books?id=1`, its `window.opener` is `null`, and the request resolves with `true`

#### Scenario: Link cancelled
- **WHEN** the visible mod sends `links.open` with `{ "url": "https://example.org/" }` and the user presses Cancel
- **THEN** no tab opens and the request resolves with `false`

### Requirement: Link addresses are web addresses
The engine SHALL answer `links.open` with error code `-32602`, without showing a dialog, when `url` is not a string holding an absolute `http:` or `https:` address, or holds a user name or password. The message SHALL name `links.open` and the problem.

#### Scenario: Script address
- **WHEN** a mod sends `links.open` with `{ "url": "javascript:alert(1)" }`
- **THEN** the response has an error with code `-32602` whose message names `links.open` and says that `url` must be an `http:` or `https:` address

#### Scenario: Relative address
- **WHEN** a mod sends `links.open` with `{ "url": "./books.html" }`
- **THEN** the response has an error with code `-32602` and no dialog is shown

#### Scenario: Address with a password
- **WHEN** a mod sends `links.open` with `{ "url": "https://user:secret@example.org/" }`
- **THEN** the response has an error with code `-32602` whose message says that `url` must not hold a user name or password

### Requirement: Save a file
`files.save` with `{ name, content, encoding, type }` SHALL show the action dialog with the file name, its size and the buttons Save and Cancel. Save SHALL make the browser download a file with that name, that type and exactly that content, and the request SHALL resolve with `true`. Cancel SHALL resolve with `false`. `encoding` SHALL be `"text"` (the default) or `"base64"`. `type` SHALL default to `text/plain` for text and `application/octet-stream` for base64.

#### Scenario: Text file saved
- **WHEN** the visible mod sends `files.save` with `{ "name": "books.csv", "content": "title\nKallocain\n", "type": "text/csv" }` and the user presses Save
- **THEN** the browser downloads `books.csv` whose content is exactly `title\nKallocain\n`, and the request resolves with `true`

#### Scenario: Binary file saved
- **WHEN** the visible mod sends `files.save` with `{ "name": "cover.png", "content": "iVBORw0KGgo=", "encoding": "base64", "type": "image/png" }` and the user presses Save
- **THEN** the downloaded file's bytes are the base64 decoding of `iVBORw0KGgo=`

#### Scenario: Save cancelled
- **WHEN** the visible mod sends `files.save` for `books.csv` and the user presses Cancel
- **THEN** nothing is downloaded and the request resolves with `false`

#### Scenario: Size shown
- **WHEN** the visible mod sends `files.save` with 2048 characters of text
- **THEN** the dialog shows the name and the size `2 KB`

### Requirement: Saved files are checked
The engine SHALL answer `files.save` with error code `-32602`, without showing a dialog, when `name` is not a file name (empty, longer than 255 characters, `.` or `..`, or holding `/`, `\` or a control character), when `content` is not a string, when `encoding` or `type` has a wrong value, when base64 content does not decode, or when the file would be larger than 20 MB. The message SHALL name `files.save` and the problem.

#### Scenario: Name with a path
- **WHEN** a mod sends `files.save` with `{ "name": "../books.csv", "content": "x" }`
- **THEN** the response has an error with code `-32602` whose message names `files.save` and says that `name` must be a file name without a path

#### Scenario: File too large
- **WHEN** a mod sends `files.save` with text content of 20 MB plus one byte
- **THEN** the response has an error with code `-32602` whose message says that the file is larger than 20 MB

#### Scenario: Broken base64
- **WHEN** a mod sends `files.save` with `{ "name": "a.bin", "content": "%%%", "encoding": "base64" }`
- **THEN** the response has an error with code `-32602` whose message says that `content` is not valid base64

### Requirement: Ask for a confirmation
`ui.confirm` with `{ message, confirmLabel, cancelLabel }` SHALL show the action dialog with the message as plain text and two buttons, labeled `confirmLabel` (default `OK`) and `cancelLabel` (default `Cancel`). The request SHALL resolve with `true` when the user presses the confirm button, and with `false` when the user presses the cancel button or closes the dialog with Escape.

#### Scenario: Confirmed with a custom label
- **WHEN** the visible mod sends `ui.confirm` with `{ "message": "Delete this list?", "confirmLabel": "Delete" }` and the user presses Delete
- **THEN** the dialog showed `Delete this list?` with the buttons Delete and Cancel, and the request resolves with `true`

#### Scenario: Escape answers no
- **WHEN** the visible mod sends `ui.confirm` and the user presses Escape
- **THEN** the dialog closes and the request resolves with `false`

#### Scenario: Message is plain text
- **WHEN** the visible mod sends `ui.confirm` with `{ "message": "<b>Delete</b>?" }`
- **THEN** the dialog shows the text `<b>Delete</b>?` with no bold text

#### Scenario: Message too long
- **WHEN** a mod sends `ui.confirm` with a message of 1001 characters, or a label of 41 characters
- **THEN** the response has an error with code `-32602` whose message names `ui.confirm` and the field that is too long

### Requirement: The action dialog names the mod
The action dialog SHALL be drawn by the app, outside every mod frame, and SHALL show the asking mod's title and source. A mod SHALL NOT be able to change, hide or press the dialog. While the dialog is open, the rest of the app and the mod frames SHALL NOT respond to the pointer or the keyboard.

#### Scenario: Sample mod asks
- **WHEN** a running mod sends `ui.confirm`
- **THEN** the dialog is in the app page, not in the mod's frame, and shows the mod's title and source

#### Scenario: Frame cannot be used behind the dialog
- **WHEN** the action dialog is open and the user clicks a button in the mod's frame
- **THEN** the mod's frame does not receive the click

### Requirement: Only the visible mod asks
The engine SHALL answer `links.open`, `files.save`, `ui.confirm`, `players.open`, `userCatalog.import`, `userCatalog.update`, `userCatalog.add`, `userCatalog.export` and `userCatalog.remove` from a mod whose sandbox is not the visible one with error code `-32002`, and SHALL NOT show a dialog.

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

### Requirement: One action dialog at a time
The app SHALL show one action dialog at a time. Requests that arrive while a dialog is open SHALL wait, and their dialogs SHALL be shown one after the other in the order the requests arrived.

#### Scenario: Two confirmations
- **WHEN** the visible mod sends `ui.confirm` with message `First` and then with message `Second`
- **THEN** only the dialog for `First` is shown, and after the user answers it the dialog for `Second` is shown

### Requirement: A mod that leaves gets no
When the sandbox of a mod with a shown or waiting request stops being visible, is closed, or its mod is stopped, its dialogs SHALL be removed without acting. Each of its requests SHALL resolve with `false`, unless the mod was stopped, which gets no answer.

#### Scenario: Back while a dialog is open
- **WHEN** the mod viewer, opened by the explorer, sends `ui.confirm` and the user goes back to the explorer with the browser's back button while the dialog is open
- **THEN** the dialog is removed and the viewer's request resolves with `false`

#### Scenario: Stopped while a dialog is open
- **WHEN** a mod sends `files.save`, and while the dialog is open the mod sets its frame's `location.href` and is stopped
- **THEN** the dialog is removed and nothing is downloaded

### Requirement: The player dialog is an action dialog
The player dialog SHALL follow the rules of the action dialog: drawn by the app and naming the asking mod, shown one at a time in the order the requests arrived, and removed when its mod's sandbox stops being visible, is closed or its mod is stopped. A player shown when its mod stops being visible SHALL be removed with it, and its request SHALL resolve with `true`.

#### Scenario: Confirmation after a player
- **WHEN** the visible mod sends `players.open` and then `ui.confirm`
- **THEN** the confirmation is shown only after the player dialog is closed

#### Scenario: Back while playing
- **WHEN** a player of the mod viewer, opened by the explorer, is playing and the user goes back to the explorer with the browser's back button
- **THEN** the player dialog is removed, the player frame is no longer in the page, and the request resolves with `true`
