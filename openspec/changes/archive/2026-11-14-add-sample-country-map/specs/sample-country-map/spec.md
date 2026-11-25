# Spec Delta

## Purpose

Describes what the shipped sample country map mod (`public/samples/mods/country_map/`) shows and how the user works with it: a world map with one marker per country that has tiles, a sidebar with a country's tiles, and a card with each tile's metadata and body. It is also the sample of a mod that uses declared libraries.

## ADDED Requirements

### Requirement: Mod file
The mod file SHALL name the mod `country_map` with the title "Country Map", and SHALL declare `api: "^0.1.10"`, its tile type `./country_tile_type.md`, its test file `./test.js`, the books of `public/samples/tiles/literature_nobel_laureates_books/` as its sample collection, and `show` permissions for `https://covers.openlibrary.org`, `https://archive.org`, `https://*.archive.org` and `https://upload.wikimedia.org`, the hosts the sample books' covers load from, and no other permission.

#### Scenario: Sample matches the app's API
- **WHEN** the sample country map mod is opened
- **THEN** it shows no API dialog, no site consent dialog and no issue about its API or its permissions

#### Scenario: Sample collection
- **WHEN** the sample country map mod runs with its sample collection
- **THEN** it receives the 51 books of that collection, each matching its tile type

#### Scenario: Open Library cover
- **WHEN** the user opens the card of "The Years", whose cover at `https://covers.openlibrary.org` redirects to `https://archive.org` and then to a subdomain of `archive.org`
- **THEN** the card shows the cover, and no warning about a blocked request is reported

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
The sea SHALL be a gray, a tint of the theme's `--ot-muted-foreground` over `--ot-card`, distinct from every country. The countries without tiles SHALL be filled with `--ot-muted`, the countries with tiles with a tint of `--ot-primary` over `--ot-card`, and the selected country with `--ot-accent`, each outlined with `--ot-border`. The map SHALL follow a change of color scheme without reloading the frame. The map SHALL send no request other than the libraries' files.

#### Scenario: Countries with tiles stand out
- **WHEN** the mod runs with its sample collection
- **THEN** the computed fill of France's shape differs from the fill of Spain's, which has no tiles, and both differ from the sea's color

#### Scenario: Dark map
- **WHEN** the mod runs and the user switches the color scheme to dark
- **THEN** the computed fill of a country without tiles is the dark value of `--ot-muted`, and the frame was not reloaded

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
- **THEN** the map shows 14 markers, one for each country of the books

#### Scenario: Tip on the country's land
- **WHEN** the mod runs with its sample collection
- **THEN** the tip of each marker is inside its own country's shape, Norway's included

#### Scenario: Country with overseas land
- **WHEN** the mod runs with its sample collection
- **THEN** the tip of France's marker is in mainland France, between latitudes 42 and 51.5 and longitudes -5 and 8

### Requirement: Marker shape
A marker SHALL be a speech bubble: a box with rounded corners and a pin in the middle of its bottom edge whose tip is the marker's point. It SHALL hold the country's number of tiles, centered, and its box SHALL widen with the number's digits. It SHALL be filled with `--ot-primary` and its number SHALL use `--ot-primary-foreground`.

#### Scenario: Wider for more digits
- **WHEN** one country has 7 tiles and another has 12
- **THEN** the first marker shows "7", the second shows "12", and the second's box is wider

#### Scenario: Tip on the country
- **WHEN** the user zooms the map
- **THEN** each marker's tip stays on its country's point

### Requirement: Marker button
Each marker SHALL be a button that the keyboard reaches, named after its country and number of tiles, as in "France, 6 tiles" or "Germany, 1 tile". Clicking it, or pressing Enter or Space on it, SHALL select its country. The Tab order of the markers SHALL follow their countries' names. The selected country's marker SHALL have `aria-expanded="true"`, and every other marker `aria-expanded="false"`.

#### Scenario: Select with the keyboard
- **WHEN** the user moves focus to the marker "France, 6 tiles" and presses Enter
- **THEN** the sidebar shows France's tiles, and that marker has `aria-expanded="true"`

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
- **THEN** the sidebar shows the heading "France", "6 tiles" and the titles of France's six books, among them "The Years"

#### Scenario: Close the sidebar
- **WHEN** France's sidebar is open and the user presses "Close"
- **THEN** no sidebar is shown, France's marker has `aria-expanded="false"`, and it has focus

### Requirement: Sidebar look
The sidebar's background SHALL be the theme's `--ot-card`, apart from the frame's `--ot-background`, and the tile buttons' background SHALL differ from the sidebar's.

