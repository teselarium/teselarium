# Teselarium

## 0.2.0

### Minor Changes

- 0b75c7f: The catalog an instantiation sets is now the instance catalog, in `src/main/instance_catalog.ts` as `INSTANCE_CATALOG` (was `src/main/app_catalog.ts` and `APP_CATALOG`), and the mod API type `CatalogListing` is now `Catalog`; users see no change.
- f619bc6: The project is now named Teselarium; mods use the `--tes-*` theme variables and the `teselarium-browser:` address scheme and declare `api: ^0.2.0`

### Patch Changes

- 6904d56: The app has one catalog of the mods, collections and mosaics it offers, which the Mods, Tiles and Mosaics explorers list, with a Settings switch to also list mods' default mosaics (mod API 0.1.15: `catalog.list`, `catalog.changed`).
- 2c2bc1c: The Tiles section lists the sample tile collections and shows each one's name, description and tiles, with a new `collections.inspect` request for mods (mod API 0.1.11).
- bb87610: The sample country map opens with its own UNESCO World Heritage Sites instead of the Nobel laureates' books.
- bf2a291: Mods can declare the npm libraries and files they use in mod_conf.yaml, and libs.load installs them in the mod's frame from the app's npm host, jsDelivr by default.
- e82bdaf: Users can edit the mosaics stored in this browser, save copies of any mosaic or an unsaved combination as a mosaic, see their history, resolve conflicts on re-import and export a folder as a `.zip` (mod API 0.1.19: `mosaics.validate`, `mosaics.edit`, `userCatalog.save`, `userCatalog.history`, `userCatalog.exportFolder`).
- 560ea6b: The Mosaics section lists the sample mosaics, opens them, and shows each one's mod, collection, overrides, aliases and permissions in a mosaic viewer that can check it.
- 7b73dba: Run links can name a mosaic as `sites` to give another mod that mosaic's show permissions, so the collection's images still load (mod API 0.1.16).
- 114a8dd: Mosaics: `#/run?mosaic=…` opens a mod with a collection, config overrides, field aliases and the media hosts its data needs, with new `mosaics.inspect` and `mosaics.open` requests for mods (mod API 0.1.13).
- bf8e100: A sample country map mod shows any collection on a world map, with a marker per country, a sidebar of its tiles and a card for each one, using Leaflet declared as a library.
- 1e2c77d: A sample flashcards mod lets you explore any collection and study it as question and answer cards, and see how many you knew.
- ca4fa0a: Mods from other sites can use the sites they declare once you allow them; the app asks before the mod starts, can remember your answer, and lists remembered answers in Settings.
- 2915ce6: Mods are centered at a readable width on wide screens, pages at a reading width, and the stage bar has a theater mode button and a fullscreen button.
- 9864c5e: Mods can show a tile's body with one element, and play videos and audio from YouTube, Vimeo, SoundCloud or any embedded player in an app dialog after asking you.
- 53112da: Tile bodies show mermaid diagrams, drawn in the mod's frame from the app's own copy of mermaid, which mods can also load with libs.load.
- c3a0b5c: Tile bodies show formulas as math, highlight labeled code blocks and turn :emoji: shortcodes into emoji, loading each only when a body needs it.
- c83bce3: Tiles open in a new tile viewer, with their metadata, body and place in their collection, through links with a `tile` that anyone can share (mod API 0.1.12).
- d5e5f22: Users can import mosaics from their files into this browser, add mosaics by URL, and update, export and remove them, and the mosaic explorer shows where each mosaic lives.
- ba2feca: The mod viewer runs and checks mods with a relative collection path such as `./samples/tiles/…/collection.yaml`, resolved against the app's address as in a run link.
- f83639c: Mods can show the images, audio and video their tiles link to, from any public site, without a permission; Settings has a Privacy switch to turn it off.
- 6bbee54: Tiles can link images, video and audio whose address has a comma, a semicolon, square brackets or a vertical bar, such as `https://upload.wikimedia.org/…/Human_Acts,_cover.png`.
- d30666f: Mods can declare wildcard hosts such as `https://*.example.org` in the `show`, `connect`, `embed` and `code` permissions.
- 4c12d64: The vanilla pages requirement no longer depends on the pages' wording.
- f850353: The expanded sidebar leaves the main area at least 784px wide, and shows its icon rail on viewports from 768px to 983px, so the stage bar's capsules no longer fold before the sidebar makes room.
- 010e75d: The app's shell works on phones: under 480px the stage bar folds its message buttons into one messages button and moves theater mode and fullscreen into "More actions", taps leave no tooltips behind, highlighted list rows stay readable, and the sidebar scrolls on short screens.
- e82bdaf: In a dark app, a mod's frame no longer flashes light while it opens, even when the browser is busy.
- 14545cc: Mod content fits phones: long words wrap in mod frames, and the default viewers' tables and the book list card adapt to narrow frames.
- 616fb34: The tile viewer keeps its place, Previous and Next when you choose another collection in the stage bar, and mods get the collection they were opened with as `context.collection` (mod API 0.1.17).
- 92215cc: The stage bar's lists sort by mosaics then name, show scores with mosaics' aliases, and get sort, filter, pages for mosaics and remembered tried combinations.
- 2b29ade: The tests no longer depend on the shipped samples; no change to the app.
- 767e0dc: The stage bar's lists show their details on a page opened from a new Details button, with buttons to copy each address or open it in its viewer, and the mod capsule no longer shows the mod's version.
- 3647f15: The sample book list mod shows its books as a grid of covers, with a "Books per row" choice and a card with each book's details and text.
- 08e8d24: The stage bar fits in one row, with counts for errors, warnings and notifications that open their lists, a Share menu, and mods can now send notifications.
- 399a747: The app's header moves into the sidebar, a hidden sidebar keeps its hamburger, the sidebar gets a theme button that cycles System, Light and Dark, the app's canvas is white with floating panels, and Mods, Tiles and Mosaics get new icons.
- ff6a68f: Tile metadata paths starting with `./` or `../`, such as `image: "./cover.jpg"`, reach mods as absolute URLs next to the tile, so images placed beside a tile load.
- fe00318: Mod and collection files use `title` instead of `name`, `sample_collection` becomes `default_mosaic`, mods are checked with their default mosaic or with `mosaics.check`, and stored mod values are kept per mosaic or collection, so values stored before start over (mod API 0.1.14).
- 324d770: The stage bar shows mod + collection -> mosaic as capsules, each with a list to try other combinations, keeps a mosaic's sites when changing its mod, remembers recently used items, and moves Copy link and Reload tiles into a More actions menu.
- dcf57f2: The code rules are split into general principles and project conventions; no change to the app.
- cfa74de: Faster, steadier test suite; no change to the app.
- 0647ed1: The default mods are built from TypeScript in `default_mods/` at the repository's root and ship their own tests; built sites serve them at the same addresses.

## 0.1.0

### Minor Changes

- First versioned release of Teselarium. The Settings page shows the app's version and its mod API version, to copy into a problem report.
