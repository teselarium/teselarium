## ADDED Requirements

### Requirement: Mod file
The mod file SHALL declare the sample books as the mod's sample collection, its test file `./test.js`, and `api: "^0.1.5"`, the first mod API version with the `<ot-tile-body>` element.

#### Scenario: Books with covers
- **WHEN** the sample mod runs with the sample collection from the app's origin
- **THEN** the frame shows the three books with their titles, authors and cover images

#### Scenario: Sample matches the app's API
- **WHEN** the sample book list mod is opened
- **THEN** it shows no API dialog and has no issue about its API

### Requirement: Mod tests
The mod's test file SHALL have, among its cases, `lists the sample books`, which mounts the mod and expects the three sample books, and `remembers the books per row`, which seeds `columns` and expects that choice in the "Books per row" select.

#### Scenario: Sample tests
- **WHEN** the sample book list mod is checked
- **THEN** the report's tests are the cases of the sample's test file, among them `lists the sample books` and `remembers the books per row`, each with status `"pass"`

### Requirement: Theme look
The mod SHALL take its colors and fonts from the theme, and SHALL only add styles for what the base stylesheet does not cover: layout, the corner shape of its books, taken from `--ot-radius`, and their shadow, taken from `--ot-shadow`.

#### Scenario: Dark sample mod
- **WHEN** the color scheme is `dark` and the sample book list mod runs with the sample collection
- **THEN** the computed background color of its frame's `<body>` is the dark value of `--ot-background`

#### Scenario: Sample mod's own styles
- **WHEN** the sample book list mod runs with the sample collection
- **THEN** the rules of its own styles set no background, color or font property, no shadow other than `var(--ot-shadow)`, and no border property other than corner radii
