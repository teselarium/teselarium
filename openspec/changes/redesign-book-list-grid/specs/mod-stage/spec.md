# Spec Delta

## MODIFIED Requirements

### Requirement: Open a mod from a run link
The app SHALL open a mod for the address hash `#/run`, with the query parameter `mod` (a mod reference), the optional parameter `collection` (location of a collection file) and any other parameters, which the mod receives in its context. Relative references and locations SHALL be resolved against the app's address. Each run link SHALL open in a new sandbox, which becomes the visible one, and the stage bar SHALL show the mod's title and version.

#### Scenario: Link with a mod and a collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml`
- **THEN** the stage bar shows `Book List` and `1.1.0`, and the mod's frame lists the three sample books

#### Scenario: Link without a collection
- **WHEN** the app is opened at `#/run?mod=./samples/mods/book_list`
- **THEN** the sample book list mod runs with no tiles and no collection file is requested

#### Scenario: Encoded values
- **WHEN** the app is opened with a run link whose `mod` is the percent-encoded absolute URL of the sample book list mod file
- **THEN** the sample book list mod runs

### Requirement: Sample book list mod
The sample mod `book_list` SHALL show the tiles it receives with each book's title, authors and cover image, and SHALL declare the sample books as its sample collection. Opening a book's card SHALL mark that book as the last opened one and store its source in the mod's storage slot, and the mark SHALL show again when the mod is opened later. What the sample shows and how the user works with it is described in `sample-book-list`.

#### Scenario: Books with covers
- **WHEN** the sample mod runs with the sample collection from the app's origin
- **THEN** the frame shows the three books with their titles, authors and cover images

#### Scenario: Selection is remembered
- **WHEN** the user opens and closes the card of "Kallocain" in the sample mod and the app page is reloaded
- **THEN** Kallocain's button in the sample mod has `aria-current="true"`
