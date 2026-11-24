# tile-loading Specification

## Purpose

Loads a single tile (a markdown document with YAML frontmatter) from a relative path, an absolute URL or a local file the user picked, into a plain tile object: source, metadata, body and types. Other parts of Teselarium, such as collections, validation, mods and the tiles UI, build on this object.

## Requirements

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

### Requirement: Default base URL in a browser page
When no base URL is given and the system runs in a browser page, the system SHALL resolve a relative location against the page's document base URL, the same way the browser resolves a relative fetch.

#### Scenario: No base URL in a page
- **WHEN** `books/kallocain.md` is loaded with no base URL on a page whose document base URL is `https://example.org/app/`
- **THEN** the tile's source is `https://example.org/app/books/kallocain.md`

### Requirement: Reject locations that cannot be resolved
The system SHALL fail with a fetch error, without making any request, when the location cannot be resolved to a valid absolute URL. This includes a relative location with no base URL outside a browser page. The error message SHALL include the location.

#### Scenario: Relative path without any base
- **WHEN** `books/kallocain.md` is loaded with no base URL and no document base URL is available
- **THEN** loading fails with a fetch error whose message includes `books/kallocain.md` and says that a base URL is required
- **AND** no request is made

#### Scenario: Invalid URL
- **WHEN** `https://[bad/kallocain.md` is loaded
- **THEN** loading fails with a fetch error whose message includes `https://[bad/kallocain.md`
- **AND** no request is made

### Requirement: Report files that cannot be fetched
The system SHALL fail with a fetch error when the request is rejected (for example a network or CORS failure) or the response status is not successful (outside 200–299). The error SHALL carry the resolved source, and its message SHALL include the source and the HTTP status or the underlying cause. When the request is rejected, the message SHALL also say that the site may be unreachable or may not allow this app to read its files.

#### Scenario: HTTP 404
- **WHEN** a tile is loaded from `https://example.org/fixtures/tiles/missing.md` and the server answers HTTP 404
- **THEN** loading fails with a fetch error whose source is `https://example.org/fixtures/tiles/missing.md` and whose message includes that source and `404`

#### Scenario: Network failure
- **WHEN** a tile is loaded from `https://example.org/fixtures/tiles/books/kallocain.md` and the request is rejected with a network error
- **THEN** loading fails with a fetch error whose message includes that source
- **AND** the original network error is kept as the error's cause

#### Scenario: Hint for a rejected request
- **WHEN** a collection is loaded from `https://tiles.example.net/books.yaml` and the request is rejected, as a browser rejects a site that does not allow the app's origin
- **THEN** the fetch error's message includes `https://tiles.example.net/books.yaml` and says that the site may be unreachable or may not allow this app to read its files

#### Scenario: No hint for an HTTP status
- **WHEN** a tile is loaded and the server answers HTTP 404
- **THEN** the fetch error's message does not say that the site may not allow this app to read its files

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

### Requirement: Report local files that cannot be read
The system SHALL fail with a fetch error, without any network request, when a `file:` location is not among the picked files, when no picked files were given, or when a picked file cannot be read. The error SHALL carry the source, and its message SHALL include it.

#### Scenario: File was not picked
- **WHEN** `file:///library/books/missing.md` is loaded with picked files that do not include it
- **THEN** loading fails with a fetch error whose source is `file:///library/books/missing.md` and whose message says that the file is not among the picked files
- **AND** no network request is made

#### Scenario: No picked files
- **WHEN** `file:///library/books/kallocain.md` is loaded without any picked files
- **THEN** loading fails with a fetch error whose message includes `file:///library/books/kallocain.md`
- **AND** no network request is made

#### Scenario: Picked file can no longer be read
- **WHEN** a picked file is loaded and reading its content fails
- **THEN** loading fails with a fetch error whose message includes the file's source
- **AND** the read failure is kept as the error's cause

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

### Requirement: Load files without frontmatter
The system SHALL load a file that does not start with a frontmatter block as a tile with empty metadata and the whole file text as body. A `---` line that is not the first line of the file SHALL NOT start a frontmatter block.

