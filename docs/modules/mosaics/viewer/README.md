# Mosaic Viewer

The mosaic viewer is the Viewer component for mosaics. It ships as the default mod `mosaic_viewer` in `default_mods/mosaic_viewer/` (see the [default mods folder](../../../../default_mods/README.md)), and the [mosaic explorer](../explorer/README.md) opens it. It shows a mosaic with its mod and its collection, opens it, checks it, and edits it: a mosaic stored in this browser in place, any other as a copy, and a new mosaic from a combination. Its edit mode takes the role the [mosaic maker](../maker/README.md) was planned for.

It is an ordinary sandboxed mod. It uses only the engine API: `mosaics.inspect` to read the mosaic file, `mods.inspect` and `collections.inspect` to read its mod and its collection without running or loading them, `mosaics.open` to open it, `mosaics.check` to check it, `mods.open` to open the mod viewer and the collection viewer, `catalog.list` to find whether the user added the mosaic, `userCatalog.update`, `userCatalog.export`, `userCatalog.history`, `userCatalog.exportFolder` and `userCatalog.remove` to ask the app's dialogs that change it, and, in edit mode, `mosaics.edit` and `mosaics.validate` to change and check its draft, `storage.get` and `storage.set` to keep the draft, `ui.confirm` before it drops changes, and `userCatalog.save` to save it. It never reads or writes mosaic YAML itself: the app does, so a replacement viewer needs no YAML library either. It never requests a tile. An instantiation can switch it off or replace it by putting another mod in its folder.

## What it does

