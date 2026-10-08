# Spec Delta

## Purpose

Loads tiles and tile collections from relative paths or absolute URLs into parsed tile objects. One unreachable or malformed tile is reported and never prevents the rest of a collection from loading.

## ADDED Requirements

### Requirement: Load a single tile from a location
The system SHALL load a tile from a relative path or an absolute URL by fetching its text and parsing it with the tile parser. The tile's source SHALL be the absolute URL it was fetched from.

#### Scenario: Load a tile by URL
- **WHEN** a tile is loaded from `https://example.org/books/kallocain.md` and the server returns the sample Kallocain document
- **THEN** the result is a tile with source `https://example.org/books/kallocain.md` and metadata.title `"Kallocain"`

#### Scenario: Tile cannot be fetched
- **WHEN** a tile is loaded from a location that answers with HTTP 404 or a network failure
- **THEN** loading fails with a load error that includes the location and the cause

### Requirement: Parse and check a tile collection file
The system SHALL fetch a collection YAML file and read its `collection` object: `name` (string, required), `description` (string, optional) and `tiles` (list, required). A collection file that cannot be fetched, is not valid YAML or does not have this structure SHALL fail the whole load with a collection error.

#### Scenario: Load the sample collection
- **WHEN** `samples/tiles/books_collection.yaml` is loaded
- **THEN** the result has collection name `"Science fiction books"` and description `"A sample book list for demonstration purposes."`

#### Scenario: Missing tiles list
- **WHEN** a collection file whose `collection` object has no `tiles` list is loaded
- **THEN** the load fails with a collection error naming the missing `tiles` field

### Requirement: Resolve collection entry locations
The system SHALL resolve each `path` entry relative to the location of the collection file, and SHALL use each `url` entry as an absolute URL.

#### Scenario: Relative path resolution
- **WHEN** a collection at `https://example.org/data/books_collection.yaml` lists `path: "./books/kallocain.md"`
- **THEN** that tile is fetched from `https://example.org/data/books/kallocain.md`

#### Scenario: Absolute URL entry
- **WHEN** a collection lists `url: "https://other.example/tiles/foundation.md"`
- **THEN** that tile is fetched from `https://other.example/tiles/foundation.md`

### Requirement: Load all collection tiles in order
The system SHALL return the loaded tiles in the order their entries appear in the collection.

#### Scenario: Sample collection order
- **WHEN** `samples/tiles/books_collection.yaml` is loaded and every tile is reachable
- **THEN** the tile titles are, in order, `"Fahrenheit 451"`, `"Kallocain"` and `"The Library of Babel"`
- **AND** the error list is empty

### Requirement: Skip and report failing collection entries
The system SHALL skip any collection entry that is malformed or cannot be fetched or parsed. It SHALL still return every other tile, together with one error per skipped entry giving the entry's position, its location (if any) and the reason.

#### Scenario: One tile is missing
- **WHEN** a collection with three entries is loaded and the second answers with HTTP 404
- **THEN** the result has the first and third tiles in order
- **AND** one error with entry position 1 (zero-based), the resolved location of the second entry and a reason mentioning the 404

#### Scenario: Entry with unparseable frontmatter
- **WHEN** a collection entry points to a document whose frontmatter is invalid YAML
- **THEN** that entry is skipped and reported with a parse reason, and the other tiles are returned

#### Scenario: Malformed entry
- **WHEN** a collection entry has both `path` and `url`, or neither
- **THEN** that entry is skipped and reported as malformed, and no fetch is attempted for it
