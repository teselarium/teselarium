# Design

## Context

The country map's default mosaic, its test file, its e2e spec and the shipped-sample unit test all read the 51 Nobel laureates' books, which live in `public/samples/tiles/literature_nobel_laureates_books/` and also serve the book list's `nobel_books_list.yaml`. See proposal.md (Why) for the reasons to stop that.

Constraints from the code:

- The mod tells tiles apart by `source`: the sidebar buttons carry it, and the card is opened and looked up by it (`public/samples/mods/country_map/main.js`).
- In a mod test case, `context.mount({ tiles })` replaces the tiles, and the mod test docs (`docs/mod_plugin_spec.md`, "The case context") list no check of their sources. `tiles.renderBody` renders only the tiles of the check's collection, by source (`src/lib/core/engine/mod_tile_bodies.ts`).
- When "Load media linked by tiles" is on, an image linked from a tile's metadata loads without a permission (`mod-sandbox`, "Media linked by tiles"). Only a redirect to another host, as Open Library's covers do, needed the extra `show` permissions.
- The e2e answers external requests locally (jsDelivr's library files; `upload.wikimedia.org` images with a 1×1 PNG through `routeCovers` in `e2e/mod_routes.ts`; the country map spec's own route for Open Library covers), so no test reaches the network. The sites' images need only `routeCovers`.

## Goals / Non-Goals

**Goals:**

- The mod's folder holds everything its default mosaic shows.
- The mod's tests depend on the sample only where they prove something about it.
- The sites can be fetched again the same way later.

**Non-Goals:**

- No change to the mod's code, tile type, libraries or `api` range.
- No change to the books folder, the two sample mosaics or the engine's resolution of mod paths.
- No script to fetch the sites. With 11 files, the procedure written below is enough.

## Decisions

### The sites live in `sites/` with their own `collection.yaml`

Like `book_list/books/` and `book_list/book_collection.yaml`. The default mosaic names `./sites/collection.yaml`. Each file is named after its site in snake case, such as `machu_picchu.md`, and the collection lists them in the order of the spec's "The sites", by UNESCO region.

Alternative: `public/samples/tiles/unesco_world_heritage_sites/`, next to the Nobel collections. Rejected, since that folder is the pool for standalone mosaics, and putting the data there keeps the mod from being copied as one folder.

### Fetching a site

For each site, the English Wikipedia REST summary, `https://en.wikipedia.org/api/rest_v1/page/summary/<article>`, gives:

- the body's paragraph: `extract`, the article's first paragraph as plain text, kept as written;
- the image: the article's lead image. The tile links a standard-size thumbnail on `upload.wikimedia.org` (the summary's `thumbnail` at a width Wikimedia serves, around 960 px wide), not the original, which can be several megabytes.

The tile's `title` is the article's title, as listed in the spec; its `country` is the state party UNESCO lists, written with the map's name or one of its aliases (see "Country names"). The body ends with `Source: <article address>`, as the Nobel tiles do. The fetched files are a snapshot: they are not refreshed when the articles change.

Alternative: download the images into the repo. Rejected: it would add several megabytes and a license file per image, and the Nobel tiles already hot-link Wikimedia.

### `show` only for `upload.wikimedia.org`

The images are linked at their final address, so the default mosaic declares only Wikimedia's host. The scenario "Without the default mosaic" keeps showing why the permission belongs to the mosaic: with "Load media linked by tiles" off, the same sites opened from a run link have their images blocked.

### Tests: real sites for cards, made-up tiles for markers

| Case needs | Tiles |
|---|---|
| a card, a body, a link in a body | the sample sites, through `context.tiles`, changed with `changeTile` when it needs other metadata |
| counting, sizing or placing markers only | made-up tiles with a `title`, a `country` and a unique `source` (for example `made-up/germany-3.md`) and an empty body |

The marker-width case needs 7 and 12 tiles in two countries, more than the 11 sites, and no card, so it uses made-up tiles. The current `placeSampleTiles` reads 19 sample tiles and would no longer find them. Made-up tiles are not cloned from one site, since copies with the same source would collapse into one card in the sidebar.

The same rule holds in the e2e: the geometry cases that used the books' countries (Norway's tip, the overlap of Austria's and Hungary's markers) mount the sites plus made-up tiles through a routed collection.

The cases read the sample's facts from `context.tiles` where they can (the titles of a country), and write them only where they are the point of the case: the 10 markers, China's 2 tiles.

Alternative: clone one site. Rejected for the reason above. Alternative: grow the sample to 19 tiles. Rejected, since that sizes the sample for a test.

### `sample_mod.test.ts` gives each mod its own permissions

`COVER_PERMISSIONS` stays for the book list. The country map gets its own expected list, only `upload.wikimedia.org` with the reason "Shows the sites' images", and its tile type case expects the 11 sites.

### Docs stop promoting outside data in a default mosaic

`docs/mod_plugin_spec.md` keeps the "copied or shared as one folder" sentence and the shared `type_path` example. Its country map example then describes the mod's own sites and Wikimedia's `show` permission, and points to standalone mosaics, such as `samples/mosaics/nobel_laureates_map.yaml`, for showing a mod with data from elsewhere. `docs/modules/lib/mod/README.md` updates the country map's entry the same way, and its note on `type_path` and `default_mosaic` says that a default mosaic outside the folder keeps the mod from being copied as one folder.

## Risks / Trade-offs

- [A made-up source is refused by `context.mount`] → The first task tries one made-up tile in a case before rewriting the others. If it fails, stop and revise this design with the user.
- [A summary's `extract` is not the article's first paragraph, or has no lead image] → Check each site's article while fetching. Take the first paragraph and the lead image from the article itself when the summary differs.
- [A thumbnail width Wikimedia does not serve] → Open each image address before writing it into a tile.
- [Long first paragraphs, such as the Great Wall's] → Kept as written, as the proposal says. The card scrolls.
- [The Giza and Petra markers may overlap at the first view] → No scenario relies on it either way. The overlap case uses Austria and Hungary from made-up tiles.
- [Hot-linked images can move] → Same as the Nobel tiles. The card leaves out an image that fails to load.

## Migration Plan

None. The sample changes in one release; `nobel_books_list.yaml` and `nobel_laureates_map.yaml` are untouched. Rolling back restores the books as the default collection.
