# Tasks

## 1. Theme: current items in the spec's tests

- [ ] 1.1 In `e2e/mod_theme.spec.ts`, next to "Pressed button", add "Current item" and "Current item keeps its outline when focused" from the `mod-theme` delta: a `<button aria-current="true">`, an `<a aria-current="page">` and a `<button aria-current="false">` in a mod that adds no styles. Read the outline colors with the existing `readOutlineColor`. No app code changes, since `base_stylesheet.css` already outlines `[aria-current]`. Verify the two cases pass in the three browsers.
- [ ] 1.2 In `src/lib/core/theme/theme_styles.test.ts`, check that the base stylesheet holds the selector `[aria-current]:not([aria-current="false"])` next to `button[aria-pressed="true"]`. Verify `npx vitest run src/lib/core/theme` passes.

## 2. The grid, its shape and the placeholder

- [ ] 2.1 Restructure `public/samples/mods/book_list/main.js` (design.md, D4):
  - `mount` builds `<body>` once as a `<main>` and one `<dialog>`;
  - `renderBookList` replaces only the children of `<main>`: a `<header>` with the `<h1>`, then the `<ul>` or the empty `role="status"`;
  - `view` gains `booksPerRow`, `openSource` and `card`.

  Keep the code conventions (`docs/code_conventions.md`): named functions only, explicit loops, results stored before being returned, and no more than three levels of indentation. Verify the existing case "lists the sample books" in `test.js` still passes through `mods.check` (the e2e `mod_check.spec.ts` sample check).
- [ ] 2.2 Build each item as the book `<button>` with `data-source`, `aria-label` "<title>, <authors>", and the cover or placeholder, followed by a caption `<p>` with `<strong>` and `<small>` (D1). Add `buildBookFace` with the `error` fallback to the placeholder (D8). Add the layout and shape rules to `BOOK_LIST_STYLE`:
  - the grid formula (D3);
  - the 2:3 button with `padding: 0`, `min-height: 0` and `overflow: hidden`;
  - square left corners (D2);
  - the two-line title clamp;
  - the hover and focus lift, turned off under reduced motion.

  Update the header comment of `main.js` to say the CSS sets layout and the books' corner shape. Add cases to `test.js`:
  - "shows a placeholder without an image", which mounts with a tile without `image`;
  - "shows placeholders when covers are off", which mounts with `config: { show_covers: false }` and finds no `<img>`;
  - "names each book by title and authors".

  Verify the cases pass with `mods.check` on the sample (e2e `mod_check.spec.ts`).
- [ ] 2.3 In `e2e/theme_probes.ts`, make `listOwnLookDeclarations` skip properties ending in `-radius`, and update its doc comment. Leave `default_mods/*/test/look_probes.ts` unchanged. Verify "Own styles are layout only" in `e2e/default_mods.spec.ts` passes on the new sample, and fails if a `color` rule is added to `BOOK_LIST_STYLE` (check by hand, then remove the rule).
- [ ] 2.4 Add `e2e/sample_book_list.spec.ts` for the layout scenarios of the `sample-book-list` spec that need a real page:
  - "The sample books": the order, the same size, and height = 1.5 × width within 1px;
  - "Corners of a book";
  - "Text under the cover";
  - "Cover fails to load": route Kallocain's cover to 404;
  - "No image": a test mod with `SAMPLE_ENTRYPOINT_CODE` and a tile without `image`.

  Use `routeCovers`. Verify the spec passes in the three browsers.

## 3. Books per row

- [ ] 3.1 Add `readBooksPerRow` (D3), the start value (stored `columns`, then `config.columns`, then 6), the "Books per row" `<label>` and `<select>` in the header, and the `data-columns` attribute on the `<ul>`. On `change`, set the attribute without rebuilding the list, then `storage.set` `columns`. Hide the caption's authors at 8 and 10 per row. Leave out the select when there are no tiles. Add `columns: 6` to `public/samples/mods/book_list/mod_conf.yaml`. Add cases to `test.js`:
  - "uses the config's books per row" (`config: { columns: 8 }`);
  - "ignores an unknown books per row" (`config: { columns: 5 }`);
  - "remembers the books per row" (stored 10 over config 4, then stored 7 gives 6);
  - "has no select without books".

  Verify they pass through `mods.check`.
- [ ] 3.2 In `e2e/sample_book_list.spec.ts`, add:
  - "Default books per row" at a 1200px viewport, which counts the grid's columns from the computed `grid-template-columns`;
  - "Choosing books per row";
  - "Authors left out at 10 per row", checking the hidden text and the accessible name;
  - "Choice kept across starts";
  - "Ten per row in a narrow frame" at a viewport that makes the frame 400px wide.

  Verify the spec passes in the three browsers.

## 4. The book card

