# Spec Delta

## MODIFIED Requirements

### Requirement: Mod file
The mod file SHALL give the mod the title "Country Map", and SHALL declare `api: "^0.1.14"`, the first mod API version with `default_mosaic`, its tile type `./country_tile_type.md`, its test file `./test.js` and `default_mosaic: "./mosaic.yaml"`, and no permission. Its default mosaic SHALL name the mod's own folder, the books of `public/samples/tiles/literature_nobel_laureates_books/` as its collection, and `show` permissions for `https://covers.openlibrary.org`, `https://archive.org`, `https://*.archive.org` and `https://upload.wikimedia.org`, the hosts the books' covers load from.

#### Scenario: Sample matches the app's API
- **WHEN** the sample country map mod is opened from its default mosaic
- **THEN** it shows no API dialog, no site consent dialog and no issue about its API or its permissions

#### Scenario: Sample collection
- **WHEN** the sample country map mod is opened from its default mosaic
- **THEN** it receives the 51 books of that collection, each matching its tile type

#### Scenario: Open Library cover
- **WHEN** the mod was opened from its default mosaic and the user opens the card of "The Years", whose cover at `https://covers.openlibrary.org` redirects to `https://archive.org` and then to a subdomain of `archive.org`
- **THEN** the card shows the cover, and no warning about a blocked request is reported

#### Scenario: Without the default mosaic
- **WHEN** the mod is opened from a run link with the same books as `collection`, with "Load media linked by tiles" on, and the user opens the card of "The Years"
- **THEN** the cover is blocked and a warning names the blocked host
