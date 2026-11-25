## ADDED Requirements

### Requirement: Sample sites
The mod SHALL ship its sample collection in its own folder, `sites/`, with 11 UNESCO World Heritage Sites in 10 countries. Each tile SHALL have a string `title`, `country` and `image`, the lead image of its English Wikipedia article on `https://upload.wikimedia.org`, and a body with that article's first paragraph, as written, then a line `Source:` with the article's address. The collection's description SHALL credit Wikipedia and its CC BY-SA 4.0 license.

#### Scenario: The sites
- **WHEN** the sample collection is loaded
- **THEN** its tiles are, in this order, "Serengeti National Park" (Tanzania), "Giza pyramid complex" (Egypt), "Petra" (Jordan), "Great Wall of China" (China), "Forbidden City" (China), "Taj Mahal" (India), "Acropolis of Athens" (Greece), "Mont-Saint-Michel" (France), "Grand Canyon" (United States), "Machu Picchu" (Peru) and "Galápagos Islands" (Ecuador)

#### Scenario: A site's tile
- **WHEN** the tile "Machu Picchu" is read
- **THEN** its metadata is `title`, `country` and `image`, with an `image` on `https://upload.wikimedia.org`, and its body ends with `Source: https://en.wikipedia.org/wiki/Machu_Picchu`

#### Scenario: Inside the mod folder
- **WHEN** the mod folder `public/samples/mods/country_map/` is copied elsewhere with nothing else
- **THEN** its default mosaic's collection and every tile it lists are in the copy

### Requirement: Mod file and default mosaic
The mod file SHALL give the mod the title "Country Map", and SHALL declare `api: "^0.1.14"`, the first mod API version with `default_mosaic`, its tile type `./country_tile_type.md`, its test file `./test.js` and `default_mosaic: "./mosaic.yaml"`, and no permission. Its default mosaic SHALL name the mod's own folder, the sample sites' `./sites/collection.yaml` as its collection, and a `show` permission only for `https://upload.wikimedia.org`, the host the sites' images load from.

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

### Requirement: Opening the card
Selecting a tile in the sidebar SHALL open a modal dialog, labeled by the tile's title, with the title as its heading, then its metadata, then its body. The rest of the mod SHALL NOT be usable while the card is open. Each tile button SHALL have `aria-haspopup="dialog"`.

#### Scenario: Open a tile
- **WHEN** Peru's sidebar is open and the user selects "Machu Picchu"
- **THEN** a modal dialog named "Machu Picchu" is open, with the heading "Machu Picchu" and the start of its body, the first words of its Wikipedia article's first paragraph

### Requirement: Metadata on the card
The card SHALL show each metadata key other than `title` and `image` as a labeled value, in the tile's order: a string, number or boolean as written, a list of those joined with `, `, and any other value as JSON. A key whose value is `null`, an empty string or an empty list SHALL be left out. A string `image` SHALL be shown as an image above the title, and left out when it fails to load.

#### Scenario: Tile metadata
- **WHEN** the user opens the card of "Machu Picchu"
- **THEN** it shows its image above the heading and "Peru" labeled "country", and no label "title" or "image"

#### Scenario: Empty values
- **WHEN** the card of a sample site is opened with the added metadata `inscribed: 1983`, `criteria: ["i", "iii"]` and `area: null`
- **THEN** it shows "1983" labeled "inscribed" and "i, iii" labeled "criteria", and no label "area"

### Requirement: Map follows tile changes
When the tiles change, the mod SHALL redraw the markers and the "Not on the map" button from the new tiles without reloading the map. A selected country that still has tiles SHALL stay selected with its new list, and one that has none SHALL be deselected. An open card SHALL stay open with the tile's new metadata and body while its tile is still among the tiles, and SHALL close otherwise.

#### Scenario: Tile added
- **WHEN** China's sidebar is open and the user presses "Reload tiles" with a collection that has one more Chinese site
- **THEN** China's marker shows "3", and the sidebar shows "3 tiles" and the new site

#### Scenario: Country emptied
- **WHEN** Peru's sidebar is open and the reloaded collection has no Peruvian site
- **THEN** no sidebar is shown and Peru has no marker

## MODIFIED Requirements

### Requirement: One marker per country
The map SHALL show one marker for each map country that has at least one tile, and none for the others. A marker's tip SHALL be on the country's largest piece of land, at its point farthest from the piece's edges in the map's projection, so it is never on the sea, on another country or in an enclave.

#### Scenario: Sample markers
- **WHEN** the mod runs with its sample collection
- **THEN** the map shows 10 markers, one for each country of the sites, and China's holds 2

#### Scenario: Tip on the country's land
- **WHEN** the mod runs with its sample collection and one more tile in Norway
- **THEN** the tip of each marker is inside its own country's shape, Norway's included

