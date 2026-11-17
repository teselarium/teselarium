# Mosaic Viewer

The mosaic viewer is the Viewer component for mosaics. It ships as the default mod `mosaic_viewer` in `default_mods/mosaic_viewer/` (see the [default mods folder](../../../../default_mods/README.md)), and the [mosaic explorer](../explorer/README.md) opens it. It shows a mosaic with its mod and its collection, opens it, and checks it.

It is an ordinary sandboxed mod. It uses only the engine API: `mosaics.inspect` to read the mosaic file, `mods.inspect` and `collections.inspect` to read its mod and its collection without running or loading them, `mosaics.open` to open it, `mosaics.check` to check it, and `mods.open` to open the mod viewer and the collection viewer. It never requests a tile. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- It reads the mosaic reference in its `target` link parameter. Without one, or with an empty one, it says "No mosaic was given.", sends nothing and has no buttons.
- Otherwise it sends `mosaics.inspect` for the target. When the mosaic cannot be inspected, for any reason, it shows the error message as an alert: a missing file names `404`, a mosaic file without a title says that `"title"` must be a non-empty string.
- It shows the mosaic, in this order:
  - a card, an `<article>`, with its title as the heading, its description and its source;
  - "Mod": the mod's title, as a button, its version as a badge, and its API range with a badge saying whether it matches the app's mod API version ("matches", or "does not match" followed by the app's mod API version), as the [mod viewer](../../mods/viewer/README.md) shows them;
  - "Collection": the collection's title, as a button, and its number of tiles, such as "17 tiles", or "This mosaic has no collection.";
  - "Config": the mosaic's own config overrides as indented `key: value` lines, or "(none)";
  - "Aliases": a `field ← name, name` line for each field of the mod's tile type that the mosaic renames, such as `title ← name`, or "(none)";
  - "Permissions": a table of the mosaic's `show` lines, with each one's category, host, reason and a badge saying whether it would be granted ("granted" or "not granted"), or "(none)".
- After the mosaic card is shown, it sends `mods.inspect` for the mosaic's mod and `collections.inspect` for its collection, in parallel. Each section says it is loading meanwhile (`aria-busy`). A mod or collection that cannot be inspected is shown as an alert inside its own section, with its address and the error message, and the rest of the mosaic is still shown.
- Activating the mod's title sends `mods.open` for the mod in its config's `mod_viewer`, with the mod's source as `target`. Activating the collection's title sends `mods.open` for the mod in its config's `collection_viewer`, with the collection's source as `target`.
- "Open mosaic", the page's primary action, sends `mosaics.open` with the mosaic's source: the mosaic's mod opens with its collection, config, aliases and `show` permissions.
- "Check mosaic" sends `mosaics.check` with the mosaic's source. While the check runs, the button is disabled and a `role="status"` message says "Checking <title>…". The report then replaces it, as the mod viewer shows a mod's: a "Check report" section whose heading says "Check passed", "Check passed with warnings" or "Check failed" with the status as a badge, a notice when a bundle error kept the mod from being mounted, and the findings, one list item each with its level as a badge, its step, its message and its source, or "No findings.". It has no "Tests" list, since a mosaic check does not run the mod's tests (see [Checking a mosaic](../README.md#checking-a-mosaic)). A failed request shows the error as an alert, and the button is enabled again.

What it opens opens in a new sandbox, and the viewer stays open behind it, so back returns to it as it was left. The viewer stays the visible mod while it checks: the check runs in hidden frames. A refused open or check is shown as an alert under the actions.

The report is drawn by `src/check_report.ts`, a copy of the mod viewer's report rendering without its tests list: a default mod cannot import another mod's files. Keep the two copies alike: the mod viewer's [README](../../mods/viewer/README.md) points back here, and the e2e checks of both viewers assert the same status headings and finding badges.

## An example of the app's look

Its TypeScript source, in `default_mods/mosaic_viewer/src/`, gets the app's look from semantic HTML as the mod viewer does:

- the mosaic is an `<article>`, drawn as a card, and the permissions a plain `<table>`;
- the mod's version, the API range's match, the permission statuses, the check status and the findings' levels are badges: `<span>`s with `data-ot-variant`;
- the mod's and the collection's titles are buttons with `data-ot-variant="ghost"`, "Open mosaic" a `<button type="submit">`, drawn as the primary button, and "Check mosaic" a plain `<button>`, drawn as an outline button, so the page has one primary action;
- errors and notices are `role="alert"` and `role="status"` elements.

The mod's own CSS sets layout only. The frame has no `allow-forms`, so its form is never submitted: "Open mosaic" handles its click and calls `preventDefault()`. See "Write HTML, get the app's look" in the [theme module](../../lib/core/theme/README.md).

## Config

`default_mods/mosaic_viewer/mod_conf.yaml`:

```yaml
mod:
  title: "Mosaic Viewer"
  version: "0.1.0"
  api: "^0.1.0"
  description: "Shows a mosaic's mod, collection, config, aliases and permissions, opens it and checks it."
  entrypoint: "./main.js"
  test_path: "./test.js"
  config:
    mod_viewer: "mod_viewer"
    collection_viewer: "collection_viewer"
  permissions:
    open:
      - host: "*"
        reason: "Reads the mosaic you are viewing, its mod and its collection, and opens them"
```

- `mod_viewer` and `collection_viewer`: the mod references opened by the mod's and the collection's titles. They are also the defaults when the config names none. What the viewer shows comes from its `target` parameter.
- `open` for `"*"`: the viewer inspects a mosaic, its mod and its collection, and opens them, from any site, since `mosaics.inspect`, `mods.inspect`, `collections.inspect`, `mosaics.open`, `mosaics.check` and `mods.open` are all checked against `open`. It is granted because the viewer is served from the app's origin.

## Tests

Its tests ship with it: `default_mods/mosaic_viewer/test/`, built into `test.js` and declared with `test_path`, so checking `mosaic_viewer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They mount the viewer with the fixture mosaics of `default_mods/mosaic_viewer/fixtures/`, whose mod, `fixture_mod/`, and collection, `fixture_collection.yaml`, are fixtures next to them, so the cases pass without `samples/`. They check what it draws, the requests it sends, answering `mods.open` and `mosaics.open` with `null`, and its look. A case cannot answer `mosaics.check`, so "Check mosaic" in a case is refused with `-32002`: the case checks that the error is shown and that the button is enabled again.

`e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage, the links it opens, the sample mosaics it shows, and a real "Check mosaic" of a mosaic whose alias names a field the mod's tile type does not declare. `e2e/sample_mosaics.spec.ts` checks each sample mosaic in the viewer.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mosaic_viewer&target=./samples/mosaics/nobel_laureates_map.yaml` | the sample mosaic of the laureates on the country map |
| `https://example.org/#/run?mod=mosaic_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml` | the same mosaic, by its source (what the explorer opens) |
| `https://example.org/#/run?mod=mosaic_viewer` | "No mosaic was given." |

On the laureates' map, "Open mosaic" opens `#/run?mosaic=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml`. `Country Map` opens `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fcountry_map%2Fmod_conf.yaml`, and `Nobel Prize in Literature laureates` opens `#/run?mod=collection_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml`.
