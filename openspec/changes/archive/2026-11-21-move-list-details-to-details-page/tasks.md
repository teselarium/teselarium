# Tasks

## 1. Shared pieces

- [x] 1.1 Move `copyText`, `buildRunLinkAddress`, `COPY_FEEDBACK_MS` and `scheduleFeedbackEnd` from `MoreActionsMenu.tsx` into a module in `src/main/stage/` named for the domain (see design, "Shared clipboard module"), and import them back in `MoreActionsMenu`. Verify that the existing `MoreActionsMenu.test.tsx` "Copy link" cases still pass unchanged.
- [x] 1.2 Add `isWebAddress(value)` in its own pure module, accepting only parsed `http:` and `https:` URLs, and write its unit tests first: `https://…` and `http://…` are accepted, while `file:///…`, `blob:…`, `data:…`, `javascript:…`, `mod_viewer`, `None`, `Unsaved combination` and `""` are refused. Verify with `npm run test -- detail_addresses` (or the chosen file name).

## 2. Details values

- [x] 2.1 Change `buildModDetails`, `buildCollectionDetails` and `buildMosaicListDetails` to read the snapshot's resolved fields, following the table in design, "Detail values come from the resolved snapshot". The run link becomes the app's full address, and an empty mod reference is left out. Verify with `CombinationLists.test.tsx` cases: the mod list shows "Mod" with the resolved mod file address and "Version"; the collection list shows "None" without a collection and "Tile" for a tile link; the mosaic list shows the mosaic file's address and a run link starting with the app's address.

## 3. Details page

- [x] 3.1 Add `isShowingDetails` to `ListView` in `CombinationList.tsx`. While it is set, draw the "Back" item as the `CommandList`'s only row and the details `<dl aria-label="Details">` after the list, inside a key-stopping wrapper, and hide the failed rows. Remove `renderFooter`. Verify with component tests that opening the page shows "Back" highlighted and the details, and that no details section is shown on the main list.
- [x] 3.2 Implement leaving the page, following design, "The details page is a list view" and "Leaving on search, sort and filter". "Back", Backspace in an empty search field, the "Details" button, typing, choosing a sort and checking a filter all go back to the view the page was opened from, with its search and highlighted row, and sort again. Escape closes the list, and opening it again starts on the main list. Verify with one component test per scenario of "Leaving the details page" and with "Back from the details page" of "Rows are sorted again".
- [x] 3.3 Add `DetailActions`: a Copy `StageBarIconButton` with a pinned "Copied" or "Cannot copy" tooltip for 2 seconds, and an Open `<a target="_blank" rel="noopener noreferrer">` styled as an `icon-sm` ghost button, both named after the term. Draw them only when `isWebAddress(value)`. Add the page's polite live region. Verify with component tests:
  - the clipboard text and "Copied";
  - "Cannot copy" with a refusing clipboard;
  - the link's `href`, `target` and `rel`;
  - no controls for "Unsaved combination", the version and a `file:///` mod source;
  - the live region's text after a copy.

## 4. Toolbar

