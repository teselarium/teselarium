# Mod Viewer

The mod viewer is the Viewer component for mods. It ships as the default mod `mod_viewer` in `default_mods/mod_viewer/` (see the [default mods folder](../../../../default_mods/README.md)). It shows a mod's metadata without running it, runs it with or without tiles, and checks it.

It is an ordinary sandboxed mod. It uses only the engine API: `mods.inspect` to read the mod's metadata, `mosaics.open` and `mods.open` to run it and `mods.check` to check it. It needs no collection and has no tile type. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- It reads the mod reference in its `target` link parameter. Without one, it says "No mod was given."
- It sends `mods.inspect` for the target and shows the title with the version as a badge, then a card with the metadata: description, source, the API range, tile type, default mosaic (the address of the mod's `default_mosaic`, or "(none)"), the config as indented `key: value` lines, and a table of the declared permissions with each one's category, host, reason and a badge saying whether it would be granted ("granted" or "not granted"). The API range is the mod's `api` from `inspection.api`, with a badge from `inspection.apiCompatible`: "matches" when it matches the app's mod API version, or "does not match" followed by the app's mod API version, read from `context.api.version`. A mod without `api` shows "The mod declares no API range." When the mod cannot be inspected, it shows the error message as an alert.
- It offers three ways to run the mod:
  - "Open default mosaic", only when the mod declares a `default_mosaic`: a `mosaics.open` with `inspection.defaultMosaic` as `mosaic`, so the mod opens as its default mosaic opens it, with the mosaic's collection, config, aliases and `show` permissions. It is the page's primary action.
  - A collection address field with "Run with this collection" (or Enter): a `mods.open` with the mod's source as `mod` and the typed collection, sent as typed without surrounding spaces. It is an address with its scheme, such as `https://example.org/collection.yaml`, or a relative path such as `./samples/tiles/literature_nobel_laureates_books/collection.yaml`, resolved against the app's address as in a run link's `collection`, never against the viewed mod's file. The field is never marked invalid: a collection that cannot be loaded is reported by the opened mod's sandbox. An empty field runs nothing.
  - "Run without tiles": a `mods.open` with the mod's source as `mod` and no collection.

The mod opens in a new sandbox, and the viewer stays open behind it, so back returns to it as it was left.

- "Check mod", next to the run buttons and only while a mod is shown, sends `mods.check` with the mod's source as `mod`, and with the collection field's value as `collection` whenever the field is not empty, sent as "Run with this collection" sends it; with an empty field, the mod is checked with its default mosaic, as "Open default mosaic" opens it, or with no tiles when it declares none. While the check runs, the button is disabled and a `role="status"` message says "Checking <title>…". The report then replaces it: a "Check report" section whose heading says "Check passed", "Check passed with warnings" or "Check failed" with the status as a badge (`success` for `"pass"`, `warning` for `"warn"`, `destructive` for `"fail"`), a notice when a bundle error kept the mod from being mounted, a "Tests" list when the mod's test cases ran, one list item per case with its status as a badge (`success` for `"pass"`, `destructive` for `"fail"`), its name and, for a failed case, its message, and the findings, one list item each with its level as a badge, its step, its message and its source, or "No findings.". A failed request shows the error as an alert. The viewer stays the visible mod: the check and the mod's tests run in hidden frames (see the [stage module](../../lib/core/stage/README.md#mod-checks)).

The [mosaic viewer](../../mosaics/viewer/README.md) shows a mosaic check's report with a copy of this report rendering, `default_mods/mosaic_viewer/src/check_report.ts`, without the tests list, since a default mod cannot import another mod's files. A change to one copy belongs in the other.

## An example of the app's look

Its TypeScript source, in `default_mods/mod_viewer/src/`, is a short example of how a mod gets the app's look from semantic HTML, with no classes and no styling library:

- the metadata is an `<article>`, drawn as a card, and the permissions a plain `<table>` whose parts carry explicit table roles (`table`, `rowgroup`, `row`, `columnheader`, `cell`). In a frame narrower than 30rem, such as a phone's, each permission is a block: its category with its status badge at the end, then its host, then its reason, without the header row. The header row is hidden visually, not removed, and the roles keep the table's semantics for assistive technology whatever its layout. The [mosaic viewer](../../mosaics/viewer/README.md) has a copy of these rules: a change to one belongs in the other;
- the version, the API range's match, the permission statuses, the check status, the test cases' statuses and the findings' levels are badges: `<span>`s with `data-tes-variant` (`secondary`, `success`, `warning`, `destructive`, `outline`);
- "Open default mosaic" is a `<button type="submit">`, drawn as the primary button, and "Run with this collection" a submit button with `data-tes-variant="outline"`, so the page has one primary action;
- errors and notices are `role="alert"` and `role="status"` elements.

The mod's own CSS sets layout only. The frame has no `allow-forms`, so its forms are never submitted: the submit buttons handle their clicks and call `preventDefault()`, and Enter in the address field still clicks the form's submit button. See "Write HTML, get the app's look" in the [theme module](../../lib/core/theme/README.md).

## Config

`default_mods/mod_viewer/mod_conf.yaml`:

```yaml
mod:
  title: "Mod Viewer"
  version: "0.1.0"
  api: "^0.2.0"
  description: "Shows a mod's metadata and runs it with or without tiles."
  entrypoint: "./main.js"
  test_path: "./test.js"
  permissions:
    open:
      - host: "*"
        reason: "Runs the mod you are viewing"
```

`open` for `"*"` lets the viewer inspect and run mods from any site. It is granted because the viewer is served from the app's origin.

## Tests

Its tests ship with it: `default_mods/mod_viewer/test/`, built into `test.js` and declared with `test_path`, so checking `mod_viewer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They mount the viewer with the fixture mods of `default_mods/mod_viewer/fixtures/` and check what it draws, the requests it sends and its look. `e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage and the links it opens.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mod_viewer&target=./samples/mods/book_list` | the sample book list mod |
| `https://example.org/#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` | the same mod, by its source (what the explorer opens) |
| `https://example.org/#/run?mod=mod_viewer` | "No mod was given." |

"Run with sample tiles" on the sample mod opens `#/run?mod=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml&collection=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fbook_collection.yaml`.
