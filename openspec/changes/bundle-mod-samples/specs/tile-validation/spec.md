## MODIFIED Requirements

### Requirement: Build a tile validator from a tile type file
The system SHALL build a tile validator from a tile type file given as a relative path, an absolute URL or a picked local file. The file is markdown whose frontmatter has a `schema` mapping. The location SHALL be resolved and read with the same rules as a tile. The validator SHALL expose the tile type name and the type file's resolved source.

#### Scenario: Build from the sample book type
- **WHEN** a validator is built from `https://example.org/fixtures/types/book.md` and the server returns the contents of `fixtures/types/book.md`
- **THEN** the validator's type name is `"book"` and its source is `https://example.org/fixtures/types/book.md`

#### Scenario: Relative type path with a base URL
- **WHEN** a validator is built from `./types/book.md` with base URL `https://example.org/fixtures/`
- **THEN** the type file is requested from `https://example.org/fixtures/types/book.md` and that is the validator's source

#### Scenario: Type file in a picked folder
- **WHEN** the user picked a folder whose files include `library/types/book.md` with the contents of `fixtures/types/book.md`
- **AND** a validator is built from `file:///library/types/book.md` with those picked files
- **THEN** the validator's type name is `"book"`
- **AND** no network request is made

### Requirement: Report type files that cannot be read
The system SHALL fail with a fetch error when the type file cannot be fetched or read, and with a parse error when its frontmatter cannot be parsed, with the same rules as for a tile. Each error SHALL carry the type file's source.

#### Scenario: Type file HTTP 404
- **WHEN** a validator is built from `https://example.org/fixtures/types/missing.md` and the server answers HTTP 404
- **THEN** building fails with a fetch error whose source is `https://example.org/fixtures/types/missing.md` and whose message includes `404`

#### Scenario: Type file with invalid frontmatter
- **WHEN** a validator is built from a type file whose frontmatter is not valid YAML
- **THEN** building fails with a parse error whose source is the type file's source

### Requirement: Validate a tile against a tile type
The system SHALL check a tile's metadata against the validator's schema with JSON Type Definition semantics, except for the default above, and SHALL return the tile type name when the metadata matches. Only the metadata SHALL be checked.

#### Scenario: Matching sample tile
- **WHEN** the tile loaded from `fixtures/tiles/books/kallocain.md` is validated with the validator built from `fixtures/types/book.md`
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
- **WHEN** the tile at `https://example.org/tiles/no_country.md`, with every required book field except `country`, is validated with the validator built from `https://example.org/fixtures/types/book.md`
- **THEN** validation fails with a tile validation error whose source is `https://example.org/tiles/no_country.md`
- **AND** whose message includes `https://example.org/tiles/no_country.md`, `book`, `https://example.org/fixtures/types/book.md` and `country`

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

