# collection-loading Specification

## Purpose

Loads a tile collection file (a YAML list of tile paths and URLs) from a relative path, an absolute URL or a picked local file into a plain tile collection: source, name, description, tiles and issues. A tile that fails to load is reported as an issue and never stops the rest of the collection from loading.

## Requirements

### Requirement: Load a tile collection from a location
The system SHALL load a tile collection file from a relative path, an absolute URL or a picked local file. It SHALL return a tile collection with exactly five properties: `source` (string), `name` (string), `description` (string), `tiles` (list of loaded tiles) and `issues` (list of issues). Each tile SHALL be the same tile the tile loader returns for that location.

#### Scenario: Load the sample collection
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` is loaded and the server returns the files under `fixtures/`
- **THEN** the result has source `https://example.org/fixtures/tiles/books_collection.yaml`, name `"Science fiction books"` and description `"A sample book list for demonstration purposes."`
- **AND** tiles has three tiles whose metadata.title values are, in order, `"Fahrenheit 451"`, `"Kallocain"` and `"The Library of Babel"`
- **AND** each tile's types is an empty list
- **AND** issues is an empty list
- **AND** the collection has no properties other than source, name, description, tiles and issues

#### Scenario: Collection without tiles
- **WHEN** a collection file whose `tiles` is an empty list is loaded
- **THEN** tiles and issues are both empty lists

### Requirement: Resolve the collection location
The system SHALL resolve the collection location in the same way as a tile location: a relative location is resolved against the given base URL, or the page's document base URL when no base is given, and an absolute URL is used as it is. The resolved absolute URL SHALL be the collection's `source`.

#### Scenario: Relative collection path with a base URL
- **WHEN** `./tiles/books_collection.yaml` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the collection's source is `https://example.org/fixtures/tiles/books_collection.yaml`

#### Scenario: Relative collection path without any base
- **WHEN** `tiles/books_collection.yaml` is loaded with no base URL and no document base URL is available
- **THEN** loading fails with a fetch error whose message includes `tiles/books_collection.yaml` and says that a base URL is required
- **AND** no request is made

### Requirement: Collection file format
The system SHALL read a collection file whose top level is a mapping with a `collection` mapping. That mapping SHALL have a non-empty string `name`, an optional string `description` and a `tiles` list. A missing `description` SHALL give an empty string. Other keys SHALL be ignored.

#### Scenario: Description is missing
- **WHEN** a collection file with `name: "A"` and a `tiles` list but no `description` is loaded
- **THEN** the collection's description is an empty string

#### Scenario: Unknown keys are ignored
- **WHEN** a collection file whose `collection` mapping also has `license: "CC-BY"` is loaded
- **THEN** the collection loads and has no `license` property

### Requirement: Reject collection files with the wrong structure
The system SHALL fail with a collection format error when the `collection` mapping is missing, `name` is missing, empty or not a string, `description` is present but not a string, or `tiles` is missing or not a list. The error SHALL carry the collection's source, and its message SHALL include the source and the reason. No tile SHALL be requested.

#### Scenario: Missing tiles list
- **WHEN** the collection file at `https://example.org/fixtures/no_tiles.yaml` has a `collection` mapping with a `name` and no `tiles`
- **THEN** loading fails with a collection format error whose source is `https://example.org/fixtures/no_tiles.yaml` and whose message says that `tiles` must be a list
- **AND** no tile is requested

#### Scenario: Missing collection mapping
- **WHEN** a collection file whose content is `name: "A"` is loaded
- **THEN** loading fails with a collection format error saying that a `collection` mapping is required

#### Scenario: Name is not a string
- **WHEN** a collection file whose `collection.name` is the number `3` is loaded
- **THEN** loading fails with a collection format error saying that `name` must be a non-empty string

### Requirement: Collection file is plain YAML
The system SHALL parse the collection file as a single YAML document whose top level is a mapping, holding only strings, numbers, booleans, null, lists and mappings. Unquoted dates SHALL stay strings. It SHALL fail with a YAML parse error that carries the source when the file is empty, is not valid YAML, has more than one document, repeats a key, uses a tag for another value type, or has no mapping at its top level.

#### Scenario: Invalid YAML
- **WHEN** the collection file at `https://example.org/bad.yaml` contains `collection: [unclosed`
- **THEN** loading fails with a YAML parse error whose source is `https://example.org/bad.yaml` and whose message includes that source
- **AND** no tile is requested

#### Scenario: Empty file
- **WHEN** an empty collection file is loaded
- **THEN** loading fails with a YAML parse error

