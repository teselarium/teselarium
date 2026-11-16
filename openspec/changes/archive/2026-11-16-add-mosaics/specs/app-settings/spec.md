# Spec Delta

## ADDED Requirements

### Requirement: Remembered mosaic decisions in Settings
The Mod permissions group SHALL also list the remembered decisions of mosaics (see `site-consent`), one group per mosaic file address, sorted with the mods' groups by title, then address. A mosaic's group SHALL say that it is a mosaic, and show its title as remembered, its address, its counts, its group checkbox and its Remove all button. Checking, unchecking and removing its decisions SHALL work as for a mod's, and apply to that mosaic only.

#### Scenario: One remembered mosaic allow
- **WHEN** the user remembered Allow for `show` `https://covers.openlibrary.org` of the mosaic `Nobel books` at `https://mosaics.example.net/nobel/mosaic.yaml`, and opens `#/settings`
- **THEN** the Mod permissions group shows a collapsed group that says it is a mosaic, with `Nobel books`, `https://mosaics.example.net/nobel/mosaic.yaml` and `1 allowed`

#### Scenario: A mod and a mosaic
- **WHEN** the user remembered decisions for the mod `Probe` and the mosaic `Nobel books`
- **THEN** the group lists `Nobel books`, then `Probe`, and only the first says that it is a mosaic

#### Scenario: Removing a mosaic's decision
- **WHEN** the user removes the remembered allow of the mosaic `Nobel books` and opens it again
- **THEN** the site consent dialog lists the mosaic's `show content from https://covers.openlibrary.org`
- **AND** the decisions of mods are unchanged
