# Spec Delta

## ADDED Requirements

### Requirement: Read a collection's index without loading tiles
The system SHALL read a collection's index from a location: the collection file alone, with no tile requested. The index SHALL have exactly five properties: `source`, `name` and `description` as for a loaded collection, `tiles` (the resolved address of each tile entry that would be loaded, in entry order) and `issues` (the issues of the entries, found before any tile request).

#### Scenario: Index of the sample collection
- **WHEN** the index of `https://example.org/fixtures/tiles/books_collection.yaml` is read
- **THEN** it has source `https://example.org/fixtures/tiles/books_collection.yaml`, name `"Science fiction books"` and description `"A sample book list for demonstration purposes."`
- **AND** its tiles are the three addresses the collection's entries resolve to, in entry order
- **AND** its issues are empty
- **AND** no tile file is requested

#### Scenario: Collection without tiles
- **WHEN** the index of a collection file whose `tiles` is an empty list is read
- **THEN** its tiles and issues are both empty lists

### Requirement: The index follows the collection's entry rules
The index SHALL resolve, report and deduplicate entries as loading the collection does, before any tile request: paths resolved against the collection, malformed entries and relative `url`s as errors, local files in a remote collection as errors, and each repeated tile listed once with a warning. A tile the index lists SHALL be one that loading the collection would request.

#### Scenario: Repeated tile is listed once
- **WHEN** a collection lists `path: "./books/kallocain.md"` and later `url: "https://example.org/fixtures/tiles/books/kallocain.md"`, and its index is read
- **THEN** tiles holds `https://example.org/fixtures/tiles/books/kallocain.md` once, at the first entry's position
- **AND** issues has one warning whose source is that address

#### Scenario: Malformed entry
- **WHEN** the second entry of a collection has both `path` and `url`, and its index is read
- **THEN** tiles leaves that entry out
- **AND** issues has one error whose source is the collection's source and whose message mentions entry 2

#### Scenario: Tile that would fail to load
- **WHEN** a collection lists a tile that answers HTTP 404, and its index is read
- **THEN** tiles holds that tile's address and issues names nothing about it, since no tile is requested

### Requirement: Index failures are the collection's failures
Reading an index SHALL fail as loading the collection fails when the collection file itself cannot be fetched, is not plain YAML, or has the wrong structure: with the same three kinds of error, each carrying the collection's source.

#### Scenario: Collection file missing
- **WHEN** the index of `https://example.org/fixtures/missing.yaml` is read and the server answers HTTP 404
- **THEN** reading fails with a fetch error whose source is `https://example.org/fixtures/missing.yaml` and whose message includes `404`

#### Scenario: Wrong structure
- **WHEN** the index of a collection file with a `collection` mapping but no `tiles` is read
- **THEN** reading fails with a collection format error that says `tiles` must be a list
