# Tile Viewer

The tile viewer is the Viewer component for tiles. It ships as the default mod `tile_viewer` in `default_mods/tile_viewer/` (see the [default mods folder](../../../../default_mods/README.md)). It shows one tile: its heading, its source, its metadata and its body, and, when it is opened from a collection, its place in that collection, with the previous and next tiles.

It is an ordinary sandboxed mod. It uses only the engine API: the tile reaches it as the tiles of its mount context, from the run link's `tile` or the first tile of its `collection` (see [Run links](../../lib/core/stage/README.md#run-links) in the stage module), `collections.inspect` reads its collection, `mods.open` opens other views, and `ui.notify` warns about a collection it cannot read. It has no tile type, so any text file opens: without frontmatter, the whole text is the body. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- It shows the first tile it receives. Without one, it says "No tile was given."
- The tile is one card: an `<article>` with a heading and the tile's source in muted text, then, after a separator (`<hr>`), its metadata and, after another separator, its body. The heading is the tile's `title` when it is a non-empty string, and otherwise the file name of its source, decoded (`caf%C3%A9.md` is headed `café.md`).
- The metadata, in a `<section aria-label="Metadata">`, is a description list in frontmatter order, laid out in two columns: the keys on the left, at most 40% of the card's width, and each value beside its key. A value that is not a list or a mapping is shown as written (`156`, `true`) on its key's row. A list is a list without bullets, one item per line in the value column. A mapping is a nested description list, laid out the same way in the value column. A file without metadata says "This file has no metadata."
- The metadata has a small "Metadata" heading (an `<h2>` holding `<small>`, the theme's muted, smaller text). Long metadata starts collapsed, in 6 lines, with a button next to the heading, "Show all <n> fields", that shows every field, then "Show fewer fields". The button is the theme's outline button, so its border and the page background show it is a button without a pointer over it, and it is no taller than the heading. Lines are counted from the values (`src/metadata_lines.ts`): a single value takes 1 line, an image address 2, a list or a mapping the lines of its items or values, and an empty one 1. Collapsed, the fields show in order while they fit, and the fields after the first that does not fit are hidden. A list that does not fit shows its first items that fit and a muted line such as "and 14 more", which counts as one of the 6 lines. The first field always shows, a list with at least its first item. Metadata that fits in 6 lines has no button. Each viewer starts collapsed, also after Previous or Next. Collapsing sets `hidden` on whole fields and list items, so hidden links leave the tab order; the button has `aria-expanded` and `aria-controls`. A long text that wraps takes more lines than it counts.
- Each metadata string that is an absolute `http:` or `https:` address is a link with `data-tes-link`, so following it asks the user to open it in a new tab, as for a link of a body. When the address's path ends with `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif` or `.svg`, in any letter case and without its query or fragment, the link also shows a thumbnail of the image, two lines of text high, before the address, loaded lazily. A thumbnail that fails to load is hidden, and the link stays.
- The body is drawn by `<tes-tile-body>` at the end of the card (see [Tile bodies](../../lib/core/engine/README.md#tile-bodies) in the engine module). An empty body draws neither the separator nor a body.

### Its place in a collection

The viewer's collection is the one it was opened with, `context.collection` (see [Mount context](../../lib/core/engine/README.md#mount-context) in the engine module), and otherwise the optional `from` parameter, the address of a collection. With a collection in the mount context, `from` is ignored: choosing another collection in the stage bar keeps the link's params, so a `from` kept from the previous link is stale. The collection is decided once, when the viewer mounts, and the breadcrumb, Previous and Next, the collection's title, the warning below and the `from` of linked tiles all use it. Without either, the viewer has no collection. Opened from its default mosaic, the viewer's collection is the mosaic's.

The viewer inspects its collection with `collections.inspect`, which requests no tile, also when the collection came from the mount context: the mount context's tiles leave out tiles that failed to load, so counting them could give another position than the collection viewer shows. When the collection lists the tile's source, a breadcrumb, `<nav aria-label="Collection">`, shows above the card:

- the collection's title, a button that opens the collection viewer named in the config's `collection_viewer`, with the collection's address as its `target`, in a new sandbox;
- the tile's position, such as `3 of 16`, as plain text;
- Previous and Next, which send `mods.open` for the mod named in the config's `tile_viewer`, with the neighbouring tile as `tile`, the collection's address as `from` and `replace: true`. The new viewer takes the place of this one in the same history entry, so stepping through a collection turns pages instead of adding entries and frames, and back returns to what was shown before the first tile (see [Replacing a sandbox](../../lib/core/stage/README.md#replacing-a-sandbox) in the stage module). Previous is disabled on the first tile and Next on the last: the list does not wrap around.

When the collection does not list the tile, the tile is shown without a breadcrumb. When the collection cannot be inspected, the tile is still shown, and the viewer sends `ui.notify` with level `"warning"`, the collection's address as `source` and a message that gives the reason, so the stage bar lists it as a warning from the mod.

### Links to tiles

A click on a link of the metadata or of the body whose address's path ends with `.md`, in any letter case (`https://example.org/a.md?raw=1` is one, `https://example.org/readme.md.html` is not), is cancelled and sends `mods.open` for the mod named in the config's `tile_viewer`, with the link's address as `tile`, in a new sandbox. Following a link is navigation, so back returns to this viewer. The request carries the address of this viewer's collection, the one it was opened with or else `from`, as `from` only when the inspected collection lists the linked tile; until the inspection settles, it carries none. The viewer listens on `document`, so it runs before the frame loader's listener on `window`, which leaves a cancelled click alone (see [Tile bodies](../../lib/core/engine/README.md#tile-bodies)). Other links are left to the frame loader.

The errors of `mods.open`, such as `-32003` for a switched-off viewer, are shown in a `role="status"` region under the body, which stays empty until an error, since the theme draws a non-empty `role="status"` as an alert box.

## An example of the app's look

Its TypeScript source, in `default_mods/tile_viewer/src/`, gets the app's look from semantic HTML, with no classes:

- the tile is an `<article>`, drawn as a card, the metadata a `<dl>`, its heading muted `<small>` text, and the separators around the metadata `<hr>`s;
- the metadata's button is a plain `<button>`, the theme's outline button, kept no taller than its heading by layout-only CSS (a smaller minimum height and padding);
- Next is the primary action (`data-tes-variant="primary"`), Previous an outline button, and the collection's title a ghost button;
- the errors of opening another view are a `role="status"` element.

The mod's own CSS sets layout only: the metadata's two columns are a grid, and its lists drop their bullets. These rules are scoped to the metadata section, so they never reach the rendered body in the same card. No rule that sets `display` matches a `[hidden]` element, so a hidden thumbnail stays hidden. See "Write HTML, get the app's look" in the [theme module](../../lib/core/theme/README.md).

## Config

`default_mods/tile_viewer/mod_conf.yaml`:

```yaml
mod:
  title: "Tile Viewer"
  version: "0.1.0"
  api: "^0.2.0"
  description: "Shows a tile's metadata and body and, when it is opened from a collection, its place in it, with the previous and next tiles."
  entrypoint: "./main.js"
  test_path: "./test.js"
  default_mosaic: "./mosaic.yaml"
  config:
    tile_viewer: "tile_viewer"
    collection_viewer: "collection_viewer"
  permissions:
    open:
      - host: "*"
        reason: "Shows the collection of the tile you are viewing and opens the tiles and collections you pick"
```

- `tile_viewer` is the mod that linked tiles and the previous and next tiles open in, and `collection_viewer` the mod the collection's title opens. Naming them in the config keeps the links short (`mod=tile_viewer`), so a typed link equals the one the viewer opens, and lets an instantiation point to other viewers.
- `open` for `"*"` lets the viewer inspect collections and open mods for any site, since `collections.inspect` and `mods.open` are both checked against `open`. It is granted because the viewer is served from the app's origin.
- `default_mosaic` is `mosaic.yaml`, next to the mod file, whose `mod` is `"./"` and whose collection is the viewer's fixture collection, `./fixtures/tiles_collection.yaml`. It is there for its tests: a check without a collection takes its tiles from the default mosaic, and `tiles.renderBody` renders only the tiles of the check's collection, so the cases can render a body only for these. "Open default mosaic" in the mod viewer opens the viewer on its first fixture tile, with its place in the fixture collection: the breadcrumb shows `Viewer tiles` and `1 of 3`.

## Tests

Its tests ship with it: `default_mods/tile_viewer/test/`, built into `test.js` and declared with `test_path`, so checking `tile_viewer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). The check's tiles are the fixture tiles of `default_mods/tile_viewer/fixtures/`, and the cases name the fixture collection, `./default_mods/tile_viewer/fixtures/tiles_collection.yaml`, as `from`. The check runs with the default mosaic, so its cases would get the fixture collection as `context.collection`: the cases about `from` mount with `collection: null`, so their place comes from `from` alone, and the cases about the opening collection mount with the fixture collection as `collection`, one of them with a stale `from`, `fixtures/stale_collection.yaml`, which lists two fixture tiles in another order. They cover the heading, the metadata with nested values, links and thumbnails, a file without metadata, the body, no tile, the place in the collection with Previous and Next, the place in the collection it was opened with and a stale `from` next to it, a tile not in `from`, a `from` that cannot be read, links to tiles, and the look. The tiles a case builds itself have an empty body, so the viewer sends no `tiles.renderBody` for them. The heading, address and line budget cases call the pure modules, `tile_heading.ts`, `metadata_addresses.ts` and `metadata_lines.ts`, directly. `e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage, real image loads and the links the viewer opens.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=tile_viewer&tile=./samples/tiles/literature_nobel_laureates/2013__alice_munro.md` | the tile of Alice Munro, without a place in a collection |
| `https://example.org/#/run?mod=tile_viewer&tile=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2F2013__alice_munro.md&from=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml` | the same tile as `4 of 17` in the Nobel laureates collection (what the collection viewer opens) |
| `https://example.org/#/run?mod=tile_viewer` | "No tile was given." |

Next on the second link replaces the viewer with `#/run?mod=tile_viewer&tile=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2F2014__patrick_modiano.md&from=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml`.
