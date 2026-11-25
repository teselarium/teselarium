# Spec Delta

## Purpose

Builds a tile validator from a tile type file (markdown whose frontmatter holds a JSON Type Definition schema) and uses it to decide whether a tile belongs to that tile type by structural typing: the tile must have the fields the type requires, and may have any others.

## ADDED Requirements

### Requirement: Build a tile validator from a tile type file
The system SHALL build a tile validator from a tile type file given as a relative path, an absolute URL or a picked local file. The file is markdown whose frontmatter has a `schema` mapping. The location SHALL be resolved and read with the same rules as a tile. The validator SHALL expose the tile type name and the type file's resolved source.

#### Scenario: Build from the sample book type
- **WHEN** a validator is built from `https://example.org/samples/types/book.md` and the server returns the contents of `samples/types/book.md`
- **THEN** the validator's type name is `"book"` and its source is `https://example.org/samples/types/book.md`

#### Scenario: Relative type path with a base URL
- **WHEN** a validator is built from `./types/book.md` with base URL `https://example.org/samples/`
- **THEN** the type file is requested from `https://example.org/samples/types/book.md` and that is the validator's source

#### Scenario: Type file in a picked folder
- **WHEN** the user picked a folder whose files include `library/types/book.md` with the contents of `samples/types/book.md`
- **AND** a validator is built from `file:///library/types/book.md` with those picked files
- **THEN** the validator's type name is `"book"`
- **AND** no network request is made

### Requirement: Report type files that cannot be read
The system SHALL fail with a fetch error when the type file cannot be fetched or read, and with a parse error when its frontmatter cannot be parsed, with the same rules as for a tile. Each error SHALL carry the type file's source.

#### Scenario: Type file HTTP 404
- **WHEN** a validator is built from `https://example.org/samples/types/missing.md` and the server answers HTTP 404
- **THEN** building fails with a fetch error whose source is `https://example.org/samples/types/missing.md` and whose message includes `404`

#### Scenario: Type file with invalid frontmatter
- **WHEN** a validator is built from a type file whose frontmatter is not valid YAML
- **THEN** building fails with a parse error whose source is the type file's source

### Requirement: Type file must have a schema mapping
The system SHALL fail with a tile type error when the type file's metadata has no `schema`, or when `schema` is not a mapping. The error SHALL carry the type file's source, and its message SHALL include the source and the reason.

#### Scenario: Type file without a schema
- **WHEN** a validator is built from `https://example.org/types/plain.md`, whose frontmatter is `title: "Not a type"`
- **THEN** building fails with a tile type error whose source is `https://example.org/types/plain.md` and whose message says that `schema` is missing

#### Scenario: Type file without frontmatter
- **WHEN** a validator is built from a type file whose content is `# Just text\n`
- **THEN** building fails with a tile type error saying that `schema` is missing

#### Scenario: Schema is not a mapping
- **WHEN** a validator is built from a type file whose frontmatter is `schema: "book"`
- **THEN** building fails with a tile type error saying that `schema` must be a mapping

### Requirement: Tile type name is the schema's ref
The system SHALL use the schema's `ref` as the tile type name. It SHALL fail with a tile type error when `ref` is missing, is not a non-empty string, or does not name one of the schema's `definitions`. The message SHALL include the type file's source and the reason.

#### Scenario: Schema without ref
- **WHEN** a validator is built from a type file whose schema has `definitions` with a `book` definition but no `ref`
- **THEN** building fails with a tile type error saying that `ref` must be a non-empty string

#### Scenario: Ref names a missing definition
- **WHEN** a validator is built from a type file whose schema has a `book` definition and `ref: novel`
- **THEN** building fails with a tile type error whose message includes `novel` and says it is not one of the schema's definitions

### Requirement: Schema must be valid JSON Type Definition
The system SHALL fail with a tile type error, without validating any tile, when the schema is not valid JSON Type Definition (RFC 8927). The error SHALL carry the type file's source. Free-form content under a schema's `metadata` keyword SHALL be accepted, as RFC 8927 allows.

#### Scenario: Unknown type name
- **WHEN** a validator is built from a type file whose `book` definition describes `title` with `type: text`
- **THEN** building fails with a tile type error saying that the schema is not valid JSON Type Definition

#### Scenario: Keyword from another schema language
- **WHEN** a validator is built from a type file whose `book` definition describes `title` with `type: string` and `minLength: 1`
- **THEN** building fails with a tile type error

#### Scenario: Descriptions under metadata
- **WHEN** a validator is built from a type file whose `book` definition describes `title` with `type: string` and `metadata: { description: "Title of the book" }`
- **THEN** the validator is built and its type name is `"book"`

### Requirement: Distinguish tile type failures
The system SHALL report a type file that cannot be fetched, a type file whose frontmatter cannot be parsed and a type file without a usable schema as three distinguishable kinds of error. Each SHALL expose the type file's source as a separate value.

#### Scenario: Caller tells the type file failures apart
- **WHEN** one type file answers HTTP 404, a second has invalid YAML frontmatter and a third has no `schema`
- **THEN** the errors are, in order, a fetch error, a parse error and a tile type error
- **AND** each exposes its own type file source

