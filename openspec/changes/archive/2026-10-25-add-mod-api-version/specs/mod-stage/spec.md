## MODIFIED Requirements

### Requirement: Show the mod issues
The stage bar SHALL list every issue of the visible sandbox found while starting and running its mod, in the order they were found: mod file issues (a missing `api` range), tile collection issues, permission issues, blocked requests, mount failures and a stopped mod. Each item SHALL show the level, the source and the message. With no issues, it SHALL say so. Each sandbox SHALL keep its own issues.

#### Scenario: Sample mod has no issues
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the stage bar says that there are no issues

#### Scenario: Missing range comes first
- **WHEN** a mod file without `api` is opened with a collection that has a tile that does not match the mod's type
- **THEN** the issue list's first item is the warning about the missing `api` range, followed by the tile's issue

#### Scenario: Foreign mod permission issue is listed
- **WHEN** a mod from another origin that declares a `show` permission is opened
- **THEN** the issue list has a warning whose source is the mod's source and whose message names the permission

#### Scenario: Blocked request is listed while the mod runs
- **WHEN** a running mod requests an image from an undeclared host
- **THEN** the issue list gains a warning that names the host and `permissions.show`

#### Scenario: Issues stay with their sandbox
- **WHEN** a mod with a blocked request is hidden by opening the sample book list mod
- **THEN** the stage bar says that there are no issues, and going back shows the blocked request again
