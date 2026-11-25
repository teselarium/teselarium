# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Mods from other origins run with the default policy`
- TO: `### Requirement: Mods from other origins get the permissions the user allows`

## MODIFIED Requirements

### Requirement: Mods from other origins get the permissions the user allows
When the mod file is served from another origin, the system SHALL grant the declared permissions the user allowed (see `site-consent`), as it grants those of a mod from the app's origin, and none of the others. With none allowed, it SHALL run the mod with the default content policy. For each declared permission not granted, it SHALL report a warning issue naming the category, the host and the reason, and saying that mods from other sites get only the permissions the user allows.

#### Scenario: Foreign mod with a show permission
- **WHEN** a mod at `https://mods.example.net/probe/mod_conf.yaml` that declares `show` for `https://upload.wikimedia.org` is opened and the user chooses Show without them
- **THEN** a warning issue is reported that names `show`, `https://upload.wikimedia.org` and the declared reason, and says that mods from other sites get only the permissions the user allows
- **AND** images from `https://upload.wikimedia.org` are blocked

#### Scenario: Foreign mod with an allowed show permission
- **WHEN** the same mod is opened and the user allows `show` for `https://upload.wikimedia.org`
- **THEN** images from `https://upload.wikimedia.org` load and no permission issue is reported for it

#### Scenario: Foreign mod with an allowed open permission
- **WHEN** a foreign mod whose `open` permission for `"*"` the user allowed sends `mods.inspect` for a mod at `https://other.example.net/clock/mod_conf.yaml`
- **THEN** the request is answered with the inspection, not with error code `-32002`

#### Scenario: Foreign mod without permissions
- **WHEN** a mod from another origin declares no permissions
- **THEN** no permission issue is reported
