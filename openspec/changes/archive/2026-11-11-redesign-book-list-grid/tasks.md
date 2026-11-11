# Tasks

## 1. Theme: no current-item checks

- [x] 1.1 Remove the current-item checks this change added, which the `mod-theme` delta no longer asks for: the cases "Current item" and "Current item keeps its outline when focused" in `e2e/mod_theme.spec.ts`, the probes `readOutlineStyle` and `hasVisibleFocus` in `e2e/theme_probes.ts` (used only by those cases), and the selector `[aria-current]:not([aria-current="false"])` in the check of `src/lib/core/theme/theme_styles.test.ts`. Leave `base_stylesheet.css` and the theme README's line on current items unchanged: they predate this change. Verify `npx vitest run src/lib/core/theme` passes and `e2e/mod_theme.spec.ts` passes in the three browsers.

## 2. The grid, its shape and the placeholder

- [x] 2.1 Restructure `public/samples/mods/book_list/main.js` (design.md, D4):
  - `mount` builds `<body>` once as a `<main>` and one `<dialog>`;
  - `renderBookList` replaces only the children of `<main>`: a `<header>` with the `<h1>`, then the `<ul>` or the empty `role="status"`;
  - `view` gains `booksPerRow`, `openSource` and `card`.

  Keep the code conventions (`docs/code_conventions.md`): named functions only, explicit loops, results stored before being returned, and no more than three levels of indentation. Verify the existing case "lists the sample books" in `test.js` still passes through `mods.check` (the e2e `mod_check.spec.ts` sample check).
- [x] 2.2 Build each item as the book `<button>` with `data-source`, `aria-label` "<title>, <authors>", and the cover or placeholder, followed by a caption `<p>` with `<strong>` and `<small>` (D1). Add `buildBookFace` with the `error` fallback to the placeholder (D8). Add the layout and shape rules to `BOOK_LIST_STYLE`:
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
- [x] 2.3 In `e2e/theme_probes.ts`, make `listOwnLookDeclarations` skip properties ending in `-radius`, and update its doc comment. Leave `default_mods/*/test/look_probes.ts` unchanged. Verify "Own styles are layout only" in `e2e/default_mods.spec.ts` passes on the new sample, and fails if a `color` rule is added to `BOOK_LIST_STYLE` (check by hand, then remove the rule).
- [x] 2.4 Add `e2e/sample_book_list.spec.ts` for the layout scenarios of the `sample-book-list` spec that need a real page:
  - "The sample books": the order, the same size, and height = 1.5 × width within 1px;
  - "Corners of a book";
  - "Text under the cover";
  - "Cover fails to load": route Kallocain's cover to 404;
  - "No image": a test mod with `SAMPLE_ENTRYPOINT_CODE` and a tile without `image`.

  Use `routeCovers`. Verify the spec passes in the three browsers.

## 3. Books per row

- [x] 3.1 Add `readBooksPerRow` (D3), the start value (stored `columns`, then `config.columns`, then 6), the "Books per row" `<label>` and `<select>` in the header, and the `data-columns` attribute on the `<ul>`. On `change`, set the attribute without rebuilding the list, then `storage.set` `columns`. Hide the caption's authors at 8 and 10 per row. Leave out the select when there are no tiles. Add `columns: 6` to `public/samples/mods/book_list/mod_conf.yaml`. Add cases to `test.js`:
  - "uses the config's books per row" (`config: { columns: 8 }`);
  - "ignores an unknown books per row" (`config: { columns: 5 }`);
  - "remembers the books per row" (stored 10 over config 4, then stored 7 gives 6);
  - "has no select without books".

  Verify they pass through `mods.check`.
- [x] 3.2 In `e2e/sample_book_list.spec.ts`, add:
  - "Default books per row" at a 1200px viewport, which counts the grid's columns from the computed `grid-template-columns`;
  - "Choosing books per row";
  - "Authors left out at 10 per row", checking the hidden text and the accessible name;
  - "Choice kept across starts";
  - "Ten per row in a narrow frame" at a viewport that makes the frame 400px wide.

  Verify the spec passes in the three browsers.

