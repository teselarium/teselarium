# Design

## Context

See proposal.md (Why) and the audit notes in `.audit/android-themes/findings.md` (C1, C2, C3+D1, E1). Current state:

- **Base stylesheet** (`src/lib/core/theme/base_stylesheet.css`, layer `opentesela`): the `body` rule sets padding, colors and the content width, but no `overflow-wrap`. Only the player buttons set `overflow-wrap: anywhere`. The browser's default, `normal`, lets an unbreakable word overflow its line.
- **Default mods' tables**: the three viewers render plain `<table>`s, styled by the base stylesheet (`table { width: 100% }`, `th, td` padding). They are the collection viewer's tiles (`tile_list.ts`, two columns) and the mod and mosaic viewers' permissions (`metadata_card.ts`, `mosaic_card.ts`, four columns `Category`, `Host`, `Reason`, `Status`). Each viewer's `viewer_page.ts` adds `td { overflow-wrap: anywhere; }`. With `anywhere`, a cell's min-content width drops to one character. So on a narrow frame the table shrinks columns to slivers instead of overflowing, and file names and hosts break letter by letter. At 360px the permission table still ends up 27px wider than the frame: the badge and padding cannot shrink.
- **Tile viewer's place** (`collection_place.ts`, styled in `tile_viewer/src/viewer_page.ts`): a `<nav aria-label="Collection">` holds the title button (ghost, does not wrap), the position `<span>` (`flex: 1`), Previous and Next. The span is the item that shrinks, so `7 of 17` wraps.
- **Book list card** (`public/samples/mods/book_list/main.js`): `dialog > header` is a flex row of the small book (`flex: none; width: 6rem`) and a details `<div>` (`flex: 1; min-width: 0`), whose `<dl>` is a grid `auto minmax(0, 1fr)`. On a phone the `<div>` is about 110px wide, the `auto` label column takes about 100px, and the values get 9px. The country map's card already stacks its image above the title.
- Mod frames are `srcdoc` iframes, so a `@media` width query inside a frame measures the frame, not the window.

## Goals / Non-Goals

**Goals:**
- One shared rule fixes long words for every mod that uses the base stylesheet, including third-party mods, without changing how anything else lays out.
- The default mods' tables are readable on a phone and unchanged on wide frames.
- The same breakpoint for every "narrow frame" rule in this change: 30rem.

**Non-Goals:**
- No generic table behavior in the base stylesheet: tables in tile bodies and in third-party mods are not changed.
- No shared code module between default mods. The permission table styles are duplicated in the mod viewer and the mosaic viewer, as `check_report.ts` already is ("Keep both copies alike").
- No change to the app shell (stage bar, sidebar): that is `fix-app-shell-on-phones`.

## Decisions

### D1. `overflow-wrap: break-word` on `body`, in the base stylesheet's layer

The `body` rule in the `opentesela` layer gets `overflow-wrap: break-word`, which every element inherits.

- **Why `break-word`, not `anywhere`:** both break an unbreakable word at the line's end. Only `anywhere` also lowers the element's min-content width, and that is what squeezes the viewers' table columns into slivers. `break-word` keeps tables, flex items and grid tracks at their longest word's width, so layouts that work today don't change. Only text that would overflow wraps.
- **Why on `body`:** one inherited declaration covers paragraphs, links, list items, headings and cells. A mod overrides it with any rule outside a layer, as for every base style.
- **Alternatives:**
  - `word-break: break-all` breaks every word, which hurts reading.
  - `hyphens: auto` depends on the language and does nothing for URLs.
  - Wrapping only `a` and `p` would miss cells, list items and `<dd>`.

### D2. Default mods' tables stack their rows below 30rem, with explicit ARIA roles

In each viewer's style, inside `@media (max-width: 29.99rem)`:

- `table`, `tbody`, `tr` and `td` become blocks (the collection viewer) or each `tr` becomes a small grid (the permissions). The rows are laid out as follows:
  - **A tile:** its label, then its address, each cell across the row.
  - **A permission:** row 1 holds the category and, at its end, the status badge. Row 2 holds the host. Row 3 holds the reason.
