# Mod Viewer

The mod viewer is the Viewer component for mods. It ships as the default mod `mod_viewer` in `public/default_mods/mod_viewer/`. It shows a mod's metadata without running it, and runs it with or without tiles.

It is an ordinary sandboxed mod. It uses only the engine API: `mods.inspect` to read the mod's metadata and `mods.open` to run it. It needs no collection and has no tile type. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- It reads the mod reference in its `target` link parameter. Without one, it says "No mod was given."
- It sends `mods.inspect` for the target and shows the title with the version as a badge, then a card with the metadata: description, name, source, tile type, sample collection, the config as indented `key: value` lines, and a table of the declared permissions with each one's category, host, reason and a badge saying whether it would be granted ("granted" or "not granted"). When the mod cannot be inspected, it shows the error message as an alert.
- It offers three ways to run the mod, each a `mods.open` with the mod's source as `mod`:
  - "Run with sample tiles", only when the mod declares a `sample_collection`: with that collection. It is the page's primary action.
  - A collection address field with "Run with this collection" (or Enter): with the typed collection. An address that is not a full URL marks the field invalid and shows an alert instead.
  - "Run without tiles": with no collection.

The mod opens in a new sandbox, and the viewer stays open behind it, so back returns to it as it was left.

## An example of the app's look

Its source, `public/default_mods/mod_viewer/main.js`, is a short example of how a mod gets the app's look from semantic HTML, with no classes and no styling library:

- the metadata is an `<article>`, drawn as a card, and the permissions a plain `<table>`;
- the version and the permission statuses are badges: `<span>`s with `data-ot-variant` (`secondary`, `success`, `outline`);
- "Run with sample tiles" is a `<button type="submit">`, drawn as the primary button, and "Run with this collection" a submit button with `data-ot-variant="outline"`, so the page has one primary action;
- an invalid address sets `aria-invalid="true"` on the field, and errors and notices are `role="alert"` and `role="status"` elements.

The mod's own CSS sets layout only. The frame has no `allow-forms`, so its forms are never submitted: the submit buttons handle their clicks and call `preventDefault()`, and Enter in the address field still clicks the form's submit button. See "Write HTML, get the app's look" in the [theme module](../../lib/core/theme/README.md).

## Config

`public/default_mods/mod_viewer/mod_conf.yaml`:

```yaml
mod:
  name: "mod_viewer"
  title: "Mod Viewer"
  version: "0.1.0"
  description: "Shows a mod's metadata and runs it with or without tiles."
  entrypoint: "./main.js"
  permissions:
    open:
      - host: "*"
        reason: "Runs the mod you are viewing"
```

`open` for `"*"` lets the viewer inspect and run mods from any site. It is granted because the viewer is served from the app's origin.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mod_viewer&target=./samples/mods/book_list` | the sample book list mod |
| `https://example.org/#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` | the same mod, by its source (what the explorer opens) |
| `https://example.org/#/run?mod=mod_viewer` | "No mod was given." |

"Run with sample tiles" on the sample mod opens `#/run?mod=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml&collection=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fbooks_collection.yaml`.
