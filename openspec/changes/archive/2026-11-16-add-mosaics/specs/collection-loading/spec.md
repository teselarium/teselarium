# Spec Delta

## MODIFIED Requirements

### Requirement: Resolve the collection location
The system SHALL resolve the collection location in the same way as a tile location: a relative location is resolved against the given base URL, or the page's document base URL when no base is given, and an absolute URL is used as it is. When the resolved path ends in neither `.yaml` nor `.yml`, the location SHALL name a folder: a `/` SHALL be added when the path does not end with one, the folder's query and fragment SHALL be dropped, and the location SHALL mean the file `collection.yaml` in it. The resolved absolute URL of the file SHALL be the collection's `source`. Loading a collection and reading its index SHALL resolve the location the same way.

#### Scenario: Relative collection path with a base URL
- **WHEN** `./tiles/books_collection.yaml` is loaded with base URL `https://example.org/fixtures/`
- **THEN** the collection's source is `https://example.org/fixtures/tiles/books_collection.yaml`

#### Scenario: Relative collection path without any base
- **WHEN** `tiles/books_collection.yaml` is loaded with no base URL and no document base URL is available
- **THEN** loading fails with a fetch error whose message includes `tiles/books_collection.yaml` and says that a base URL is required
- **AND** no request is made

#### Scenario: Collection folder
- **WHEN** `./samples/tiles/literature_nobel_laureates` is loaded with base URL `https://example.org/`
- **THEN** the file `https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml` is requested and is the collection's source

#### Scenario: Folder with a trailing slash and a query
- **WHEN** `https://tiles.example.net/books/?v=2` is loaded
- **THEN** the file `https://tiles.example.net/books/collection.yaml` is requested

#### Scenario: Index of a folder
- **WHEN** the index of `./samples/tiles/literature_nobel_laureates` is read with base URL `https://example.org/`
- **THEN** the index's source is `https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml`
