# Design

## Context

See proposal.md for the motivation, and the `sample-book-list` and `mod-theme` deltas for the behavior.

How the sample works today (`public/samples/mods/book_list/main.js`):
- `mount` builds a `view` (`engine`, `root: document.body`, `title`, `config`, `tiles`, `selected`), reads `selected` from storage, and calls `renderBookList`.
- `renderBookList` replaces every child of `<body>` with an `<h1>` and either a `<ul>` of book buttons or a `role="status"` paragraph. `tiles.changed` and a click both re-render the whole body.
- Its `<style>` sets layout only. The e2e test "Own styles are layout only" (`e2e/default_mods.spec.ts`) checks this with `listOwnLookDeclarations` (`e2e/theme_probes.ts`), which flags every property matching `^(background|border|font)|color$|shadow$`, so corner radii count as look.

What the theme and the frame loader already give a mod:
- A plain `<button>` is an outline button: background, a 1px border, `--ot-radius` on every corner, an accent fill on hover, a `min-height` and padding.
- `button[aria-pressed="true"]` and `[aria-current]:not([aria-current="false"])` get a 3px `--ot-primary` outline, placed after the focus rings so it wins on focus.
- `<dialog>` gets the popover look, and `::backdrop` gets a dimmed background.
- `<dl>` and `<span data-ot-variant="secondary">` (a badge) are styled. `<hr>` is styled.
- `<ot-tile-body>` renders a tile's body and handles clicks on its links and players. It needs mod API `0.1.5`.

Two copies of the entrypoint exist:
- `src/test/fixtures/mods/book_list/main.js` is identical to the sample, and unit tests load it as "the sample mod". Nothing in it is asserted beyond being loaded.
- The e2e helper `SAMPLE_ENTRYPOINT_CODE` reads the shipped file, so e2e test mods that reuse it follow automatically.

## Goals / Non-Goals

**Goals:**
- Keep the sample an example of "write HTML, get the app's look":
  - Every visible element is a plain element the base stylesheet already styles.
  - The mod's CSS adds layout and the book's corner shape only.
- Keep the code a readable sample for mod authors: one file, no build step, with the same structure as today (small named functions and a `view` object).

**Non-Goals:**
- Changing the base stylesheet or the probes of the default mods.
- Adding a way for mods to get a `<dialog>` from the app (`ui.*`): the card lives in the mod's frame.
- Virtualizing large collections: the sample collection has three books.

## Decisions

### D1. The button is the book; the caption sits under it

Each `<li>` holds the book `<button>`, then a caption `<p>` with `<strong>` (the title) and `<small>` (the authors). The button holds only the cover `<img>` or the placeholder `<span>`. Its CSS gives it `aspect-ratio: 2 / 3`, `width: 100%`, `padding: 0`, `overflow: hidden` and `min-height: 0`, and the image gets `width: 100%`, `height: 100%` and `object-fit: cover`.

Why:
- The button's own theme surface (background and border) becomes the placeholder's book, with no colors added by the mod.
- The `aria-current` outline and the focus ring go around the book, which is the thing the user presses.
- `overflow: hidden` clips the image to the button's corners but not its outline, which is drawn outside the border box.

The button's accessible name is set with `aria-label` to the title and the authors (`Kallocain, Karin Boye`). That matches the `sample-book-list` requirement even when the caption's authors are hidden at 8 and 10 per row. An `aria-labelledby` pointing at a partly hidden caption is computed differently across browsers. The cover keeps `alt="Cover of <title>"`, which the e2e test of relative cover paths reads.

The caption is not clickable. Only the book is.

Alternatives considered:
- The whole item as one outline button, with the cover and caption inside, like today's rows. The book would sit inside a rounded card. A placeholder would then need a surface of its own, which means a background the mod sets. That breaks the layout-only rule.
- `clip-path: inset(0 round 0 R R 0)` for the shape, which the look probe does not flag. On the button, it clips the focus ring and the `aria-current` outline, which is an accessibility regression. On an inner element, it leaves the placeholder without a surface.

