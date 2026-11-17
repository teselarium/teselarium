# Spec Delta

## Purpose

Describes the sample mosaics the app ships in `public/samples/mosaics/`: what each pairs, and what it shows that a run link cannot, a config override in one and aliases in the other.

## ADDED Requirements

### Requirement: Books by Nobel laureates
The app SHALL ship `public/samples/mosaics/nobel_books_list.yaml`, titled "Books by Nobel laureates", which names the mod `../mods/book_list` and the collection `../tiles/literature_nobel_laureates_books`. Its config SHALL set `columns: 8`. It SHALL declare `show` for `https://upload.wikimedia.org`, `https://covers.openlibrary.org`, `https://archive.org` and `https://*.archive.org`, the hosts the books' covers load from.

#### Scenario: Open the books
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_books_list.yaml`
- **THEN** the book list shows the 51 books, "Books per row" shows 8, and no API dialog, site consent dialog or warning about a blocked request is shown

#### Scenario: Open Library cover
- **WHEN** the user opens the card of "The Years", whose cover at `https://covers.openlibrary.org` redirects to a subdomain of `archive.org`
- **THEN** the card shows the cover

### Requirement: Nobel laureates on the map
The app SHALL ship `public/samples/mosaics/nobel_laureates_map.yaml`, titled "Nobel laureates on the map", which names the mod `../mods/country_map` and the collection `../tiles/literature_nobel_laureates`. It SHALL rename `name` to `title` and `birth_country` to `country` with its aliases, and SHALL declare `show` for `https://upload.wikimedia.org`, the host of the laureates' portraits.

#### Scenario: Every laureate reaches the map
- **WHEN** the app is opened at `#/run?mosaic=./samples/mosaics/nobel_laureates_map.yaml`
- **THEN** the country map receives the 17 laureates, each matching its tile type, with no warning about a tile of another type

#### Scenario: A laureate's card
- **WHEN** the user selects the United States and opens the card of Bob Dylan
- **THEN** the card's heading is `Bob Dylan` with his portrait, and it shows no `name` or `birth_country` label

### Requirement: The sample mosaics pass their checks
Each sample mosaic SHALL pass `mosaics.check`: a report with status `"pass"` and no findings.

#### Scenario: Check the laureates' map
- **WHEN** the visible mosaic viewer checks `nobel_laureates_map.yaml`
- **THEN** the report has status `"pass"` and no findings
