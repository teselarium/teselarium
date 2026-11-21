# Design

## Context

`CombinationList.tsx` draws the three lists: a toolbar (`CombinationListToolbar`), then a cmdk `CommandList` with the rows, then the failed rows, and `renderFooter(details, explorer)` as the last child of the `PopoverContent`. `ModList`, `CollectionList` and `MosaicList` build the `ListDetail[]` from the sandbox's raw link values (`link.mod`, `link.collection`, `link.tile`) and an `ExplorerLink` from `buildExplorerLink`.

The list already has one kind of page. `ListView` (`pageId`, `mainSearch`, `pageSearch`) shows an entry's page with a "Back" `CommandItem`. Opening the list resets the view to `MAIN_VIEW`, and `goBack` restores the parent's highlight and sorts again.

`SandboxSnapshot` already carries resolved addresses: `mod.source` once loaded, and `modReference`, `collection`, `tile` and `mosaicReference`, each resolved against the app's address. The raw link values can be relative, or a default mod name such as `mod_viewer`.

"Copy link" (`MoreActionsMenu.tsx`) has its own `copyText`, `buildRunLinkAddress` and 2-second feedback timer, and `StageBar` announces the feedback through an `sr-only` polite live region.

The mod capsule's version is a `Badge` hidden by `@max-[960px]:hidden`, and `buildCapsuleName` appends it to the accessible name. The plain title (`StageBar.tsx`) reads the same `readModCapsuleTitle` and shows the version on its own.

## Goals / Non-Goals

**Goals:**
- The details page reuses the list's page mechanism: the same "Back" row, Backspace, focus and highlight handling. It doesn't add a popover inside the list's popover.
- One clipboard and run-link address module, shared by "Copy link" and the details page.
- Deciding whether a value is a web address is a pure function with unit tests.

**Non-Goals:**
- Details for rows other than the current entry. That's a follow-up.
- Changing what "Copy link" in "More actions" does or says.
- Changing the folded capsule's menu. It already opens the same three lists.

## Decisions

### The details page is a list view, not a popover

`ListView` gains `isShowingDetails: boolean`. While it is true:
- the `CommandList` holds only the "Back" item (`value` `BACK_ID`, highlighted);
- the details section is drawn after the `CommandList`, where the footer was;
- the failed rows are not drawn.

`pageId`, `mainSearch` and `pageSearch` are left as they are. Going back only clears the flag, so the user returns to the main list or to the entry's page they came from, as "Leaving the details page" requires. The highlighted row is kept in a ref when the page opens and restored on the way back, in the same way `goBack` restores the parent (`pendingHighlightRef`, `scrollTargetRef`). Going back calls `sortAgain()`.

*Alternative: a nested Popover anchored to the "Details" button.* It was rejected for three reasons:
- On a 328px phone list, a second popover covers the list or falls outside the viewport.
- It needs its own Escape and focus handling, inside a non-modal popover that already contains two non-modal menus.
- The page pattern already exists and users already know it.

### The details sit outside the cmdk list