## 4. The book card

- [x] 4.1 Add `openBookCard` (D5). It builds the card header with the small book, `<h2 id="book-card-title">`, authors, `<dl>` (Published, Country, Language, Pages, leaving out missing or wrongly typed keys) and genre badges (`<span data-ot-variant="secondary">`). Then it adds the `<hr>` and an `<ot-tile-body>` when the body is not empty, and the ghost close button. It sets `aria-labelledby`, calls `showModal()` and sets `openSource`. The book button's `click` opens the card. Add cases to `test.js`:
  - "opens the card of a clicked book": click Kallocain's button, then check `dialog.open`, the `<h2>` text, the values and the three badges;
  - "leaves out missing metadata": a tile with only `title`, no `<dl>` items and no badges.

  Verify they pass through `mods.check`.
- [x] 4.2 Add closing (D6): the close button, the backdrop check by bounding rectangle, and a `close` listener that clears `openSource` and focuses the button found by `data-source`. Add `tiles.changed` handling, which rebuilds the open card from the new tile or closes it when its book is gone (D5). Add e2e cases to `e2e/sample_book_list.spec.ts`:
  - "Open Kallocain's card", with the start of the body visible;
  - "Grid behind the card": a click where Fahrenheit 451 is shown opens no card of Fahrenheit 451 and closes Kallocain's;
  - "Escape", "Close button", "Backdrop" and "Click inside the card", with focus back on Kallocain's button where the spec says so;
  - "A link in the body", which expects `links.open` through the existing engine probes;
  - "Tiles reloaded with the book" and "Tiles reloaded without the book", with "Reload tiles" and a routed collection.

  Verify the spec passes in the three browsers.
- [x] 4.3 In `public/samples/mods/book_list/mod_conf.yaml`, set `version: "1.1.0"` and `api: "^0.1.5"`, and change `description` to say the mod shows a grid of book covers with a card for each book. Verify the mod viewer shows the new version and no API range question for the sample (the e2e `mod_api_version.spec.ts` sample cases pass).
- [x] 4.4 Leave the small book out of the card when the book has no cover, and remove a card cover that fails to load (design.md, D5). Add the case "shows no small book without a cover" to `test.js` (`config: { show_covers: false }`, no `<img>` and no placeholder in the card), and "Covers switched off in the card" to `e2e/sample_book_list.spec.ts`. Verify both pass, the second in the three browsers.
- [x] 4.5 Show only the year of publication in the card (design.md, D5): the first four digits of a `date` string that starts with four digits, a number `date` as it is, and any other string `date` as written, still labeled "Published". In `test.js`, "opens the card of a clicked book" expects "1940", and add "shows a date without a year as written" (a tile with `date: "c. 1940"`). Copy `main.js` to `src/test/fixtures/mods/book_list/main.js` again. Verify the sample's cases pass through `mods.check`, and `e2e/sample_book_list.spec.ts` passes in the three browsers.
- [x] 4.6 Replace the `×` text of the card's close button with the 20 by 20 SVG cross (design.md, D5), built with `document.createElementNS`, and copy `main.js` to `src/test/fixtures/mods/book_list/main.js` again. Verify "Own styles are layout only" in `e2e/default_mods.spec.ts` and `e2e/sample_book_list.spec.ts` pass in the three browsers, and check the look of the open card in light and dark.

## 5. The raised book

