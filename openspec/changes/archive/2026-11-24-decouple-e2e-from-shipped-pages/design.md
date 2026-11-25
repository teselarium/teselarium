# Design

## Context

`e2e/app_pages.spec.ts` already serves a page file from the test with `servePage`, using `page.route` on `**/pages/<path>.md`. Most other page tests do not: they open `/` and rely on the shipped Home. `docs/code_principles.md` says a test never depends on examples or other modules' fixtures, and the shipped pages are the instance's editorial content.

Tests that read the shipped pages today: the layout, color and chip tests in `app_pages.spec.ts` (lines 260 to 366), `Missing page`, `Vanilla pages`, `Back after switching sections` in `app_sidebar.spec.ts`, `New section after going back` in `mod_stage.spec.ts`, `Vanilla home is not a mod` in `default_mods.spec.ts` and `app.spec.ts`. The Mosaic explorer tests in `default_mods.spec.ts` (`@sample`) list sample titles by hand.

## Goals / Non-Goals

**Goals:**
- A change to the text, headings or number of shipped pages cannot fail a layout, color, history or navigation test.
- One test still proves the vanilla instance ships its three pages.

**Non-Goals:**
- No change to how pages load, to the shipped pages or to the samples.

## Decisions

### D1. Fixture pages with a shared helper

Move `servePage` (and its `answerMarkdown`) from `app_pages.spec.ts` to a shared module `e2e/page_routes.ts`, and use it in each test that needs a page. A test serves `home/index` with a heading it names (for example `# Fixture page`) and asserts on that heading. Alternative: a fixed set of fixture files under `e2e/`: rejected, because a route with the content inline keeps each test readable on its own and matches the existing tests.

### D2. One structural test for the shipped pages

`Vanilla pages` becomes: for Home (`/`), Guides (`#/guides`) and About (`#/about`), the page shows a level 1 heading, the sidebar item of the section is current, and `collectBrowserErrors` is empty. It reads no heading name and no status. `Vanilla home is not a mod` asserts any level 1 heading, and no frame.

### D3. The sample list comes from the catalog

The Mosaic explorer tests read the mosaic references the vanilla instance catalog lists (the `INSTANCE_CATALOG` of `src/main/instance_catalog.ts`), read each mosaic file's title from `public/`, and expect the explorer's cards in that order. A new sample then needs no test edit. The tests that check a card's description and the default-mosaic marks keep reading the two named samples they are about (books and map), which they need as data.

Alternative: leave the lists by hand and edit them per sample: rejected, it is what failed.

### D4. `app.spec.ts` keeps the product name

The shell test checks the product name heading in `main`. The name is the instance's identity, not a draft's wording, and `main` removes the clash with the sidebar's heading.

## Risks / Trade-offs

- [A fixture page hides a real problem of a shipped page] → D2 keeps one test that opens the three shipped pages.
- [Reading the catalog and the mosaic files in a test repeats app code] → the test reads only the list and the `title` key, and fails loudly with the file address if one is missing.