#### Scenario: Top level is a list
- **WHEN** a collection file whose content is the two lines `- a` and `- b` is loaded
- **THEN** loading fails with a YAML parse error saying that the YAML must be a mapping

#### Scenario: Tag for another value type
- **WHEN** a collection file whose `collection` mapping has the line `cover: !!binary aGk=` is loaded
- **THEN** loading fails with a YAML parse error

#### Scenario: Code tag is never run
- **WHEN** a collection file whose `collection.name` is `!!js/function "function () { return 1; }"` is loaded
- **THEN** loading fails with a YAML parse error and no code from the file is run

#### Scenario: More than one document
- **WHEN** a collection file with two YAML documents separated by a `---` line is loaded
- **THEN** loading fails with a YAML parse error

### Requirement: Report collection files that cannot be fetched
The system SHALL fail with a fetch error when the collection file cannot be fetched or read, with the same rules as for a tile: request rejected, unsuccessful HTTP status, or a `file:` location that is not among the picked files. The error SHALL carry the collection's source. No tile SHALL be requested.

#### Scenario: Collection HTTP 404
- **WHEN** the collection at `https://example.org/fixtures/missing.yaml` is loaded and the server answers HTTP 404
- **THEN** loading fails with a fetch error whose source is `https://example.org/fixtures/missing.yaml` and whose message includes `404`

### Requirement: Distinguish collection failures
The system SHALL report a collection that cannot be fetched, a collection file that is not valid plain YAML and a collection file with the wrong structure as three distinguishable kinds of error. Each SHALL expose the collection's source as a separate value.

#### Scenario: Caller tells the collection failures apart
- **WHEN** one collection fails with HTTP 404, a second has invalid YAML and a third has no `tiles` list
- **THEN** the errors are, in order, a fetch error, a YAML parse error and a collection format error
- **AND** each exposes its own collection source

### Requirement: Resolve tile paths against the collection
The system SHALL resolve a tile entry's `path` against the collection's source, so relative paths point inside the collection's folder whatever base URL was used to load the collection.

#### Scenario: Relative tile path
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` lists `path: "./books/kallocain.md"`
- **THEN** the tile is requested from `https://example.org/fixtures/tiles/books/kallocain.md` and that is its source

#### Scenario: Parent folder path
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` lists `path: "../other/kallocain.md"`
- **THEN** the tile is requested from `https://example.org/fixtures/other/kallocain.md`

### Requirement: Tile URLs must be absolute
The system SHALL use a tile entry's `url` as it is when it is an absolute URL. A `url` that is not an absolute URL SHALL be reported as a malformed entry and SHALL NOT be resolved against the collection's source.

#### Scenario: Absolute tile URL
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` lists `url: "https://other.example/books/kallocain.md"`
- **THEN** the tile is requested from `https://other.example/books/kallocain.md` and that is its source

#### Scenario: Relative tile URL
- **WHEN** a collection lists `url: "./books/kallocain.md"`
- **THEN** no tile is requested for that entry
- **AND** issues has one error whose message says that `url` must be an absolute URL and includes `./books/kallocain.md`

### Requirement: Report malformed tile entries as issues
The system SHALL report as an error issue, and leave out of tiles without any request, a tile entry that is not a mapping, has both `path` and `url`, has neither, has a value that is not a non-empty string, or cannot be resolved to a URL. The issue's source SHALL be the collection's source and its message SHALL give the entry's position, counting from 1.

#### Scenario: Entry with both path and url
- **WHEN** the second entry of a collection has both `path: "./a.md"` and `url: "https://example.org/a.md"`
- **THEN** that entry is not requested and no tile is added for it
- **AND** issues has one error whose source is the collection's source and whose message mentions entry 2 and says it must have exactly one of `path` or `url`
- **AND** the other entries are loaded

#### Scenario: Entry with neither path nor url
- **WHEN** a collection lists an entry `title: "A"`
- **THEN** issues has one error saying the entry must have exactly one of `path` or `url`

#### Scenario: Entry is not a mapping
- **WHEN** a collection lists the entry `"./books/kallocain.md"` as a plain string
- **THEN** issues has one error saying the entry must be a mapping

#### Scenario: Path is not a string
- **WHEN** a collection lists `path: 42`
- **THEN** issues has one error saying that `path` must be a non-empty string

### Requirement: Tiles that fail to load become issues
The system SHALL load every tile entry even when other tiles fail. A tile that cannot be fetched or whose markdown cannot be parsed SHALL be left out of tiles and reported as an error issue whose source is the tile's resolved source and whose message is the failure's message.

