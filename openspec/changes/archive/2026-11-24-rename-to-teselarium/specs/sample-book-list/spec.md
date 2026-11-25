## MODIFIED Requirements

### Requirement: Book shape
Each book's cover area SHALL have square left corners and right corners rounded with the theme's radius (`--tes-radius`).

#### Scenario: Corners of a book
- **WHEN** the mod runs with the sample collection
- **THEN** the top-left and bottom-left corner radii of each book's button are `0px`
- **AND** its top-right and bottom-right corner radii are the value of `--tes-radius`

### Requirement: Raised book
A book SHALL be raised, moved up a little and given the theme's shadow (`--tes-shadow`), while the pointer is over it, while it has keyboard focus, and while its card is open. When the user prefers reduced motion, a raised book SHALL get the shadow without moving.

#### Scenario: Raised on hover
- **WHEN** the pointer is over Kallocain's book
- **THEN** Kallocain's button has the computed `box-shadow` of `--tes-shadow` and its computed transform moves it up
- **AND** the other books' buttons have no `box-shadow`

#### Scenario: Raised while the card is open
- **WHEN** Kallocain's card is open
- **THEN** Kallocain's button has the computed `box-shadow` of `--tes-shadow` and its computed transform moves it up

#### Scenario: Back after closing
- **WHEN** the user opens and closes Kallocain's card, moves the pointer off the books and clicks the heading
- **THEN** Kallocain's button has no `box-shadow` and its computed transform is `none`

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion and the pointer is over Kallocain's book
- **THEN** Kallocain's button has the computed `box-shadow` of `--tes-shadow` and its computed transform is `none`

### Requirement: Mod file
The mod file SHALL declare the title "Book List", its test file `./test.js`, `api: "^0.2.0"`, and `default_mosaic: "./mosaic.yaml"`, and SHALL declare no permissions. Its default mosaic SHALL name the mod's own folder, the sample books `./book_collection.yaml` as its collection, and `show` permissions for `https://upload.wikimedia.org`, `https://covers.openlibrary.org`, `https://archive.org` and `https://*.archive.org`, the hosts the sample books' covers load from. The sample collection file SHALL use `title`.

#### Scenario: Books with covers
- **WHEN** the sample mod is opened from its default mosaic, served from the app's origin
- **THEN** the frame shows the three books with their titles, authors and cover images

#### Scenario: Sample matches the app's API
- **WHEN** the sample book list mod is opened
- **THEN** it shows no API dialog and has no issue about its API

#### Scenario: The mod declares no permissions
- **WHEN** `mods.inspect` is sent for `./samples/mods/book_list`
- **THEN** its permissions have no granted and no denied entry, and its `defaultMosaic` ends in `samples/mods/book_list/mosaic.yaml`

### Requirement: Theme look
The mod SHALL take its colors and fonts from the theme, and SHALL only add styles for what the base stylesheet does not cover: layout, the corner shape of its books, taken from `--tes-radius`, and their shadow, taken from `--tes-shadow`.

#### Scenario: Dark sample mod
- **WHEN** the color scheme is `dark` and the sample book list mod runs with the sample collection
- **THEN** the computed background color of its frame's `<body>` is the dark value of `--tes-background`

#### Scenario: Sample mod's own styles
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the rules of its own styles set no background, color or font property, no shadow other than `var(--tes-shadow)`, and no border property other than corner radii