The `CommandList` has the `listbox` role, and an option can't contain buttons or links. So the details are a `<dl aria-label="Details">` outside the `CommandList`, with selectable text (`select-text`), as the footer was. The section's wrapper stops key propagation (`stopKeyPropagation`, as the toolbar's buttons do), so Enter or Space on a Copy button doesn't reach cmdk and choose "Back". With the keyboard, Tab moves from the search field through sort, filter and Details to each Copy button and Open link.

### Leaving on search, sort and filter

`handleSearchChange` clears `isShowingDetails` and applies the text to the view the user returns to: `mainSearch`, or `pageSearch` when a page is open. Choosing a sort already calls `onSortChoose`, and the list's handler now also clears the flag. The toolbar gains `onFilterChange`, called after `checkListFilter`, which does the same. Backspace in an empty search field goes back, through `handleKeyDown`, as on an entry's page.

### Toolbar button

`CombinationListToolbar` takes `isShowingDetails` and `onDetailsToggle`. After the filter menu comes a second vertical `Separator`, then a `StageBarIconButton` with the label "Details", the `Info` icon and `aria-pressed={isShowingDetails}`. While pressed, it has the same `bg-accent text-accent-foreground` classes as the active filter button. It is a plain toggle button, not a menu trigger.

### Detail values come from the resolved snapshot

The three builders read the resolved fields:

| Term | Value |
| --- | --- |
| Mod | `mod.source ?? modReference`, left out when that is `""` |
| Version | `mod.version`, once the mod file is loaded |
| Tile | `tile` |
| Collection | `collection`, or "None" without a collection |
| Mosaic | `mosaic.source ?? mosaicReference`, or "Unsaved combination" |
| Run link | `buildRunLinkAddress(hash)` |

`ListDetail` becomes `{ term, value, open }`, where `open` is a `DetailOpen` (`{ address, place }`, see "Open goes to the entry's viewer") or `null`. Whether a detail gets buttons is decided while rendering: Copy and Open only when `isWebAddress(value)`, and Open only when `open` is not `null` too.

*Alternative: keep the raw link values.* They can be relative or a default mod name, so "Open" would have to resolve them in the view, and it would get default mod names wrong. The snapshot has already done that work.

### Open goes to the entry's viewer

A pure module in `src/main/stage/`, `detail_viewers.ts`, has `buildViewerOpen(kind, address, defaults)`. It returns the `DetailOpen` of a detail's address in its kind's default viewer:

| Kind | Viewer | Link |
| --- | --- | --- |
| mod | `mod_viewer`, "the mod viewer" | `#/run?mod=mod_viewer&target=<address>` |
| collection | `collection_viewer`, "the collection viewer" | `#/run?mod=collection_viewer&target=<address>` |
| tile | `tile_viewer`, "the tile viewer" | `#/run?mod=tile_viewer&tile=<address>` |
| mosaic | `mosaic_viewer`, "the mosaic viewer" | `#/run?mod=mosaic_viewer&target=<address>` |

The hash comes from `buildRunLink`, and `address` is the app's full address with it (`buildRunLinkAddress`). `place` is the viewer's name. It returns `null` when the stage's default mod settings (`stage.defaults.switchedOff`) name that viewer, so no link leads to a viewer that would refuse to open. The tile viewer gets no `from`: a tile link has no collection to name. The run link's `open` is `{ address: value, place: "a new tab" }`, since it is already the app's address. The link's name and tooltip are `Open <term in lower case> in <place>`, such as "Open mod in the mod viewer" and "Open run link in a new tab".

*Alternative: open the raw address.* It shows the YAML or Markdown source of the file, not what the app shows of it, and the viewers already exist for that.

### `isWebAddress`

`isWebAddress` lives in a small pure module in `src/main/stage/`, named for the domain (for example `detail_addresses.ts`). It parses the value with `URL.parse` (or `new URL` inside `try`) and accepts only the `http:` and `https:` protocols. `file:///` (local files), `blob:`, `data:` and `javascript:` values, and anything that doesn't parse, get no buttons. This keeps a crafted run link from turning a detail into a script link.

### Copy and Open controls

A new `DetailActions` component draws, for one detail:
- **Copy**: a `StageBarIconButton` with the `Copy` icon, labelled `Copy <term in lower case>`. It keeps its own copy state. Its pinned tooltip says "Copied" or "Cannot copy" for 2 seconds (`isTooltipOpen`), as the "More actions" button says "Link copied".
- **Open**: an `<a>` with `href={open.address}`, `target="_blank"` and `rel="noopener noreferrer"`, labelled `Open <term in lower case> in <place>`, with the `ExternalLink` icon. It is left out when `open` is `null`. It is styled as an `icon-sm` ghost button through `buttonVariants`, inside `HoverTooltip`. It is a link because it navigates, so middle-click and "copy link address" also work. `noreferrer` keeps the app's address, with its run link hash, from reaching the opened tab, and `noopener` keeps the app's window from it.

Both controls are 32px (`size-8`), which meets "Details buttons are easy to tap". The details page has one `sr-only` polite live region, which says the last copy's feedback, as `StageBar` does for "Copy link".

### Shared clipboard module

`copyText`, `buildRunLinkAddress`, `COPY_FEEDBACK_MS` and `scheduleFeedbackEnd` move from `MoreActionsMenu.tsx` to a module in `src/main/stage/` named for the domain (for example `run_link_copy.ts`). `MoreActionsMenu` and `DetailActions` import them. The feedback texts stay with each caller, because they differ ("Link copied" and "Copied").

### Explorer links removed

`buildExplorerLink`, `ExplorerLink`, the `explorer` prop and `renderFooter` are removed. Nothing else uses them, and the sidebar's section links stay as they are.

### Version out of the capsule

`CombinationCapsule` loses its `version` prop and Badge, and `buildCapsuleName` becomes `${kind}: ${title}`. `CombinationTitle` stops passing `modTitle.version`. `CapsuleTitle.version` and `readModCapsuleTitle` stay, because the plain title still uses them. `CombinationCapsule`'s comment about the version and the 960px step is updated. The `@max-[960px]` variant isn't used anywhere else, so it goes away with the Badge.

## Risks / Trade-offs

- **The version is one tap further away** for users who checked it in the bar. → It is on the mod list's details page and in the plain title. "Wide bar" in the `stage-bar` delta makes the change explicit.
- **Typing on the details page leaves it.** A user who wanted to select text by typing could be surprised. → The text is selected with the pointer or touch, not by typing, and the search field keeps the focus, as on every page.
- **A link can name a collection folder** (`…/laureates/`), which `collections.inspect` would not read. → Once the sandbox is launched, the snapshot's `collection` is the collection file's address (a folder means its `collection.yaml`), so the viewer gets the file. Before the launch, the values are the raw link values, which are not web addresses, so they get no buttons.
- **An instance may replace a viewer** with its own mod of the same name. → The link names the viewer by its default mod name, so it opens whatever the instance ships under that name, as the explorers do.
- **The clipboard can be refused** (insecure context, permissions). → "Cannot copy" is shown and announced, and the text stays selectable.
- **e2e tests that relied on the footer or the version Badge break.** → The tasks update them (`stage_bar.spec.ts` "Each step of the ladder", `CombinationLists.test.tsx` details and explorer cases, `CombinationCapsule.test.tsx`).

## Migration Plan

This is an interface-only change, with no stored data or link format. It ships in one release. Rolling it back means reverting the change.
