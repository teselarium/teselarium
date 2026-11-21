# Proposal

## Why

Each of the stage bar's three lists ends with a details footer that takes up a lot of space: the current entry's addresses and, in the mosaic list, the long encoded run link, followed by a link to the explorer. On a phone, where a list is at most 328px wide, these values wrap over several lines and leave less room for the rows. The details are rarely needed while choosing a combination, and the explorer links repeat what the sidebar already offers. The mod capsule's version takes up room in the bar too.

## What Changes

- **A "Details" button in each list's toolbar**, after the filter button and behind a divider. It shows a details page in place of the rows. The page starts with a "Back" row and holds the current entry's details:
  - mod list: the mod's address and its version;
  - collection list: the collection's address, or the tile's, or "None";
  - mosaic list: the mosaic file's address, or "Unsaved combination", then the run link as the app's full address.

  The values stay text the user can select. While the page is shown, the button is shown pressed, and pressing it again goes back.
- **Copy and open buttons**: each value that is an `http:` or `https:` address gets a "Copy" button and an "Open in a new tab" button. A copy confirms with "Copied", or says "Cannot copy" when the clipboard refuses. The version, "None", "Unsaved combination" and any other address (such as a local file) get no buttons.
- **Removed**: the details footer is removed, and so are the "Open the mod explorer", "Open the collection explorer" and "Open the mosaic explorer" links. The explorers remain available from the sidebar.
- **Removed**: the mod capsule no longer shows the mod's version, at any bar width. Its accessible name and tooltip follow what it shows: "Mod: Country Map". The version is shown on the mod list's details page. A sandbox shown with a plain title, which has no list, keeps its version in that title.
- The bar's folding steps lose the step where the version is hidden (720px to 959px). The remaining steps are: full titles from 720px, icons only from 480px to 719px, and one capsule on a narrow bar.

Mod API version bump: **none**. The change touches no mod API spec. The engine's methods, events, mount context and mod file format stay as they are.

**Phone viewport**: the "Details" button joins the toolbar's sort and filter buttons, and on a 328px-wide list the search field keeps about 210px. The details page takes the place of the rows, so its values wrap inside the list's width instead of below the rows. The copy and open buttons are icon buttons the size of the toolbar's buttons, and work on touch. Their tooltips show only where the pointer can hover, and their accessible names hold the same text. The capsules are shorter without the version, so the bar folds later.

**Color schemes**: the change adds no color. The buttons, the pressed state and the details text use the theme tokens that the toolbar and the old footer already use, in both light and dark.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `combination-pickers`: "Details footer" is removed and replaced by new requirements: "Details button", "Details page", "Details of each list", "Leaving the details page", "Copy and open buttons", "Copying a detail", "Opening a detail in a new tab" and "Details buttons are easy to tap". "Explorer links" and "Explorer links are easy to tap" are removed. "Rows are sorted again" also covers going back from the details page.
- `stage-bar`: the mod capsule shows no version, and its accessible name and tooltip match what it shows ("Combination capsules", "Capsule contents", "Name while loading or after a failure"). "The bar folds as it narrows" loses its 720px to 959px step.

## Impact

- `src/main/stage/CombinationList.tsx`: the footer is replaced by the details page, and the list's view gains a details state.
- `src/main/stage/CombinationListToolbar.tsx`: the "Details" button.
- `src/main/stage/ModList.tsx`, `CollectionList.tsx`, `MosaicList.tsx`: their details read the snapshot's resolved addresses, and they pass no explorer link.
- `src/main/stage/combination_list_inputs.ts`: `buildExplorerLink` and the `ExplorerLink` type are removed.
- `src/main/stage/MoreActionsMenu.tsx`: its clipboard and run-link address code moves to a module that the details page shares.
- `src/main/stage/CombinationCapsule.tsx`, `CombinationTitle.tsx`: the capsule's `version` prop is removed. `capsule_titles.ts` keeps the version for the plain title.
- Tests: `CombinationLists.test.tsx`, `CombinationCapsule.test.tsx`, `e2e/stage_bar.spec.ts` (the ladder's version step and new details-page cases).
- Docs: `docs/modules/main/README.md`, if it describes the footer or the version step.
- No new dependency. The `Info`, `Copy` and `ExternalLink` icons come from `lucide-react`, which the app already uses.
