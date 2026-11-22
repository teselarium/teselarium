# Mosaic Explorer

The mosaic explorer is the Explore component for mosaics. It ships as the default mod `mosaic_explorer` in `default_mods/mosaic_explorer/` (see the [default mods folder](../../../../default_mods/README.md)), and the vanilla app's Mosaics section opens it. It lists mosaics, opens the one the user picks, and opens the [mosaic viewer](../viewer/README.md) for it.

It is an ordinary sandboxed mod. It uses only the engine API: `catalog.list` to read the catalog, `mosaics.inspect` to read a mosaic file without requesting its mod, its collection or any tile, `mosaics.open` to open a mosaic, `mods.open` to open the viewer, `userCatalog.import` and `userCatalog.add` to ask the app's dialogs that import mosaics and add one by URL, `userCatalog.export` to export a stored mosaic, and `files.save` to download any other (see [Inspecting and opening mosaics](../../lib/core/engine/README.md#inspecting-and-opening-mosaics)). An instantiation can switch it off, which removes the Mosaics section, or replace it by putting another mod in its folder.

## What it does

- While the mosaics load, its list region ("Mosaics") is busy (`aria-busy="true"`) and says "Loading mosaics…".
- It reads the mosaics of the [catalog](../../main/README.md#the-instance-catalog) with `catalog.list`. For each of them, in catalog order, it sends `mosaics.inspect` and lists the mosaic as a card with its title and its description. A mosaic that cannot be inspected is listed as an alert with its source, the resolved address, and the error message (for example a missing mosaic file and `404`).
- After its title, each card has a badge for where the mosaic's file lives, from the catalog entry's `place`: "Browser", a secondary badge, for a mosaic stored in this browser, or "Remote", an outline badge, for any other. The title wraps, and the badge stays beside it or goes under it, so a card never scrolls sideways on a phone.
- A mod's default mosaic, which the catalog lists while "List the default mosaics of mods" is on (see [Settings](../../main/settings/README.md)), says `Default mosaic of <mod title>` under its title, in a `<small>`, so the card's first paragraph stays its description. A mosaic the user added (`listedBy: "user"`) says `Added by you` there instead, followed, for a stored mosaic whose provenance says `changedSinceExport`, by "Unexported changes", a warning badge whose text has a contrast of at least 4.5:1 with the card in both color schemes. The instance catalog's mosaics have no such line.
- Above the list, "Import…" sends `userCatalog.import` and "Add by URL…" sends `userCatalog.add` with no params, both outline buttons, at least 32px tall, which wrap on a narrow frame. The app draws the dialogs and stores the mosaics (see [The user catalog](../../main/README.md#the-user-catalog)); the explorer then lists the new catalog when it receives `catalog.changed`, with no reload. A refusal, such as `-32002` for a hidden explorer, is shown in its `role="status"` region.
- When the catalog changes (`catalog.changed`, for example when that switch changes), it lists the new catalog's mosaics in place of its list, inspected again, without reloading its frame. The list is busy meanwhile, and the latest catalog wins.
- Each card has "Open", "View", and "Export" for a stored mosaic or "Download" for any other, whose accessible names are "Open <title>", "View <title>", "Export <title>" and "Download <title>", so a screen reader still names the mosaic:
  - "Open", the card's primary action, sends `mosaics.open` with the mosaic's source: the mosaic's mod opens with its collection, config, aliases and `show` permissions, as the mosaic's link opens it.
  - "View" sends `mods.open` for the mod in its config's `viewer`, with the mosaic's source as the `target` parameter.
  - "Export", only for a mosaic stored in this browser and whether or not it has unexported changes, as in the viewer, sends `userCatalog.export` with the mosaic's source. The app asks before it downloads the file, and the export clears the card's "Unexported changes" when the explorer receives `catalog.changed`. A refusal is shown in the `role="status"` region.
  - "Download", for a remote, instance or default mosaic, sends `files.save` with the text `mosaics.inspect` answered as `content`, unchanged, typed `application/yaml` and named after the last segment of the mosaic's address, decoded, or `mosaic.yaml` when that segment is not a file name (`mosaic_file_name.ts`). The app asks before it downloads the file. Nothing is synced: a remote file has no unexported changes. A refusal is shown in the `role="status"` region.

  Both open in a new sandbox, and the explorer stays open behind it, so back returns to it as it was left. When a mosaic or the viewer cannot be opened, for example because the viewer is switched off, the error goes to a `role="status"` region and the explorer stays visible.
- It requests no mod, collection or tile: a card holds only the mosaic's own data. The [mosaic viewer](../viewer/README.md) shows the mosaic's mod and collection.

It gets the app's look as the [collection explorer](../../tiles/explorer/README.md) does: each mosaic is an `<article>`, drawn as a card, "Open" a button with `data-ot-variant="primary"` and "View", "Export" and "Download" plain `<button>`s, drawn as outline buttons, a failure is a `role="alert"` element, the loading list is `aria-busy`, and the mod's own CSS sets layout only.

## Config

`default_mods/mosaic_explorer/mod_conf.yaml`:

```yaml
mod:
  title: "Mosaics"
  version: "0.1.0"
  api: "^0.1.0"
  description: "Lists mosaics, opens them, and opens them in the mosaic viewer."
  entrypoint: "./main.js"
  test_path: "./test.js"
  config:
    viewer: "mosaic_viewer"
  permissions:
    open:
      - host: "*"
        reason: "Lists the app's mosaics and opens the one you pick"
```

- `viewer`: the mod reference opened by "View". `mosaic_viewer` is the default mod name of the viewer, and the default when the config names none.
- The mosaics it lists are the catalog's, whose lists the instantiation sets in the instance catalog (`src/main/instance_catalog.ts`); the vanilla instance catalog lists the two sample mosaics of `samples/mosaics/`: the books of the Nobel laureates on the book list, then the laureates on the country map, and none of the mods' default mosaics unless "List the default mosaics of mods" is on. A `mosaics` key in its config is ignored.
- `open` for `"*"`: the explorer inspects and opens mosaics from any site. It is granted because the explorer is served from the app's origin.

## Tests

Its tests ship with it: `default_mods/mosaic_explorer/test/`, built into `test.js` and declared with `test_path`, so checking `mosaic_explorer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They answer `catalog.list` with the fixture mosaics of `default_mods/mosaic_explorer/fixtures/` before mounting the explorer, one of them marked as a default mosaic, and one marked `place: "browser"` with a `provenance`, which stands for a stored mosaic, so no case needs a store, and check what it draws, the requests it sends, answering `mosaics.open` and `mods.open` with `null` or leaving `mods.open` unanswered to check that the refusal is shown, answering `userCatalog.import` with `true`, `userCatalog.add` with `false`, `userCatalog.export` with `true` and `files.save` with `true` and `false`, the downloaded file's name, and its look. `e2e/default_mods.spec.ts` also imports a mosaic through "Import…" and checks it is listed with "Browser" without a reload, the badges and buttons on a 360×740 phone, including a stored card's three buttons, "Export" from a saved copy's card with its download, "Download" from a sample's card with exactly the served text, and the place badges' contrast in the light and the dark color scheme. `e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage, the Mosaics section, the links it opens, a switched-off viewer, and that it requests no mod, collection or tile file.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mosaic_explorer` | the explorer, in the Mosaics section |

"Open" on `Nobel laureates on the map` opens `#/run?mosaic=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml`, the country map with the laureates. "View" on it opens `#/run?mod=mosaic_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml`. Both stay in the Mosaics section, also after a reload.
