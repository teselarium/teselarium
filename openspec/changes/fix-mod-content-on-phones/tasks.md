# Tasks

## 1. Base stylesheet wraps long words (mod-theme)

- [ ] 1.1 Write the failing e2e tests first in `e2e/mod_theme.spec.ts`, using a test mod and `page.setViewportSize` for the narrow frame, one per scenario of "Long words wrap":
  - bare URL in a 338px frame: the document cannot scroll sideways;
  - words that fit are not split;
  - a mod's `body { overflow-wrap: normal; }` wins;
  - an opted-out mod's `<body>` computes `normal`.

  Verify that the first scenario fails on the current code and the others pass.
- [ ] 1.2 Add `overflow-wrap: break-word` to the `body` rule of `src/lib/core/theme/base_stylesheet.css`, inside the `opentesela` layer, with a comment saying why `break-word` and not `anywhere` (design D1). Verify the tests of 1.1 pass.
- [ ] 1.3 Describe the wrapping in "The base stylesheet" of `docs/modules/lib/core/theme/README.md`: long words break at the line's end, and a mod can override it with `body { overflow-wrap: normal; }`. Verify that the documented override is the one the test of 1.1 uses.

## 2. Default mods' tables stack in a narrow frame (default-mods)

- [ ] 2.1 Set explicit ARIA roles in the three table builders: `role="table"`, `rowgroup`, `row`, `columnheader` and `cell`.
  - `default_mods/collection_viewer/src/tile_list.ts`;
  - `default_mods/mod_viewer/src/metadata_card.ts`;
  - `default_mods/mosaic_viewer/src/mosaic_card.ts`.

  Add a case to each mod's own test cases (`default_mods/<mod>/test/`) that checks the roles on the rendered table. Verify the mods' cases pass in `npm run test:e2e` (`e2e/default_mods.spec.ts` runs them).
- [ ] 2.2 Write the failing e2e tests in `e2e/default_mods.spec.ts` for "Viewer tables stack in a narrow frame" and "Stacked tables keep their semantics":
  - collection viewer at 412×915: label on one line, address below, no sideways scroll;
  - mosaic viewer `nobel_books_list.yaml` at 360×740: status, host and reason inside the frame;
  - mod viewer for the book list at 360×740: the `granted` badge inside the frame;
  - mosaic viewer at 1280×800: header row and columns side by side;
  - roles at 360×740: `table`, four column headers, cells.

  Use the tests' own fixtures where the existing tests do. Verify the narrow cases fail on the current code.
- [ ] 2.3 Add the narrow-frame styles to the collection viewer's `viewer_page.ts`, inside `@media (max-width: 29.99rem)`:
  - `table`, `tbody`, `tr` and `td` as blocks;
  - the header row hidden with the clip pattern (design D2).

  Verify the collection viewer tests of 2.2 pass.
- [ ] 2.4 Add the same permission-table styles to `default_mods/mod_viewer/src/viewer_page.ts` and `default_mods/mosaic_viewer/src/viewer_page.ts`:
  - each `tr` a grid: category and status on the first line, then the host, then the reason;
  - the header row clipped;
  - in each file, a comment that the two copies are kept alike, as in `check_report.ts`.

  Verify the mod and mosaic viewer tests of 2.2 pass, and that the mods' look cases (`listOwnLookDeclarations`) still pass, since the new rules set layout only.
- [ ] 2.5 Document the narrow layout in `docs/modules/mods/viewer/README.md`, `docs/modules/mosaics/viewer/README.md` and the collection viewer's section of `docs/modules/tiles/viewer/README.md`:
  - below 30rem, the tables show each row as a block;
  - the tables carry explicit table roles.

  Verify every README that describes one of the three tables mentions it.

## 3. Tile viewer keeps its position on one line (default-mods)

- [ ] 3.1 Write the failing e2e test in `e2e/default_mods.spec.ts`. At 412×915, the tile viewer shows the seventh laureate tile from its collection: `7 of 17` must be one line high, and the collection title must be fully shown. Verify it fails on the current code.
- [ ] 3.2 Change the `nav[aria-label="Collection"]` rules in `default_mods/tile_viewer/src/viewer_page.ts` (design D3):
  - the title button: `flex: 1 1 auto; min-width: 0; white-space: normal; text-align: start`;
  - the position span: `flex: none; white-space: nowrap`, without its `flex: 1`.

  Verify the test of 3.1 passes, and that the existing tile viewer tests still pass, including the wide layout (title at the start, Previous and Next at the end).

## 4. Book list card in a narrow frame (sample-book-list)

- [ ] 4.1 Write the failing `@sample` e2e tests in `e2e/sample_book_list.spec.ts` for "Card in a narrow frame":
  - Kallocain's card at 412×915: the cover is above the heading, and "1940", "Sweden" and "Swedish" are each one line high;
  - `show_covers: false` at 412×915;
  - the cover beside the heading at 1280×800.

  Verify the phone case fails on the current code.
- [ ] 4.2 Add a `@media (max-width: 29.99rem)` block to the card styles in `public/samples/mods/book_list/main.js` (design D4):
  - `dialog > header` becomes a column;
  - the small book is centered at 6rem;
  - the details take the full width.

  Verify the tests of 4.1 pass with `npm run test:e2e:samples`.

## 5. Release note

- [ ] 5.1 Add `.changeset/fix-mod-content-on-phones.md` with a `patch` bump for `opentesela`, following the bump rule in `docs/releasing.md`, and a one-line summary: mod content fits phones (long words wrap in mod frames, the default viewers' tables and the book list card adapt to narrow frames). Verify `npx changeset status` lists it.

## 6. Verification

- [ ] 6.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and, since the change touches `public/samples/`, `npm run test:e2e:samples`. Verify all pass.
- [ ] 6.2 Re-run the local audit with the C1 stand-in off, and confirm that C1, C2, C3, D1 and E1 are no longer reported or visible in the screenshots:

  `cd .audit/android-themes && node audit.mjs <step> --c1stub=off` for steps `03-tiles`, `05-mosaics`, `06-samples` and `07-sample-mosaics`, plus `--profiles=small --shots=all` for the mosaic viewer.

  Only the app-shell findings left for `fix-app-shell-on-phones` should remain. Record the result in `.audit/android-themes/findings.md`.
