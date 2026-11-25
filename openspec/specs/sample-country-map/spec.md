# sample-country-map Specification

## Purpose

Describes what the shipped sample country map mod (`public/samples/mods/country_map/`) shows and how the user works with it: a world map with one marker per country that has tiles, a sidebar with a country's tiles, and a card with each tile's metadata and body. It is also the sample of a mod that uses declared libraries.

## Requirements

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

### Requirement: Declared libraries
The mod file SHALL declare `leaflet` as `leaflet@1.9.4` with `dist/leaflet.js` and `dist/leaflet.css`, `topojson_client` as `topojson-client@3.1.0` with `dist/topojson-client.min.js`, `proj4` as `proj4@2.23.0` with `dist/proj4.js`, and `world_atlas` as `world-atlas@2.0.2` with `countries-110m.json`. The mod SHALL load them with `libs.load` and SHALL ship no third-party code of its own.

#### Scenario: Libraries come from the npm host
- **WHEN** the sample country map mod is opened in the vanilla app
- **THEN** the app requests the five files from `https://cdn.jsdelivr.net/npm/`, and the mod's frame sends no request for them

### Requirement: Tile type
The tile type `country_tile` SHALL require a string `title` and a string `country`, and SHALL allow other keys.

#### Scenario: Book tile
- **WHEN** a tile has `title: "Kallocain"`, `country: "Sweden"` and other keys
- **THEN** it matches `country_tile`

#### Scenario: No country
- **WHEN** a tile has a `title` and no `country`
- **THEN** it does not match `country_tile`, and the mod does not receive it

### Requirement: Loading the map
While the libraries load, the mod SHALL show a status "Loading the map…". When a library cannot be loaded, it SHALL show a status "The map could not be loaded.", show no map, and send `ui.notify` with level `"error"` and the error's message. Its `mount` SHALL still resolve.

#### Scenario: Library that cannot be loaded
- **WHEN** the npm host answers HTTP 404 for `dist/leaflet.js` and the mod is opened
- **THEN** the frame shows "The map could not be loaded.", and the stage bar shows an error whose message names `leaflet`

### Requirement: World map
Once the libraries are loaded, the mod SHALL show a world map in the Equal Earth projection that fills the frame's width in every layout and its height, with each country of `countries-110m.json` drawn as a shape. A country that crosses the 180th meridian SHALL be drawn on both edges of the map, with no shape across the world. The map SHALL pan and zoom with the pointer and the keyboard. Its first view SHALL fit every marker, or the whole world when there is none.

#### Scenario: Map of the sample
- **WHEN** the mod runs with its sample collection
- **THEN** the frame shows a map with 177 country shapes, and every marker is inside the map's visible area

#### Scenario: Theater mode
- **WHEN** the mod runs in the contained layout and the user turns on theater mode
- **THEN** the map fills the frame's width in both layouts

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

### Requirement: Attribution
The map SHALL show an attribution that credits Leaflet and Natural Earth, each as a link. Following an attribution link SHALL send `links.open` with its address, and the mod's frame SHALL NOT navigate.

#### Scenario: Leaflet link
- **WHEN** the user clicks the Leaflet link of the attribution
- **THEN** the mod sends `links.open` with `https://leafletjs.com`, and the mod keeps running

### Requirement: Country names
A tile SHALL belong to a map country when its `country`, trimmed, equals the country's name or one of the country's aliases, ignoring case and accents. The aliases SHALL cover the common names of countries whose map name is abbreviated or formal, such as `United States` and `USA` for "United States of America", `Czech Republic` for "Czechia" and `Ivory Coast` for "Côte d'Ivoire". A country SHALL be shown with its first tile's `country`, trimmed.

#### Scenario: Alias
- **WHEN** the tiles have `country: "United States"` and `country: "usa"`
- **THEN** both belong to the same marker, shown as "United States"

#### Scenario: Accents and case
- **WHEN** a tile has `country: "cote d'ivoire"`
- **THEN** it belongs to the marker of Côte d'Ivoire

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

### Requirement: Marker shape
A marker SHALL be a speech bubble: a box with rounded corners and a pin in the middle of its bottom edge whose tip is the marker's point. It SHALL hold the country's number of tiles, centered, and its box SHALL widen with the number's digits. It SHALL be filled with `--tes-primary` and its number SHALL use `--tes-primary-foreground`.

#### Scenario: Wider for more digits
- **WHEN** one country has 7 tiles and another has 12
- **THEN** the first marker shows "7", the second shows "12", and the second's box is wider

#### Scenario: Tip on the country
- **WHEN** the user zooms the map
- **THEN** each marker's tip stays on its country's point

