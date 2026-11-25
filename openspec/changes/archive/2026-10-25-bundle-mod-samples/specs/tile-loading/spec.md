## MODIFIED Requirements

### Requirement: Load a tile from a location
The system SHALL load a tile from a relative path, an absolute URL or a picked local file and return a tile with exactly four properties: `source` (string), `metadata` (mapping parsed from the frontmatter), `body` (string) and `types` (list of tile type names). `types` SHALL be empty for a newly loaded tile.

#### Scenario: Load a sample tile
- **WHEN** the tile at `https://example.org/fixtures/tiles/books/kallocain.md` is loaded and the server returns the contents of `fixtures/tiles/books/kallocain.md`
- **THEN** the result has source `https://example.org/fixtures/tiles/books/kallocain.md`
- **AND** metadata.title is `"Kallocain"`, metadata.authors is `["Karin Boye"]` and metadata.pages is the number `220`
- **AND** types is an empty list
- **AND** the tile has no properties other than source, metadata, body and types

### Requirement: Resolve the location to an absolute URL
The system SHALL resolve a relative location against a base URL and SHALL use an absolute URL location as it is. The resolved absolute URL SHALL be both the address that is fetched and the tile's `source`.

#### Scenario: Relative path with a base URL
- **WHEN** `./tiles/books/kallocain.md` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the file is requested from `https://example.org/fixtures/tiles/books/kallocain.md`
- **AND** the tile's source is `https://example.org/fixtures/tiles/books/kallocain.md`

#### Scenario: Path with dot segments
- **WHEN** `./tiles/../tiles/books/kallocain.md` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the tile's source is `https://example.org/fixtures/tiles/books/kallocain.md`

#### Scenario: Absolute URL ignores the base URL
- **WHEN** `https://other.example/books/kallocain.md` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the file is requested from `https://other.example/books/kallocain.md` and that is the tile's source

### Requirement: Report files that cannot be fetched
The system SHALL fail with a fetch error when the request is rejected (for example a network or CORS failure) or the response status is not successful (outside 200–299). The error SHALL carry the resolved source, and its message SHALL include the source and the HTTP status or the underlying cause.

#### Scenario: HTTP 404
- **WHEN** a tile is loaded from `https://example.org/fixtures/tiles/missing.md` and the server answers HTTP 404
- **THEN** loading fails with a fetch error whose source is `https://example.org/fixtures/tiles/missing.md` and whose message includes that source and `404`

#### Scenario: Network failure
- **WHEN** a tile is loaded from `https://example.org/fixtures/tiles/books/kallocain.md` and the request is rejected with a network error
- **THEN** loading fails with a fetch error whose message includes that source
- **AND** the original network error is kept as the error's cause

### Requirement: Load a tile from picked local files
The system SHALL load a tile from a file the user picked on their computer, given the picked files and each file's path inside the picked folder. A picked file's location SHALL be the `file:///` URL of that path. The system SHALL read a `file:` location from the picked files and SHALL NOT request it over the network.

#### Scenario: Load from a picked folder
- **WHEN** the user picked a folder whose files include `library/books/kallocain.md` with the contents of `fixtures/tiles/books/kallocain.md`
- **AND** `file:///library/books/kallocain.md` is loaded with those picked files
- **THEN** the tile's source is `file:///library/books/kallocain.md` and metadata.title is `"Kallocain"`
- **AND** no network request is made

#### Scenario: Relative path inside the picked folder
- **WHEN** `./books/kallocain.md` is loaded with base URL `file:///library/` and the same picked files
- **THEN** the tile's source is `file:///library/books/kallocain.md`

#### Scenario: Picked path with a leading slash
- **WHEN** the picked files include the path `/library/books/kallocain.md`
- **AND** `file:///library/books/kallocain.md` is loaded with those picked files
- **THEN** the tile is loaded from that picked file

#### Scenario: Picked path with spaces
- **WHEN** the picked files include `library/my books/kallocain.md`
- **AND** `./my books/kallocain.md` is loaded with base URL `file:///library/` and those picked files
- **THEN** the tile is loaded and its source is `file:///library/my%20books/kallocain.md`

### Requirement: Parse the frontmatter into metadata
The system SHALL parse a frontmatter block into the tile's metadata. A frontmatter block starts with a `---` line at the very start of the file and ends at the next `---` line. Both LF and CRLF line endings SHALL be accepted.

#### Scenario: Sample frontmatter
- **WHEN** `fixtures/tiles/books/farenheit_451.md` is loaded
- **THEN** metadata.title is `"Fahrenheit 451"`, metadata.genres is `["Dystopian", "Science fiction"]` and metadata.pages is the number `156`

#### Scenario: CRLF line endings
- **WHEN** a file with content `---\r\ntitle: "A"\r\n---\r\nText\r\n` is loaded
- **THEN** metadata is `{ "title": "A" }` and body is `Text\r\n`

#### Scenario: Empty frontmatter block
- **WHEN** a file with content `---\n---\nText` is loaded
- **THEN** metadata is an empty mapping and body is `Text`

### Requirement: Keep the body unchanged
The system SHALL return as body the exact text that follows the line closing the frontmatter, without rendering, trimming or otherwise transforming it.

#### Scenario: Sample body
- **WHEN** `fixtures/tiles/books/farenheit_451.md` is loaded
- **THEN** body equals the file's text after the line `---` that closes the frontmatter, character for character
- **AND** body starts with an empty line followed by `Fahrenheit 451 is a 1953 dystopian novel`

#### Scenario: Markdown syntax kept
- **WHEN** a tile whose body contains `# Heading`, a link `[source](https://example.org)`, two consecutive blank lines and trailing spaces is loaded
- **THEN** the body contains all of them unchanged