- [x] 5.1 In `public/samples/mods/book_list/main.js`, remove the remembered book (D7):
  - `SELECTED_KEY`, `view.selected`, the `storage.get` of `selected` in `mount`, and the `storage.set` of `selected` in `openBookCard`, which is then no longer `async`;
  - `aria-current` in `buildBookButton`;
  - the re-render of `<main>` in the `close` listener (D6).

  Then add the raised book (D7):
  - `buildBookButton` sets `aria-haspopup="dialog"`, and `aria-expanded` from `view.openSource`;
  - `openBookCard` sets `aria-expanded="true"` on the book's button, and the `close` listener sets it to `"false"` before focusing it;
  - in `BOOK_LIST_STYLE`, the rule for `:hover`, `:focus-visible` and `[aria-expanded="true"]` with `translateY(-2px)` and `box-shadow: var(--ot-shadow)`, `box-shadow` in the `transition`, and, under reduced motion, only the transform turned off.

  Update the header comment to say the CSS sets layout, and the books' corner shape and shadow. In `test.js`, replace "highlights the remembered book", "marks no book for an unknown remembered source" and "does not reopen the remembered book's card" with:
  - "marks the book whose card is open": Kallocain's button has `aria-expanded="true"` and the others `"false"`, and every button has `aria-haspopup="dialog"`;
  - "unmarks the book when its card closes": after `card.close()`, every button has `aria-expanded="false"`. The focus is checked by the e2e cases "Escape" and "Close button" instead: in WebKit, a hidden case frame does not take focus.

  Keep the code conventions (`docs/code_conventions.md`). Verify the cases pass through `mods.check`.
- [x] 5.2 In `e2e/theme_probes.ts`, make `listOwnLookDeclarations` also skip a `box-shadow` whose declared value is exactly `var(--ot-shadow)`, and update its doc comment (D2). Verify "Own styles are layout only" in `e2e/default_mods.spec.ts` passes on the sample, and fails if `box-shadow: 0 0 4px red` is added to `BOOK_LIST_STYLE` (check by hand, then remove the rule).
- [x] 5.3 In `e2e/sample_book_list.spec.ts`, replace "Mark after opening" and "Remembered across starts" with:
  - "Raised on hover", "Raised while the card is open", "Back after closing" and "Reduced motion" (with `page.emulateMedia({ reducedMotion: "reduce" })`), comparing the computed `box-shadow` with the value of `--ot-shadow` and reading the computed transform;
  - "State while the card is open" and "State after closing".

  Add the `aria-expanded` check to "Tiles reloaded with the book". Verify the spec passes in the three browsers.
- [x] 5.4 Move the other e2e checks of the sample from the remembered book to the books per row or the raised book:
  - `mod_check.spec.ts`, "Real slot untouched": choose 10 books per row, and rename `serveSelectionReportingSample` in `e2e/mod_routes.ts` to a sample that reports its `storage.get` for `columns`;
  - `mod_stage.spec.ts`, "Selection is remembered": choose 10 books per row, reload, and expect the select to show 10;
  - `mod_theme.spec.ts`: the `describe` of "Sample and default mods follow the theme" takes the name "Sample and default mods take the theme's look", and "Selection uses the accent" becomes "Raised book uses the theme's shadow", with the pointer over Kallocain's book;
  - `mod_app_actions.spec.ts`, "Frame cannot be used behind the dialog": drop the `aria-current` checks and keep "no dialog open in the frame";
  - `SAMPLE_CONTEXT_TEST_CODE` in `e2e/mod_routes.ts`: "highlights the remembered book" becomes "remembers the books per row" (`columns` seeded to 10, the select shows 10), and "records the requests" chooses 10 books per row and expects `storage.get` for `columns`, then `storage.set` for `columns` with 10;
  - `SAMPLE_CASE_NAMES` in `e2e/mod_routes.ts`, to match the new `test.js`.

  Verify the changed specs pass in the three browsers.
- [x] 5.5 Check that no trace of the remembered book or of the current-item checks is left:
  - `grep -rn 'selected\|aria-current' public/samples/mods/book_list src/test/fixtures/mods/book_list e2e/sample_book_list.spec.ts e2e/mod_check.spec.ts e2e/mod_stage.spec.ts e2e/mod_theme.spec.ts e2e/mod_app_actions.spec.ts e2e/theme_probes.ts src/lib/core/theme/theme_styles.test.ts docs/mod_plugin_spec.md` prints nothing;
  - `grep -n 'aria-current\|SelectionReporting\|remembered book' e2e/mod_routes.ts` prints nothing;
  - in `docs/modules/lib/core/engine/README.md`, the section "The mod entrypoint" has no `selected` and no `aria-current`. The generic storage examples elsewhere in the docs that use the key `selected` are not about the sample and stay.