### D2. The corner shape is allowed, from `--ot-radius`, in the sample only

The button gets `border-top-left-radius: 0` and `border-bottom-left-radius: 0`. The right corners keep the base stylesheet's `--ot-radius`, so the shape follows the theme.

`listOwnLookDeclarations` in `e2e/theme_probes.ts` stops flagging properties ending in `-radius`. Only the sample's test uses it. The default mods keep their own `LOOK_PROPERTY_PATTERN` in `default_mods/*/test/look_probes.ts` unchanged. The `mod-theme` delta allows corner shape for the sample's books only.

The mod's header comment and the theme README change from "sets layout only" to "sets layout and the books' corner shape".

- *Alternative:* keep the probe strict and draw the books with uniform corners. That drops a feature the user asked for.

### D3. Books per row with a data attribute and one grid rule

The `<ul>` carries `data-columns="4|6|8|10"`. Four short rules map each value to a custom property, `--books-per-row`. One grid rule uses it:

```css
ul[data-columns] {
  --book-min: 4.5rem;
  grid-template-columns: repeat(
    auto-fill,
    minmax(max(var(--book-min), calc((100% - (var(--books-per-row) - 1) * var(--ot-space-4)) / var(--books-per-row))), 1fr)
  );
}
```

How the formula behaves:
- When the frame is wide enough, the minimum track is exactly 1/N of the row, so `auto-fill` makes N columns.
- When it is too narrow, `--book-min` wins, and fewer columns fit. That is the "Narrow frames" requirement, with no resize listener.

Changing the select sets the attribute and stores the value. It does not rebuild the list, so images do not reload.

`readBooksPerRow(value)` accepts only 4, 6, 8 and 10 and returns 6 for anything else. The start value is the stored `columns` if valid, otherwise `config.columns` if valid, otherwise 6.

The authors in the caption are hidden at 8 and 10 per row with `ul[data-columns="8"] small, ul[data-columns="10"] small { display: none; }`. The title gets `-webkit-line-clamp: 2` with `display: -webkit-box` and `overflow: hidden`. These are layout properties, not look properties.

- *Alternative:* an inline `style="--books-per-row: 6"`. It works, but attribute selectors keep every style in the mod's one `<style>` element, where a reader of the sample finds them.

### D4. The page is split into a re-rendered part and a persistent dialog

At mount, the mod builds `<body>` once with two parts:
- a `<main>`, which holds the `<header>` (`<h1>` and the `<label>` with its `<select>`) and the list or the empty status;
- one `<dialog>`, created once and never replaced.

`renderBookList` now replaces the children of `<main>` only. A `tiles.changed` therefore never destroys an open card. The select lives in the header of `<main>`, and is left out with the list when there are no tiles.

`view` gains the following fields:
- `booksPerRow`;
- `openSource`, the source of the open card or `null`;
- `card`, the `<dialog>` element.

### D5. The card's content is built from the tile each time it opens

`openBookCard(view, source)` does the following:
1. Finds the tile.
2. Fills the dialog with a `<header>`: a small book (the same cover or placeholder markup, at a fixed width of about 6rem), a `<div>` with the `<h2 id="book-card-title">`, a `<p><small>` with the authors, a `<dl>`, and a `<p>` of genre badges.
3. Adds an `<hr>`, then an `<ot-tile-body>` whose `tile` is set to the tile.
4. Calls `showModal()`, sets `view.openSource`, and stores `selected` as today.

The `<dl>` holds date, country, language and pages. It uses labels "Published", "Country", "Language" and "Pages", and leaves out each key that is missing or not a string or number. The dialog has `aria-labelledby="book-card-title"`. A ghost close button sits at the top of the dialog (`<button type="button" data-ot-variant="ghost" aria-label="Close">×</button>`).

