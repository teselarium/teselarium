## MODIFIED Requirements

### Requirement: Saving a new mosaic
Saving a new draft SHALL store it as a new user catalog entry with a root of its own (see `browser-files`), as a single file named after its title in lower case, with letters, digits and underscores, followed by `.yaml`, or `mosaic.yaml` when nothing is left. Its provenance SHALL have no folder, that path, and the address it was copied from, if any.

#### Scenario: Saved from a copy
- **WHEN** the user edits a copy of `https://example.org/samples/mosaics/nobel_laureates_map.yaml`, titled "Laureates, my way", and saves
- **THEN** the catalog lists a stored mosaic at `teselarium-browser:///<root>/laureates_my_way.yaml`, listed by the user, copied from that address