- [x] 5.6 Show the focus ring after closing only when the card was closed with the keyboard (design.md, D6). Add `closedByKeyboard` to `view`; `openBookCard` sets it to `false`, a `cancel` listener on the dialog sets it to `true`, the close button's click sets it to `event.detail === 0`, and the `close` listener focuses the book with `focus({ focusVisible: view.closedByKeyboard })`. In `e2e/sample_book_list.spec.ts`:
  - "Escape" also expects the focus ring;
  - "Close button" clicks with the mouse, moves the pointer off the books, and expects focus, no focus ring and no `box-shadow`;
  - add "Close button with the keyboard": Enter on "Close", then focus and the focus ring;
  - "Backdrop" clicks away from the books and expects focus and no focus ring.

  Read the focus ring as `:focus-visible` on the focused element. Copy `main.js` to `src/test/fixtures/mods/book_list/main.js` again, and update `showClosedCard` in the short version of the sample in `docs/modules/lib/core/engine/README.md` so it matches the shipped file. Verify the spec passes in the three browsers and the sample's cases pass through `mods.check`.

## 6. Copies and docs

- [x] 6.1 Replace `src/test/fixtures/mods/book_list/main.js` with the new sample entrypoint, and leave the fixture's `mod_conf.yaml` unchanged (design.md, Risks). Verify `diff public/samples/mods/book_list/main.js src/test/fixtures/mods/book_list/main.js` prints nothing and `npx vitest run src/lib/mod src/lib/core` passes.
- [x] 6.2 Update the short version of the sample mod in `docs/modules/lib/core/engine/README.md` ("The mod entrypoint"): the `<main>` and `<dialog>` split, books per row as the only stored value, the open book's `aria-expanded`, and the card with `<ot-tile-body>`. Update the excerpt of `test.js` in `docs/mod_plugin_spec.md` ("Mod tests") so it matches the new file, without `highlightsTheRememberedBook`. In `docs/modules/lib/core/theme/README.md`, wherever it describes the sample's own CSS, say it sets layout, and the books' corner shape and shadow. Verify each excerpt matches the shipped files and that the links in the changed docs resolve.
- [x] 6.3 Bring the other checks and docs that name the sample's version, description, API range or cases in line with the `mod-api-version`, `default-mods`, `stage-bar` and `mod-stage` deltas: `e2e/mod_stage.spec.ts`, `e2e/stage_bar.spec.ts`, `e2e/default_mods.spec.ts` (the viewer's check report), `e2e/mod_tests.spec.ts` and `e2e/mod_check.spec.ts` (one shared list of the sample's cases in `e2e/mod_routes.ts`), `e2e/mod_app_actions.spec.ts` (no open `<dialog>` in the frame), `src/lib/mod/sample_mod.test.ts` (`^0.1.5`) and the `mod_conf.yaml` in `docs/modules/lib/mod/README.md`. Verify those specs pass in the three browsers and `npm test` passes.

## 7. Integration and release

- [x] 7.1 Open `#/run?mod=./samples/mods/book_list&collection=./samples/mods/book_list/book_collection.yaml` in light and dark, at 4, 6, 8 and 10 per row, and in a narrow window. Open and close a card with the mouse and the keyboard, and verify the look matches the specs, with no colors from the mod.
- [x] 7.2 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `openspec validate redesign-book-list-grid --strict`, and verify all pass.
- [x] 7.3 Add `.changeset/redesign-book-list-grid.md` with `"opentesela": patch` (docs/releasing.md, "Bump rule": no breaking change for people who use or instantiate the app, and no mod API bump) and the summary "The sample book list mod shows its books as a grid of covers, with a "Books per row" choice and a card with each book's details and text." Verify `npx changeset status` lists it as a patch.
