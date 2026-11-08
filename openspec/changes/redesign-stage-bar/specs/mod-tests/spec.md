# Spec Delta

## MODIFIED Requirements

### Requirement: What a case records
While a case runs, the check SHALL record as `test` findings what the mount check records as `mount` findings, with the same level and source and a message that also names the case: blocked requests and blocked browser dialogs as warnings, and each request answered with `-32600`, `-32601` or `-32602` as an error. A mount that throws or rejects SHALL NOT be a finding, since it rejects the case's `mount` call. A `ui.notify` SHALL resolve with `null` and SHALL NOT be a finding, whatever its level; the case reads it from `requests`.

#### Scenario: Unknown method in a case
- **WHEN** a case named `deletes a book` mounts a mod that then sends `tiles.delete`
- **THEN** the report has a `test` error whose message names `deletes a book` and `tiles.delete` and says that the method is unknown

#### Scenario: Blocked image in a case
- **WHEN** a case named `shows covers` mounts a mod that then requests an image from an undeclared host
- **THEN** the report has a `test` warning whose message names `shows covers`, the host and `permissions.show`

#### Scenario: Expected mount failure
- **WHEN** a case expects `mount()` to reject, and the mod's `mount` throws `new Error("map failed")`
- **THEN** the case passes and the report has no finding whose message includes `map failed`

#### Scenario: Expected error notification
- **WHEN** a case mounts a mod with no tiles, and the mod sends `ui.notify` with `{ "message": "No books found", "level": "error" }`
- **THEN** the request resolves with `null`, the report has no finding whose message includes `No books found`, and `requests` lists `ui.notify` with those params and result `null`
