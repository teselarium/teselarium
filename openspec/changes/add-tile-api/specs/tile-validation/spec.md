# Spec Delta

## Purpose

Decides whether a tile belongs to a tile type by checking its metadata against the type's JTD schema (structural typing), and explains any mismatch so callers can ignore incompatible tiles with a warning.

## ADDED Requirements

### Requirement: Obtain the schema from a tile type
The system SHALL take the schema used for validation from the `schema` property of a tile type's metadata.

#### Scenario: Schema taken from the sample book type
- **WHEN** a validator is created from the parsed `samples/types/book.md` tile
- **THEN** it validates against the `book` definition referenced by `schema.ref`

### Requirement: Reject invalid tile types
The system SHALL reject a tile type whose metadata has no `schema` object, or whose `schema` is not a valid JSON Type Definition, with a tile type error. This error SHALL be separate from a metadata validation failure.

#### Scenario: Missing schema
- **WHEN** a validator is requested for a tile whose metadata has no `schema` property
- **THEN** the request fails with a tile type error saying that `schema` is missing

#### Scenario: Malformed schema
- **WHEN** a validator is requested for a tile type whose schema uses an unknown JTD type such as `type: text`
- **THEN** the request fails with a tile type error and no metadata is validated

### Requirement: Validate metadata against a tile type
The system SHALL validate a metadata object against a tile type using JSON Type Definition semantics as written in the schema, and return a result showing whether the metadata matches.

#### Scenario: Matching tile
- **WHEN** the metadata of `samples/tiles/books/kallocain.md` is validated against the sample book type
- **THEN** the result says the metadata is valid and has no errors

#### Scenario: Extra fields allowed by structural typing
- **WHEN** metadata with all required book fields plus an extra `pages` field is validated against the book type, whose schema sets `additionalProperties: true`
- **THEN** the result says the metadata is valid

#### Scenario: Optional property absent
- **WHEN** metadata without `language` (an optional property of the book type) is validated against the book type
- **THEN** the result says the metadata is valid

### Requirement: Report validation mismatches
The system SHALL return, for metadata that does not match, a list of errors. Each error SHALL identify the offending metadata location and the schema rule it violated. Validation SHALL NOT throw for non-matching metadata.

#### Scenario: Missing required field
- **WHEN** book metadata without `country` is validated against the book type
- **THEN** the result says the metadata is invalid
- **AND** the errors include one that refers to the missing `country` property

#### Scenario: Wrong field type
- **WHEN** book metadata where `authors` is the string `"Ray Bradbury"` instead of a list is validated against the book type
- **THEN** the result says the metadata is invalid and an error refers to `authors`

### Requirement: Validation does not modify input
The system SHALL leave the metadata object and the tile type unchanged when validating. It SHALL NOT add defaults, remove fields or coerce types.

#### Scenario: Metadata unchanged after validation
- **WHEN** a metadata object is validated, whatever the outcome
- **THEN** the object deep-equals a copy taken before validation
