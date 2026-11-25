# Spec Delta

## Purpose

Validates every tile of a loaded tile collection with a tile validator, adding the tile type name to each tile that matches and a warning issue for each tile that does not, so callers such as mods and mosaics can tell which tiles belong to a type.

## ADDED Requirements

### Requirement: Validate every tile of a collection
The system SHALL validate each tile of a tile collection with a tile validator and return a new tile collection with the same `source`, `name` and `description`, and the same tiles in the same order.

#### Scenario: Validate the sample collection
- **WHEN** the sample collection loaded from `samples/tiles/books_collection.yaml` is validated with the validator built from `samples/types/book.md`
- **THEN** the result has the collection's source, name and description
- **AND** tiles has the three tiles in the same order, each with types `["book"]`
- **AND** issues is an empty list

#### Scenario: Collection without tiles
- **WHEN** a collection with no tiles and no issues is validated
- **THEN** the result has no tiles and no issues

### Requirement: Add the type name to matching tiles
The system SHALL add the tile type name at the end of the `types` of each tile that matches, after the names it already has. A name the tile already has SHALL NOT be added again.

#### Scenario: Tile already has another type
- **WHEN** a collection whose only tile matches the book type and has types `["simple_event"]` is validated with the book validator
- **THEN** that tile's types is `["simple_event", "book"]`

#### Scenario: Tile already has the type
- **WHEN** a collection whose only tile matches the book type and already has types `["book"]` is validated with the book validator
- **THEN** that tile's types is `["book"]`

### Requirement: Keep tiles that do not match, with a warning
The system SHALL keep each tile that does not match at its position with its `types` unchanged, and SHALL add a `warning` issue whose source is the tile's source and whose message is the tile validation error's message.

#### Scenario: One tile does not match
- **WHEN** a collection of three book tiles, whose second tile at `https://example.org/tiles/no_country.md` has no `country`, is validated with the book validator
- **THEN** tiles still has the three tiles in order, the first and third with types `["book"]` and the second with types `[]`
- **AND** issues has one warning whose source is `https://example.org/tiles/no_country.md` and whose message mentions `book` and `country`

#### Scenario: No tile matches
- **WHEN** a collection of two tiles without frontmatter is validated with the book validator
- **THEN** both tiles are kept with types `[]`
- **AND** issues has two warnings, one per tile, in tile order

#### Scenario: Issue shape
- **WHEN** a collection with one tile that does not match is validated
- **THEN** its only issue has level `"warning"`, a source and a message, and no other properties

### Requirement: Keep the existing issues
The system SHALL keep the collection's existing issues, in their order, and SHALL add the new validation issues after them, in tile order.

#### Scenario: Collection loaded with a failed tile
- **WHEN** a collection that was loaded with one error issue for a tile answering HTTP 404 has a tile without `country`, and it is validated with the book validator
- **THEN** issues is the HTTP 404 error first, then the warning for the tile without `country`

### Requirement: Validation is idempotent
The system SHALL return, when it validates its own result again with the same validator, a collection that deep-equals that result. It SHALL NOT add a type name a tile already has, nor an issue equal to an existing one (same level, source and message).

#### Scenario: Validate the sample collection twice
- **WHEN** the sample collection is validated with the book validator, and the result is validated again with the same validator
- **THEN** the second result deep-equals the first, and each tile's types is `["book"]`

#### Scenario: Tile that does not match, validated twice
- **WHEN** a collection with one tile without `country` is validated with the book validator, and the result is validated again with a validator built again from the same type file
- **THEN** the second result has exactly one warning for that tile

### Requirement: Validate with several tile types
The system SHALL let a collection be validated with several validators in turn. Each validator SHALL add its own type name to the tiles that match it, and its own warning to the tiles that do not.

#### Scenario: Two types that match
- **WHEN** the sample collection is validated with the book validator, and the result is validated with a validator whose `simple_event` type requires only `title` and `date`
- **THEN** each tile's types is `["book", "simple_event"]`

#### Scenario: Two types that do not match
- **WHEN** a collection with one tile without `country` is validated with the book validator, and the result is validated with a validator whose `country_location` type requires `title` and `country`
- **THEN** that tile's types is `[]`
- **AND** issues has two warnings, the first mentioning `book` and the second mentioning `country_location`

### Requirement: The input collection is not changed
The system SHALL leave the collection it validates unchanged, and SHALL return a collection that does not share objects with it. The result SHALL be plain data.

#### Scenario: Input unchanged
- **WHEN** the sample collection is validated with the book validator
- **THEN** the input collection deep-equals a copy taken before validation, and its tiles still have types `[]`

#### Scenario: Result independent of the input
- **WHEN** the sample collection is validated and the first tile of the result has its metadata.title changed
- **THEN** the first tile of the input collection still has its original metadata.title

#### Scenario: Structured clone of the result
- **WHEN** the sample collection is validated and a structured clone of the result is made
- **THEN** the clone deep-equals the result
