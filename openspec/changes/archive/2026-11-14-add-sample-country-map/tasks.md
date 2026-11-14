# Tasks

Prerequisite: `add-mod-declared-libraries` is applied and archived, so `libraries` and `libs.load { name }` exist and the mod API version is `0.1.10`.

## 1. Mod file, tile type and test fixtures

- [x] 1.1 Create `public/samples/mods/country_map/mod_conf.yaml`:
  - name `country_map`, title "Country Map", version `1.0.0`, `api: "^0.1.10"`, and a description;
  - `entrypoint: "./main.js"`, `type_path: "./country_tile_type.md"`, `sample_collection: "../../tiles/literature_nobel_laureates_books/collection.yaml"` and `test_path: "./test.js"`;
  - no permissions;
  - the three `libraries` of the spec's "Declared libraries".

  Write `country_tile_type.md` with `ref: country_tile`, required string `title` and `country`, `additionalProperties: true`, and a body explaining the country names and "Not on the map". Extend `src/lib/mod/sample_mod.test.ts` with the shipped country map: the 51 books match `country_tile` with no issues, the range is `^0.1.10`, the test file names its cases, and the loaded mod has the three libraries with their jsDelivr sources. `loadShippedMod` passes the vanilla npm host (`NPM_HOST` from `src/main/library_host.ts`) as `npmHost`: without it, `loadMod` throws for a mod that declares an npm library. Verify with `npm test`.
- [x] 1.2 Copy the four library files from jsDelivr into `e2e/npm_files/<package>@<version>/<path>`, byte for byte, with each package's license file (`LICENSE` from Leaflet, topojson-client and world-atlas). Add `e2e/npm_files/` to `.prettierignore` and to `ignorePatterns` in `.oxlintrc.json`. Add a route helper to `e2e/sample_mod.ts` that answers `https://cdn.jsdelivr.net/npm/**` from that folder, with a 404 and jsDelivr's text for a missing file. Add the country map's paths and run hashes next to the flashcards'. Verify that `npm run lint` and `npm run format:check` pass, and that the copies' SHA-256 hashes match the files jsDelivr serves.

## 2. Map and libraries

- [x] 2.1 Write `main.js`'s module comment (what the mod shows as an example of declared libraries) and the loading flow of design.md, decision 9: "Loading the map…", the three `libs.load` requests in order, the TopoJSON parsed into GeoJSON, and "The map could not be loaded." with a `ui.notify` error on failure. Write the map of decisions 1 and 5:
  - full-width layout and container query;
  - Leaflet with no tile layer, and the country shapes with their CSS classes;
  - bounds, zoom range and first view;
  - the `ResizeObserver`.

  Add `test.js` cases for the 177 shapes and the empty state ("There are no tiles to show.", no marker). Verify with the mod viewer's "Check mod" in `npm run dev`.
- [x] 2.2 Add the attribution of decision 6: Leaflet and Natural Earth links, opened through `links.open`. Add a `test.js` case that clicks the Leaflet link and expects a recorded `links.open` with `https://leafletjs.com`. Verify with "Check mod".

## 3. Countries and markers

- [x] 3.1 Write the name normalization and the alias table of decision 3, covering every short or formal name of `countries-110m.json` listed in design.md's Context, and the grouping of tiles into countries and "Not on the map", with the shown name taken from the first tile. Add `test.js` cases for "Alias" (`United States` and `usa` share a marker shown as "United States"), "Accents and case" and a historical country going to "Not on the map". Verify with "Check mod", and remove the open question from design.md once the table is written.
- [x] 3.2 Write the marker point of decision 2 (largest piece of land by area, center of its bounds) and the markers of decision 4:
  - the speech-bubble SVG, with its width from the digits and its anchor at the tip;
  - the count;
  - `aria-label` with "tile"/"tiles", and `aria-expanded`;
  - Space handling;
  - name order;
  - raising on hover, focus and selection.

  Add the `test.js` case `shows a marker per country` (14 markers with their numbers and labels) and a case for widths with 1 and 2 digits. Verify with "Check mod".
- [x] 3.3 Add the "Not on the map" control: shown only with unplaced tiles, labeled "Not on the map, N tiles", and selecting that group. Add the `test.js` case `groups tiles not on the map`, plus a case checking that the sample shows no such button. Verify with "Check mod".

## 4. Sidebar and card

- [x] 4.1 Write the sidebar of decision 7:
  - heading with focus, the count, Close with the Lucide `x` icon, and tile buttons in tiles' order;
  - replacing its content when another country is selected;
  - closing it, with focus back to the marker or the "Not on the map" button;
  - the selected country's shape class.

  Add the `test.js` case `opens a country` (France, "6 tiles", six titles including "The Years") and a case for closing with focus. Verify with "Check mod".
- [x] 4.2 Write the tile card of decision 7:
  - `showModal()`, labeled by the title;
  - the image when `image` is a string, removed on error;
  - the `<dl>` of metadata with the spec's formatting and omissions;
  - `<ot-tile-body>`;
  - Escape, Close and backdrop, and focus back to the tile's button.

  Add `test.js` cases for "Book metadata" ("The Years": authors, country, genres, no `pages`), a mapping value shown as JSON, and Escape. Verify with "Check mod".
- [x] 4.3 Handle `tiles.changed` as decision 8 describes. Add `test.js` cases where the case mounts new tiles: a French book added ("7" and "7 tiles"), Germany emptied (sidebar closed, no marker), and an open card that refreshes and one that closes. Verify with "Check mod".

## 5. App integration, e2e and docs