When the body is empty, no `<hr>` is added and `<ot-tile-body>` renders nothing.

On `tiles.changed`:
- If `openSource` is among the new tiles, the card is rebuilt from the new tile.
- Otherwise the dialog is closed.

Since `<ot-tile-body>` is used:
- the body's links, players and fragment links work through the frame loader, with no code in the mod;
- the mod file's `api` becomes `^0.1.5`.

### D6. Closing, the backdrop and focus

The dialog closes in three ways:
- **Escape**: the native `cancel` behavior of a modal dialog.
- **The close button**: calls `card.close()`.
- **A backdrop click**: a `click` listener on the dialog compares the click's coordinates with `card.getBoundingClientRect()`, and closes the card when the click is outside the rectangle. A click on the backdrop targets the `<dialog>` element itself, but so does a click on the dialog's padding, so the target alone cannot tell them apart.
  - *Alternative:* the `closedby="any"` attribute. It is not supported by every browser the app targets yet.

A `close` listener does the following:
- clears `openSource`;
- re-renders `<main>`, so `aria-current` moves to the opened book;
- focuses the button of the book whose card it was, found by `data-source` in the current list.

The browser's own focus restore cannot be relied on: a `tiles.changed` while the card was open may have replaced the button it would return to.

### D7. `aria-current` replaces `aria-pressed`

`buildBookButton` sets `aria-current="true"` only on the book whose `source` equals `view.selected`, and removes the attribute on all others. It never sets `aria-pressed`.

The storage key `selected` and its meaning (the source of the last chosen book) stay. A slot written by today's sample keeps working after the update.

Opening the card stores `selected` before the dialog shows. The `aria-current` mark changes when the card closes, because `<main>` is re-rendered then (D6) and not while the modal is open.

### D8. The placeholder

`buildBookFace(view, tile)` returns either the cover `<img>` or a placeholder `<span>` holding the title:
- When covers are shown and the tile has a string `image`, it returns the `<img>`.
- An `error` listener on the `<img>` replaces it with the placeholder.

The placeholder `<span>` is centered in the button with flex layout and padding, and its text is cut with line clamping. It has the button's theme colors. On hover, the theme's accent fill applies to it like to any button.

The `<span>` is `aria-hidden="true"`, because the button's `aria-label` already names the book.

## Risks / Trade-offs

- [The base stylesheet's `button` `min-height` and padding fight the 2:3 box] → The mod resets `padding` and `min-height` on its book buttons, which is layout. The tests check the 2:3 ratio from the bounding box.
- [With image covers, the hover fill is hidden behind the image, so pointer users get no hover feedback] → On `:hover` and `:focus-visible`, the book is lifted with `transform: translateY(-2px)` and a short `transition` on `transform`, both turned off under `prefers-reduced-motion: reduce`. These are not look properties, and the probe does not flag them.
- [A backdrop click detected by coordinates can be wrong for clicks on the dialog's scrollbar] → The rectangle includes the scrollbar, so those clicks count as inside.
- [Many e2e specs locate books by `getByRole("button", { name: /Kallocain/ })` and `getByText`] → The `aria-label` keeps the title in the name, and the caption keeps the title as visible text. The specs that read `aria-pressed` move to `aria-current` (see tasks).
- [Hidden test frames: `showModal()` in a hidden case frame] → A modal dialog opens in a hidden document too. The mod's own cases check `card.open` and the dialog's content, not its rendering.
- [The fixture copy in `src/test/fixtures/` drifts from the sample] → It is replaced with the new file in the same change. The fixture's `mod_conf.yaml` keeps its own paths and gains no `columns`, so the `mod-loading` scenarios about its `config` stay true.

## Migration Plan

None beyond shipping. Storage slots written by the current sample keep their `selected` value, and get `columns` the first time the user changes the select. Rolling back restores the old file, which ignores `columns`.
