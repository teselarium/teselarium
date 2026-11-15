# Design

## Context

See proposal.md (Why). This change assumes `add-mosaics` and `rework-mod-file-format` are archived, so these exist:

- **Methods:** `mosaics.inspect`, `mosaics.open` and `mosaics.check`, all needing `open` for the mosaic file's origin.
- **Files:** `title` in mod and collection files, and default mosaics.
- **Types:** `MosaicInspection` and the report's `mosaic`, in `default_mods/mod_api.d.ts`.

The default mods it mirrors:

- **`collection_explorer`:** config `viewer` and `collections`. It lists cards from `collections.inspect` and opens the viewer with `target`. Its `src/` has `explorer_page.ts`, `explorer_view.ts`, `collection_cards.ts` and `collection_entries.ts`, and its `test/` has the cases and look probes.
- **`mod_viewer`:** shows `mods.inspect`, offers the run choices, and checks with `mods.check`, showing the report (badges, tests list and findings).

A default mod's code may import only its own files and npm packages. The build fails on anything else (`default_mods/README.md`).

## Goals / Non-Goals

**Goals:**

- The Mosaics pair reads and behaves like the Tiles and Mods pairs: same card, badge, alert and status patterns, the same `target` parameter, and the same section behavior.
- The explorer stays cheap: one `mosaics.inspect` per listed mosaic, nothing else.
- The samples show the two things a mosaic adds, each in one file.

**Non-Goals:**

- A mosaic maker.
- Listing default mosaics in the explorer.
- An engine-drawn check report element.
- Showing in the explorer which mod or collection a mosaic uses.

## Decisions

### D1. The explorer opens mosaics directly and also offers the viewer

Each card has "Open", the primary action (`mosaics.open`), and "View" (`mods.open` for `viewer` with `target`). The collection explorer has only "View", because a collection is not runnable on its own. A mosaic is the finished thing the user asked to open "from the list". The viewer remains one click away for metadata and checks.

*Alternatives:*
- "View" only, like Tiles and Mods: opening would always take two clicks.
- "Open" only: the viewer would be unreachable from the section.

### D2. The explorer's cards hold only the mosaic's own data

A card shows the title and description from `mosaics.inspect`. Showing the mod's title or the collection's tile count would cost a `mods.inspect` and a `collections.inspect` per card, and a failure of either would clutter the list. The viewer shows them.

### D3. The viewer composes three inspections

1. `mosaics.inspect` with the `target`. A failure is the page's alert, as in the other viewers.
2. Then `mods.inspect` for `mosaic.mod` and `collections.inspect` for `mosaic.collection`, in parallel. Each failure is an alert inside its own section, so the mosaic's own data stays visible.

The sections, in order:

- the mosaic card (title, description, source);
- "Mod": title as a button, version badge, API badge;
- "Collection": title as a button, tile count, or "This mosaic has no collection.";
- "Config": the mosaic's own overrides as indented `key: value` lines, as `mod_viewer` draws config;
- "Aliases": `field ← name, name`;
- "Permissions": a table with a granted / not granted badge, as `mod_viewer` draws permissions.

The actions are "Open mosaic" (a primary `<button type="submit">`) and "Check mosaic" (an outline button). The page has one primary action, as in `mod_viewer`.

### D4. The check report view is copied from the mod viewer

`mosaic_viewer` gets its own `src/check_report.ts`, copied from `mod_viewer`'s report rendering without the tests list. A default mod cannot import another mod's files, and sharing would need an npm workspace package for about a hundred lines.

*Alternatives:*
- An engine-provided `<ot-check-report>` element: a mod API addition with its own spec, worth doing if a third mod needs it.
- A workspace package: build and lint setup out of proportion.

The duplication is recorded in both mods' READMEs.

### D5. Sample mosaics are plain files in `public/samples/mosaics/`

A mosaic is one small YAML file with no assets. So the samples are `nobel_books_list.yaml` and `nobel_laureates_map.yaml`, not folders. Their references use the unified rule: `mod: "../mods/book_list"` (a folder), and `collection: "../tiles/literature_nobel_laureates_books"` (a folder holding `collection.yaml`).

- **`nobel_books_list.yaml`:** `columns: 8`, so the override is visible next to `book_list`'s default of 6. It declares the four cover hosts its default mosaic declares.
- **`nobel_laureates_map.yaml`:**
  - aliases `title: ["name"]` and `country: ["birth_country"]`;
  - `show` for `https://upload.wikimedia.org`, with the reason "Shows the laureates' portraits". The portraits would also load as media linked by tiles, but declaring the host demonstrates a data-driven permission and keeps them showing when that setting is off;
  - all 14 birth countries are in the country map's name table, so no laureate lands under "Not on the map".

### D6. The Mosaics section goes live; coming soon stays as a mechanism

`vanilla_sections.ts` gives `mosaics` the target `{ mod: { mod: "mosaic_explorer", collection: null, params: {} } }` and `comingSoon: false`. The `comingSoon` field, its validation, the disabled sidebar item and the Settings label all stay, for instantiations.

Their unit and e2e tests used the vanilla Mosaics item as their example. They move to a test registry with an `Atlas` section marked coming soon, which the Sidebar and Settings tests already know how to pass in. The docs' examples change the same way.

Sandboxes opened from the explorer stay in Mosaics through the opener rule. No stage change is needed.

### D7. Fixtures inside each mod

As for the other default mods, cases name fixtures by their address in the default mods folder:

- **`mosaic_explorer/fixtures/`:** `listed_mosaic.yaml` and `other_mosaic.yaml`.
- **`mosaic_viewer/fixtures/`:**
  - `shown_mosaic.yaml`, with config, aliases and a `show` line;
  - `missing_collection.yaml`;
  - `untitled_mosaic.yaml`;
  - `fixture_mod/` (a `mod_conf.yaml` only) and `fixture_collection.yaml` with its tiles.

Their mosaics point to these neighbors with relative paths, so the cases pass without `samples/`. The vanilla explorer lists none of them.

## Risks / Trade-offs

- **[Two copies of the report view drift apart]** → Both READMEs point to each other. The look tests of both viewers check the same badges and headings.
- **[The coming-soon path loses its only real use and could rot]** → Its tests move to the `Atlas` test registry, so it stays covered.
- **[The samples depend on remote covers and portraits]** → `e2e/sample_mosaics.spec.ts` routes the image hosts with `routeCovers` from `e2e/mod_routes.ts`, as the book list's sample tests do, and runs only in `npm run test:e2e:samples`.
- **[An "Open" next to "View" on every card is busier than the other explorers]** → "Open" is the primary button and "View" an outline one, so the eye lands on one action per card.