- [x] 5.1 Add `./samples/mods/country_map` after the flashcards in `default_mods/mod_explorer/mod_conf.yaml`. Update the explorer's tests in `default_mods/mod_explorer/test/` and `e2e/default_mods.spec.ts` for the third entry (the `default-mods` delta, "Vanilla explorer lists the country map sample"). Verify with `npm test` and `npx playwright test e2e/default_mods.spec.ts`.
- [x] 5.2 Write `e2e/sample_country_map.spec.ts`, tagged `@sample`, using the route helper of 1.2, for what cases can't observe:
  - "Libraries come from the npm host" (the frame sends no request);
  - "Map of the sample" (every marker inside the view), and "Theater mode";
  - "Dark map", and "No map tiles";
  - "Leaflet link" (the mod keeps running);
  - "Country with overseas land" (France's tip in mainland France, from the projected point);
  - "Tip on the country" after zooming;
  - "Select with the keyboard", the Tab order, and "Overlapping markers";
  - "Phone width";
  - "A link in the body";
  - "Book added" and "Country emptied" with "Reload tiles";
  - "Library that cannot be loaded" (the route answers 404 for `dist/leaflet.js`);
  - "Check mod" passing in the mod viewer.

  Verify with `npx playwright test e2e/sample_country_map.spec.ts --grep @sample` in Chromium, Firefox and WebKit.
- [x] 5.3 Mention the country map sample in `docs/modules/lib/mod/README.md` (the shipped samples, with its folder and what it shows as an example) and in `docs/modules/mods/explorer/README.md` (the vanilla `mods` list). Replace the made-up `country_markers_map` example in `docs/mod_plugin_spec.md` with the real `country_map` mod file and tile type. In its "Declared libraries" section, which `add-mod-declared-libraries` wrote with a shortened `country_map` example, point to the sample as the complete example and make the npm snippet declare the same libraries as the sample's mod file. The snippet of files next to the mod, and the `map_tools` example in "Library declarations" in `docs/modules/lib/mod/README.md`, stay as format examples. Verify that the documented files match `mod_conf.yaml` and `country_tile_type.md`, and that every `mod_conf.yaml` snippet in these docs passes the mod file's format rules.

## 6. Release

- [x] 6.1 Add `.changeset/add-sample-country-map.md` with an `"opentesela": patch` bump: a new sample, with no breaking change for users or instantiations and no mod API bump (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "A sample country map mod shows any collection on a world map, with a marker per country, a sidebar of its tiles and a card for each one, using Leaflet declared as a library." Verify the file follows the format of the other files in `.changeset/`.

## 7. Verification

- [x] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify all pass. Run `openspec validate add-sample-country-map --strict` and verify it is valid.

## 8. Feedback revisions

These tasks follow the review of the first implementation. Where they change what tasks 1.1, 1.2, 2.1, 3.2 or 5.3 built (the mod file's permissions and libraries, the projection, the marker point, the look), they supersede those tasks.

- [x] 8.1 Add `proj4` (`proj4@2.23.0`, `dist/proj4.js`) to the mod file's `libraries`, between `topojson_client` and `world_atlas`, and the `show` permissions of design.md, decision 12. Copy `dist/proj4.js` and `LICENSE.md` into `e2e/npm_files/proj4@2.23.0/`, byte for byte, and verify their SHA-256 hashes against jsDelivr and the npm tarball. Update `src/lib/mod/sample_mod.test.ts`: the four libraries with their jsDelivr sources, and the four `show` hosts instead of no permissions. Verify with `npm test`.
- [x] 8.2 Draw the map of decision 1 in Equal Earth: `libs.load` of `proj4` after `topojson_client`, `L.CRS.Simple`, the countries projected by `coordsToLatLng`, the world box as `maxBounds`, zoom from 0 to 5, and the markers in map units. Replace the unwrapping with the split at the 180th meridian of decision 2b. Keep the `test.js` cases passing (177 shapes, one per country). Verify with "Check mod" and a screenshot that no shape crosses the map.
- [x] 8.3 Replace the marker point with the pole of inaccessibility of decision 2, in map units with holes, computed once per country with tiles. Add an e2e test, "Tip on the country's land", that checks each sample marker's tip is inside its country's shape (`isPointInFill` on the shape's path), Norway's included, and update "Country with overseas land" to read latitude and longitude through proj4's inverse.
- [x] 8.4 Make the country layer interactive as decision 4b says: a click on a country with tiles selects it, a click on one without does nothing, and the pointer cursor shows only on `path.country.has-tiles`. Add a `test.js` case that clicks France's shape and expects its sidebar, and e2e tests "Click a country" and "Click a country without tiles" (Spain).
- [x] 8.5 Apply the palette of decision 11: the sea, countries with and without tiles, the selected country, the sidebar on `--ot-card` and the tile buttons. Update the e2e tests "Dark map" (a country without tiles), "Countries with tiles stand out" and "Sidebar colors", and keep "Mod's own styles" passing with `color-mix()` of tokens. Check screenshots in light and dark, and settle the percentages.
- [x] 8.6 Add the e2e test "Open Library cover": the route answers The Years' cover with a redirect to `https://archive.org`, then to `https://ia800100.us.archive.org`, then an image. The card shows the image, and no warning is reported.
- [x] 8.7 Update the docs: the country map in `docs/modules/lib/mod/README.md` (Equal Earth, proj4, the cover permissions), the sample's mod file in `docs/mod_plugin_spec.md`, and its "Declared libraries" snippet and code with `proj4`. Verify that the documented files match `mod_conf.yaml` and that every `mod_conf.yaml` snippet passes the mod file's format rules. Keep the changeset's summary unless it no longer describes the sample.
- [x] 8.8 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify all pass. Run `openspec validate add-sample-country-map --strict` and verify it is valid.
