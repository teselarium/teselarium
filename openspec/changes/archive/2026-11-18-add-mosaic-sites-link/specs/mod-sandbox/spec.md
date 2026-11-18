# Spec Delta

## MODIFIED Requirements

### Requirement: Mosaic grants last only for its sandbox
A mosaic's `show` lines SHALL be granted only to the sandbox opened from that mosaic, and to a sandbox opened with that mosaic as `sites` (see "Sites from a mosaic"). A run link to the same mod without the mosaic or `sites`, and a mod that the mosaic's mod opens with `mods.open`, SHALL NOT get them.

#### Scenario: Same mod without the mosaic
- **WHEN** a mosaic grants `show` for `https://images.example.net` to a mod that declares no permission, and the user then opens a run link to that mod with the same collection
- **THEN** in the new sandbox, an image from `https://images.example.net/other.jpg`, which no tile links, is blocked

#### Scenario: Mod opened by the mosaic's mod
- **WHEN** the mod opened from that mosaic opens another mod with `mods.open`
- **THEN** the other mod's `context.permissions` holds none of the mosaic's lines

#### Scenario: Other mod with sites
- **WHEN** the user opens a run link to another mod with the same collection and that mosaic as `sites`
- **THEN** in the new sandbox, an image from `https://images.example.net/other.jpg` loads

## ADDED Requirements

### Requirement: Sites from a mosaic
For a sandbox opened with `sites`, the system SHALL grant the named mosaic's `show` lines as for a mod opened from that mosaic (see "Grant a mosaic's show permissions"), list them in the mount context's permissions after the mod's own, and report each refused line as "Report a mosaic's refused lines" says. Blocked requests SHALL name the mosaic file as they do for a mosaic.

#### Scenario: Covers of the books' mosaic for Flashcards
- **WHEN** Flashcards, which declares no permission, is opened with `sites` naming `nobel_books_list.yaml` from the app's origin
- **THEN** `context.permissions.granted` holds the mosaic's four `show` lines, `https://covers.openlibrary.org` among them

#### Scenario: Refused line of a foreign sites mosaic
- **WHEN** a sandbox is opened with `sites` naming a mosaic from another origin, and the user chooses Show without them
- **THEN** a warning issue names each refused host, its reason and the mosaic file's address
