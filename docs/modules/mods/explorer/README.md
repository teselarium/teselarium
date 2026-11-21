# Mod Explorer

The mod explorer is the Explore component for mods. It ships as the default mod `mod_explorer` in `default_mods/mod_explorer/` (see the [default mods folder](../../../../default_mods/README.md)), and the vanilla app's Mods section opens it. An instantiation can also make it the Home mod, shown at `#/`, by giving the Home section its link (see the [section registry](../../main/README.md#home-a-page-or-a-mod)).

It is an ordinary sandboxed mod. It uses only the engine API: `catalog.list` to read the catalog, `mods.inspect` to read each mod's metadata and `mods.open` to open the viewer. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- While the mods load, its list region is busy (`aria-busy="true"`) and says "Loading mods…".
- It reads the mods of the [catalog](../../main/README.md#the-instance-catalog) with `catalog.list`. For each of them, in catalog order, it sends `mods.inspect` and lists the mod as a card with its title, its description and a "View" button, whose accessible name is "View <title>" so a screen reader still names the mod. A mod that cannot be inspected is listed as an alert with its source, the resolved address, and the error message (for example a missing mod file and `404`).
- When the catalog changes (`catalog.changed`, see [Reading the catalog](../../lib/core/engine/README.md#reading-the-catalog)), it lists the new catalog's mods in place of its list, inspected again, without reloading its frame. The list is busy meanwhile, and the latest catalog wins.
- When the user selects a mod, it sends `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter. The stage opens the viewer in a new sandbox, and the explorer stays open behind it, so back returns to it as it was left.

## An example of the app's look

Its TypeScript source, in `default_mods/mod_explorer/src/`, is a short example of how a mod gets the app's look from semantic HTML, with no classes and no styling library. Each mod is an `<article>`, which the theme's base stylesheet draws as a card, a failure is a `role="alert"` element, drawn as the app's destructive alert, and the loading list is `aria-busy`. Errors from opening the viewer go to a `role="status"` live region, which draws nothing while it is empty. The mod's own CSS sets layout only: the card grid and the button's place in the card. See "Write HTML, get the app's look" in the [theme module](../../lib/core/theme/README.md).

## Config

`default_mods/mod_explorer/mod_conf.yaml`:

```yaml
mod:
  title: "Mods"
  version: "0.1.0"
  api: "^0.1.0"
  description: "Lists mods and opens them in the mod viewer."
  entrypoint: "./main.js"
  test_path: "./test.js"
  config:
    viewer: "mod_viewer"
  permissions:
    open:
      - host: "*"
        reason: "Opens the mods you pick"
```

- `viewer`: the mod reference opened for a selected mod. `mod_viewer` is the default mod name of the viewer.
- The mods it lists are the catalog's, whose lists the instantiation sets in the instance catalog (`src/main/instance_catalog.ts`); the vanilla instance catalog lists the three sample mods: the book list, the flashcards mod and the country map. A `mods` key in its config is ignored.
- `open` for `"*"`: the explorer inspects and opens mods from any site. It is granted because the explorer is served from the app's origin.

## Tests

Its tests ship with it: `default_mods/mod_explorer/test/`, built into `test.js` and declared with `test_path`, so checking `mod_explorer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They answer `catalog.list` with the fixture mods of `default_mods/mod_explorer/fixtures/` before mounting the explorer, so they never depend on the catalog, and check what it draws, the requests it sends and its look. `e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage and the links it opens.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mod_explorer` | the explorer, in the Mods section (with a close button) |
| `https://example.org/#/`, when the Home section's target is the explorer | the explorer, as the Home mod (no close button) |

Selecting `Book List` opens `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml`.
