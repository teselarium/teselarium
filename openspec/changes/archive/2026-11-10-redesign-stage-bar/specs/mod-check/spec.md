# Spec Delta

## MODIFIED Requirements

### Requirement: What the mount check records
The mount check SHALL record as `mount` findings:
- a mount that throws or rejects, and a stopped mod, as errors;
- blocked requests and blocked browser dialogs, as warnings;
- each request answered with `-32600`, `-32601` or `-32602`, as an error naming the method and the error's message;
- a `mount` that has not finished 10 seconds after the frame started, as an error that says so;
- each `ui.notify` with level `"error"` or `"warning"`, at that level, with its source and text.

#### Scenario: Mount throws
- **WHEN** a mod whose `mount` throws `new Error("map failed")` is checked
- **THEN** the report has status `"fail"` and a `mount` error whose message includes `map failed`

#### Scenario: Unknown method
- **WHEN** a mod that sends `tiles.delete` while mounting is checked
- **THEN** the report has a `mount` error whose message names `tiles.delete` and says that the method is unknown

#### Scenario: Blocked image
- **WHEN** a mod that requests an image from an undeclared host is checked
- **THEN** the report has a `mount` warning that names the host and `permissions.show`

#### Scenario: Mount never finishes
- **WHEN** a mod whose `mount` returns a promise that never settles is checked
- **THEN** the result comes about 10 seconds later, with status `"fail"` and a `mount` error that says the mount did not finish within 10 seconds

#### Scenario: Mod notifies an error while mounting
- **WHEN** a mod that sends `ui.notify` with `{ "message": "No books found", "level": "error" }` while mounting is checked
- **THEN** the request resolves with `null`, and the report has status `"fail"` and a `mount` error whose source is the mod's source and whose message is `No books found`

## ADDED Requirements

### Requirement: Notifications while checking
While the mount check runs, `ui.notify` SHALL resolve with `null` and SHALL NOT add a message to any stage bar. A notification with level `"info"` SHALL NOT be a finding.

#### Scenario: Info notification is not a finding
- **WHEN** a mod that sends `ui.notify` with `{ "message": "Loaded" }` while mounting is checked
- **THEN** the request resolves with `null` and the report has no finding whose message is `Loaded`

#### Scenario: The check adds nothing to the stage bar
- **WHEN** the visible mod viewer checks a mod that sends `ui.notify` while mounting
- **THEN** the mod viewer's stage bar gets no message from that notification