- The header row is hidden visually, with the usual clip pattern (`position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%)`), not with `display: none`, so the column headers stay in the accessibility tree.
- **Explicit ARIA roles:** the table builders set `role="table"`, `rowgroup`, `row`, `columnheader` and `cell` on the elements. Browsers, notably WebKit, can drop an HTML table's implicit semantics once its parts get `display: block` or `grid`. Explicit roles keep the semantics whatever the CSS does, so the spec's "Stacked tables keep their semantics" holds in all three engines.
- **Why 30rem:** a phone in portrait gives a frame of about 290 to 340px, and a tablet in portrait about 600px. The audit found the tables fine at the tablet's width and broken only on phones. 30rem (480px) separates the two with room to spare. The same value is used for the book list card (D4), so "narrow frame" means one thing in this change.
- **Why `@media`, not `@container`:** the frame is the container. A width query in a `srcdoc` frame measures it directly, without declaring a container on `body`.
- **Alternatives:**
  - Scrolling the table sideways inside a wrapper keeps the columns, but hides the status, the field that matters most, off-screen.
  - Dropping the Address column on phones would break the collection viewer's requirement to show the full address.

### D3. Tile viewer: the title wraps, the position does not

In the tile viewer's style, the collection title button gets `flex: 1 1 auto; min-width: 0; white-space: normal; text-align: start`. The position `<span>` gets `flex: none; white-space: nowrap` and loses its `flex: 1`. Today the span's `flex: 1` pushes Previous and Next to the end of the row. The title now does that, so the wide layout looks the same: title at the start, then the position and the two buttons.

- **Alternative:** putting the position on its own line on narrow frames. That costs a row on every phone, even when everything fits.

### D4. Book list card stacks its header below 30rem

Inside `@media (max-width: 29.99rem)` in the sample's style:
- `dialog > header` becomes a column.
- The small book is centered at its current 6rem width, keeping its shape and its square left corners.
- The details `<div>` takes the card's full width.

The `<dl>`'s `auto minmax(0, 1fr)` grid is unchanged: with the full width, the values get about 160px on a 412px phone. The DOM order (book, then details) already puts the cover first, so no markup changes. This matches the country map's card, which puts its image above its title.

- **Alternative:** moving the `<dl>` out of the header, under the cover and title. That needs a markup change and changes the wide layout too.

### D5. Tests at the level that can see layout

Every behavior here depends on layout, which jsdom cannot compute, so each requirement gets one Playwright test at a phone viewport (`page.setViewportSize`), plus one wide check where the spec keeps the wide layout:
- `e2e/mod_theme.spec.ts`: a test mod with a bare URL in a narrow frame, the override, and the opted-out mod.
- `e2e/default_mods.spec.ts`: the three tables, the roles, and the tile viewer's position.
- `e2e/sample_book_list.spec.ts`, tagged `@sample`: the card on a phone and on a wide viewport.

None of these depends on the browser engine beyond layout, so they don't need `@frames`. The roles scenario is the one that could differ by engine. It reads ARIA roles, which the explicit roles make engine-independent, so it stays in the default Chromium run.

## Risks / Trade-offs

- [Third-party mods get `break-word` without asking] → It only changes text that would otherwise overflow, which is a defect anyway. A mod restores the old behavior with `body { overflow-wrap: normal; }`, as the spec scenario checks.
- [Hiding the header row visually could leave a stray focusable element] → The header holds only text, nothing focusable. The clip pattern is the same visually-hidden technique the app uses for `sr-only`.
- [The 30rem breakpoint is arbitrary for frames between 480 and 600px] → Those widths keep the columns, as today. The audit found no problem at the tablet's 640px frame. If one shows up, the value lives in three style blocks and is easy to tune.
- [Explicit roles duplicate native semantics] → Harmless where the browser keeps the semantics, and needed where it drops them. The builders set them in one place per table.
- [Permission styles are duplicated in two default mods] → Same accepted pattern as `check_report.ts`, with a "keep both copies alike" comment on each.

## Migration Plan

No data or API migration. The change ships with the app as a patch (changeset). Rollback is reverting the change. No stored state depends on it.
