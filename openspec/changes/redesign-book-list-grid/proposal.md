# Proposal

## Why

The sample book list mod shows each book as a full-width row with a 48×72 thumbnail, so the covers are too small to recognize, and a long list is slow to scan. A click only marks a book as selected: the mod never shows a book's details or its body, although the engine renders bodies for mods (`<ot-tile-body>`). The sample is also the project's example of classless theming, so it should show a richer, still classless, layout: a grid, a select and a modal card.

## What Changes

- **A grid of books**: each book is a book-shaped button showing its cover. Covers fill their column with a 2:3 ratio, so every book in the grid has the same size. The left corners are square and the right corners are rounded with the theme's radius. The title and the authors show as text under each cover, the title cut at two lines; the authors are left out at 8 and 10 books per row.
- **Books per row**: a "Books per row" select next to the heading offers 4, 6, 8 and 10, 6 by default. The mod remembers the choice. A new `columns` config key sets the default; a value outside those four is ignored. A cover is never narrower than about 4.5rem: in a narrow frame the grid shows fewer books per row than chosen.
- **A placeholder book**: a book without an `image`, a cover that fails to load, and every book when `show_covers` is `false`, show the book shape with the title written on it.
- **A card for each book**: clicking a book opens a modal `<dialog>` with the book's metadata at the top (a small cover when the book has one, the title, the authors, the year of publication, country, language and pages, and the genres as badges) and the body below, rendered with `<ot-tile-body>`. Escape, a close button and a click on the backdrop close it, and focus goes back to the book. The card stays open when the books per row or the tiles change, and closes when its book is no longer among the tiles.
- **The raised book**: a book is raised, moved up a little with the theme's shadow, while the pointer is over it, while it has keyboard focus and while its card is open. Its button tells whether its card is open (`aria-expanded`). The mod no longer marks a chosen book (`aria-pressed`) or remembers it (the `selected` storage key). What looked for the sample's pressed or remembered book (its own tests, the e2e tests, the mod plugin guide and the specs that use it as their storage example) moves to the remembered books per row or to the raised book. This is a change of the sample only, not of the mod API.
- **The mod file**: version `1.1.0`, `api` `^0.1.5` (the first mod API with `<ot-tile-body>`), the new `columns: 6` config, and a description that no longer says "a very simple list".
- **Own styles stay without colors**: the mod's CSS sets layout, the book's corner shape, from `--ot-radius`, and the raised book's shadow, from `--ot-shadow`. Its colors, borders and fonts still come from the theme.

## Capabilities

### New Capabilities

- `sample-book-list`: what the shipped sample book list mod shows and how the user works with it: the grid of books, books per row, the placeholder book, the book's card and the raised book. The many specs that use the sample mod as a fixture keep doing so.

### Modified Capabilities

- `mod-theme`: "Sample and default mods follow the theme" is replaced by "Sample and default mods take the theme's look", in which the sample mod may also set the corner shape of its books, from `--ot-radius`, and their shadow, from `--ot-shadow`; the default mods stay layout only. Its sample scenario checks the raised book's shadow instead of the selected book's outline.
- `mod-api-version`: "Sample and default mods declare the API range" lets the sample declare `^0.1.5`; the default mods keep `^0.1.0`.
- `default-mods`: the explorer's and the viewer's scenarios show the sample's new description, version `1.1.0` and range `^0.1.5`, and the viewer's check report lists the sample's new cases.
- `stage-bar`: the scenarios that show the sample's version show `1.1.0`.
- `mod-stage`: "Open a mod from a run link" shows `1.1.0`, and "Sample book list mod" remembers the books per row instead of a selected book; its scenario "Selection is remembered" now checks the "Books per row" choice.
- `mod-check`: "Real slot untouched" uses the remembered books per row instead of a selected book.
- `mod-tests`: "Seeded storage" and "Requests are recorded" use the books per row (`columns`), and "Sample mod tests" names `remembers the books per row` instead of `highlights the remembered book`.
- `mod-app-actions`: "Frame cannot be used behind the dialog" checks that no card opens, instead of that no book is selected.

## Impact

- **Code**: `public/samples/mods/book_list/` (`main.js`, `test.js`, `mod_conf.yaml`) and its copy `src/test/fixtures/mods/book_list/main.js`. No app code changes: the theme already has `--ot-shadow`.
- **Tests**:
  - The mod's own cases: the grid, the books per row, the card and the raised book.
  - e2e: `mod_check.spec.ts` (the real slot keeps the books per row), `mod_stage.spec.ts` (the books per row are remembered), `mod_theme.spec.ts` (the raised book's shadow), `mod_app_actions.spec.ts` (no card opens behind the action dialog), and the sample's test code in `mod_routes.ts` move from `aria-pressed` and `selected` to the books per row or the raised book.
  - The probe `listOwnLookDeclarations` in `e2e/theme_probes.ts` no longer counts corner radii or a `box-shadow` of `var(--ot-shadow)` as look.
  - New e2e checks for the sample's raised book.
  - The checks that read the sample's version, description, API range or case names: `mod_stage.spec.ts`, `stage_bar.spec.ts`, `default_mods.spec.ts`, `mod_tests.spec.ts`, `mod_check.spec.ts` and `src/lib/mod/sample_mod.test.ts`. `mod_app_actions.spec.ts` looks for an open `<dialog>` in the frame, since the sample now always has one.
- **Docs**: the engine README's short version of the sample mod, the mod plugin spec's excerpt of `test.js`, the theme README's description of what the sample's own CSS sets, and the mod module README's copy of the sample's `mod_conf.yaml`.
- **Mod API version**: none. `mod-theme` only changes what the sample's own styles may set, and the mount context, the events and the mod file format do not change: `columns` is a key of the sample's own `config`.
- **App version**: patch. The shipped sample mod changes, and nothing breaks for people who use or instantiate the app.
- **Out of scope**:
  - Previous and next buttons in the card.
  - Sorting, filtering or searching books.
  - Reopening the last card when the mod starts.
  - Remembering the last opened book.
  - Showing metadata other than the title, authors, date, country, language, pages and genres.
