# Proposal

## Why

The e2e tests read the text of the pages the vanilla app ships. When the page drafts were replaced (`public/pages/*`), 14 e2e tests failed although no behavior changed: they look for a `Home` heading and a "work in progress" status that the new drafts do not have. The `Vanilla pages` requirement of `app-pages` says the same, so the spec itself ties the product to the wording of its first drafts. The same happens with the Mosaic explorer tests, which list the sample mosaics by title and fail when a sample is added.

## What Changes

- The e2e tests of page layout, colors, history and sidebar navigation serve their own page files (as the "Replaced page" test already does) instead of reading the shipped pages, so editing `public/pages/` cannot break them.
- Keep one structural test of the shipped pages: Home, Guides and About exist, are listed in the sidebar, show a level 1 heading, and load without browser errors. It does not read their wording.
- Drop the wording checks (`work in progress`, `early phase`, the heading texts `Home` and `Teselarium` as a page's name).
- The Mosaic explorer tests that list the samples compare the explorer's cards with the mosaics the vanilla instance catalog lists, read from the catalog, instead of a fixed list of titles.
- The `Vanilla pages` requirement of `app-pages` drops the status note: it asks for the three pages, each with a level 1 heading, and nothing about their wording.
- No change to the app, the shipped pages, the samples or the mod API.
- Out of scope: rewriting the shipped pages, and the `@sample` tests of the sample mods themselves.

Phone viewport and color schemes: no interface or layout changes. The existing tests keep their phone viewports and both color schemes, with fixture pages in place of the shipped ones.

Mod API version: no bump, because no mod API spec changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-pages`: the `Vanilla pages` requirement no longer requires a status note, and covers the Guides and About pages with a scenario.

## Impact

- Tests only: `e2e/app_pages.spec.ts`, `e2e/app_sidebar.spec.ts`, `e2e/mod_stage.spec.ts`, `e2e/default_mods.spec.ts`, `e2e/app.spec.ts`, and a shared e2e helper for serving a page file.
- `app-pages` main spec, at archive.
- Release: a patch changeset, since the instance's documented behavior (the spec) changes while the app does not.
