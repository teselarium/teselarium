# Design

## Context

See proposal.md for the motivation. What the design builds on:

- **The other samples** (`public/samples/mods/book_list/`, `flashcards/`) are plain JavaScript, served as they are. They follow the project's conventions: named functions, no nested functions, explicit loops. The book list's card is the model for this mod's card: a native `<dialog>` with `showModal()`, closed by Escape, the Close button and the backdrop, with focus returned to the opener.
- **`add-mod-declared-libraries`** (applied first) gives `libraries` in the mod file and `libs.load { name }`. `.js` files are installed as classic scripts and `.css` files as `<style>` elements before the mod's own styles. Data files come back as text in `files`.
- **Spike results** (jsDelivr, in that change's design):
  - `leaflet@1.9.4/dist/leaflet.js` is a 148 KB UMD build that sets `globalThis.L`, and `dist/leaflet.css` is 15 KB;
  - `topojson-client@3.1.0/dist/topojson-client.min.js` is 7 KB and sets `globalThis.topojson`;
  - `world-atlas@2.0.2/countries-110m.json` is a 108 KB TopoJSON with 177 countries. Each has only a `name` (Natural Earth's short name) and a numeric `id`. France is a MultiPolygon with French Guiana. Small states such as Singapore are not drawn.
- **Short or formal map names**: `Bosnia and Herz.`, `Central African Rep.`, `Dem. Rep. Congo`, `Dominican Rep.`, `Eq. Guinea`, `Falkland Is.`, `Fr. S. Antarctic Lands`, `N. Cyprus`, `S. Sudan`, `Solomon Is.` and `W. Sahara`, plus `United States of America`, `Czechia`, `eSwatini`, `Côte d'Ivoire`, `Macedonia` and `Timor-Leste`.
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

### 1. Leaflet with a GeoJSON layer and no tile layer

`L.map` gets `attributionControl` and `zoomControl` on, no tile layer, and one `L.geoJSON` layer built from `topojson.feature(topology, topology.objects.countries)`. Each country path gets a class (`country`, and `country selected` for the selected one). The mod's CSS fills and strokes these classes with `var(--ot-muted)`, `var(--ot-border)` and `var(--ot-accent)`, so a color scheme change applies with no redraw. The map container's background is `var(--ot-background)`.

The map uses `worldCopyJump: false`, `maxBounds` around the world with `maxBoundsViscosity: 1`, and zoom from 1 to 6. The first view is `fitBounds` of the marker points with padding, or the world's bounds without markers.

- *Alternative: raster tiles from OpenStreetMap.* Rejected in the exploration: it needs a `show` permission, sends third-party requests from every user, falls under a tile usage policy, and doesn't follow the theme.
- *Alternative: d3-geo with SVG.* Rejected: pan, zoom and keyboard handling would have to be assembled by hand, which this sample exists to avoid.

### 2. Marker point: the center of the largest piece of land

For a country's MultiPolygon, the mod takes the polygon with the largest area. It computes the area of each outer ring with the shoelace formula on longitude and latitude, which is enough to compare pieces of one country. The marker point is Leaflet's center of that polygon (`L.polygon(ring).getBounds().getCenter()`). That puts France in mainland France, the United States in the contiguous states and Norway on its mainland.

- *Alternative: the centroid of the whole country.* Rejected: overseas land pulls it into the sea, for France for example.
- *Alternative: a hand-made table of points.* Rejected: 177 entries to maintain. A per-country override table can be added later if a center lands badly.

### 3. Country matching

The mod builds a lookup from a normalized name to a map country. To normalize a name, it trims it, lower-cases it, strips accents (`normalize("NFD")` and dropping combining marks) and collapses spaces. Each country is entered under its map name and under its aliases, from a small table in `main.js`. The table covers the map names listed in Context with their common forms, for example:

- `united states`, `usa` and `united states of america`;
- `democratic republic of the congo` and `dr congo`;
- `czech republic`, `ivory coast`, `north macedonia`, `east timor` and `eswatini`/`swaziland`;
- the long forms of the abbreviated names.

A tile whose name finds no entry goes to "Not on the map". The shown name is the first tile's trimmed `country`, so the sample shows "United States", not "United States of America".

### 4. Markers as `L.divIcon` with an inline SVG

The marker's HTML is one SVG `<path>`: a rounded box with a centered pin. Its width is computed from the number's digits, `max(28, 12 + 8 × digits)` px with a 22 px box and an 8 px pin, plus the count in a `<text>`. `iconSize` and `iconAnchor` put the anchor at the pin's tip (`[width / 2, 30]`).

Leaflet makes an interactive marker's icon a focusable element with `role="button"`. After `addTo`, the mod sets its `aria-label` ("France, 6 tiles") and `aria-expanded`. A `keydown` listener handles Space; Leaflet already turns Enter into a click.

Markers are added in the order of their countries' names, which gives the Tab order. Raising uses `setZIndexOffset` on `mouseover`, `focus` and selection, and resets it on `mouseout` and `blur` unless the country is selected.

- *Alternative: Leaflet's default image markers.* Rejected: they need their image files and can't hold a number.

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

The state is one plain `view` object: the map, layers, the selected group key (a country id or `"unplaced"`) and the open tile source. It is redrawn by functions that take the view, as in the other samples.

### 8. Following the tiles

On `tiles.changed`, the mod:
1. recomputes the groups;
2. removes and re-adds the markers (the map and its country layer stay);
3. updates the "Not on the map" control;
4. keeps or deselects the selected group;
5. refreshes or closes the card, by tile source.

### 9. Loading and failure

`mount` shows "Loading the map…", then loads `leaflet`, `topojson_client` and `world_atlas`, in that order, because the map needs `L` before the data. It parses `files["countries-110m.json"]` with `JSON.parse`. On any failure it replaces the status with "The map could not be loaded.", sends `ui.notify` at level `"error"` with the error's message, and resolves. The mod check then reports the error as a `mount` finding, and the mod doesn't fail with an unhandled rejection.

### 10. Tests and fixture copies

`test.js` holds the cases of the "Mod tests" requirement, plus cases for the alias, the shown name, card metadata formatting and the empty state. They mount the mod in hidden frames, as the other samples' cases do. They read the DOM (marker labels, counts, `aria-expanded`, sidebar text), not pixel positions. Positions are covered by an e2e test.

`e2e/sample_country_map.spec.ts` routes `https://cdn.jsdelivr.net/npm/**` to `e2e/npm_files/<package>@<version>/<path>`, which holds exact copies of the four files with each package's license file. `.prettierignore` and `.oxlintrc.json` skip `e2e/npm_files/`. The spec covers what cases can't observe:
- the marker tip positions, compared with the projected latitude and longitude;
- the theme colors in light and dark;
- the narrow layout;
- the attribution link;
- the Tab order and raised markers;
- the absence of map image requests;
- "Reload tiles";
- "Check mod" passing in the mod viewer.

## Risks / Trade-offs

- [Markers in Europe overlap at the first zoom] → raised markers on hover and focus, keyboard access by Tab, and zoom. Clustering is out of scope.
- [Leaflet in a hidden check frame with no size] → `invalidateSize` from the `ResizeObserver`, and cases that read the DOM, not positions.
- [jsDelivr unreachable] → the mod shows "The map could not be loaded." and notifies the error, which names the package and host (from `add-mod-declared-libraries`).
- [The 1:110m map leaves out small states] → their tiles go to "Not on the map", with no tile lost. A finer map (`countries-50m.json`, about 750 KB) is a one-line change in the mod file if needed.
- [Copies of third-party files in the repo, for tests] → exact copies with their license files, outside `public/`, never shipped, and skipped by lint and formatting.
- [The center of a crescent-shaped largest piece may fall just outside it] → acceptable for a sample marker. An override table can be added if a sample country needs it.

## Migration Plan

Additive: a new sample and one explorer entry. Rollback is removing the folder and the entry.

## Open Questions

- The exact alias list is settled while writing the table against `countries-110m.json`'s names. It doesn't change the spec, whose scenarios name only `United States`, `usa` and `cote d'ivoire`.