- [ ] 4.1 Add `openBookCard` (D5). It builds the card header with the small book, `<h2 id="book-card-title">`, authors, `<dl>` (Published, Country, Language, Pages, leaving out missing or wrongly typed keys) and genre badges (`<span data-ot-variant="secondary">`). Then it adds the `<hr>` and an `<ot-tile-body>` when the body is not empty, and the ghost close button. It sets `aria-labelledby`, calls `showModal()`, sets `openSource`, and stores `selected`. The book button's `click` opens the card. Add cases to `test.js`:
  - "opens the card of a clicked book": click Kallocain's button, then check `dialog.open`, the `<h2>` text, the values and the three badges;
  - "leaves out missing metadata": a tile with only `title`, no `<dl>` items and no badges.

  Verify they pass through `mods.check`.
- [ ] 4.2 Add closing (D6): the close button, the backdrop check by bounding rectangle, and a `close` listener that clears `openSource`, re-renders `<main>` and focuses the button found by `data-source`. Add `tiles.changed` handling, which rebuilds the open card from the new tile or closes it when its book is gone (D5). Add e2e cases to `e2e/sample_book_list.spec.ts`:
  - "Open Kallocain's card", with the start of the body visible;
  - "Grid behind the card";
  - "Escape", "Close button", "Backdrop" and "Click inside the card", with focus back on Kallocain's button where the spec says so;
  - "A link in the body", which expects `links.open` through the existing engine probes;
  - "Tiles reloaded with the book" and "Tiles reloaded without the book", with "Reload tiles" and a routed collection.

  Verify the spec passes in the three browsers.
- [ ] 4.3 In `public/samples/mods/book_list/mod_conf.yaml`, set `version: "1.1.0"` and `api: "^0.1.5"`, and change `description` to say the mod shows a grid of book covers with a card for each book. Verify the mod viewer shows the new version and no API range question for the sample (the e2e `mod_api_version.spec.ts` sample cases pass).

## 5. The last opened book

- [ ] 5.1 In `buildBookButton`, set `aria-current="true"` only on the book whose source is `view.selected`, and never set `aria-pressed` (D7). Change `test.js`:
  - "highlights the remembered book" reads `button[aria-current="true"]` and its `aria-label`;
  - add "marks no book for an unknown remembered source";
  - add "does not reopen the remembered book's card".

  Verify they pass through `mods.check`.
- [ ] 5.2 Move the e2e checks of the sample from `aria-pressed` to `aria-current`:
  - `mod_check.spec.ts`, "Real slot untouched": open and close Kallocain's card instead of a single click;
  - `mod_app_actions.spec.ts`, "Frame cannot be used behind the dialog": no `aria-current`, and no dialog open in the frame;
  - `mod_theme.spec.ts`, "Selection uses the accent": open and close the card, then read the outline of `button[aria-current="true"]`;
  - the sample's test code `SAMPLE_CONTEXT_TEST_CODE` in `e2e/mod_routes.ts`.

  Add "Mark after opening" and "Remembered across starts" to `e2e/sample_book_list.spec.ts`. Verify `grep -rn 'aria-pressed' e2e public/samples` lists only the theme's own "Pressed button" and "Mod overrides a token" cases, and that the changed specs pass in the three browsers.

## 6. Copies and docs

- [ ] 6.1 Replace `src/test/fixtures/mods/book_list/main.js` with the new sample entrypoint, and leave the fixture's `mod_conf.yaml` unchanged (design.md, Risks). Verify `diff public/samples/mods/book_list/main.js src/test/fixtures/mods/book_list/main.js` prints nothing and `npx vitest run src/lib/mod src/lib/core` passes.
- [ ] 6.2 Update the short version of the sample mod in `docs/modules/lib/core/engine/README.md` ("The mod entrypoint"): the `<main>` and `<dialog>` split, books per row in storage, `aria-current`, and the card with `<ot-tile-body>`. Update the excerpt of `test.js` in `docs/mod_plugin_spec.md` ("Mod tests") so it matches the new file. In `docs/modules/lib/core/theme/README.md`, wherever it describes the sample's own CSS, say it sets layout and the books' corner shape. Verify each excerpt matches the shipped files and that the links in the changed docs resolve.

## 7. Integration and release

- [ ] 7.1 Open `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml` in light and dark, at 4, 6, 8 and 10 per row, and in a narrow window. Open and close a card with the mouse and the keyboard, and verify the look matches the specs, with no colors from the mod.
- [ ] 7.2 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `openspec validate redesign-book-list-grid --strict`, and verify all pass.
- [ ] 7.3 Add `.changeset/redesign-book-list-grid.md` with `"opentesela": patch` (docs/releasing.md, "Bump rule": no breaking change for people who use or instantiate the app, and no mod API bump) and the summary "The sample book list mod shows its books as a grid of covers, with a "Books per row" choice and a card with each book's details and text." Verify `npx changeset status` lists it as a patch.