- [x] 4.1 Give `CombinationListToolbar` the props `isShowingDetails`, `onDetailsToggle` and `onFilterChange`, and draw a second divider and the "Details" toggle (`Info` icon, `aria-pressed`, the active filter's pressed classes) after the filter menu. Verify with component tests that the button is named "Details", follows the filter button, is pressed only while the page is shown, and that checking a filter calls `onFilterChange`.

## 5. Explorer links removed

- [x] 5.1 Remove `buildExplorerLink`, `ExplorerLink`, the `explorer` prop and the explorer link calls in the three lists. Remove the "Open the collection explorer" test, and the switched-off-explorer assertion in the "Mosaic details" test of `CombinationLists.test.tsx`. Verify with `npm run lint` (no unused exports or imports) and `npm run test -- CombinationLists`.

## 6. Version out of the mod capsule

- [x] 6.1 Remove `CombinationCapsule`'s `version` prop, its Badge and the `@max-[960px]` variant, make `buildCapsuleName` return `<kind>: <title>`, stop passing the version in `CombinationTitle`, and update the capsule's width comment. Keep `readModCapsuleTitle`'s version for the plain title. Verify by updating `CombinationCapsule.test.tsx` to expect the name and tooltip "Mod: Country Map", and check that the `StageView.test.tsx` plain-title version test still passes.

## 7. End-to-end and docs

- [x] 7.1 Update `e2e/stage_bar.spec.ts`:
  - in "Each step of the ladder", drop the version step and expect no version text in the mod capsule at 1100px and 800px;
  - add the details page: open it from the mosaic list, check the run link value, copy it (clipboard permission granted) and expect "Copied", check the Open link's `href` and `rel`, then go back with "Back" and with Backspace;
  - at `SMALL_PHONE_VIEWPORT` (360×740) from `e2e/layout_probes.ts`: the toolbar fits in the list on one row, the run link wraps without sideways scrolling, and Copy and Open are each at least 32px wide and tall;
  - check the pressed "Details" button's accent background and foreground in the light and the dark color scheme, with the existing theme probes.

  Verify the file passes with `npm run test:e2e -- stage_bar`.
- [x] 7.2 Update `docs/modules/main/README.md`, in the stage bar section:
  - the mod capsule without a version (line 43);
  - the details page, its Back and leaving rules, and the Copy and Open controls with their web-address rule, in place of the details section and explorer links (line 67);
  - the folding steps without the 720px to 959px step, and without `@max-[960px]` (lines 72 to 77).

  Verify that every label it names ("Details", "Copy run link", "Open run link in a new tab", "Copied", "Cannot copy") matches the UI.
- [x] 7.3 Add `.changeset/move-list-details-to-details-page.md` with a `patch` bump, since nothing breaks for people who use or instantiate the app and the mod API doesn't bump. Add a one-line summary: the stage bar's lists show their details on a page opened from a new Details button, with copy and open buttons, and the mod capsule no longer shows the version. Verify the file follows the format of the other files in `.changeset/`.
- [x] 7.4 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify each passes.

## 8. Open in the viewer

- [x] 8.1 Add `buildViewerOpen(kind, address, defaults)` in `src/main/stage/detail_viewers.ts`, following design, "Open goes to the entry's viewer", and write its unit tests first: each kind's link (`mod_viewer`, `collection_viewer` and `mosaic_viewer` with `target`, `tile_viewer` with `tile`) as the app's full address, and its place; `null` when its viewer is switched off. Verify with `npm run test -- detail_viewers`.
- [x] 8.2 Add `open` to `ListDetail`, and have `buildModDetails`, `buildCollectionDetails` and `buildMosaicListDetails` fill it from `buildViewerOpen` with the stage's default mod settings, and give the run link `{ address: value, place: "a new tab" }`. Verify with `CombinationLists.test.tsx` cases: the mosaic list's "Mosaic" opens the mosaic viewer with the mosaic file's address, its "Run link" opens itself, and with `mosaic_viewer` switched off "Mosaic" has no Open link.
- [x] 8.3 Have `DetailActions` name the link `Open <term in lower case> in <place>`, with that tooltip, and its `href` from `open.address`, and leave the link out when `open` is `null`, keeping Copy. Verify by updating `ListDetails.test.tsx`: the viewer link's name and `href`, the run link's, Copy still copying the value, and no Open link for a `null` open.
- [x] 8.4 Update `e2e/stage_bar.spec.ts` "Details page": check "Open mosaic in the mosaic viewer" (`href`, `target`, `rel`), and that following it opens a new page that shows the mosaic viewer for the labels mosaic. Verify with `npm run test:e2e -- stage_bar`.
- [x] 8.5 Update `docs/modules/main/README.md`'s Copy and Open bullet with the viewer links, their names and the switched-off rule, and the summary in `.changeset/move-list-details-to-details-page.md` ("…copy each address or open it in its viewer…"). Verify that every label the docs name matches the UI.
- [x] 8.6 Rerun the checks of 7.4 (`npm ci`, `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e`), and verify each passes.
