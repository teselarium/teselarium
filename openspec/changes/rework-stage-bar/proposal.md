# Proposal

## Why

The stage bar says which mod runs, but changing what runs means going back through the explorers, one mod or collection at a time. A mosaic is a mod plus a collection, and the stage bar is the natural place to try other mods on the same data, other data on the same mod, or other mosaics of the same pair. With the app catalog from `add-app-catalog` in place, the bar has the lists it needs.

## What Changes

- The stage bar's left side becomes a **recipe**: `[mod] + [collection] -> [mosaic]`, three capsules with an icon and a chevron. When the pair is not a mosaic, the mosaic capsule is a dashed "Unsaved combination". Interactive capsules are shown for sandboxes opened from a mosaic, a collection or a tile, or running a mod that the catalog or recently used holds. Other sandboxes, such as the explorers and viewers, keep a plain title.
- Each capsule opens its own **searchable list**:
  - **Mod and collection lists:** entries from the catalog and from recently used items. Compatible entries come first, the incompatible ones are muted and labeled, and tile-match counts load lazily. A `n mosaics` marker shows entries that have mosaics with the other capsule's value. The collection list starts with a "None" row.
  - **Mosaic list:** mosaics of the current pair first, each with an alias summary, then the other combinations, each with its mod and collection.
  - **Footer:** each list ends with a details section (the item's source or location) and a link to its explorer.
- **Choosing an entry** opens the new combination in place of the visible sandbox, with a new history entry, so Back returns to the previous one:
  - Choosing a mod keeps the collection or tile.
  - Choosing a collection keeps the mod.
  - Choosing a mosaic replaces both.
  - Changing the mod drops the link's other params, and changing only the collection keeps them.
- **Swapping the mod inside a mosaic keeps the mosaic's `show` hosts**: the new link names the mosaic as `sites`, the run link parameter that `add-mosaic-sites-link` adds. A shield chip in the bar shows those hosts and drops them when pressed. Swapping the collection drops them.
- **Recently used**: the mods, collections and mosaics opened in combination sandboxes are remembered, up to 10 per kind. The Settings page's Catalog group shows how many and has a "Clear" button.
- **Fewer buttons**:
  - The information button and its popover are removed: each list's details footer holds what it showed.
  - The Share button and "Reload tiles" move into a `...` overflow menu.
  - The version moves into the mod capsule.
- **Long titles**: capsules have a max width and a shrink order (collection first, then mod, and the mosaic last). At narrower bar widths, the version moves into the mod list, then mod and collection drop to icons, then everything folds into one capsule whose menu has Mosaic, Mod and Collection rows. The bar stays one row.

Mod API version bump: **none**. The change touches no mod API spec: the engine's methods, events, mount context and mod file format stay as `add-mosaic-sites-link` leaves them (`0.1.16`).

This change builds on two changes, which must be applied first:
- `add-app-catalog`: this change reads the catalog, and its Settings delta starts from that change's text;
- `add-mosaic-sites-link`: it provides the `sites` link that the mod swap and the shield chip build.

## Capabilities

### New Capabilities
- `combination-pickers`: the stage bar's three lists. Covers their entries, order, compatibility counts and labels, the mosaic markers, the mosaic grouping and alias summaries, the "None" and tile rows, the details footer and the explorer links, and what choosing an entry opens.
- `recently-used`: the remembered mods, collections and mosaics. Covers what is recorded and when, the limit, the order, the storage, and clearing.

### Modified Capabilities
- `stage-bar`: the recipe layout and which sandboxes get capsules, the loading and failure texts in capsules, the overflow menu with Copy link and Reload tiles, the shield chip, closing on a click outside for the lists, and the width ladder. The information popover requirements and the old mosaic title requirement are removed.
- `mod-stage`: opening a combination in place of the visible sandbox with a new history entry, and the home mod exception.
- `app-settings`: the Catalog group gets the recently used count and "Clear".

## Impact

- **Stage bar UI** (`src/main/stage/`):
  - `StageBar.tsx` is reorganized.
  - New components: the capsules, the three lists, the overflow menu and the shield chip.
  - `ModInfoPopover.tsx` and `ShareMenu.tsx` are replaced. Copy link moves to the overflow menu.
  - shadcn `command` is vendored (cmdk) for the searchable lists.
- **Stage** (`src/lib/core/stage/`):
  - The sandbox snapshot gains the tile, the link params, the collection title, the mosaic's aliases and `show` lines, and the `sites` mosaic.
  - A new `openStageCombination` opens a combination in place of the visible sandbox with a new history entry.
  - The stage reports the files a combination sandbox loaded, for recently used.
- **New core module** (`src/lib/core/combinations/`): cached loading of catalog entries (mod files, collection indexes, mosaic files) and tile-match counts.
- **App** (`src/main/`): a recently used store, the Settings Catalog group additions, and `main.tsx` wiring.
- **Docs**: stage README, main README, Settings docs, and the stage bar section of the user-facing docs.
- **Tests**:
  - Unit tests for the core module, the choice links, the swap opening and recently used.
  - Component tests for the bar and the lists.
  - e2e tests for swaps, Back, the shield chip, and the width ladder.
  - `e2e/stage_bar.spec.ts` is largely rewritten.
