# Spec Delta

## MODIFIED Requirements

### Requirement: Mod file
The mod file SHALL declare the title "Book List", its test file `./test.js`, `api: "^0.1.14"`, the first mod API version with `default_mosaic`, and `default_mosaic: "./mosaic.yaml"`, and SHALL declare no permissions. Its default mosaic SHALL name the mod's own folder, the sample books `./book_collection.yaml` as its collection, and `show` permissions for `https://upload.wikimedia.org`, `https://covers.openlibrary.org`, `https://archive.org` and `https://*.archive.org`, the hosts the sample books' covers load from. The sample collection file SHALL use `title`.

#### Scenario: Books with covers
- **WHEN** the sample mod is opened from its default mosaic, served from the app's origin
- **THEN** the frame shows the three books with their titles, authors and cover images

#### Scenario: Sample matches the app's API
- **WHEN** the sample book list mod is opened
- **THEN** it shows no API dialog and has no issue about its API

#### Scenario: The mod declares no permissions
- **WHEN** `mods.inspect` is sent for `./samples/mods/book_list`
- **THEN** its permissions have no granted and no denied entry, and its `defaultMosaic` ends in `samples/mods/book_list/mosaic.yaml`

### Requirement: Remembered books per row
The mod SHALL store the chosen number of books per row in its storage under the key `columns`, and SHALL use the stored value when the mod starts. A stored value that is not 4, 6, 8 or 10 SHALL be ignored. The stored value SHALL come back when the mod is opened again from the same mosaic or with the same collection, and not with another one.

#### Scenario: Choice kept across starts
- **WHEN** the user chooses 8 books per row while the mod is opened from its default mosaic, and the mod is opened again from its default mosaic
- **THEN** "Books per row" shows 8

#### Scenario: Another collection
- **WHEN** the user chooses 8 books per row while the mod is opened from its default mosaic, and the mod is then opened with another collection
- **THEN** "Books per row" shows the config's value, 6

#### Scenario: Stored value wins over the config
- **WHEN** the storage holds `columns` 10 and the config sets `columns: 4`
- **THEN** "Books per row" shows 10

#### Scenario: Unknown stored value
- **WHEN** the storage holds `columns` 7 and the config sets `columns: 6`
- **THEN** "Books per row" shows 6
