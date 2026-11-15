# Collection Explorer and Collection Viewer

The collection explorer is the Explore component for tiles, and the collection viewer its Viewer component. They ship as the default mods `collection_explorer` in `default_mods/collection_explorer/` and `collection_viewer` in `default_mods/collection_viewer/` (see the [default mods folder](../../../../default_mods/README.md)), and the vanilla app's Tiles section opens the explorer.

Both are ordinary sandboxed mods. They use only the engine API: `collections.inspect` to read a collection's file without loading its tiles (see [Inspecting collections](../../lib/core/engine/README.md#inspecting-collections)), and, for the explorer, `mods.open` to open the viewer. An instantiation can switch them off or replace them by putting another mod in their folder. Tiles do not open yet: the viewer lists a collection's tiles, and selecting one does nothing.

## Collection explorer

### What it does

- While the collections load, its list region ("Collections") is busy (`aria-busy="true"`) and says "Loading collections…".
- For each location in its config's `collections`, in order, it sends `collections.inspect` and lists the collection as a card with its name, its description, its number of tiles (such as "17 tiles") and a "View" button, whose accessible name is "View <name>" so a screen reader still names the collection. A location that cannot be inspected is listed as an alert with the location and the error message (for example a missing collection file and `404`).
- When the user selects a collection, it sends `mods.open` for the mod in its config's `viewer`, with the collection's source as the `target` parameter. The stage opens the viewer in a new sandbox, and the explorer stays open behind it, so back returns to it as it was left. When the viewer cannot be opened, for example because it is switched off, the error goes to a `role="status"` region and the explorer stays visible.
- It never requests a tile: the number of tiles is the length of the index's `tiles`.

It gets the app's look as the [mod explorer](../../mods/explorer/README.md) does: each collection is an `<article>`, drawn as a card, a failure is a `role="alert"` element, the loading list is `aria-busy`, and the mod's own CSS sets layout only.

### Config

`default_mods/collection_explorer/mod_conf.yaml`:

```yaml
mod:
  name: "collection_explorer"
  title: "Tiles"
  version: "0.1.0"
  api: "^0.1.0"
  description: "Lists tile collections and opens them in the collection viewer."
  entrypoint: "./main.js"
  test_path: "./test.js"
  config:
    viewer: "collection_viewer"
    collections:
      - "./samples/tiles/literature_nobel_laureates/collection.yaml"
      - "./samples/tiles/literature_nobel_laureates_books/collection.yaml"
  permissions:
    open:
      - host: "*"
        reason: "Lists the collections of its config and opens the one you pick"
```

- `viewer`: the mod reference opened for a selected collection. `collection_viewer` is the default mod name of the viewer, and the default when the config names none.
- `collections`: the collection locations to list. Relative locations are resolved against the app's address. The vanilla config lists the two sample collections of `samples/tiles/`: the Nobel Prize in Literature laureates, then their books. It lists no sample collection of a mod.
- `open` for `"*"`: the explorer inspects collections and opens the viewer from any site. It is granted because the explorer is served from the app's origin.

## Collection viewer

### What it does

- It reads its `target` parameter. Without one, or with an empty one, it says "No collection was given." and sends nothing.
- Otherwise it sends `collections.inspect` with the target, and shows "Loading the collection…" as `aria-busy` meanwhile. When the collection cannot be inspected, for any reason, it shows the error message as an alert: a missing file names the address and `404`, a file without a `tiles` list says that `tiles` must be a list, and a site that refuses the app says that the site may be unreachable or may not allow this app to read its files.
- It shows the collection as a card, an `<article>` with the name as its heading, the description and the source.
- When the collection has entry issues, an "Entry issues" section lists each one with its level as a badge (`destructive` for an error, `warning` for a warning), its message and its source. There is no such section when there are none.
- A "Tiles" section lists the tiles, in entry order, as a table in a card (an `<article>`): the theme gives the rows their separators and a highlight on hover. The "Tile" column holds each tile's label, the file name of its address, decoded (`caf%C3%A9.md` is labeled `café.md`; a name that is not valid percent-encoding is kept as it is), and the "Address" column its full address, in muted text. When two tiles share a file name, each is labeled by its parent folder and file name (`a/index.md`, `b/index.md`). The rare labels that still clash are kept: the addresses tell them apart.
- A "Filter by file name" search field, at most 24rem wide, shows only the tiles whose label holds the typed text, ignoring letter case. It matches the label, the file name (with its folder when two tiles share one), not the address, which most tiles of a collection share up to the file name. A muted line under it, outside the card, says how many are shown, such as "Showing 2 of 17 tiles". The line is `aria-live="polite"`, so screen readers announce it, rather than `role="status"`, which the theme draws as a box. Hidden rows get the `hidden` attribute. An empty filter shows every tile. The field is outside any form, since the mod's sandbox does not allow forms.
- It never requests a tile, and selecting a tile does nothing.

Its labels and its filter are pure modules, `src/tile_labels.ts` and `src/tile_filter.ts`, which its test cases call directly. Its own CSS sets layout only.

### Config and permission

`default_mods/collection_viewer/mod_conf.yaml` has no config: what it shows comes from its `target` parameter. It declares `open` for `"*"`, with the reason "Shows the collection you are viewing", so it can inspect a collection from any site.

## Tests

The tests of both mods ship with them, in `test/`, built into `test.js` and declared with `test_path`, so checking `collection_explorer` or `collection_viewer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They mount the mod with the fixture collections of its `fixtures/` folder and check what it draws, the requests it sends and its look. `e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage, the links they open, a site that refuses the app, and that no tile is requested.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=collection_explorer` | the explorer, in the Tiles section |
| `https://example.org/#/run?mod=collection_viewer&target=./samples/tiles/literature_nobel_laureates/collection.yaml` | the viewer, showing the sample collection of Nobel laureates |
| `https://example.org/#/run?mod=collection_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml` | the same collection, by its source (what the explorer opens) |
| `https://example.org/#/run?mod=collection_viewer` | "No collection was given." |

Selecting `Nobel Prize in Literature laureates` in the explorer opens `#/run?mod=collection_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml`. A viewer the explorer opened stays in the Tiles section, also after a reload. A viewer link that is shared and opened on its own was opened by no section's mod, so it is in no section, and no sidebar item is current.
