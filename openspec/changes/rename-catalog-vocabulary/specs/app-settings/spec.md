# Spec Delta

## MODIFIED Requirements

### Requirement: List the default mosaics of mods
The "List the default mosaics of mods" switch SHALL decide whether the catalog's mosaics also hold the default mosaics of the catalog's mods (see `catalog`). The group SHALL say that the switch helps when writing a mod. A change SHALL apply at once, to running mods too (see "Catalog changed event" in `mod-engine-api`), and SHALL NOT reload any frame.

#### Scenario: Switched on, then the mosaic explorer opened
- **WHEN** the user opened Mosaics, then switches "List the default mosaics of mods" on and opens Mosaics again
- **THEN** the mosaic explorer lists the two sample mosaics, then the default mosaics of Book List, Flashcards and Country Map, and its frame was not reloaded

#### Scenario: Switched off again
- **WHEN** the user switches it on, then off, and then opens Mosaics
- **THEN** the mosaic explorer lists only the two sample mosaics
