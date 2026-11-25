## MODIFIED Requirements

### Requirement: Open a mod from a run link
The app SHALL open a mod for the address hash `#/run`, with the query parameter `mod` (a mod reference), the optional parameter `collection` (location of a collection file) and any other parameters, which the mod receives in its context. Relative references and locations SHALL be resolved against the app's address. Each run link SHALL open in a new sandbox, which becomes the visible one, and the stage bar SHALL show the mod's title and version.

#### Scenario: Link with a mod and a collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml`
- **THEN** the stage bar shows `Book List` and `1.0.0`, and the mod's frame lists the three sample books

#### Scenario: Link without a collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list`
- **THEN** the sample book list mod runs with no tiles and no collection file is requested

#### Scenario: Encoded values
- **WHEN** the app is opened with a run link whose `mod` is the percent-encoded absolute URL of the sample book list mod file
- **THEN** the sample book list mod runs

### Requirement: Show load failures
When the mod file, its entrypoint, its tile type file or the collection file cannot be loaded, the sandbox SHALL show an error naming the file that failed and the reason, and SHALL NOT start a mod frame. The sandbox SHALL keep its history entry and its close button.

#### Scenario: Missing mod file
- **WHEN** the app is opened at `#/run?mod=./samples/mods/missing`
- **THEN** the stage shows an error that names the mod file's resolved address and `404`
- **AND** no mod frame is shown

#### Scenario: Missing collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/missing.yaml`
- **THEN** the stage shows an error that names the collection's resolved address
- **AND** no mod frame is shown