#### Scenario: One tile cannot be fetched
- **WHEN** the second of three tile entries answers HTTP 404 at `https://example.org/fixtures/tiles/books/missing.md`
- **THEN** tiles holds the first and third tiles in order
- **AND** issues has one error whose source is `https://example.org/fixtures/tiles/books/missing.md` and whose message includes `404`

#### Scenario: One tile has invalid frontmatter
- **WHEN** one tile entry points to a file whose frontmatter is not valid YAML
- **THEN** that tile is left out of tiles
- **AND** issues has one error whose source is that tile's source and whose message says the markdown cannot be parsed

#### Scenario: Every tile fails
- **WHEN** every tile entry of a collection answers HTTP 404
- **THEN** the collection loads with an empty tiles list and one error issue per entry

### Requirement: Keep the listed order
The system SHALL list loaded tiles in the order of their entries in the collection file, and issues in the order of the entries they concern, whatever order the files arrive in.

#### Scenario: Responses arrive out of order
- **WHEN** a collection lists tiles A, B and C and the response for A arrives last
- **THEN** tiles is A, B, C

### Requirement: Limit parallel tile requests
The system SHALL have at most 6 tile loads in progress at the same time for one collection. When one finishes, the next waiting tile SHALL start, in entry order, until every tile is loaded. The limit SHALL NOT change which tiles and issues the collection has, or their order.

#### Scenario: Collection larger than the limit
- **WHEN** a collection with 10 tile entries is loaded and no tile response has arrived yet
- **THEN** exactly 6 tiles have been requested, those of the first 6 entries
- **AND WHEN** the response for one of them arrives
- **THEN** the tile of the 7th entry is requested

#### Scenario: Every tile still loads
- **WHEN** a collection with 10 tile entries that all load is loaded
- **THEN** tiles has the 10 tiles in entry order and issues is empty

### Requirement: Load repeated tiles once
The system SHALL load a tile only once when several entries resolve to the same source. The first entry SHALL keep the tile at its position. Each later entry SHALL add a warning issue whose source is the repeated tile's source and whose message gives that entry's position.

#### Scenario: Same tile listed by path and by URL
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` lists `path: "./books/kallocain.md"` and later `url: "https://example.org/fixtures/tiles/books/kallocain.md"`
- **THEN** that tile is requested once and appears once in tiles, at the first entry's position
- **AND** issues has one warning whose source is `https://example.org/fixtures/tiles/books/kallocain.md`

### Requirement: Local files stay local
The system SHALL accept `file:` tile entries only in a collection that was itself loaded from a `file:` location. In any other collection, a tile entry that resolves to a `file:` URL SHALL be reported as an error issue with that URL as its source and SHALL NOT be read, even when picked files were given.

#### Scenario: Remote collection lists a local file
- **WHEN** the collection at `https://example.org/fixtures/tiles/books_collection.yaml` lists `url: "file:///library/books/kallocain.md"` and picked files that include that file are given
- **THEN** the picked file is not read and no tile is added for that entry
- **AND** issues has one error whose source is `file:///library/books/kallocain.md` and whose message says that a remote collection cannot list local files

#### Scenario: Collection in a picked folder
- **WHEN** the user picked a folder with `library/books_collection.yaml` (with the contents of `fixtures/tiles/books_collection.yaml`) and the three book files under `library/books/`
- **AND** `file:///library/books_collection.yaml` is loaded with those picked files
- **THEN** tiles has the three tiles, the first with source `file:///library/books/farenheit_451.md`
- **AND** no network request is made

#### Scenario: Local collection lists a remote tile
- **WHEN** a collection loaded from `file:///library/books_collection.yaml` lists `url: "https://example.org/fixtures/tiles/books/kallocain.md"`
- **THEN** that tile is requested from `https://example.org/fixtures/tiles/books/kallocain.md` and added to tiles

### Requirement: Issue shape
The system SHALL represent each issue as an object with exactly three properties: `level` (`"warning"` or `"error"`), `source` (string) and `message` (string).

#### Scenario: Issue for a failed tile
- **WHEN** a collection with one tile entry that answers HTTP 404 is loaded
- **THEN** its only issue has level `"error"`, a source and a message, and no other properties

### Requirement: Loaded collections are independent plain data
The system SHALL return a tile collection that contains no class instances or functions and does not share objects with any other loaded collection.

#### Scenario: Structured clone of a collection
- **WHEN** the sample collection is loaded and a structured clone of it is made
- **THEN** the clone deep-equals the collection

#### Scenario: Same collection loaded twice
- **WHEN** the sample collection is loaded twice and the first collection's first tile's metadata.title is changed
- **THEN** the second collection's first tile's metadata.title still has the value from the file

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
