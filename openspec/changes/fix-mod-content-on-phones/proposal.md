# Proposal

## Why

An audit of the app on Android phone viewports, in the light and dark themes (`.audit/android-themes/findings.md`, not committed), found that the content inside mod frames breaks on phones. A long word or bare URL makes a mod's document scroll sideways. The default mods' tables squeeze their columns until names and addresses break letter by letter, and at 360px the permission table is cut at the frame's edge. The tile viewer's position (`7 of 17`) wraps over three lines. The sample book list's card leaves its values 9px wide, so "1953" and "United States" read vertically. The themes are not at fault: every finding shows in both. The causes are a missing wrapping rule in the base stylesheet, and layouts in the default mods and the book list sample that only fit wide frames.

## What Changes

- The base stylesheet wraps long words: text that has no break opportunity, such as a bare URL, breaks at the frame's edge instead of making the document scroll sideways. A mod's own style still overrides it.
- In a narrow frame, the default mods' tables stack each row: the collection viewer's tiles (label, then address), and the mod viewer's and mosaic viewer's permissions (category and status, then host, then reason). Each value keeps a readable width, and no table is wider than its frame. The tables keep their semantics for assistive technology. Wide frames are unchanged.
- The base stylesheet draws a table's row separators on the rows instead of the cells. A row a mod stacks in a narrow frame keeps one line under it, instead of one under each value. Wide tables look the same.
- The tile viewer's place in a collection keeps its position (`<i> of <n>`) on one line. The collection's title wraps instead. Its button is only as wide as its text.
- In a narrow frame, the book list's card shows the cover above the title and the labeled values, as the country map's card already does.
- Mod API version bump: **none**. The base stylesheet, the default mods' layout and the sample's layout are not part of the mod API, which covers the engine's methods and events, the mount context, the mod file format and the test API. No method, event, context key or mod file key changes. The app bumps as a **patch**, since this is a fix.

Out of scope:
- The app shell on phones: the stage bar, sidebar tooltips, list contrast, the drawer's close button and the sidebar's collapse button. These are a separate change, `fix-app-shell-on-phones`.
- Tables a mod writes itself, and tables in tile bodies. The base stylesheet does not make them scroll or stack.
- Mermaid diagrams, which shrink to their container by mermaid's default as `tile-bodies` requires (accepted in the audit).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `mod-theme`: the base stylesheet wraps long words, so text alone never makes a frame scroll sideways, and draws table row separators on the rows.
- `default-mods`: the collection viewer's tile table and the mod and mosaic viewers' permission tables stack their rows in a narrow frame. The tile viewer keeps its position on one line.
- `sample-book-list`: the card shows the cover above the metadata in a narrow frame.

## Impact

- Base stylesheet: `src/lib/core/theme/base_stylesheet.css` (a wrapping rule on the page's text, and the row separators moved from the cells to the rows), and its description in `docs/modules/lib/core/theme/README.md`.
- Default mods:
  - `default_mods/collection_viewer/src/viewer_page.ts` and `tile_list.ts`;
  - `default_mods/mod_viewer/src/viewer_page.ts` and `metadata_card.ts`;
  - `default_mods/mosaic_viewer/src/viewer_page.ts` and `mosaic_card.ts`;
  - `default_mods/tile_viewer/src/viewer_page.ts`.
- Sample: `public/samples/mods/book_list/main.js` (card styles).
- E2E: phone-width checks in `e2e/mod_theme.spec.ts`, `e2e/default_mods.spec.ts` and `e2e/sample_book_list.spec.ts` (`@sample`). The sample change means `npm run test:e2e:samples` runs too.
- A changeset `.changeset/fix-mod-content-on-phones.md` (patch).
- No new dependency, no API change. Third-party mods that use the base stylesheet get the wrapping rule. Their own styles still win, since the rule is in the `opentesela` layer. A mod that hid the cells' separators with its own `td` rule sees them again, on the row.
