# Spec Delta

## MODIFIED Requirements

### Requirement: Load a tile collection from a location
The system SHALL load a tile collection file from a relative path, an absolute URL or a picked local file. It SHALL return a tile collection with exactly five properties: `source` (string), `title` (string), `description` (string), `tiles` (list of loaded tiles) and `issues` (list of issues). Each tile SHALL be the same tile the tile loader returns for that location.

#### Scenario: Load the sample collection
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` is loaded and the server returns the files under `fixtures/`
- **THEN** the result has source `https://example.org/fixtures/tiles/books_collection.yaml`, title `"Science fiction books"` and description `"A sample book list for demonstration purposes."`
- **AND** tiles has three tiles whose metadata.title values are, in order, `"Fahrenheit 451"`, `"Kallocain"` and `"The Library of Babel"`
- **AND** each tile's types is an empty list
- **AND** issues is an empty list
- **AND** the collection has no properties other than source, title, description, tiles and issues

#### Scenario: Collection without tiles
- **WHEN** a collection file whose `tiles` is an empty list is loaded
- **THEN** tiles and issues are both empty lists

### Requirement: Collection file format
The system SHALL read a collection file whose top level is a mapping with a `collection` mapping. That mapping SHALL have a non-empty string `title`, an optional string `description` and a `tiles` list. A missing `description` SHALL give an empty string. Other keys SHALL be ignored, `name` included.

#### Scenario: Description is missing
- **WHEN** a collection file with `title: "A"` and a `tiles` list but no `description` is loaded
- **THEN** the collection's description is an empty string

#### Scenario: Unknown keys are ignored
- **WHEN** a collection file whose `collection` mapping also has `license: "CC-BY"` is loaded
- **THEN** the collection loads and has no `license` property

#### Scenario: Former name is ignored
- **WHEN** a collection file has both `title: "A"` and `name: "B"`
- **THEN** the collection's title is `"A"` and it has no `name` property

### Requirement: Reject collection files with the wrong structure
The system SHALL fail with a collection format error when the `collection` mapping is missing, `title` is missing, empty or not a string, `description` is present but not a string, or `tiles` is missing or not a list. The error SHALL carry the collection's source, and its message SHALL include the source and the reason. No tile SHALL be requested.

#### Scenario: Missing tiles list
- **WHEN** the collection file at `https://example.org/fixtures/no_tiles.yaml` has a `collection` mapping with a `title` and no `tiles`
- **THEN** loading fails with a collection format error whose source is `https://example.org/fixtures/no_tiles.yaml` and whose message says that `tiles` must be a list
- **AND** no tile is requested

#### Scenario: Missing collection mapping
- **WHEN** a collection file whose content is `title: "A"` is loaded
- **THEN** loading fails with a collection format error saying that a `collection` mapping is required

#### Scenario: Title is not a string
- **WHEN** a collection file whose `collection.title` is the number `3` is loaded
- **THEN** loading fails with a collection format error saying that `title` must be a non-empty string

#### Scenario: Name is not a string
- **WHEN** a collection file has `name: 3` and no `title`
- **THEN** loading fails with a collection format error saying that `title` must be a non-empty string

### Requirement: Read a collection's index without loading tiles
The system SHALL read a collection's index from a location: the collection file alone, with no tile requested. The index SHALL have exactly five properties: `source`, `title` and `description` as for a loaded collection, `tiles` (the resolved address of each tile entry that would be loaded, in entry order) and `issues` (the issues of the entries, found before any tile request).

#### Scenario: Index of the sample collection
- **WHEN** the index of `https://example.org/fixtures/tiles/books_collection.yaml` is read
- **THEN** it has source `https://example.org/fixtures/tiles/books_collection.yaml`, title `"Science fiction books"` and description `"A sample book list for demonstration purposes."`
- **AND** its tiles are the three addresses the collection's entries resolve to, in entry order
- **AND** its issues are empty
- **AND** no tile file is requested

#### Scenario: Collection without tiles
- **WHEN** the index of a collection file whose `tiles` is an empty list is read
- **THEN** its tiles and issues are both empty lists
