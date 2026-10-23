# Mod Explorer

The mod explorer is the Explore component for mods. It ships as the default mod `mod_explorer` in `public/default_mods/mod_explorer/`, and it is the vanilla app's home mod: the app opens it for `#/` and for any address that is not a run link.

It is an ordinary sandboxed mod. It uses only the engine API: `mods.inspect` to read each mod's metadata and `mods.open` to open the viewer. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- While the mods load, its list region is busy (`aria-busy="true"`) and says "Loading mods…".
- For each reference in its config's `mods`, in order, it sends `mods.inspect` and lists the mod as a card with its title, its description and a "View <title>" button. A reference that cannot be inspected is listed as an alert with the reference and the error message (for example a missing mod file and `404`).
- When the user selects a mod, it sends `mods.open` for the mod in its config's `viewer`, with the selected mod's source as the `target` parameter. The stage opens the viewer in a new sandbox, and the explorer stays open behind it, so back returns to it as it was left.

## An example of the app's look

Its source, `public/default_mods/mod_explorer/main.js`, is a short example of how a mod gets the app's look from semantic HTML, with no classes and no styling library. Each mod is an `<article>`, which the theme's base stylesheet draws as a card, a failure is a `role="alert"` element, drawn as the app's destructive alert, and the loading list is `aria-busy`. Errors from opening the viewer go to a `role="status"` live region, which draws nothing while it is empty. The mod's own CSS sets layout only: the card grid and the button's place in the card. See "Write HTML, get the app's look" in the [theme module](../../lib/core/theme/README.md).

## Config

`public/default_mods/mod_explorer/mod_conf.yaml`:

```yaml
mod:
  name: "mod_explorer"
  title: "Mods"
  version: "0.1.0"
  description: "Lists mods and opens them in the mod viewer."
  entrypoint: "./main.js"
  config:
    viewer: "mod_viewer"
    mods:
      - "./samples/mods/book_list"
  permissions:
    open:
      - host: "*"
        reason: "Opens the mods you pick"
```

- `viewer`: the mod reference opened for a selected mod. `mod_viewer` is the default mod name of the viewer.
- `mods`: the mod references to list. Relative references are resolved against the app's address.
- `open` for `"*"`: the explorer inspects and opens mods from any site. It is granted because the explorer is served from the app's origin.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/` or `https://example.org/#/` | the explorer, as home mod (no close button) |
| `https://example.org/#/run?mod=mod_explorer` | the explorer, opened from a link (with a close button) |

Selecting `Book List` opens `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml`.
