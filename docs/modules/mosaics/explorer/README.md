# Mosaic Explorer

The mosaic explorer is the Explore component for mosaics. It ships as the default mod `mosaic_explorer` in `default_mods/mosaic_explorer/` (see the [default mods folder](../../../../default_mods/README.md)), and the vanilla app's Mosaics section opens it. It lists mosaics, opens the one the user picks, and opens the [mosaic viewer](../viewer/README.md) for it.

It is an ordinary sandboxed mod. It uses only the engine API: `catalog.list` to read the app's catalog, `mosaics.inspect` to read a mosaic file without requesting its mod, its collection or any tile, `mosaics.open` to open a mosaic, and `mods.open` to open the viewer (see [Inspecting and opening mosaics](../../lib/core/engine/README.md#inspecting-and-opening-mosaics)). An instantiation can switch it off, which removes the Mosaics section, or replace it by putting another mod in its folder.

## What it does

- While the mosaics load, its list region ("Mosaics") is busy (`aria-busy="true"`) and says "Loading mosaics…".
- It reads the mosaics of the [app catalog](../../main/README.md#the-app-catalog) with `catalog.list`. For each of them, in catalog order, it sends `mosaics.inspect` and lists the mosaic as a card with its title and its description. A mosaic that cannot be inspected is listed as an alert with its source, the resolved address, and the error message (for example a missing mosaic file and `404`).
- A mod's default mosaic, which the catalog lists while "List the default mosaics of mods" is on (see [Settings](../../main/settings/README.md)), says `Default mosaic of <mod title>` under its title, in a `<small>`, so the card's first paragraph stays its description. The catalog's own mosaics have no such line.
- When the catalog changes (`catalog.changed`, for example when that switch changes), it lists the new catalog's mosaics in place of its list, inspected again, without reloading its frame. The list is busy meanwhile, and the latest catalog wins.
- Each card has two buttons, whose accessible names are "Open <title>" and "View <title>", so a screen reader still names the mosaic:
  - "Open", the card's primary action, sends `mosaics.open` with the mosaic's source: the mosaic's mod opens with its collection, config, aliases and `show` permissions, as the mosaic's link opens it.
  - "View" sends `mods.open` for the mod in its config's `viewer`, with the mosaic's source as the `target` parameter.

  Both open in a new sandbox, and the explorer stays open behind it, so back returns to it as it was left. When a mosaic or the viewer cannot be opened, for example because the viewer is switched off, the error goes to a `role="status"` region and the explorer stays visible.
- It requests no mod, collection or tile: a card holds only the mosaic's own data. The [mosaic viewer](../viewer/README.md) shows the mosaic's mod and collection.

It gets the app's look as the [collection explorer](../../tiles/explorer/README.md) does: each mosaic is an `<article>`, drawn as a card, "Open" a button with `data-ot-variant="primary"` and "View" a plain `<button>`, drawn as an outline button, a failure is a `role="alert"` element, the loading list is `aria-busy`, and the mod's own CSS sets layout only.

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
- The mosaics it lists are the app catalog's, set by the instantiation in `src/main/app_catalog.ts`; the vanilla catalog lists the two sample mosaics of `samples/mosaics/`: the books of the Nobel laureates on the book list, then the laureates on the country map, and none of the mods' default mosaics unless "List the default mosaics of mods" is on. A `mosaics` key in its config is ignored.
- `open` for `"*"`: the explorer inspects and opens mosaics from any site. It is granted because the explorer is served from the app's origin.

## Tests

Its tests ship with it: `default_mods/mosaic_explorer/test/`, built into `test.js` and declared with `test_path`, so checking `mosaic_explorer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They answer `catalog.list` with the fixture mosaics of `default_mods/mosaic_explorer/fixtures/` before mounting the explorer, one of them marked as a default mosaic, and check what it draws, the requests it sends, answering `mosaics.open` and `mods.open` with `null` or leaving `mods.open` unanswered to check that the refusal is shown, and its look. `e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage, the Mosaics section, the links it opens, a switched-off viewer, and that it requests no mod, collection or tile file.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mosaic_explorer` | the explorer, in the Mosaics section |

"Open" on `Nobel laureates on the map` opens `#/run?mosaic=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml`, the country map with the laureates. "View" on it opens `#/run?mod=mosaic_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml`. Both stay in the Mosaics section, also after a reload.
