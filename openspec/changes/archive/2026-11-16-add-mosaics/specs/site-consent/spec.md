# Spec Delta

## ADDED Requirements

### Requirement: Ask before a foreign mosaic's permissions apply
When a mod is opened from a mosaic whose mosaic file is served from another origin than the app, and the mosaic declares a `show` line that has no remembered decision for that mosaic, the app SHALL show the site consent dialog before the mod's frame is created. A mosaic from the app's origin SHALL get its lines without asking. One dialog SHALL ask about the mod's lines and the mosaic's lines together.

#### Scenario: Foreign mosaic with a cover host
- **WHEN** the user opens a mosaic at `https://mosaics.example.net/maps/mosaic.yaml` that declares `show` for `https://covers.openlibrary.org`, with a mod from the app's origin and no remembered decision
- **THEN** the site consent dialog is shown, lists only the mosaic's line, and the mod has no frame yet

#### Scenario: Mosaic from the app's origin
- **WHEN** the user opens a mosaic served from the app's origin that declares `show` for a host
- **THEN** no site consent dialog is shown and images from that host load

#### Scenario: Foreign mosaic and foreign mod
- **WHEN** both the mosaic and its mod are served from other origins and each declares a line without a remembered decision
- **THEN** one dialog lists both lines

### Requirement: The dialog shows the mosaic's lines apart
When the dialog lists lines of a mosaic, it SHALL show them in a group of their own, after the mod's lines, that names the mosaic by its title and the address of its mosaic file. Each line SHALL show the verb, the host and the mosaic's reason as plain text, with a checkbox checked when the dialog opens. Allow, Show without them and Escape SHALL apply to the mosaic's lines as to the mod's.

#### Scenario: Lines of the mod and of the mosaic
- **WHEN** the dialog lists the mod's `show` for `https://upload.wikimedia.org` and the mosaic's `show` for `https://covers.openlibrary.org` with reason `"Shows the book covers"`
- **THEN** the mod's line is listed under the mod's title and address, and the mosaic's line under the mosaic's title and address, as `show content from https://covers.openlibrary.org` with `Shows the book covers`

#### Scenario: Allow with the mosaic's line unchecked
- **WHEN** the user unchecks the mosaic's line and chooses Allow
- **THEN** the mod's line is granted, the mosaic's line is refused, and images from `https://covers.openlibrary.org` are blocked

### Requirement: Remember keeps the answer for that mosaic
With **Remember** checked, Allow and Show without them SHALL keep one decision per listed mosaic line for that mosaic file's address, category and host, apart from the mod's decisions. A remembered mosaic decision SHALL apply only to the mosaic file at that address, whatever mod it names, and SHALL be kept and restored as the mod decisions are.

#### Scenario: Remembered mosaic allow
- **WHEN** the user checks Remember, allows the mosaic's line, closes the sandbox and opens the same mosaic again
- **THEN** no dialog is shown and the covers load

#### Scenario: Another mosaic with the same host
- **WHEN** a decision is remembered for `show` `https://covers.openlibrary.org` of one mosaic, and the user opens another mosaic file that declares the same line
- **THEN** the dialog is shown for the other mosaic

#### Scenario: Same mod without the mosaic
- **WHEN** a decision is remembered for a mosaic's line and the user opens a run link to the mosaic's mod alone
- **THEN** that decision is not applied to the mod

### Requirement: Inspecting a mosaic never asks
`mosaics.inspect` SHALL never show the site consent dialog. For a mosaic from another origin, it SHALL treat each `show` line with a remembered allow for that mosaic as granted, and every other one as denied.

#### Scenario: Inspect a foreign mosaic without decisions
- **WHEN** a mod inspects a foreign mosaic that declares `show` for `https://covers.openlibrary.org`, with no remembered decision
- **THEN** no dialog is shown and the result's `permissions.denied` holds that line