#### Scenario: Plain markdown file
- **WHEN** a file with content `# Just text\n` is loaded
- **THEN** metadata is an empty mapping and body is `# Just text\n`

#### Scenario: Delimiter not on the first line
- **WHEN** a file with content `\n---\ntitle: "A"\n---\nText` is loaded
- **THEN** metadata is an empty mapping and body is the whole file content

#### Scenario: Empty file
- **WHEN** an empty file is loaded
- **THEN** metadata is an empty mapping and body is an empty string

### Requirement: Metadata is plain data
The system SHALL produce metadata that holds only strings, numbers, booleans, null, lists and mappings. Unquoted dates and timestamps SHALL stay strings. Frontmatter that uses YAML tags for any other kind of value SHALL be rejected with a parse error.

#### Scenario: Unquoted date stays a string
- **WHEN** a file whose frontmatter has the line `date: 1953-10-19` (unquoted) is loaded
- **THEN** metadata.date is the string `"1953-10-19"`

#### Scenario: Tag for another value type
- **WHEN** a file whose frontmatter has the line `cover: !!binary aGk=` is loaded
- **THEN** loading fails with a parse error

#### Scenario: Code tag is never run
- **WHEN** a file whose frontmatter has the line `title: !!js/function "function () { return 1; }"` is loaded
- **THEN** loading fails with a parse error and no code from the file is run

### Requirement: Frontmatter must be YAML
The system SHALL reject, with a parse error, a frontmatter block whose opening line declares a language other than YAML, such as `---json` or `---js`. Content in any other language SHALL NOT be evaluated.

#### Scenario: JavaScript frontmatter
- **WHEN** a file starting with `---js` followed by `{ title: (function () { return "x"; })() }` and a closing `---` is loaded
- **THEN** loading fails with a parse error and no code from the file is run

#### Scenario: JSON frontmatter
- **WHEN** a file starting with `---json` followed by `{"title": "A"}` and a closing `---` is loaded
- **THEN** loading fails with a parse error saying the frontmatter must be YAML

### Requirement: Reject malformed frontmatter
The system SHALL fail with a parse error when the frontmatter block is not closed, is not valid YAML, repeats a key, or does not have a mapping at its top level (for example a list or a single value). The error SHALL carry the resolved source, and its message SHALL include the source and the reason.

#### Scenario: Invalid YAML
- **WHEN** a file at `https://example.org/bad.md` with frontmatter `title: "unterminated` is loaded
- **THEN** loading fails with a parse error whose source is `https://example.org/bad.md` and whose message includes that source

#### Scenario: Frontmatter is a list
- **WHEN** a file whose frontmatter is the two lines `- a` and `- b` is loaded
- **THEN** loading fails with a parse error saying that the frontmatter must be a mapping

#### Scenario: Frontmatter not closed
- **WHEN** a file with content `---\ntitle: "A"\n\nSome text` (no closing `---` line) is loaded
- **THEN** loading fails with a parse error saying that the frontmatter is not closed

#### Scenario: Repeated key
- **WHEN** a file whose frontmatter has `title: "A"` and `title: "B"` is loaded
- **THEN** loading fails with a parse error

### Requirement: Distinguish fetch errors from parse errors
The system SHALL report fetch failures and parse failures as two distinguishable kinds of error. Both SHALL expose the source as a separate value, so callers can report the failing tile without parsing the message.

#### Scenario: Caller tells the failures apart
- **WHEN** one tile fails because the server answers HTTP 404 and another fails because its frontmatter is invalid YAML
- **THEN** the first error is a fetch error and the second is a parse error
- **AND** each error exposes its own resolved source

### Requirement: Loaded tiles are independent plain data
The system SHALL return a tile that contains no class instances or functions and does not share objects with any other loaded tile. Changing one loaded tile SHALL NOT change another tile, even one loaded from the same file.

#### Scenario: Structured clone of a tile
- **WHEN** a sample tile is loaded and a structured clone of it is made
- **THEN** the clone deep-equals the tile

#### Scenario: Same file loaded twice
- **WHEN** the same file is loaded twice and the first tile's metadata.title is changed
- **THEN** the second tile's metadata.title still has the value from the file
