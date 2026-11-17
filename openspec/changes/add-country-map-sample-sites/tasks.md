# Tasks

## 1. Before starting

- [ ] 1.1 Check the design's main risk: in `public/samples/mods/country_map/test.js`, temporarily make `widensAMarkerForMoreDigits` mount one made-up tile (`{ source: "made-up/germany-1.md", metadata: { title: "Made-up 1", country: "Germany" }, body: "" }`) next to the sample tiles. Run the mod's check in the mod viewer and verify that the case still runs and the made-up tile gets a marker. If `context.mount` refuses it, stop and revise design.md with the user before going on. Revert the temporary edit.

## 2. Sample sites

- [ ] 2.1 Fetch the 11 sites as design.md ("Fetching a site") describes, and write `public/samples/mods/country_map/sites/<site>.md`, one per site, with `title`, `country`, `image` (a standard-size thumbnail on `upload.wikimedia.org`), the article's first paragraph as written, and `Source: <article address>`. Verify each image address answers HTTP 200 with an image, and each paragraph matches the start of its article.
- [ ] 2.2 Add `public/samples/mods/country_map/sites/collection.yaml` listing the 11 files in the order of the spec's "The sites", with a title and a description that credits Wikipedia and CC BY-SA 4.0. Verify that `npm run dev` serves it at `#/run?mod=./samples/mods/country_map&collection=./samples/mods/country_map/sites/collection.yaml` with 10 markers and no "Not on the map" button.
- [ ] 2.3 Point `public/samples/mods/country_map/mosaic.yaml` to `./sites/collection.yaml`, give it a title and description for the sites, and keep only the `show` permission for `https://upload.wikimedia.org` ("Shows the sites' images"). Bump `mod_conf.yaml`'s `version` to `1.0.1`. Verify that `#/run?mosaic=./samples/mods/country_map/mosaic.yaml` opens with no dialog, and that the card of "Machu Picchu" shows its image with no blocked-request warning.

## 3. Mod tests

- [ ] 3.1 Rework `public/samples/mods/country_map/test.js` as design.md ("Tests") describes:
  - the sample markers for the 10 countries;
  - a helper that builds made-up tiles with unique sources, used by the cases that only count, size or place markers (marker width with 7 and 12 tiles, common names, accents, "Not on the map"), replacing `placeSampleTiles` where it read more tiles than the sample has;
  - `opens a country` selecting China and expecting "Great Wall of China" and "Forbidden City", read from `context.tiles`;
  - the card cases (metadata, a mapping as JSON, closing) on "Machu Picchu", with the added metadata of the "Empty values" scenario.

  Verify that checking the country map in the mod viewer reports `"pass"` with every case passed, among them `shows a marker per country`, `opens a country` and `groups tiles not on the map`.
- [ ] 3.2 Update `src/lib/mod/sample_mod.test.ts`: the country map's own expected `show` permission (only `upload.wikimedia.org`), separate from `COVER_PERMISSIONS`, which stays for the book list; the tile type case with the 11 sample sites. Verify with `npm run test`.

## 4. E2e

- [ ] 4.1 In `e2e/sample_mod.ts`, replace the books' collection and folder constants with the sites' (`/samples/mods/country_map/sites/collection.yaml` and its folder), and update their comments and the run hashes'. Verify that `npm run lint` reports no unused or missing constant.
- [ ] 4.2 Update `e2e/sample_country_map.spec.ts` to the delta spec of `sample-country-map`:
  - "Linked image" and "Without the default mosaic" on "Machu Picchu"'s image, routed by `routeCovers`; remove the Open Library route and the redirect test;
  - the sample's 10 markers, China's 2 tiles, France's 1 tile, the sidebar, card and Escape scenarios on China and "Machu Picchu";
  - "Tip on the country's land" with one made-up tile in Norway, and "Overlapping markers" with made-up tiles in Austria and Hungary, served through a routed collection;
  - "Tile added" with one more Chinese site, and "Country emptied" without the Peruvian site.

  Verify with `npm run test:e2e:samples`.

## 5. Docs

- [ ] 5.1 Update `docs/mod_plugin_spec.md` (the paragraph on the mod folder) and `docs/modules/lib/mod/README.md` (the country map's entry and the note on `type_path` and `default_mosaic`) as design.md ("Docs stop promoting outside data in a default mosaic") describes. Verify that `grep -rn "literature_nobel_laureates_books" docs` names no country map text, and that the links resolve.

## 6. Release

- [ ] 6.1 Add `.changeset/add-country-map-sample-sites.md` with a `patch` bump for `opentesela` and a one-line summary such as "The sample country map opens with its own UNESCO World Heritage Sites instead of the Nobel laureates' books." Verify that `npx changeset status` lists it.

## 7. Verification

- [ ] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify that each passes. Then run `openspec validate add-country-map-sample-sites --strict` and verify that it passes.
