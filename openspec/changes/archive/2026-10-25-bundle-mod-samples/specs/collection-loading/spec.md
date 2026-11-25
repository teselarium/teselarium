## MODIFIED Requirements

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

### Requirement: Report collection files that cannot be fetched
The system SHALL fail with a fetch error when the collection file cannot be fetched or read, with the same rules as for a tile: request rejected, unsuccessful HTTP status, or a `file:` location that is not among the picked files. The error SHALL carry the collection's source. No tile SHALL be requested.

#### Scenario: Collection HTTP 404
- **WHEN** the collection at `https://example.org/fixtures/missing.yaml` is loaded and the server answers HTTP 404
- **THEN** loading fails with a fetch error whose source is `https://example.org/fixtures/missing.yaml` and whose message includes `404`

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

