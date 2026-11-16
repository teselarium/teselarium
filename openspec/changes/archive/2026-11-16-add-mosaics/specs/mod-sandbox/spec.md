# Spec Delta

## MODIFIED Requirements

### Requirement: Content hosts
The content hosts SHALL be the `http:` and `https:` origins of the files the engine read to start the mod: the mosaic file when the mod was opened from a mosaic, the mod file, its entrypoint, its tile type file, the collection file and each tile. A mod's content hosts SHALL be fixed when its frame starts.

#### Scenario: Sample content hosts
- **WHEN** a mod is opened with a collection, with every file it reads from the app's own origin
- **THEN** the only content host is the app's origin

#### Scenario: Tile from another host
- **WHEN** the collection lists a tile at `https://tiles.example.net/books/kallocain.md`
- **THEN** `https://tiles.example.net` is a content host and images from it load

#### Scenario: Mosaic from another host
- **WHEN** a mod from the app's origin is opened from a mosaic at `https://mosaics.example.net/maps/mosaic.yaml`
- **THEN** `https://mosaics.example.net` is a content host and images from it load

## ADDED Requirements

### Requirement: Grant a mosaic's show permissions
For a mod opened from a mosaic, the system SHALL grant the mosaic's `show` lines as it grants a mod's `show` permissions: every line when the mosaic file is served from the app's origin, and the lines the user allowed (see `site-consent`) when it is served from another origin. Granted lines SHALL be listed in the mount context's `permissions.granted`, and the others in `permissions.denied`, after the mod's own.

#### Scenario: Covers declared by a mosaic from the app's origin
- **WHEN** a mod without permissions is opened from a mosaic of the app's origin that declares `show` for `https://*.archive.org`, and shows an image from `https://ia800100.us.archive.org`
- **THEN** the image loads and `context.permissions.granted` holds the mosaic's line

#### Scenario: Refused line of a foreign mosaic
- **WHEN** a mosaic from another origin declares `show` for `https://covers.openlibrary.org` and the user chooses Show without them
- **THEN** images from `https://covers.openlibrary.org` are blocked and `context.permissions.denied` holds the line

### Requirement: Report a mosaic's refused lines
For each `show` line of a mosaic that is not granted, the system SHALL report a warning issue that names the host, the reason and the mosaic file, and says that mosaics from other sites get only the permissions the user allows.

#### Scenario: Refused cover host
- **WHEN** the user refuses a foreign mosaic's `show` line for `https://covers.openlibrary.org` with reason `"Shows the book covers"`
- **THEN** a warning issue names `https://covers.openlibrary.org`, `Shows the book covers` and the mosaic file's address

### Requirement: Mosaic grants last only for its sandbox
A mosaic's `show` lines SHALL be granted only to the sandbox opened from that mosaic. A run link to the same mod without the mosaic, and a mod that the mosaic's mod opens with `mods.open`, SHALL NOT get them.

#### Scenario: Same mod without the mosaic
- **WHEN** a mosaic grants `show` for `https://images.example.net` to a mod that declares no permission, and the user then opens a run link to that mod with the same collection
- **THEN** in the new sandbox, an image from `https://images.example.net/other.jpg`, which no tile links, is blocked

#### Scenario: Mod opened by the mosaic's mod
- **WHEN** the mod opened from that mosaic opens another mod with `mods.open`
- **THEN** the other mod's `context.permissions` holds none of the mosaic's lines

### Requirement: Blocked show requests point to the mosaic file
For a sandbox opened from a mosaic, the report of a blocked image, media, font or stylesheet request whose host neither the mod nor the mosaic declares SHALL say to add the origin to `permissions.show` in `mod_conf.yaml`, or in the mosaic file when the mosaic's data needs it. Reports of other categories SHALL name only `mod_conf.yaml`.

#### Scenario: Undeclared cover host in a mosaic
- **WHEN** a mod opened from a mosaic shows an image from `https://images.example.net/cover.jpg`, and neither file declares that host
- **THEN** a warning issue names `https://images.example.net` and says to add it to `permissions.show` in `mod_conf.yaml`, or in the mosaic file

#### Scenario: Undeclared connection in a mosaic
- **WHEN** a mod opened from a mosaic calls `fetch("https://api.example.net/data")`
- **THEN** the warning issue says to add `https://api.example.net` to `permissions.connect` in `mod_conf.yaml`, and does not name the mosaic file
