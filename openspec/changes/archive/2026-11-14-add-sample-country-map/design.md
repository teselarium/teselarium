# Design

## Context

See proposal.md for the motivation. What the design builds on:

- **The other samples** (`public/samples/mods/book_list/`, `flashcards/`) are plain JavaScript, served as they are. They follow the project's conventions: named functions, no nested functions, explicit loops. The book list's card is the model for this mod's card: a native `<dialog>` with `showModal()`, closed by Escape, the Close button and the backdrop, with focus returned to the opener.
- **`add-mod-declared-libraries`** (applied first) gives `libraries` in the mod file and `libs.load { name }`. `.js` files are installed as classic scripts and `.css` files as `<style>` elements before the mod's own styles. Data files come back as text in `files`.
- **Spike results** (jsDelivr, in that change's design):
  - `leaflet@1.9.4/dist/leaflet.js` is a 148 KB UMD build that sets `globalThis.L`, and `dist/leaflet.css` is 15 KB;
  - `topojson-client@3.1.0/dist/topojson-client.min.js` is 7 KB and sets `globalThis.topojson`;
  - `world-atlas@2.0.2/countries-110m.json` is a 108 KB TopoJSON with 177 countries. Each has only a `name` (Natural Earth's short name) and a numeric `id`. France is a MultiPolygon with French Guiana. Small states such as Singapore are not drawn.
- **Projection spike** (after the first implementation): `proj4@2.23.0/dist/proj4.js` is a 136 KB UMD build that sets `globalThis.proj4`, with Equal Earth (`+proj=eqearth`) built in. The world spans ±17,244 km by ±8,393 km, and Equal Earth's poles are flat lines that reach only ±10,216 km. Leaflet's `maxBounds` is a pair of latitude and longitude corners, projected corner by corner, so with a projection CRS such as proj4leaflet's it would cut off about 40% of the equator's width. `polylabel` has no browser build (CommonJS in 1.x, an ES module in 2.x), so the frame cannot install it.
- **Covers**: the sample books' Open Library covers redirect from `https://covers.openlibrary.org` to `https://archive.org`, then to a subdomain such as `https://ia800100.us.archive.org`. A tile's link allows only its own address, so the redirected image is blocked and reported as a missing `show` permission. The book list declares these hosts for the same reason.
- **Short or formal map names**: `Bosnia and Herz.`, `Central African Rep.`, `Dem. Rep. Congo`, `Dominican Rep.`, `Eq. Guinea`, `Falkland Is.`, `Fr. S. Antarctic Lands`, `N. Cyprus`, `S. Sudan`, `Solomon Is.` and `W. Sahara`, plus `United States of America`, `Czechia`, `eSwatini`, `Côte d'Ivoire`, `Macedonia` and `Timor-Leste`.
- **Leaflet's stylesheet** refers to images with relative `url()`s, which do not resolve in a declared stylesheet (out of scope in `add-mod-declared-libraries`). They belong only to the layers control and the default marker icon, which this mod doesn't use, so they lose nothing and cause no request.
- **Sandbox**: a frame that navigates is stopped. Leaflet's attribution control renders ordinary `<a href>` links.

## Goals / Non-Goals

**Goals:**

- A readable sample: the library code comes from `libs.load`, and `main.js` holds only the mod's own logic, in the conventions of the other samples.
- Everything the map draws comes from the declared libraries and the tiles, with no tile server and no request from the frame.

**Non-Goals:**

- Clustering, heat maps or zoom-dependent markers.
- A general country database: only the aliases needed for common names.
- Reusing code with the book list. Each sample stays standalone, so the card logic is written again, kept short.

## Decisions

### 1. Leaflet on a flat CRS, with the countries projected in Equal Earth by proj4

The map is drawn in the Equal Earth projection, which is equal-area: countries far from the equator keep their true size, which suits a map of counts per country. proj4 projects each longitude and latitude to Equal Earth meters, and the mod scales them so the world is 512 map units wide. Leaflet draws these units on `L.CRS.Simple`, with no tile layer: `L.geoJSON` gets the countries from `topojson.feature(topology, topology.objects.countries)` and a `coordsToLatLng` that projects each position. Markers are placed in the same units.

`L.map` gets `attributionControl` and `zoomControl` on, `maxBounds` the projected world box with `maxBoundsViscosity: 1`, and zoom from -1 to 5 in half steps, where zoom 0 shows the world 512 pixels wide and zoom -1 fits it in a narrow frame. The first view, shown at once, is `fitBounds` of the marker points with padding, or the world box without markers.

Each country path gets a class: `country`, `country has-tiles` for a country with tiles, and `selected` for the selected one. The mod's CSS colors these classes (see decision 11), so a color scheme change applies with no redraw.

- *Alternative: Leaflet's default Web Mercator.* Rejected after the first implementation: it inflates the countries far from the equator, so Canada, Russia or Greenland look far larger than they are.
- *Alternative: proj4leaflet's projection CRS.* Rejected: Leaflet's `maxBounds` and `fitBounds` take latitude and longitude corners, and Equal Earth's world box has no such corners (see Context). On `L.CRS.Simple`, bounds, zoom and the first view work in plain map units. proj4 alone is enough.
- *Alternative: the Equal Earth formulas in `main.js`.* Rejected: the sample shows a library doing what a mod should not write itself.
- *Alternative: raster tiles from OpenStreetMap.* Rejected in the exploration: it needs a `show` permission, sends third-party requests from every user, falls under a tile usage policy, and doesn't follow the theme.
- *Alternative: d3-geo with SVG.* Rejected: pan, zoom and keyboard handling would have to be assembled by hand, which this sample exists to avoid.

### 2. Marker point: the pole of inaccessibility of the largest piece of land

For a country's MultiPolygon, the mod takes the polygon with the largest area, by the shoelace formula on its projected outer ring: Equal Earth is equal-area, so that compares true areas. The marker point is that polygon's pole of inaccessibility: the point inside it farthest from its edges, holes included. It is always on the country's own land, never on the sea, on another country or in an enclave such as Lesotho in South Africa, and it sits where the land is widest. It is computed in map units, so it is central as the map shows it.

The mod finds it with the polylabel algorithm: it covers the polygon's bounds with square cells, keeps the cell whose center is farthest inside, and splits the cells that could still hold a better point, until no cell can improve the best one by more than a precision of 0.05 map units (about 7 km). The distance from a point to the polygon is negative outside it, by ray casting on every ring. polylabel has no browser build (see Context), so the mod has its own short version, with the cells in a list sorted by their potential instead of a priority queue. It runs once per country with tiles, when the country first gets a marker.

- *Alternative: the center of the largest piece's bounds.* Rejected after the first implementation: it falls outside a crescent, such as Norway's mainland, whose center is in Sweden.
- *Alternative: the centroid (center of mass).* Rejected: it is also outside a crescent (Norway's falls on the Swedish border) or a ring-shaped country.
- *Alternative: the centroid of the whole country.* Rejected: overseas land pulls it into the sea, for France for example.
- *Alternative: a hand-made table of points.* Rejected: 177 entries to maintain.

### 2b. Countries across the 180th meridian

A few rings of `countries-110m.json` cross the 180th meridian within one ring: Russia's (Chukotka), Wrangel Island's and Fiji's. Drawn as they are, they would cross the whole map. Before projecting, the mod unwraps each ring, so that no longitude jumps by more than 180 degrees from the previous one, then splits a ring that reaches past 180 degrees in two: the part west of 180, and the part east of it moved back by 360 degrees, each clipped by the meridian (Sutherland–Hodgman on one half-plane). A part with no area is dropped. Chukotka is then drawn on the map's western edge, as in any world map.

### 3. Country matching

The mod builds a lookup from a normalized name to a map country. To normalize a name, it trims it, lower-cases it, strips accents (`normalize("NFD")` and dropping combining marks) and collapses spaces. Each country is entered under its map name and under its aliases, from a small table in `main.js`. The table covers the map names listed in Context with their common forms, for example:

- `united states`, `usa` and `united states of america`;
- `democratic republic of the congo` and `dr congo`;
- `czech republic`, `ivory coast`, `north macedonia`, `east timor` and `eswatini`/`swaziland`;
- the long forms of the abbreviated names.

A tile whose name finds no entry goes to "Not on the map". The shown name is the first tile's trimmed `country`, so the sample shows "United States", not "United States of America".

### 4. Markers as `L.divIcon` with an inline SVG

The marker's HTML is one SVG `<path>`: a rounded box with a centered pin. Its width is computed from the number's digits, `20 + 8 × digits` px (28 px for one digit, 36 px for two, so more digits make a wider box), with a 22 px box and an 8 px pin, plus the count in a `<text>`. `iconSize` and `iconAnchor` put the anchor at the pin's tip (`[width / 2, 30]`).

Leaflet makes an interactive marker's icon a focusable element with `role="button"`. After `addTo`, the mod sets its `aria-label` ("France, 6 tiles") and `aria-expanded`. A `keydown` listener handles Enter and Space: Leaflet's icon is a `<div>`, and Leaflet turns Enter into an action only for a marker with a popup.

Markers are added in the order of their countries' names, which gives the Tab order. Raising uses `setZIndexOffset` on `mouseover`, `focus` and selection, and resets it on `mouseout` and `blur` unless the country is selected.

- *Alternative: Leaflet's default image markers.* Rejected: they need their image files and can't hold a number.

### 4b. Clicking a country

The country layer is interactive. A `click` on a country with tiles selects it, as its marker does; a click on a country without tiles does nothing. CSS shows the pointer cursor only on `path.country.has-tiles`, and Leaflet's grab cursor elsewhere. The keyboard keeps the markers as its way to a country.

### 5. Layout

`body` gets `max-width: none` and `margin: 0`, and fills the frame's height, as the mod guide says for maps. A CSS grid holds the map and the sidebar:
- side by side, `minmax(0, 1fr) 20rem`, when the sidebar is open;
- one column below a `40rem` container query, with the map at `60vh` above the sidebar.

The "Not on the map" button and the empty status are Leaflet controls in the top-right and bottom-left corners, so they stay inside the map as it pans. A `ResizeObserver` on the map container calls `map.invalidateSize()`. That covers opening and closing the sidebar, layout modes, and hidden check frames that get their size late.

### 6. Attribution links

The attribution prefix is set to a Leaflet link (`https://leafletjs.com`) and the GeoJSON layer's attribution to a Natural Earth link (`https://www.naturalearthdata.com`). A `click` listener on the map container catches every `a[href]` inside the attribution control, prevents the navigation and sends `links.open`. Without it, a click would navigate the frame and the sandbox would stop the mod.

### 7. Sidebar, card and focus

The sidebar is an `<aside>` with a heading (focused when it opens, through `tabindex="-1"`), the count ("1 tile" / "N tiles"), a Close button with the Lucide `x` icon, and a `<ul>` of tile buttons with `aria-haspopup="dialog"`.

The card follows the book list:
- the native `<dialog>` is opened with `showModal()`, `aria-labelledby` its heading;
- the metadata is a `<dl>`, with values formatted as the spec says;
- the body is an `<ot-tile-body>`;
- an image is shown when `image` is a string, and removed on `error`;
- Escape, Close and the backdrop close it, and focus goes back to the tile's button.

The state is one plain `view` object: the map, layers, the selected group key (a country's map name or `"unplaced"`: three countries of `countries-110m.json` have no `id`) and the open tile source. It is redrawn by functions that take the view, as in the other samples.

### 8. Following the tiles

On `tiles.changed`, the mod:
1. recomputes the groups;
2. removes and re-adds the markers (the map and its country layer stay);
3. updates the "Not on the map" control;
4. keeps or deselects the selected group;
5. refreshes or closes the card, by tile source.

### 9. Loading and failure

`mount` shows "Loading the map…", then loads `leaflet`, `topojson_client`, `proj4` and `world_atlas`, in that order, because the map needs `L` before the data. It parses `files["countries-110m.json"]` with `JSON.parse`. On any failure it replaces the status with "The map could not be loaded.", sends `ui.notify` at level `"error"` with the error's message, and resolves. The mod check then reports the error as a `mount` finding, and the mod doesn't fail with an unhandled rejection.

### 10. Tests and fixture copies

`test.js` holds the cases of the "Mod tests" requirement, plus cases for the alias, the shown name, card metadata formatting and the empty state. They mount the mod in hidden frames, as the other samples' cases do. They read the DOM (marker labels, counts, `aria-expanded`, sidebar text), not pixel positions. Positions are covered by an e2e test.

`e2e/sample_country_map.spec.ts` routes `https://cdn.jsdelivr.net/npm/**` to `e2e/npm_files/<package>@<version>/<path>`, which holds exact copies of the five files with each package's license file. `.prettierignore` and `.oxlintrc.json` skip `e2e/npm_files/`. The spec covers what cases can't observe:
- the marker tip positions, compared with the projected point, and inside their country's shape;
- clicking a country's shape;
- the cover that redirects to archive.org;
- the theme colors in light and dark;
- the narrow layout;
- the attribution link;
- the Tab order and raised markers;
- the absence of map image requests;
- "Reload tiles";
- "Check mod" passing in the mod viewer.

### 11. Palette

Every color comes from the theme's tokens, mixed with `color-mix(in oklab, …)` where a role has no token, so the light and dark schemes both work:

- the sea, the map container's background: a gray, `color-mix(in oklab, var(--ot-muted-foreground) 14%, var(--ot-card))`, light in the light scheme and a step above the land in the dark one;
- countries without tiles: `var(--ot-muted)`, so they recede;
- countries with tiles: `color-mix(in oklab, var(--ot-primary) 28%, var(--ot-card))`, so they stand out, in the markers' hue;
- the selected country: `var(--ot-accent)`;
- outlines: `var(--ot-border)`;
- the sidebar: `var(--ot-card)`, with a `var(--ot-border)` edge, apart from the frame's `--ot-background`;
- tile buttons: `color-mix(in oklab, var(--ot-primary) 8%, var(--ot-card))`, and 16% on hover.

These percentages were settled against screenshots in both schemes. The sea was first a teal tint of `--ot-secondary`, then made gray at the user's request.

### 12. Cover permissions

The mod file declares `show` for `https://covers.openlibrary.org`, `https://archive.org`, `https://*.archive.org` and `https://upload.wikimedia.org`, with the reason "Shows the book covers", as the book list does. The mod is served from the app's origin, so the permissions are granted with no consent dialog. The map itself still sends no request.

## Risks / Trade-offs

- [Markers in Europe overlap at the first zoom] → raised markers on hover and focus, keyboard access by Tab, and zoom. Clustering is out of scope.
- [Leaflet in a hidden check frame with no size] → `invalidateSize` from the `ResizeObserver`, and cases that read the DOM, not positions.
- [jsDelivr unreachable] → the mod shows "The map could not be loaded." and notifies the error, which names the package and host (from `add-mod-declared-libraries`).
- [The 1:110m map leaves out small states] → their tiles go to "Not on the map", with no tile lost. A finer map (`countries-50m.json`, about 750 KB) is a one-line change in the mod file if needed.
- [Copies of third-party files in the repo, for tests] → exact copies with their license files, outside `public/`, never shipped, and skipped by lint and formatting.
- [The pole of inaccessibility costs more than a bounds center] → it runs only for countries with tiles, once each, on 1:110m outlines of at most a few hundred points; the sample's 14 countries take a few milliseconds.
- [A fifth library, proj4, adds 136 KB to the first load] → loaded once per page from the npm host and shared with any other mod that declares it; the map then shows countries at their true size.
- [Equal Earth's curved edges leave the sea's corners empty] → the sea color fills the whole map container, so the corners read as sea.

## Migration Plan

Additive: a new sample and one explorer entry. Rollback is removing the folder and the entry.
