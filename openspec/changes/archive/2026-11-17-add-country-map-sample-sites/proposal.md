# Proposal

## Why

The country map is the only sample mod whose default mosaic borrows its data from outside its folder: it opens with the 51 Nobel laureates' books of `public/samples/tiles/literature_nobel_laureates_books/`. A copied `country_map` folder loses its default collection, its spec, tests and e2e depend on another sample's data, and the mod guide presents this as the example to follow. A small collection of its own, UNESCO World Heritage Sites, makes the mod self-contained like the book list and the flashcards, and shows what a map is for: places.

## What Changes

- **Sample sites**: a new collection in `public/samples/mods/country_map/sites/`, 11 UNESCO World Heritage Sites in 10 countries, one or more per UNESCO region:
  - Africa: Serengeti National Park (Tanzania);
  - Arab States: the Giza pyramids (Egypt), Petra (Jordan);
  - Asia and the Pacific: the Great Wall and the Forbidden City (China), the Taj Mahal (India);
  - Europe and North America: the Acropolis of Athens (Greece), Mont-Saint-Michel (France), the Grand Canyon (United States);
  - Latin America and the Caribbean: Machu Picchu (Peru), the Galápagos Islands (Ecuador).
- **Simple tiles**: each has `title`, `country` and `image` (the Wikipedia article's lead image, hot-linked from `upload.wikimedia.org`), and a body with the article's first paragraph, as written, and a `Source:` line with the article's address. The collection's description credits Wikipedia and its CC BY-SA 4.0 license.
- **Default mosaic**: `mosaic.yaml` names `./sites/collection.yaml`, gets a title and description for the sites, and declares `show` only for `https://upload.wikimedia.org`. The Open Library and archive.org permissions, which only the books' covers needed, are removed.
- **Mod version**: `1.0.0` to `1.0.1`. Its code, tile type, libraries and `api` range do not change.
- **Mod tests**: the cases that open a card or render a body use the sample sites. The cases that only count, size or place markers build made-up tiles with their own sources, so they no longer depend on the sample's size. The sample's facts (its markers and its pair of Chinese sites) are written only where they prove behavior.
- **Docs**: the mod guide and the mod module's README stop presenting a default mosaic whose collection lives outside the mod folder. They describe the mod's own sites, and point to standalone mosaics, such as `samples/mosaics/nobel_laureates_map.yaml`, for showing a mod with data from elsewhere. Sharing one tile type between mods through `type_path` stays documented.
- Unchanged: the books folder and the two sample mosaics, which keep using the books and the laureates, and the engine's resolution of mod paths, which may still point outside a mod's folder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sample-country-map`: the mod file's default mosaic names the sample sites and declares only Wikimedia's host; a new requirement describes the sample sites; the scenarios and the mod tests that relied on the books (51 books, 14 markers, France's six books, "The Years", the Open Library cover redirect) describe the sites instead. Four requirements whose scenarios were named after the books are replaced under generic names, with the same behavior: "Mod file" by "Mod file and default mosaic", "Tile card" by "Opening the card", "Card metadata" by "Metadata on the card" and "Map follows the tiles" by "Map follows tile changes".

## Impact

- **New files**: `public/samples/mods/country_map/sites/collection.yaml` and 11 tile files.
- **Changed sample**: `public/samples/mods/country_map/mosaic.yaml`, `mod_conf.yaml` (version) and `test.js`.
- **Tests**: `src/lib/mod/sample_mod.test.ts` (the country map's own `show` permissions, and its tile type with the 11 sites), `e2e/sample_country_map.spec.ts` and its constants in `e2e/sample_mod.ts`. The e2e answers the sites' images on `upload.wikimedia.org` locally, so no test reaches the network.
- **Docs**: `docs/mod_plugin_spec.md` and `docs/modules/lib/mod/README.md`.
- **Network**: opening the country map's default mosaic loads the sites' images from `upload.wikimedia.org` instead of the books' covers from Open Library, archive.org and Wikimedia.
- **Mod API version**: none. No mod API spec changes.
- **App version**: patch, for a changed sample.
