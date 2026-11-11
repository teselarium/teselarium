# Proposal

## Why

The sample book list mod shows each book as a full-width row with a 48×72 thumbnail, so the covers are too small to recognize, and a long list is slow to scan. A click only marks a book as selected: the mod never shows a book's details or its body, although the engine renders bodies for mods (`<ot-tile-body>`). The sample is also the project's example of classless theming, so it should show a richer, still classless, layout: a grid, a select and a modal card.

## What Changes

- **A grid of books**: each book is a book-shaped button showing its cover. Covers fill their column with a 2:3 ratio, so every book in the grid has the same size. The left corners are square and the right corners are rounded with the theme's radius. The title and the authors show as text under each cover, the title cut at two lines; the authors are left out at 8 and 10 books per row.
- **Books per row**: a "Books per row" select next to the heading offers 4, 6, 8 and 10, 6 by default. The mod remembers the choice. A new `columns` config key sets the default; a value outside those four is ignored. A cover is never narrower than about 4.5rem: in a narrow frame the grid shows fewer books per row than chosen.
- **A placeholder book**: a book without an `image`, a cover that fails to load, and every book when `show_covers` is `false`, show the book shape with the title written on it.
- **A card for each book**: clicking a book opens a modal `<dialog>` with the book's metadata at the top (a small cover, the title, the authors, the date, country, language and pages, and the genres as badges) and the body below, rendered with `<ot-tile-body>`. Escape, a close button and a click on the backdrop close it, and focus goes back to the book. The card stays open when the books per row or the tiles change, and closes when its book is no longer among the tiles.
- **The last opened book**: the mod marks it with `aria-current="true"` instead of `aria-pressed="true"`, remembers it as before, and does not reopen its card when the mod starts again. What looked for the sample's pressed button (its own tests, the e2e tests and the mod plugin guide) moves to `aria-current`. This is a change of the sample only, not of the mod API.
- **The mod file**: version `1.1.0`, `api` `^0.1.5` (the first mod API with `<ot-tile-body>`), the new `columns: 6` config, and a description that no longer says "a very simple list".
- **Own styles stay without colors**: the mod's CSS sets layout and the book's corner shape, from `--ot-radius`. Its colors, borders, fonts and the current book's outline still come from the theme.

## Capabilities

### New Capabilities

- `sample-book-list`: what the shipped sample book list mod shows and how the user works with it: the grid of books, books per row, the placeholder book, the book's card and the last opened book. The many specs that use the sample mod as a fixture keep doing so.

### Modified Capabilities

- `mod-theme`: "Base stylesheet by default" also names current items (`aria-current`), which the base stylesheet already outlines in `--ot-primary`, and gains a scenario for them. In "Sample and default mods follow the theme", the sample mod may also set the corner shape of its books, from `--ot-radius`; the default mods stay layout only. The sample's scenario "Selection uses the accent" now checks the last opened book.

## Impact

- **Code**: `public/samples/mods/book_list/` (`main.js`, `test.js`, `mod_conf.yaml`) and its copy `src/test/fixtures/mods/book_list/main.js`. No app code changes: the base stylesheet already outlines `[aria-current]`.
- **Tests**:
  - The mod's own cases: the grid, the books per row, the card and the last opened book.
  - e2e: `mod_check.spec.ts` (the real slot keeps the last opened book), `mod_app_actions.spec.ts` (the frame behind the action dialog), and the sample's test code in `mod_routes.ts` move from `aria-pressed` to `aria-current`.
  - The probe `listOwnLookDeclarations` in `e2e/theme_probes.ts` no longer counts corner radii as look.
  - New e2e checks for the `aria-current` outline and the sample's last opened book.
- **Docs**: the engine README's short version of the sample mod, the mod plugin spec's excerpt of `test.js`, and the theme README's description of what the sample's own CSS sets.
- **Mod API version**: none. `mod-theme` only names behavior the base stylesheet already has, and the mount context, the events and the mod file format do not change: `columns` is a key of the sample's own `config`.
- **App version**: patch. The shipped sample mod changes, and nothing breaks for people who use or instantiate the app.
- **Out of scope**:
  - Previous and next buttons in the card.
  - Sorting, filtering or searching books.
  - Reopening the last card when the mod starts.
  - Showing metadata other than the title, authors, date, country, language, pages and genres.
