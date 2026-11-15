# Spec Delta

## MODIFIED Requirements

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