### Requirement: Extra fields are allowed by default
The system SHALL treat every object description in the schema (a schema with `properties` or `optionalProperties`) that omits `additionalProperties`, at any depth, as if it set `additionalProperties: true`. An explicit `additionalProperties: false` SHALL be kept, so extra fields fail there.

#### Scenario: Omitted at the top level
- **WHEN** a tile with `title`, `date` and an extra `pages` field is validated against a type whose `simple_event` definition requires `title` and `date` and does not set `additionalProperties`
- **THEN** the tile matches

#### Scenario: Omitted in a nested object
- **WHEN** a type requires `publisher` with `properties: { name: { type: string } }` and no `additionalProperties`
- **AND** a tile whose `publisher` is `{ name: "Ace", city: "New York" }` is validated
- **THEN** the tile matches

#### Scenario: Omitted for objects in a list
- **WHEN** a type requires `editions` with `elements: { properties: { year: { type: uint16 } } }` and no `additionalProperties`
- **AND** a tile whose `editions` is `[{ year: 1953, format: "paperback" }]` is validated
- **THEN** the tile matches

#### Scenario: Explicitly false
- **WHEN** a tile with `title`, `date` and an extra `pages` field is validated against a type whose definition requires `title` and `date` and sets `additionalProperties: false`
- **THEN** the tile does not match and the error message mentions `pages`

#### Scenario: Field named properties
- **WHEN** a type's definition requires a metadata field named `properties` with `type: string`
- **AND** a tile whose metadata has `properties: "three rooms"` and an extra `title` field is validated
- **THEN** the validator is built and the tile matches

### Requirement: Validate a tile against a tile type
The system SHALL check a tile's metadata against the validator's schema with JSON Type Definition semantics, except for the default above, and SHALL return the tile type name when the metadata matches. Only the metadata SHALL be checked.

#### Scenario: Matching sample tile
- **WHEN** the tile loaded from `samples/tiles/books/kallocain.md` is validated with the validator built from `samples/types/book.md`
- **THEN** the result is `"book"`

#### Scenario: Optional property absent
- **WHEN** a tile with every required book field but no `language` (an optional property of the book type) is validated with the book validator
- **THEN** the result is `"book"`

#### Scenario: Optional property with the wrong type
- **WHEN** a tile with every required book field and `language: 3` is validated with the book validator
- **THEN** the tile does not match and the error message mentions `language`

### Requirement: Report tiles that do not match
The system SHALL fail with a tile validation error when the metadata does not match. The error SHALL carry the tile's source, and its message SHALL include the tile's source, the type name, the type file's source and every mismatching metadata field, not only the first one.

#### Scenario: Missing required field
- **WHEN** the tile at `https://example.org/tiles/no_country.md`, with every required book field except `country`, is validated with the validator built from `https://example.org/samples/types/book.md`
- **THEN** validation fails with a tile validation error whose source is `https://example.org/tiles/no_country.md`
- **AND** whose message includes `https://example.org/tiles/no_country.md`, `book`, `https://example.org/samples/types/book.md` and `country`

#### Scenario: Wrong field type
- **WHEN** a book tile whose `authors` is the string `"Ray Bradbury"` instead of a list is validated with the book validator
- **THEN** validation fails with a tile validation error whose message mentions `authors`

#### Scenario: Several mismatches
- **WHEN** a book tile without `country` and with `genres: "Dystopian"` is validated with the book validator
- **THEN** the error message mentions both `country` and `genres`

#### Scenario: Tile without metadata
- **WHEN** a tile loaded from a file without frontmatter is validated with the book validator
- **THEN** validation fails with a tile validation error whose message mentions `title`

#### Scenario: Caller tells a mismatch from a bad type
- **WHEN** one validator cannot be built because its type file has no `schema`, and a tile does not match another validator
- **THEN** the first error is a tile type error and the second is a tile validation error

### Requirement: Validation leaves the tile unchanged
The system SHALL NOT change the tile it validates, whatever the outcome. It SHALL NOT add the type name to the tile's `types`, add defaults, remove fields or convert values.

#### Scenario: Matching tile unchanged
- **WHEN** a tile that matches is validated
- **THEN** the tile deep-equals a copy taken before validation, and its types is still an empty list

#### Scenario: Tile that does not match unchanged
- **WHEN** a tile that does not match is validated
- **THEN** the tile deep-equals a copy taken before validation

### Requirement: A validator can be reused
The system SHALL let one tile validator check any number of tiles, in any order, and the result for a tile SHALL NOT depend on the tiles checked before it.

#### Scenario: Matching tile after a tile that does not match
- **WHEN** a tile without `country` is validated with the book validator, and then the Kallocain sample tile is validated with the same validator
- **THEN** the first validation fails and the second returns `"book"`

#### Scenario: Two errors from one validator
- **WHEN** a tile without `country` and then a tile without `title` are validated with the same book validator
- **THEN** the first error mentions `country` and not `title`
- **AND** the second error mentions `title` and not `country`
