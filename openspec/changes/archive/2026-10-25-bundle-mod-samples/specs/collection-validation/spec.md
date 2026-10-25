## MODIFIED Requirements

### Requirement: Validate every tile of a collection
The system SHALL validate each tile of a tile collection with a tile validator and return a new tile collection with the same `source`, `name` and `description`, and the same tiles in the same order.

#### Scenario: Validate the sample collection
- **WHEN** the sample collection loaded from `fixtures/tiles/books_collection.yaml` is validated with the validator built from `fixtures/types/book.md`
- **THEN** the result has the collection's source, name and description
- **AND** tiles has the three tiles in the same order, each with types `["book"]`
- **AND** issues is an empty list

#### Scenario: Collection without tiles
- **WHEN** a collection with no tiles and no issues is validated
- **THEN** the result has no tiles and no issues