### Requirement: Marker button
Each marker SHALL be a button that the keyboard reaches, named after its country and number of tiles, as in "China, 2 tiles" or "Peru, 1 tile". Clicking it, or pressing Enter or Space on it, SHALL select its country. The Tab order of the markers SHALL follow their countries' names. The selected country's marker SHALL have `aria-expanded="true"`, and every other marker `aria-expanded="false"`.

#### Scenario: Select with the keyboard
- **WHEN** the user moves focus to the marker "China, 2 tiles" and presses Enter
- **THEN** the sidebar shows China's tiles, and that marker has `aria-expanded="true"`

### Requirement: Country shapes
Clicking the shape of a country that has tiles SHALL select that country, as its marker does. Clicking a country without tiles SHALL select nothing. The pointer SHALL show that only the countries with tiles can be clicked.

#### Scenario: Click a country
- **WHEN** the user clicks inside France's shape, away from its marker
- **THEN** the sidebar shows France's tiles, and France's marker has `aria-expanded="true"`

#### Scenario: Click a country without tiles
- **WHEN** the user clicks inside Spain's shape
- **THEN** no sidebar is shown

### Requirement: Raised marker
A marker SHALL be drawn above the other markers while the pointer is over it, while it has keyboard focus and while its country is selected.

#### Scenario: Overlapping markers
- **WHEN** the markers of Austria and Hungary overlap and the user moves focus to Austria's marker
- **THEN** Austria's marker is drawn above Hungary's

### Requirement: Not on the map
Tiles whose `country` matches no map country SHALL be grouped as "Not on the map". When there is at least one, the map SHALL show a button "Not on the map" with their number, as in "Not on the map, 2 tiles", which selects that group as a country is selected. When there is none, the button SHALL NOT be shown.

#### Scenario: Historical country
- **WHEN** the tiles include one with `country: "Soviet Union"` and one with `country: "Singapore"`, which the 1:110m map does not draw
- **THEN** the button "Not on the map, 2 tiles" is shown, and pressing it shows those two tiles in the sidebar under the heading "Not on the map"

#### Scenario: Every tile on the map
- **WHEN** the mod runs with its sample collection
- **THEN** no "Not on the map" button is shown

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
The sidebar's background SHALL be the theme's `--tes-card`, apart from the frame's `--tes-background`, and the tile buttons' background SHALL differ from the sidebar's.

#### Scenario: Sidebar colors
- **WHEN** China's sidebar is open
- **THEN** the sidebar's computed background is the value of `--tes-card`, and the button "Great Wall of China" has another background

### Requirement: Narrow frames
When the frame is narrower than 40rem, the sidebar SHALL be shown below the map, across the frame's width, instead of on its right, and the map SHALL stay visible.

#### Scenario: Phone width
- **WHEN** the frame is 24rem wide and the user selects France
- **THEN** the sidebar is below the map, and the map is still visible above it

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

### Requirement: Map follows tile changes
When the tiles change, the mod SHALL redraw the markers and the "Not on the map" button from the new tiles without reloading the map. A selected country that still has tiles SHALL stay selected with its new list, and one that has none SHALL be deselected. An open card SHALL stay open with the tile's new metadata and body while its tile is still among the tiles, and SHALL close otherwise.

#### Scenario: Tile added
- **WHEN** China's sidebar is open and the user presses "Reload tiles" with a collection that has one more Chinese site
- **THEN** China's marker shows "3", and the sidebar shows "3 tiles" and the new site

#### Scenario: Country emptied
- **WHEN** Peru's sidebar is open and the reloaded collection has no Peruvian site
- **THEN** no sidebar is shown and Peru has no marker

### Requirement: No tiles
When the mod receives no tiles, it SHALL show the world map with no markers, no "Not on the map" button, and a status "There are no tiles to show."

#### Scenario: Empty collection
- **WHEN** the mod is opened without a collection
- **THEN** the frame shows the world map, no marker and the status "There are no tiles to show."

### Requirement: Theme look
The mod SHALL take its colors and fonts from the theme. Its own styles SHALL set colors only from the theme's tokens or `color-mix()` of them, and SHALL otherwise cover only what the base stylesheet does not: the map's layout, the sidebar, the markers and the shapes.

#### Scenario: Mod's own styles
- **WHEN** the sample country map mod runs with its sample collection
- **THEN** the rules of its own styles set every color, background, fill and stroke from `--tes-*` variables

### Requirement: Mod tests
The mod's test file SHALL have, among its cases, `shows a marker per country`, which mounts the mod with the sample sites and expects 10 markers with their numbers, `opens a country`, which selects China and expects its two titles, and `groups tiles not on the map`, which mounts tiles of an unknown country and expects the "Not on the map" button.

#### Scenario: Sample tests
- **WHEN** the sample country map mod is checked
- **THEN** the report's tests are the cases of the sample's test file, among them those three, each with status `"pass"`
