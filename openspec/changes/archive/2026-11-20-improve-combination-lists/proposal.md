# Proposal

## Why

The stage bar's lists from `rework-stage-bar` work, but trying combinations with them is still slow:
- Their order depends on match counts that load while the list is open.
- Their badges pile up after the titles ("Current", "Recent", "1 mosaic", "no match").
- Every mod or collection row ignores the mosaics that would make it fit, so the country map shows `0/17` on the laureates while their mosaic matches all 17.
- Nothing is measured before a list opens.

## What Changes

- **Four columns** in all three lists:
  1. a **dot**: filled for the current entry, a ring for something tried recently and not saved in the app;
  2. the **name**;
  3. a **mosaic badge**: the mosaic icon and a number in the mod and collection lists, the icon alone in the mosaic list;
  4. the **score**, `matching/total`, with a spinner while counting.

  The "Current", "Recent", "n mosaics" and "no match" badges go away. A score with no matching tile is muted.
- **New default order:**
  - Mod and collection lists: entries that have mosaics with the other capsule's value first, then the rest A-Z.
  - Mosaic list: the current pair's mosaics first, then the other combinations, each A-Z.

  **The "Not compatible" heading is removed.**
- **Toolbar:** a filter button and a sort button after the search field, behind a divider.
  - Sort:
    - mod and collection lists: Mosaics first (default), Name, Match ratio, Matching tiles;
    - mosaic list: This pair first (default), Name, Match ratio, Matching tiles.
  - Filter:
    - mod and collection lists: Compatible only, Has mosaics, Unsaved;
    - mosaic list: This pair only, Same mod, Same collection, Compatible only, Unsaved.

  Each list keeps its own choices until the page is reloaded.
- **Rows that settle:** rows re-sort as summaries and scores arrive, until the user moves the pointer in the list or presses an arrow key. Opening the list, going back from a page, changing the search text and choosing a sort sort the rows again.
- **Pages for rows with mosaics:**
  - In the mod and collection lists, a row with mosaics shows its best score.
  - Choosing it opens a page: that row's mosaics, best score first, then "Without a mosaic" with the plain count.
  - Choosing a mosaic opens it. Choosing "Without a mosaic" is the current mod or collection choice.
- **Scores with aliases:** a mosaic's score counts its tiles after its aliases rename them, as the launch does.
- **No more `any`:** a mod without a tile type scores `total/total`, and its tooltip says so.
- **Search reaches mosaics:**
  - A mod or collection row is also found by the titles of its mosaics. Then it shows how many match, a line naming them, and its page opens with the search carried over.
  - "None", the tile row and the pinned "Unsaved combination" row are hidden while searching.
- **Measured ahead:**
  - Titles and mosaic pairs load when a combination sandbox is shown.
  - Scores load when a capsule is hovered or focused, and when a list opens.
  - All these loads share one limit on parallel requests.
- **Tried combinations:**
  - Recently used also records mod + collection pairs opened without a mosaic.
  - The mosaic list shows them as "Unsaved combination" rows with the ring.
  - When the current sandbox is not a mosaic, its pair is the pinned first row.

Mod API version bump: **none**. The change touches no mod API spec: the engine's methods, events, mount context and mod file format stay as they are (`0.1.16`).

This change builds on `rework-stage-bar`, applied and archived: its `combination-pickers` and `recently-used` texts are the starting point.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `combination-pickers`: the columns, order, sort and filter, settling and re-sorting, pages, scores with aliases and without `any`, the search through mosaics, the pinned rows, measuring ahead, and the tried combination rows. The "Not compatible" heading and the text marks are removed.
- `recently-used`: a fourth kind, the tried mod + collection pairs, and what "recent" marks.
- `app-settings`: the Catalog group also counts tried combinations, and "Clear" drops them.

## Impact

- **Core module** (`src/lib/core/combinations/`):
  - A count is always `{ matching, total, isUntyped }`.
  - Mosaic counts are kept under their own key.
  - Collection summaries keep their tile count.
  - One pure module compares scores.
  - A `fetch` limiter caps parallel loads.
- **Mosaic module** (`src/lib/mosaic/`): `aliasCollectionTiles` moves here from `src/lib/core/engine/mod_launch.ts`, and launch and counting share it.
- **Stage bar** (`src/main/stage/`):
  - `CombinationList.tsx` gets the columns, toolbar, pages, settling and its own filtering.
  - New pure modules hold the row order, the matching, and the sort and filter choices.
  - The capsules start measuring when their tooltip opens.
  - The mod, collection and mosaic lists build the new rows.
  - `PlayerDialog.tsx`'s spinner is shared.
- **App** (`src/main/`): the recently used store gets the combinations kind, the Settings Catalog group counts it, and `main.tsx` starts the summaries.
- **No new dependency:** cmdk, `DropdownMenu`, `Separator`, `Tooltip` and `lucide-react` are already in place.
- **Docs:** the combinations README, the stage README, the main README's stage bar section, and the Settings docs.
- **Tests:**
  - Unit tests for scores, the comparison, the order, the matching, the sort and filter choices, the limiter and the pairs in recently used.
  - Component tests for the lists.
  - e2e tests for pages, search through mosaics, and measuring on hover.