- It reads the mosaic reference in its `target` link parameter. Without one, or with an empty one, it says "No mosaic was given.", sends nothing and has no buttons.
- Otherwise it sends `mosaics.inspect` for the target. When the mosaic cannot be inspected, for any reason, it shows the error message as an alert: a missing file names `404`, a mosaic file without a title says that `"title"` must be a non-empty string.
- It shows the mosaic, in this order:
  - a card, an `<article>`, with its title as the heading, its description and its source;
  - "Mod": the mod's title, as a button, its version as a badge, and its API range with a badge saying whether it matches the app's mod API version ("matches", or "does not match" followed by the app's mod API version), as the [mod viewer](../../mods/viewer/README.md) shows them;
  - "Collection": the collection's title, as a button, and its number of tiles, such as "17 tiles", or "This mosaic has no collection.";
  - "Config": the mosaic's own config overrides as indented `key: value` lines, or "(none)";
  - "Aliases": a `field ← name, name` line for each field of the mod's tile type that the mosaic renames, such as `title ← name`, or "(none)";
  - "Permissions": a table of the mosaic's `show` lines, with each one's category, host, reason and a badge saying whether it would be granted ("granted" or "not granted"), or "(none)";
  - "Where it comes from", only for a mosaic the catalog lists as the user's (`listedBy: "user"`, read with `catalog.list`): for a stored mosaic, its "Folder" and "Path", or its "File" for a single file, when it was "Imported", when it was last "Updated" (or "Never"), as `<time>` elements in the reader's locale, "Copied from" and the address for a saved copy, "Changed since export", a warning badge, while its text differs from the text it was last imported or exported with, and the note "It is kept only in this browser. Export it to keep a copy as a backup.", then "Update from file…", "Export", "History…", "Export folder" when it came from a folder (outline buttons) and "Remove" (destructive); for a mosaic added by URL, "You added it by URL on <time>." and "Remove" only. A long path wraps, so the section never scrolls sideways on a phone.
- After the mosaic card is shown, it sends `mods.inspect` for the mosaic's mod, `collections.inspect` for its collection and `catalog.list`, in parallel. It follows `catalog.changed`, so "Where it comes from" shows the catalog's changes, such as a new update time or a removal, without a reload. Each section says it is loading meanwhile (`aria-busy`). A mod or collection that cannot be inspected is shown as an alert inside its own section, with its address and the error message, and the rest of the mosaic is still shown.
- Activating the mod's title sends `mods.open` for the mod in its config's `mod_viewer`, with the mod's source as `target`. Activating the collection's title sends `mods.open` for the mod in its config's `collection_viewer`, with the collection's source as `target`.
- "Open mosaic", the page's primary action, sends `mosaics.open` with the mosaic's source: the mosaic's mod opens with its collection, config, aliases and `show` permissions.
- "Edit", for a mosaic stored in this browser, or "Edit a copy", for any other, next to "Open mosaic", opens edit mode in place (see [Edit mode](#edit-mode)).
- "Update from file…", "Export", "History…" and "Remove" send `userCatalog.update`, `userCatalog.export`, `userCatalog.history` and `userCatalog.remove` with the mosaic's source, and "Export folder" sends `userCatalog.exportFolder` with the folder's name. After an update or a restore from the history (`true`), the viewer inspects the mosaic anew and shows it again, with its new title and contents. After a removal (`true`), a `role="status"` message says "The mosaic was removed from your catalog." and the buttons are gone. A refusal is shown as an alert under the actions.
- "Check mosaic" sends `mosaics.check` with the mosaic's source. While the check runs, the button is disabled and a `role="status"` message says "Checking <title>…". The report then replaces it, as the mod viewer shows a mod's: a "Check report" section whose heading says "Check passed", "Check passed with warnings" or "Check failed" with the status as a badge, a notice when a bundle error kept the mod from being mounted, and the findings, one list item each with its level as a badge, its step, its message and its source, or "No findings.". It has no "Tests" list, since a mosaic check does not run the mod's tests (see [Checking a mosaic](../README.md#checking-a-mosaic)). A failed request shows the error as an alert, and the button is enabled again.

What it opens opens in a new sandbox, and the viewer stays open behind it, so back returns to it as it was left. The viewer stays the visible mod while it checks: the check runs in hidden frames. A refused open or check is shown as an alert under the actions.

The report is drawn by `src/check_report.ts`, a copy of the mod viewer's report rendering without its tests list: a default mod cannot import another mod's files. Keep the two copies alike: the mod viewer's [README](../../mods/viewer/README.md) points back here, and the e2e checks of both viewers assert the same status headings and finding badges.

## Edit mode

Edit mode edits a draft: the full text of a mosaic file. The text is the draft, and both tabs change it. The app reads and writes the YAML: the form sends each change with `mosaics.edit`, which keeps the file's comments, key order and quoting, and fills its fields from the `draft` of the latest `mosaics.validate` answer, so the viewer never parses YAML.

**Where it starts.** The `mode` link parameter, or the buttons of view mode:

| `mode` | Edits | Its first text | "Save" sends |
|---|---|---|---|
| `edit` | the `target`, when it is stored in this browser | `content` of `mosaics.inspect` | `userCatalog.save` with `mosaic`, the target |
| `copy` | a copy of the `target` | `content`, then `mosaics.edit` with the inspection's resolved `mod` and `collection`, so they are absolute | `userCatalog.save` with `copiedFrom`, the target's source |
| `new` | a new mosaic from `draft_mod`, `draft_collection` and `draft_sites` | `mosaic:\n  title: "Untitled mosaic"\n`, then `mosaics.edit` with the mod, the collection, the `show` lines of the `draft_sites` mosaic, read with `mosaics.inspect`, and the combination's name as title, `<mod> + <collection>` or `<mod>` without a collection, from the titles of `mods.inspect` and `collections.inspect`. The skeleton's title stays when either cannot be inspected | `userCatalog.save` with neither |

The viewer knows its target is stored from its `opentesela-browser:` address and a `mosaics.inspect` that succeeded, never from a `catalog.list` read at start, which can be empty until the browser database is open. `mode=edit` for any other mosaic shows the mosaic with the alert "Only mosaics stored in this browser can be edited. Use "Edit a copy" to save a copy of your own.", and any other `mode` value with `The mode "<mode>" is not one of edit, copy, new.` The stage bar's edit button opens these links (see [the main module](../../main/README.md#the-stage-bar)).

**The page.** The heading (`Edit "<title>"`, `Copy of "<title>"` or "New mosaic"), then two tabs, `role="tab"` buttons in a `role="tablist"`:

- **Form**: "Title", "Description", "Mod address" and "Collection address (empty for none)"; "Aliases", one row per field of the mod's tile type, `<field> (required)` for a required one, whose names are separated by commas and whose suggestions are the collection's field names (a `<datalist>`), then the fields the draft renames that the type does not declare; "Sites", one row per `show` line with its host, its reason and "Remove", and "Add"; and "Config", the draft's own config read-only beside the mod's default config, read with `mods.inspect`, with "Config is edited in the YAML tab." A field sends its change when it is left (`change`), and a site row only once it has both a host and a reason. The form is drawn again from each validation, unless the focus is in it.
- **YAML**: the draft's text in a `<textarea data-ot-variant="code">`, monospace. While the text cannot be read (a YAML error, or no `mosaic` mapping), the Form tab is disabled and the page says "The form is unavailable until the YAML can be read: Line <n>: <error>".

Under the tabs, "Problems" lists the latest validation's errors and warnings, each with an "Error" or "Warning" badge and "Line <n>: " when it has a line, then the hint "<matching> of <total> tiles match", "No collection: the mod gets no tiles." or "Count unavailable". Then "Save", the page's primary action, and "Cancel".

**Validation.** Half a second after the last change, from either tab, the viewer sends `mosaics.validate` with the draft and, for a stored mosaic, its address. Each request has a number, and an answer to a request older than the newest is ignored, so a slow answer never replaces a newer one.

**The kept draft.** Each change keeps the text in the viewer's storage slot with `storage.set`, under `draft:<target>` for a stored mosaic, `draft:copy:<target>` for a copy and `draft:new:<mod>|<collection>` for a new mosaic, so leaving the page loses nothing. When edit mode opens again for the same mosaic and a kept draft differs from its first text, it says "A draft of this mosaic was kept from your last visit." with "Restore draft" and "Discard". Saving, "Discard" and a confirmed "Cancel" drop it, and so does a stored target that no longer inspects, such as after "Remove". An early `catalog.list` that lacks the target never does.

**Saving and leaving.** "Save", and Ctrl+S or Cmd+S, handled in the frame, so only while the viewer has the focus, send `userCatalog.save` (see the table). The app's "Save mosaic" confirmation then shows what changes (see [the main module](../../main/README.md#the-user-catalog)). A saved address drops the kept draft and shows the mosaic: a stored mosaic is inspected anew and shown in view mode, and a copy or a new mosaic is opened with `mods.open` for the viewer itself, with the saved address as `target` and `replace: true`, so back leads to what was before the copy. `null` keeps edit mode and the draft. "Cancel" with unsaved changes first asks with `ui.confirm` ("Discard your changes to this mosaic?", "Discard" and "Keep editing"), then shows the mosaic in view mode, or "The new mosaic was not saved." for a new one.

**On a phone.** Edit mode is one column: the tabs on one row, each label above its field, a site row's fields stacking below 30rem, and the textarea at full width, without scrolling sideways. Its buttons are the theme's, at least 32px tall.

## An example of the app's look

Its TypeScript source, in `default_mods/mosaic_viewer/src/`, gets the app's look from semantic HTML as the mod viewer does:

- the mosaic is an `<article>`, drawn as a card, and the permissions a plain `<table>` whose parts carry explicit table roles, laid out as the [mod viewer](../../mods/viewer/README.md)'s: below 30rem, each permission is a block, its category and status, then its host, then its reason, with the header row hidden visually. A copy of the mod viewer's rules: a change to one belongs in the other;
- the mod's version, the API range's match, the permission statuses, the check status and the findings' levels are badges: `<span>`s with `data-ot-variant`;
- the mod's and the collection's titles are buttons with `data-ot-variant="ghost"`, "Open mosaic" a `<button type="submit">`, drawn as the primary button, and "Check mosaic" a plain `<button>`, drawn as an outline button, so the page has one primary action;
- errors and notices are `role="alert"` and `role="status"` elements.

In edit mode, the selected tab gets the pressed button's outline (`aria-selected="true"`) and `data-ot-variant="secondary"`, the other `ghost`, the YAML is a `<textarea data-ot-variant="code">`, and the problems' levels are badges.

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
- `open` for `"*"`: the viewer inspects a mosaic, its mod and its collection, opens them, and validates drafts, from any site, since `mosaics.inspect`, `mods.inspect`, `collections.inspect`, `mosaics.open`, `mosaics.check`, `mosaics.validate` and `mods.open` are all checked against `open`. It is granted because the viewer is served from the app's origin.

## Tests

Its tests ship with it: `default_mods/mosaic_viewer/test/`, built into `test.js` and declared with `test_path`, so checking `mosaic_viewer` in the mod viewer runs them (see [Tests](../../../../default_mods/README.md#tests) in the default mods folder). They mount the viewer with the fixture mosaics of `default_mods/mosaic_viewer/fixtures/`, whose mod, `fixture_mod/`, and collection, `fixture_collection.yaml`, are fixtures next to them, so the cases pass without `samples/`. They check what it draws, the requests it sends, answering `mods.open` and `mosaics.open` with `null`, and its look. The provenance cases answer `catalog.list` with the fixture mosaic as a stored user mosaic, or a remote one, and answer `userCatalog.remove` and `userCatalog.export` with `true` and `userCatalog.update` with `false`; a scripted catalog keeps its sources as given, so they resolve the fixture's address against the frame's base, the app's address. `e2e/default_mods.spec.ts` also removes a stored mosaic from the viewer, through the app's confirmation, and checks the section on a 360×740 phone. A case cannot answer `mosaics.check`, so "Check mosaic" in a case is refused with `-32002`: the case checks that the error is shown and that the button is enabled again. The provenance cases also answer `userCatalog.history` and `userCatalog.exportFolder`, and check "Changed since export".

The edit cases (`test/edit_cases.ts`) start each mode: a copy from "Edit a copy" and from `mode=copy`, a refused `mode=edit` for a fixture that is not stored, an unknown mode, and `mode=new` with `fixtures/typed_mod/`, a fixture mod whose tile type requires `title`, on the fixture collection, whose tiles name it `name`, titled "Typed Fixture Mod + Fixture collection", then without a collection, titled "Typed Fixture Mod", and with a missing collection, which keeps "Untitled mosaic". They check the hints ("0 of 2 tiles match", then "2 of 2" once `title` is renamed from the suggestion `name` through `mosaics.edit`), broken YAML with its "Line 3" and the disabled form, a stale validation answer ignored, a kept draft seeded in the case's storage and restored, "Cancel" asking with `ui.confirm` (answered `false`) and leaving without asking when nothing changed, a saved copy (`userCatalog.save` answered with a fixture address, and `mods.open` with `null`, with `copiedFrom` the fixture's source and `replace: true`), and Ctrl+S answered `null`, which keeps edit mode. `e2e/default_mods.spec.ts` edits a copy of the sample map, changes an alias, saves it through the app's confirmation and finds it in the explorer with "Changed since export", and checks the form on a 360×740 phone.

`e2e/default_mods.spec.ts` tests what a case cannot see: the sandbox, the stage, the links it opens, the sample mosaics it shows, and a real "Check mosaic" of a mosaic whose alias names a field the mod's tile type does not declare. `e2e/sample_mosaics.spec.ts` checks each sample mosaic in the viewer.

## Links

For an app at `https://example.org/`:

| Link | Shows |
|---|---|
| `https://example.org/#/run?mod=mosaic_viewer&target=./samples/mosaics/nobel_laureates_map.yaml` | the sample mosaic of the laureates on the country map |
| `https://example.org/#/run?mod=mosaic_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml` | the same mosaic, by its source (what the explorer opens) |
| `https://example.org/#/run?mod=mosaic_viewer` | "No mosaic was given." |
| `https://example.org/#/run?mod=mosaic_viewer&target=./samples/mosaics/nobel_laureates_map.yaml&mode=copy` | edit mode for a copy of the sample map |
| `https://example.org/#/run?mod=mosaic_viewer&mode=new&draft_mod=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fflashcards%2Fmod_conf.yaml&draft_collection=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml` | edit mode for a new mosaic of Flashcards with the laureates |

On the laureates' map, "Open mosaic" opens `#/run?mosaic=https%3A%2F%2Fexample.org%2Fsamples%2Fmosaics%2Fnobel_laureates_map.yaml`. `Country Map` opens `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fcountry_map%2Fmod_conf.yaml`, and `Nobel Prize in Literature laureates` opens `#/run?mod=collection_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Ftiles%2Fliterature_nobel_laureates%2Fcollection.yaml`.