#### Scenario: Sidebar colors
- **WHEN** France's sidebar is open
- **THEN** the sidebar's computed background is the value of `--ot-card`, and the button "The Years" has another background

### Requirement: Narrow frames
When the frame is narrower than 40rem, the sidebar SHALL be shown below the map, across the frame's width, instead of on its right, and the map SHALL stay visible.

#### Scenario: Phone width
- **WHEN** the frame is 24rem wide and the user selects France
- **THEN** the sidebar is below the map, and the map is still visible above it

### Requirement: Tile card
Selecting a tile in the sidebar SHALL open a modal dialog, labeled by the tile's title, with the title as its heading, then its metadata, then its body. The rest of the mod SHALL NOT be usable while the card is open. Each tile button SHALL have `aria-haspopup="dialog"`.

#### Scenario: Open a book
- **WHEN** France's sidebar is open and the user selects "The Years"
- **THEN** a modal dialog named "The Years" is open, with the heading "The Years" and the start of its body, "The Years (French: Les Années)"

### Requirement: Card metadata
The card SHALL show each metadata key other than `title` and `image` as a labeled value, in the tile's order: a string, number or boolean as written, a list of those joined with `, `, and any other value as JSON. A key whose value is `null`, an empty string or an empty list SHALL be left out. A string `image` SHALL be shown as an image above the title, and left out when it fails to load.

#### Scenario: Book metadata
- **WHEN** the user opens the card of "The Years"
- **THEN** it shows "Annie Ernaux" labeled "authors", "France" labeled "country" and "Memoir, Autobiography" labeled "genres", and no label "pages", whose value is `null`

### Requirement: Card body
Below the metadata, the card SHALL show the tile's body as the engine renders it (see `tile-bodies`), so its links, media and players behave as in any rendered body.

#### Scenario: A link in the body
- **WHEN** the user opens the card of "The Years" and clicks the link to its Wikipedia page
- **THEN** the mod sends `links.open` with that address and its frame does not navigate

### Requirement: Closing the card
The card SHALL close when the user presses Escape, presses its close button (accessible name "Close"), or clicks the backdrop outside it. A click inside the card SHALL NOT close it. After it closes, focus SHALL be on the sidebar's button of the tile whose card it was.

#### Scenario: Escape
- **WHEN** the card of "The Years" is open and the user presses Escape
- **THEN** no dialog is open, the sidebar still shows France's tiles, and the button "The Years" has focus

#### Scenario: Backdrop
- **WHEN** the card is open and the user clicks the backdrop outside it
- **THEN** no dialog is open

### Requirement: Map follows the tiles
When the tiles change, the mod SHALL redraw the markers and the "Not on the map" button from the new tiles without reloading the map. A selected country that still has tiles SHALL stay selected with its new list, and one that has none SHALL be deselected. An open card SHALL stay open with the tile's new metadata and body while its tile is still among the tiles, and SHALL close otherwise.

#### Scenario: Book added
- **WHEN** France's sidebar is open and the user presses "Reload tiles" with a collection that has one more French book
- **THEN** France's marker shows "7", and the sidebar shows "7 tiles" and the new book

#### Scenario: Country emptied
- **WHEN** Germany's sidebar is open and the reloaded collection has no German book
- **THEN** no sidebar is shown and Germany has no marker

### Requirement: No tiles
When the mod receives no tiles, it SHALL show the world map with no markers, no "Not on the map" button, and a status "There are no tiles to show."

#### Scenario: Empty collection
- **WHEN** the mod is opened without a collection
- **THEN** the frame shows the world map, no marker and the status "There are no tiles to show."

### Requirement: Theme look
The mod SHALL take its colors and fonts from the theme. Its own styles SHALL set colors only from the theme's tokens or `color-mix()` of them, and SHALL otherwise cover only what the base stylesheet does not: the map's layout, the sidebar, the markers and the shapes.

#### Scenario: Mod's own styles
- **WHEN** the sample country map mod runs with its sample collection
- **THEN** the rules of its own styles set every color, background, fill and stroke from `--ot-*` variables

### Requirement: Mod tests
The mod's test file SHALL have, among its cases, `shows a marker per country`, which mounts the mod with the sample books and expects 14 markers with their numbers, `opens a country`, which selects France and expects its six titles, and `groups tiles not on the map`, which mounts tiles of an unknown country and expects the "Not on the map" button.

#### Scenario: Sample tests
- **WHEN** the sample country map mod is checked
- **THEN** the report's tests are the cases of the sample's test file, among them those three, each with status `"pass"`
