## MODIFIED Requirements

### Requirement: Mod file and default mosaic
The mod file SHALL give the mod the title "Country Map", and SHALL declare `api: "^0.2.0"`, its tile type `./country_tile_type.md`, its test file `./test.js` and `default_mosaic: "./mosaic.yaml"`, and no permission. Its default mosaic SHALL name the mod's own folder, the sample sites' `./sites/collection.yaml` as its collection, and a `show` permission only for `https://upload.wikimedia.org`, the host the sites' images load from.

#### Scenario: Sample matches the app's API
- **WHEN** the sample country map mod is opened from its default mosaic
- **THEN** it shows no API dialog, no site consent dialog and no issue about its API or its permissions

#### Scenario: Sample collection
- **WHEN** the sample country map mod is opened from its default mosaic
- **THEN** it receives the 11 sample sites, each matching its tile type

#### Scenario: Linked image
- **WHEN** the mod was opened from its default mosaic and the user opens the card of "Machu Picchu"
- **THEN** the card shows its image from `https://upload.wikimedia.org`, and no warning about a blocked request is reported

#### Scenario: Without the default mosaic
- **WHEN** the mod is opened from a run link with the same sites as `collection`, with "Load media linked by tiles" off, and the user opens the card of "Machu Picchu"
- **THEN** the image is blocked and a warning names `https://upload.wikimedia.org`

### Requirement: Map look
The sea SHALL be a gray, a tint of the theme's `--tes-muted-foreground` over `--tes-card`, distinct from every country. The countries without tiles SHALL be filled with `--tes-muted`, the countries with tiles with a tint of `--tes-primary` over `--tes-card`, and the selected country with `--tes-accent`, each outlined with `--tes-border`. The map SHALL follow a change of color scheme without reloading the frame. The map SHALL send no request other than the libraries' files.

#### Scenario: Countries with tiles stand out
- **WHEN** the mod runs with its sample collection
- **THEN** the computed fill of France's shape differs from the fill of Spain's, which has no tiles, and both differ from the sea's color

#### Scenario: Dark map
- **WHEN** the mod runs and the user switches the color scheme to dark
- **THEN** the computed fill of a country without tiles is the dark value of `--tes-muted`, and the frame was not reloaded

#### Scenario: No map tiles
- **WHEN** the mod runs with its sample collection and the user pans and zooms the map
- **THEN** no request is made for map images

### Requirement: Marker shape
A marker SHALL be a speech bubble: a box with rounded corners and a pin in the middle of its bottom edge whose tip is the marker's point. It SHALL hold the country's number of tiles, centered, and its box SHALL widen with the number's digits. It SHALL be filled with `--tes-primary` and its number SHALL use `--tes-primary-foreground`.

#### Scenario: Wider for more digits
- **WHEN** one country has 7 tiles and another has 12
- **THEN** the first marker shows "7", the second shows "12", and the second's box is wider

#### Scenario: Tip on the country
- **WHEN** the user zooms the map
- **THEN** each marker's tip stays on its country's point

### Requirement: Sidebar look
The sidebar's background SHALL be the theme's `--tes-card`, apart from the frame's `--tes-background`, and the tile buttons' background SHALL differ from the sidebar's.

#### Scenario: Sidebar colors
- **WHEN** China's sidebar is open
- **THEN** the sidebar's computed background is the value of `--tes-card`, and the button "Great Wall of China" has another background

### Requirement: Theme look
The mod SHALL take its colors and fonts from the theme. Its own styles SHALL set colors only from the theme's tokens or `color-mix()` of them, and SHALL otherwise cover only what the base stylesheet does not: the map's layout, the sidebar, the markers and the shapes.

#### Scenario: Mod's own styles
- **WHEN** the sample country map mod runs with its sample collection
- **THEN** the rules of its own styles set every color, background, fill and stroke from `--tes-*` variables
