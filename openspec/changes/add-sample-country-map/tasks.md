# Tasks

Prerequisite: `add-mod-declared-libraries` is applied and archived, so `libraries` and `libs.load { name }` exist and the mod API version is `0.1.10`.

## 1. Mod file, tile type and test fixtures

- [ ] 1.1 Create `public/samples/mods/country_map/mod_conf.yaml`:
  - name `country_map`, title "Country Map", version `1.0.0`, `api: "^0.1.10"`, and a description;
  - `entrypoint: "./main.js"`, `type_path: "./country_tile_type.md"`, `sample_collection: "../../tiles/literature_nobel_laureates_books/collection.yaml"` and `test_path: "./test.js"`;
  - no permissions;
  - the three `libraries` of the spec's "Declared libraries".

  Write `country_tile_type.md` with `ref: country_tile`, required string `title` and `country`, `additionalProperties: true`, and a body explaining the country names and "Not on the map". Extend `src/lib/mod/sample_mod.test.ts` with the shipped country map: the 51 books match `country_tile` with no issues, the range is `^0.1.10`, the test file names its cases, and the loaded mod has the three libraries with their jsDelivr sources. Verify with `npm test`.
- [ ] 1.2 Copy the four library files from jsDelivr into `e2e/npm_files/<package>@<version>/<path>`, byte for byte, with each package's license file (`LICENSE` from Leaflet, topojson-client and world-atlas). Add `e2e/npm_files/` to `.prettierignore` and to `ignorePatterns` in `.oxlintrc.json`. Add a route helper to `e2e/sample_mod.ts` that answers `https://cdn.jsdelivr.net/npm/**` from that folder, with a 404 and jsDelivr's text for a missing file. Add the country map's paths and run hashes next to the flashcards'. Verify that `npm run lint` and `npm run format:check` pass, and that the copies' SHA-256 hashes match the files jsDelivr serves.

## 2. Map and libraries

- [ ] 2.1 Write `main.js`'s module comment (what the mod shows as an example of declared libraries) and the loading flow of design.md, decision 9: "Loading the map…", the three `libs.load` requests in order, the TopoJSON parsed into GeoJSON, and "The map could not be loaded." with a `ui.notify` error on failure. Write the map of decisions 1 and 5:
  - full-width layout and container query;
  - Leaflet with no tile layer, and the country shapes with their CSS classes;
  - bounds, zoom range and first view;
  - the `ResizeObserver`.

  Add `test.js` cases for the 177 shapes and the empty state ("There are no tiles to show.", no marker). Verify with the mod viewer's "Check mod" in `npm run dev`.
- [ ] 2.2 Add the attribution of decision 6: Leaflet and Natural Earth links, opened through `links.open`. Add a `test.js` case that clicks the Leaflet link and expects a recorded `links.open` with `https://leafletjs.com`. Verify with "Check mod".

## 3. Countries and markers

- [ ] 3.1 Write the name normalization and the alias table of decision 3, covering every short or formal name of `countries-110m.json` listed in design.md's Context, and the grouping of tiles into countries and "Not on the map", with the shown name taken from the first tile. Add `test.js` cases for "Alias" (`United States` and `usa` share a marker shown as "United States"), "Accents and case" and a historical country going to "Not on the map". Verify with "Check mod", and remove the open question from design.md once the table is written.
- [ ] 3.2 Write the marker point of decision 2 (largest piece of land by area, center of its bounds) and the markers of decision 4:
  - the speech-bubble SVG, with its width from the digits and its anchor at the tip;
  - the count;
  - `aria-label` with "tile"/"tiles", and `aria-expanded`;
  - Space handling;
  - name order;
  - raising on hover, focus and selection.

  Add the `test.js` case `shows a marker per country` (14 markers with their numbers and labels) and a case for widths with 1 and 2 digits. Verify with "Check mod".
- [ ] 3.3 Add the "Not on the map" control: shown only with unplaced tiles, labeled "Not on the map, N tiles", and selecting that group. Add the `test.js` case `groups tiles not on the map`, plus a case checking that the sample shows no such button. Verify with "Check mod".

## 4. Sidebar and card

- [ ] 4.1 Write the sidebar of decision 7:
  - heading with focus, the count, Close with the Lucide `x` icon, and tile buttons in tiles' order;
  - replacing its content when another country is selected;
  - closing it, with focus back to the marker or the "Not on the map" button;
  - the selected country's shape class.

  Add the `test.js` case `opens a country` (France, "6 tiles", six titles including "The Years") and a case for closing with focus. Verify with "Check mod".
- [ ] 4.2 Write the tile card of decision 7:
  - `showModal()`, labeled by the title;
  - the image when `image` is a string, removed on error;
  - the `<dl>` of metadata with the spec's formatting and omissions;
  - `<ot-tile-body>`;
  - Escape, Close and backdrop, and focus back to the tile's button.

  Add `test.js` cases for "Book metadata" ("The Years": authors, country, genres, no `pages`), a mapping value shown as JSON, and Escape. Verify with "Check mod".
- [ ] 4.3 Handle `tiles.changed` as decision 8 describes. Add `test.js` cases where the case mounts new tiles: a French book added ("7" and "7 tiles"), Germany emptied (sidebar closed, no marker), and an open card that refreshes and one that closes. Verify with "Check mod".

## 5. App integration, e2e and docs

- [ ] 5.1 Add `./samples/mods/country_map` after the flashcards in `default_mods/mod_explorer/mod_conf.yaml`. Update the explorer's tests in `default_mods/mod_explorer/test/` and `e2e/default_mods.spec.ts` for the third entry (the `default-mods` delta, "Vanilla explorer lists the country map sample"). Verify with `npm test` and `npx playwright test e2e/default_mods.spec.ts`.
- [ ] 5.2 Write `e2e/sample_country_map.spec.ts`, tagged `@sample`, using the route helper of 1.2, for what cases can't observe:
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
- [ ] 5.3 Mention the country map sample in `docs/modules/lib/mod/README.md` (the shipped samples, with its folder and what it shows as an example) and in `docs/modules/mods/explorer/README.md` (the vanilla `mods` list). Replace the made-up `country_markers_map` example in `docs/mod_plugin_spec.md` with the real `country_map` mod file and tile type. Verify that the documented files match `mod_conf.yaml` and `country_tile_type.md`.

## 6. Release

- [ ] 6.1 Add `.changeset/add-sample-country-map.md` with an `"opentesela": patch` bump: a new sample, with no breaking change for users or instantiations and no mod API bump (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "A sample country map mod shows any collection on a world map, with a marker per country, a sidebar of its tiles and a card for each one, using Leaflet declared as a library." Verify the file follows the format of the other files in `.changeset/`.

## 7. Verification

- [ ] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify all pass. Run `openspec validate add-sample-country-map --strict` and verify it is valid.