#### Scenario: Country with overseas land
- **WHEN** the mod runs with its sample collection
- **THEN** the tip of France's marker is in mainland France, between latitudes 42 and 51.5 and longitudes -5 and 8

### Requirement: Marker button
Each marker SHALL be a button that the keyboard reaches, named after its country and number of tiles, as in "China, 2 tiles" or "Peru, 1 tile". Clicking it, or pressing Enter or Space on it, SHALL select its country. The Tab order of the markers SHALL follow their countries' names. The selected country's marker SHALL have `aria-expanded="true"`, and every other marker `aria-expanded="false"`.

#### Scenario: Select with the keyboard
- **WHEN** the user moves focus to the marker "China, 2 tiles" and presses Enter
- **THEN** the sidebar shows China's tiles, and that marker has `aria-expanded="true"`

### Requirement: Sidebar
Selecting a country SHALL show a sidebar on the right of the map with the country's name as a heading, its number of tiles, a close button (accessible name "Close") and one button per tile, labeled with the tile's title, in the tiles' order. Selecting another country SHALL replace its content. Closing it SHALL hide it, deselect the country and move focus to the country's marker or the "Not on the map" button.

#### Scenario: France's tiles
- **WHEN** the user clicks France's marker
- **THEN** the sidebar shows the heading "France", "1 tile" and the title "Mont-Saint-Michel"

#### Scenario: China's tiles
- **WHEN** the user clicks China's marker
- **THEN** the sidebar shows the heading "China", "2 tiles" and the titles "Great Wall of China" and "Forbidden City", in that order

#### Scenario: Close the sidebar
- **WHEN** China's sidebar is open and the user presses "Close"
- **THEN** no sidebar is shown, China's marker has `aria-expanded="false"`, and it has focus

### Requirement: Sidebar look
The sidebar's background SHALL be the theme's `--ot-card`, apart from the frame's `--ot-background`, and the tile buttons' background SHALL differ from the sidebar's.

#### Scenario: Sidebar colors
- **WHEN** China's sidebar is open
- **THEN** the sidebar's computed background is the value of `--ot-card`, and the button "Great Wall of China" has another background

### Requirement: Card body
Below the metadata, the card SHALL show the tile's body as the engine renders it (see `tile-bodies`), so its links, media and players behave as in any rendered body.

#### Scenario: A link in the body
- **WHEN** the user opens the card of "Machu Picchu" and clicks the link to its Wikipedia page
- **THEN** the mod sends `links.open` with `https://en.wikipedia.org/wiki/Machu_Picchu` and its frame does not navigate

### Requirement: Closing the card
The card SHALL close when the user presses Escape, presses its close button (accessible name "Close"), or clicks the backdrop outside it. A click inside the card SHALL NOT close it. After it closes, focus SHALL be on the sidebar's button of the tile whose card it was.

#### Scenario: Escape
- **WHEN** the card of "Machu Picchu" is open and the user presses Escape
- **THEN** no dialog is open, the sidebar still shows Peru's tiles, and the button "Machu Picchu" has focus

#### Scenario: Backdrop
- **WHEN** the card is open and the user clicks the backdrop outside it
- **THEN** no dialog is open

### Requirement: Mod tests
The mod's test file SHALL have, among its cases, `shows a marker per country`, which mounts the mod with the sample sites and expects 10 markers with their numbers, `opens a country`, which selects China and expects its two titles, and `groups tiles not on the map`, which mounts tiles of an unknown country and expects the "Not on the map" button.

#### Scenario: Sample tests
- **WHEN** the sample country map mod is checked
- **THEN** the report's tests are the cases of the sample's test file, among them those three, each with status `"pass"`

## REMOVED Requirements

### Requirement: Mod file
**Reason**: Its scenarios were written for the Nobel laureates' books, and a modified requirement cannot rename them. Replaced by "Mod file and default mosaic", with the same behavior and scenarios that hold for any collection.
**Migration**: See "Mod file and default mosaic".

### Requirement: Tile card
**Reason**: Its scenarios were written for the Nobel laureates' books, and a modified requirement cannot rename them. Replaced by "Opening the card", with the same behavior and scenarios that hold for any collection.
**Migration**: See "Opening the card".

### Requirement: Card metadata
**Reason**: Its scenarios were written for the Nobel laureates' books, and a modified requirement cannot rename them. Replaced by "Metadata on the card", with the same behavior and scenarios that hold for any collection.
**Migration**: See "Metadata on the card".

### Requirement: Map follows the tiles
**Reason**: Its scenarios were written for the Nobel laureates' books, and a modified requirement cannot rename them. Replaced by "Map follows tile changes", with the same behavior and scenarios that hold for any collection.
**Migration**: See "Map follows tile changes".
