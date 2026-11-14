# Proposal

## Why

The samples show how to list tiles (the book list) and how to study them (flashcards), but none shows how a mod uses an existing library instead of reinventing it. A map is the clearest case: no mod author should write pan, zoom and projections. With `add-mod-declared-libraries`, a mod can declare npm libraries in its mod file and get them through `libs.load`. A country map sample is the worked example of that, and it shows collections spatially: how many tiles each country has, and which ones.

## What Changes

- New sample mod `country_map` (title "Country Map") in `public/samples/mods/country_map/`, plain JavaScript like the other samples, with its mod file, tile type and test file.
- **Permissions**: `show` for the book covers' hosts, as the book list declares them (`covers.openlibrary.org`, `archive.org`, `*.archive.org`, `upload.wikimedia.org`): Open Library covers redirect to archive.org, which a tile's link alone does not allow.
- **Declared libraries**: Leaflet `1.9.4` (`dist/leaflet.js`, `dist/leaflet.css`), `topojson-client` `3.1.0`, `proj4` `2.23.0` (`dist/proj4.js`) and `world-atlas` `2.0.2` (`countries-110m.json`, the Natural Earth 1:110m countries), all loaded with `libs.load` from the app's npm host. The mod ships no third-party code.
- **World map**: the countries drawn as shapes in the Equal Earth projection, an equal-area projection that keeps countries far from the equator at their true size. There is no tile server, so the map sends no request other than the libraries'. It can be panned and zoomed, and its attribution credits Leaflet and Natural Earth.
- **Look**: in the theme's colors, following the light and dark schemes. The sea is distinct from land, the countries with tiles stand out from the muted others, and the selected country is highlighted.
- **One marker per country** with at least one tile:
  - its shape is a speech bubble, like a message-square icon but with the pin in the middle of its bottom edge, the tip on the country's own land: the point of its largest piece of land farthest from the coast and borders;
  - it holds the country's number of tiles;
  - it is a button named, for example, "France, 6 tiles", which the keyboard reaches.
- **Country names**: a tile's `country` matches a map country by name, ignoring case and accents, or by a common alias (`"United States"`, `"Czech Republic"`, `"Ivory Coast"`, ...).
- **Not on the map**: tiles whose country the map can't place (missing, too small for the map, or historical) are grouped behind a "Not on the map" button, shown only when there are some. The button opens them in the sidebar like a country.
- **Country shapes**: clicking a country that has tiles selects it, as its marker does.
- **Sidebar**: clicking a marker opens a sidebar on the right with the country's name, its number of tiles and a list of its tiles. It has the card color, apart from the stage's background, and its tiles stand out from it. On a narrow frame the sidebar sits below the map.
- **Tile card**: selecting a tile opens a modal dialog with its title, its metadata as labeled values and its body rendered by the engine (`<ot-tile-body>`). It closes like the book list's card.
- **Follows the tiles**: "Reload tiles" redraws the markers, and keeps the open country and card when they still have tiles.
- **Tile type** `country_tile`: a string `title` and a string `country`, other keys allowed.
- **Sample collection**: the existing Nobel laureates' books collection (`public/samples/tiles/literature_nobel_laureates_books/`), 51 books in 14 countries. The mod file points to it; nothing is copied.
- The mod explorer's vanilla config lists the country map after the flashcards.
- The mod guide's made-up `country_markers_map` example becomes this sample's real mod file, and its "Declared libraries" section points to the sample.

## Capabilities

### New Capabilities

- `sample-country-map`: what the shipped sample country map mod shows and how the user works with it. This covers the map and its look, the libraries it loads, the markers, country matching, "Not on the map", the sidebar, the tile card, following the tiles, the tile type, the mod file and its tests.

### Modified Capabilities

- `default-mods`: the mod explorer's vanilla config also lists the sample country map, after the flashcards.

## Impact

- **New files** under `public/samples/mods/country_map/`: `mod_conf.yaml`, `main.js`, `test.js`, `country_tile_type.md`.
- **Mod explorer**: one more entry in `default_mods/mod_explorer/mod_conf.yaml`, plus the explorer's tests and the e2e tests that count or name its entries.
- **Tests**:
  - the shipped-sample checks in `src/lib/mod/sample_mod.test.ts`, extended to the new mod;
  - a new Playwright spec, `e2e/sample_country_map.spec.ts` (tagged `@sample`), with helpers in `e2e/sample_mod.ts`. It answers jsDelivr URLs with local copies of the four libraries' files under `e2e/npm_files/` (about 400 KB, with their licenses), so no test reaches the network. Formatting and lint skip those copies.
- **Docs**: the samples in `docs/modules/lib/mod/README.md` and `docs/modules/mods/explorer/README.md`, and the example mod file in `docs/mod_plugin_spec.md` and its "Declared libraries" example.
- **Network**: when the map opens, the app page fetches the four libraries' files from the npm host, jsDelivr by default, once per page. The map's frame makes no request; a tile's card loads its cover from the hosts the mod declares.
- **Mod API version**: none. The sample uses only what `add-mod-declared-libraries` adds and changes no mod API spec. Its `api` range is `^0.1.10`.
- **App version**: patch, for a new sample.
- **Depends on**: `add-mod-declared-libraries`, which is applied and archived first.
- **Out of scope**:
  - map tiles from a tile server, other projections, and zoom beyond country level;
  - clustering markers that overlap at low zoom (the user zooms in);
  - remembering the view;
  - other tile types, such as the laureates' `birth_country`.
