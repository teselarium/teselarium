# Main Module

The main module is the app's own interface around the stage: the sidebar and its sections, the pages, and the Settings page. It lives in `src/main/`, and `src/App.tsx` lays it out.

## Page layout

```
+----------------+ +-----------------------------------------------+
| [=] OpenTesela | | stage bar                                     |
|  Home          | +-----------------------------------------------+
|  Tiles         | +-----------------------------------------------+
|  Mods          | | Main area: the visible mod's frame, under the |
|  Mosaics       | | stage bar; or, on the canvas with no panel,   |
|  Guides        | | the page of the current entry (Home, Guides,  |
|  ------------  | | Settings, About...)                           |
|  Settings      | |                                               |
|  About         | |                                               |
|  Theme         | |                                               |
|                | |                                               |
|  [<]           | |                                               |
+----------------+ +-----------------------------------------------+
```

There is no header: the sidebar and the main area take the whole height.

- **Sidebar**: its first row is the hamburger button, which hides and shows the sidebar and is always visible, then the `OpenTesela` level 1 heading, shown only while the sidebar is expanded (in the rail and the chip it stays the page's heading, `sr-only`). This row and the stage bar are one row: the same top edge and height (`--shell-row-height`). Then one item per section, built from the section registry (below): the `main` group, a divider, and the `footer` group right after it. Then the Theme control (below), and the collapse toggle at the bottom. The sidebar is expanded (resizable, 200–400px), collapsed to an icon rail, or hidden. Hidden, it shrinks to a chip that holds only the hamburger button, in the same place, and renders nothing else; the stage bar and a page's content start after the chip (`--chip-inset`), and the frame takes the whole width under the stage bar. While its edge is dragged, the sidebar collapses as soon as it is narrower than 160px and expands again at 160px or wider, from the expanded sidebar or from the rail; the release keeps that state. On viewports narrower than 768px it starts collapsed and expands over the content as a drawer, which starts with the same first row, its hamburger button where the rail's is. `Ctrl+B` (`Cmd+B` on macOS) toggles expanded and collapsed. The layout is kept in the app's storage under `opentesela.sidebar`.
- **Fixed icon axis**: every sidebar row starts with the same icon cell (`SidebarIconCell`), as wide as the rail inside its padding, with its icon or button centered. Expanded, the label follows the cell; in the rail, the row is just the cell, with the label as its accessible name and tooltip. So the hamburger button, the section icons, the Theme control and the collapse toggle never move when the sidebar collapses or expands, and the hamburger button does not move when the sidebar is hidden. The current item's highlight spans the row when expanded, and the cell in the rail.
- **Theme control**: after the `footer` items, in its own list, a button showing the current choice's icon (`SunMoon` for System, `Sun` for Light, `Moon` for Dark), labelled `Theme` when expanded and named `Theme: <choice>`. Each press moves to the next choice: System, Light, Dark, then System again (`readNextThemeChoice` in `theme/theme_options.ts`). It changes the same choice as the Settings page's Theme control (`sidebar/SidebarThemeControl.tsx`). A tooltip says `Theme: <choice>` in every state and stays open after a press, so it shows the new choice; a visually hidden polite live region announces it. It is a button, not a section, so it is never the current item.
- **Main area**: what the current history entry shows. A page section's page is rendered by the app ([pages](homepage/README.md)); the stage, with every open sandbox, stays mounted beside it and is hidden while a page shows, so no frame reloads.

### The stage bar

While a sandbox is visible, the stage bar (`stage/StageBar.tsx`) is one row above its frame, and nothing is listed under it:

```
+-------------------------------------------------------------------------------------------------------------+
| [Country Map 1.0.1 v] + [Nobel laureates v] -> [Nobel laureates on the map v] [...]  [E] [W] [N] | [theater] [full] | [x] |
+-------------------------------------------------------------------------------------------------------------+
```

- **Left, for a combination sandbox**: the sandbox's title as a recipe of three capsules (`CombinationTitle`): the mod capsule, a `+`, the collection capsule, an arrow, and the mosaic capsule, the `+` and the arrow hidden from assistive technologies. A combination sandbox is one opened from a mosaic, from a link with a collection or a tile, or from a link whose mod the catalog or recently used holds (`isCombinationSandbox`). Each capsule (`CombinationCapsule`, shadcn's outline Button) has an icon of its kind, its title and a chevron, and its accessible name and tooltip are its kind and full title, such as "Mod: Country Map 1.0.1" or "Collection: Nobel Prize in Literature laureates":
  - the **mod capsule** shows the mod's title and its version in an outline Badge, "Loading mod…" before the mod file is loaded, and "Mod not loaded" when the sandbox failed or stopped first; once loaded, the title and version stay, even when the sandbox fails later;
  - the **collection capsule** shows the collection's title once its file is loaded, "Loading collection…" before, "Collection not loaded" after a failure, the decoded file name of the tile for a tile link, or "None";
  - the **mosaic capsule** shows the mosaic's title, or, for a sandbox not opened from a mosaic, "Unsaved combination" with a dashed border.

  For a mosaic link, until the mosaic file is loaded, one capsule says "Loading mosaic…" in place of the three, or "Mosaic not loaded" when the sandbox failed first. Once it is loaded, the mosaic capsule shows its title, and the mod and collection capsules follow their own rules, so a missing mod file shows the mosaic's title and "Mod not loaded".
- **Left, for any other sandbox**, such as an explorer or a viewer opened without a collection or a tile: the mod's name and its version in an outline Badge as a plain title, with no capsule and no list, and the same loading and failure texts.
- **Then**, for a sandbox opened with `sites`, the **Sites chip** (`SitesChip`), then the **"More actions" button** (`…`, `MoreActionsMenu`).
- **Lists**: each capsule opens its list (`ModList`, `CollectionList`, `MosaicList`, all built on `CombinationList`, which wraps shadcn's Popover and Command, the vendored cmdk). The list is drawn by the app outside every mod frame, right under the capsule that opened it, or under the folded capsule in a bar under 480px wide, where the other capsules are hidden, with its search field focused and the current entry highlighted and in view (the next row that can be chosen when the current one cannot, as a tile link's tile, or the first row when a filter hides it; typing highlights the first match). Arrow keys move, Enter chooses, and Escape closes the list and gives the focus back to its capsule. What each list holds, and how it is ordered, filtered and searched, are pure functions (`mod_list.ts`, `collection_list.ts`, `mosaic_list.ts`, `list_order.ts`, `list_search.ts`); the component renders them and keeps the open list's state.
  - **Entries**: the **mod list** holds the catalog's mods, the recently used mods the catalog does not list, and the current mod, even when neither holds it. The **collection list** starts with "None", or, for a tile link, with the tile, current and not selectable, then "None"; both rows are pinned at the top, outside every sort and filter. Then come the collections in the same way. The **mosaic list** holds the mosaics in the same way, and the tried combinations (see below). Each mosaic of the current pair shows its aliases as `<field> <- <names>`, or "No aliases"; any other mosaic shows its mod and collection as `<mod> + <collection>`, or `+ None`.
  - **Columns**: every row has four, each column one width in every row, so they line up:
    1. a **mark**: a filled dot for the current entry ("Current"), or a ring for an entry tried recently and not saved in the app ("Tried recently, not saved in the app"): a recently used mod, collection or mosaic the catalog does not list, or a tried combination. The dot wins when an entry is both. Each mark has its tooltip and accessible text, and the current row is `aria-current`;
    2. the **title**, with its details lines;
    3. the **mosaic badge**: in the mod and collection lists, the mosaic icon and how many mosaics pair the entry with the other capsule's value, named `1 mosaic` or `<n> mosaics`; in the mosaic list, the icon alone, named "Mosaic", for each mosaic;
    4. the **score**, `<matching>/<total>`: how many tiles of the current collection or tile match the mod's tile type, or the current mod's on that collection. It is muted when no tile matches, and the entry stays selectable. A mod without a tile type scores `<total>/<total>`, with the tooltip "Accepts any tile: this mod has no tile type". While it is counting, a spinner named "Counting" turns, unless the user's system asks for reduced motion. "None" and pairings without a collection or tile have no score.
  - **Scores with aliases**: a mosaic's score counts its tiles after its aliases rename their fields, as the mod receives them when the mosaic runs, so "Nobel laureates on the map" scores `17/17` while the country map on the laureates scores `0/17` without it. Every other score counts without aliases.
  - **Sort**: a "Sort" button after the search field, behind a divider, offers "Mosaics first" (the mod and collection lists' default: the entries with mosaics first, then the others, each by title A-Z), or, in the mosaic list, "This pair first" (its default: the current pair's entries under "For <mod> + <collection>", then the others under "Other combinations", each A-Z), then "Name", "Match ratio" (highest `matching / total` first, then most matching tiles) and "Matching tiles" (most matching tiles first, then the ratio). Ties go by title, and entries whose score is unknown come last.
  - **Filter**: a "Filter" button after it, shown pressed while a choice is checked, keeps only the entries that meet every checked choice. The mod and collection lists offer "Compatible only" (a score with a matching tile, or one not known yet), "Has mosaics" and "Unsaved" (the ring). The mosaic list offers "This pair only", "Same mod", "Same collection", "Compatible only" and "Unsaved". Pinned rows stay.
  - Each list keeps its sort and filter until the app page is reloaded, also for other sandboxes (`list_choices.ts`).
  - **Rows settle, then stay**: while the list settles, its rows are sorted again as titles, mosaics and scores arrive, at most every 300ms. Once the pointer moves in the list or an arrow key is pressed, the rows stay in place, and what arrives shows in its row. Opening the list, going back from a page, changing the search text and choosing a sort, the chosen one too, sort the rows again at once.
  - **Pages**: in the mod and collection lists, choosing an entry with mosaics opens its page in place of the main list: a "Back" row named after the entry ("Back to Country Map"), then its mosaics, best "Match ratio" first, each with its score with aliases, then "Without a mosaic", with the entry's score without aliases. Choosing a mosaic opens it; choosing "Without a mosaic" is choosing the entry. The page of the current entry of a sandbox opened from a mosaic has no "Without a mosaic". In the main list, such an entry shows the best score of the options its page would show, and sorts and filters by it. "Back", and Backspace in an empty search field, return to the main list with the entry highlighted and in view.
  - **Search**: typing keeps the entries whose title holds the text, ignoring case, and, in the mod and collection lists, the entries with a mosaic whose title holds it. Such an entry, found only through its mosaics, names the first matching mosaic under its title with "+<k> more" for the others, its badge says "<m> of <n> mosaics match", and its page opens with the same search, listing only those mosaics. Back brings the main list's search back. While the search field has text, the pinned rows are hidden. In the mosaic list, a tried combination is found by its mod's and collection's titles.
  - **Tried combinations**: the mosaic list also holds the recently used mod + collection pairs, each an "Unsaved combination" with `<mod> + <collection>`, the ring and its score without aliases; choosing one opens that pair with no `mosaic`, no `sites` and no other params. When the sandbox is not opened from a mosaic, the list starts with its own pair as a pinned "Unsaved combination", marked current; choosing it closes the list.
  - **Measured ahead**: when a combination sandbox is shown and its mod file is loaded, the bar loads the files that give the lists' titles and mosaics, but no tile (`list_summaries.ts`). A refused link or a mosaic whose file failed loads none, as it requests no file of its own. When the pointer rests on a capsule or the keyboard focuses it, its tooltip opening starts measuring the scores its list shows, as opening the list does, so the list opens with its scores. The folded capsule's menu starts all three. The scores and summaries come from the [combinations module](../lib/core/combinations/README.md), measured once per page, at most 6 requests at a time, all lists together.
  - An entry whose file cannot be loaded is listed last with the reason, not selectable, and a recently used one has a "Remove" button.
  - Each list ends with a details section, as text the user can select: the current mod's source and version, the current collection's or tile's location, or the mosaic file's address (or "Unsaved combination") and the run link. Then a link to its explorer, "Open the mod explorer", "Open the collection explorer" or "Open the mosaic explorer", which shows that section as the sidebar item does, left out when the app has no such section.
  - **Choosing** an entry opens a new combination in place of the visible sandbox, with a new history entry, so Back returns to the previous one (`openStageCombination`, see the [stage module](../lib/core/stage/README.md#opening-a-combination)). Choosing a mod keeps the collection or tile, and, from a mosaic, keeps the mosaic as `sites`, so its `show` hosts stay; the other params are dropped. Choosing a collection or "None" keeps the mod and the params, and drops `tile` and `sites`. Choosing a mosaic opens it with no other params. Choosing the current entry closes the list and opens nothing. From the Home mod at `#/`, the choice opens as a followed link, and the Home mod keeps running.
- **Sites chip**: a shield icon and the number of `show` lines of the mosaic the link names as `sites`, named "Sites from <mosaic title>". Its popover lists each line's host, reason and whether it was granted ("Granted" or "Not granted"), and "Stop using these sites" opens the same combination, params kept, without `sites` (`buildSitesDrop`). A `sites` mosaic that failed to load shows no chip.
- **More actions**: the `…` button opens a shadcn DropdownMenu with "Copy link" and, for a sandbox opened with a collection or a tile, "Reload tiles". The menu has the menu role, arrow keys, and the focus on its first item when opened with the keyboard. It is not modal: Radix's modal menu would turn off pointer events on the page, and a click in the mod's frame would not reach the mod. "Copy link" writes `origin + pathname + search` followed by the run link's hash with `navigator.clipboard.writeText`. The menu closes, and the button's tooltip is held open for 2 seconds with "Link copied", or "Cannot copy the link" when the write is refused or the browser has no clipboard. The accessible name stays "More actions", and the same text goes to the bar's polite live region. "Reload tiles" reloads the tiles (`reloadSandboxTiles` in `stage/tile_reload.ts`), and drops that collection's or tile's scores, those of its mosaics too, so the lists measure the reloaded tiles.
- **Long titles and narrow bars**: the bar is a container (`@container`), and its left side follows the bar's width, with no script measuring anything. No capsule is wider than 16rem; a title that does not fit ends with an ellipsis, and the tooltip gives it in full. When the capsules do not fit, the collection capsule shrinks first, then the mod capsule, then the mosaic capsule; for an unsaved combination the mosaic capsule shrinks before the mod capsule (`flex-shrink` weights). The steps:
  - at least 960px: everything is shown;
  - 720px to 959px: the mod capsule shows no version, which stays in its accessible name and the mod list's details;
  - 480px to 719px: the mod and collection capsules show only their icons, with their full titles in their accessible names;
  - under 480px: one capsule with the mosaic's title, or the mod's for an unsaved combination, named "Combination: <title>", whose menu has "Mosaic", "Mod" and "Collection" rows that open their lists.

  Both the capsule row and the folded capsule are rendered, and container variants show one of them, so the hidden one is out of the accessibility tree. The right side never shrinks, so a change of width moves none of its items.
- **Right**: the errors, warnings and notifications buttons (`MessageButton`), a vertical Separator, the theater mode button, the fullscreen button while the sandbox has a running mod frame, then a second vertical Separator and the close button (×), the last two only for a sandbox that has a close button. A Home mod at `#/` ends with the fullscreen button.
- **Theater mode**: a toggle button (lucide's `RectangleHorizontal`) whose name and tooltip are "Theater mode" in both states, with `aria-pressed="true"` while theater mode is on. It is shown for every visible sandbox, also while its mod loads, asks or after it failed. Pressing it turns theater mode on or off for every running mod at once (`changeTheaterMode` in `stage/theater_setting.ts`, then `changeStageTheaterMode`), without reloading any frame: the mods' `<body>` loses or gets back its `--ot-content-width` limit (see the [stage module](../lib/core/stage/README.md#frame-layout)). The choice is kept in the app's storage under `opentesela.theater-mode`, outside the `opentesela.mod-storage:` keys, so no mod can read or change it. It is on after a reload only when the stored value is `true`; a missing or unknown value is off, and when the storage cannot be written, the choice still applies until the page is closed.
- **Fullscreen**: an icon button (lucide's `Maximize`) named "Fullscreen", shown only while the sandbox's mod runs in its frame: not while it loads, waits for an answer or after it failed. Pressing it shows the visible mod's frame fullscreen (`requestFullscreen()` on the iframe, during the click), without reloading it. The open popover or menu closes, since nothing outside the frame is visible, and the frame gets the focus, so the keyboard reaches the mod. The frame is shown without its border and rounded corners, and the stage bar is hidden. Esc, or the browser's own exit, leaves fullscreen and shows the frame under the stage bar again. When the browser refuses, the sandbox gets a `warning` from the app, "Fullscreen is not available: <the browser's reason>", whose source is the mod's source (`warnFullscreenRefused`). `StageView` follows every `fullscreenchange` of the app's page (`stage/stage_fullscreen.ts`), so a fullscreen the mod asked for itself gets the `fullscreen` layout too.
- **Buttons**: every icon button is shadcn's `icon-sm` ghost Button (`StageBarIconButton`), whose accessible name is also its tooltip, except while the "More actions" button says how a copy went. A message button's name gives the level, the exact count and the unread count, such as `Warnings: 2, 1 unread`.
- **Counts**: a message button shows its level's count in a capsule over the icon's bottom-right corner, `99+` above 99. The capsule is absolutely placed with a minimum width and `tabular-nums`, so no count changes a button's box or moves another item, and the gap after each message button leaves room for a `99+` capsule. A level without messages has no capsule and a dimmed icon, but its button stays focusable.
- **Read state**: the capsule is filled in the level's color (`destructive` for errors, `warning` for warnings, `primary` for notifications) while the level has unread messages, and muted (`muted`) once all were read. Opening a level's popover calls `markMessagesRead` for that level, and closing it calls it again, for the messages that arrived while it was open, however it closes. Until then, such a message keeps the capsule filled. Read state is the stage's, per sandbox (see the [stage module](../lib/core/stage/README.md#messages-and-load-failures)).
- **Unread marks**: the snapshot's `isRead` turns true as soon as a popover opens, so the bar records, when a level's popover opens, the ids of that level that were unread and the highest id of that level (`unread_marks.ts`). An item is marked when its id is in that set or above that id, so a message that arrives while the popover is open is marked too. A marked item (`MessageItem`) has a light background in its level's color (`bg-destructive/10`, `bg-warning/10` or `bg-primary/10`) and a dot with visually hidden text "Unread", so color is not the only cue. Every item keeps the dot's place, so an item does not move when its mark comes or goes. The record is dropped when the popover closes, so the items read on the last opening are plain.
- **Popovers**: each message button opens a shadcn Popover, rendered in a portal on the app's page, outside every mod frame, with that level's messages newest first (`MessagePopover`), or "No errors.", "No warnings." or "No notifications.". `listNewestFirst` (`message_level_views.ts`) sorts them by id, descending: ids grow as messages are added, and a reload gives its issues new ids, so a new message, a reloaded tile issue included, arrives at the top. The snapshot keeps the stage's order. Each item (`MessageItem`) shows its producer, "App" as an outline Badge or "Mod" as a secondary Badge with the mods' icon, then the source and the text as plain text. Notifications have a dismiss button each (`Dismiss: <text>`), and "Clear all" with two or more; errors and warnings have neither. A level's list ends, next to the oldest messages, with how many older messages from the mod were dropped, if any.
- **Closing**: one popover, menu or list is open at a time (`stage_bar_panels.ts`), and it closes when the visible sandbox changes. Radix closes it on a click elsewhere in the app's page. A click in a mod's frame never reaches the app's document, but it moves the focus into the frame and the window gets a `blur`, so the bar closes the open popover or menu when the focus is then on an `iframe` (`frame_focus.ts`). It checks a moment after the `blur`, because Firefox fires it while the focus is still on the body and gives the focus to the frame afterwards. The click itself goes to the mod, and the focus stays in the frame instead of going back to the button that opened the popover (`onCloseAutoFocus`), so the mod keeps the keyboard. A `blur` toward another window closes nothing.
- **Attention**: the bar remembers, per level, the newest message id it has seen of the visible sandbox (`message_attention.ts`). When a newer one arrives, that level's icon flashes once, with a `motion-safe:` animation (`stage-bar-flash` in `stage.css`), so a user who asked for reduced motion sees only the filled capsule. A new error is also written to a visually hidden `aria-live="polite"` region, which also says how a "Copy link" went. When another sandbox is shown, or the bar mounts again after a page, it starts from what the sandbox has, so messages that arrived while it was hidden do not flash.

The theme tokens give everything its colors, fonts and spacing (see the [theme module](../lib/core/theme/README.md)), so the app, the pages and the mods look alike.

### Canvas and panels

The app's canvas, the page's `<body>`, is `--app-canvas`: an app-only alias in `app.css`, `--ot-card` (white) in light and `--ot-background` in dark. The sidebar, the hamburger chip, the stage bar and the visible frame are panels: a gap (`--shell-gap`) around and between them, `rounded-lg`, an `--ot-border` border and `shadow-panel`, a shadow 2px down and right without blur (`app.css`): a blurred shadow beside a running mod's frame slows the mod down in WebKit. In dark, the panels' lighter surface gives the depth and the shadow is nearly invisible. Pages are not in a panel: their content has no background, so the canvas shows behind them. No theme token changes for this, so mods look the same.

The shell's geometry is a set of custom properties on `.app-layout` (and on the narrow drawer, which is not inside it): `--shell-gap`, `--sidebar-rail-width`, `--shell-row-height`, `--sidebar-inset`, `--sidebar-cell-size` and `--chip-inset`. The sidebar, the chip, the stage view and the page area all read them, so their alignment cannot drift. `App.tsx` sets `data-sidebar-state` on `.app-layout`, which turns the grid into one column and places the chip while the sidebar is hidden.

### Catalog icons

The Tiles, Mods and Mosaics items show the icon of their catalog kind, the same icon the stage bar's capsules and lists show (`catalog_icons.ts`): lucide's `Shapes` for collections; for mods, lucide's `square-arrow-right-enter` turned towards the bottom right on a dashed square; for mosaics, a soft tile holding four shapes on a grid. The mod and mosaic icons are drawn on lucide's 24×24 grid with `createLucideIcon`, so they are `LucideIcon`s. The collection and mod icons are lines in the text color. The mosaic's tile is outlined in the text color at 25% and filled with it at 10%, and its shapes are filled by `.mosaic-shape` in `app.css`: the theme's primary, secondary, destructive and warning colors, 20% more saturated (relative color syntax, with the plain token colors as fallback), so deep in light and pastel in dark. In dark, on the accent (the sidebar's current item, a list's highlighted row, a menu's focused entry), the shapes are darkened in OKLCH so they keep their contrast.

## Section navigation

The sidebar works like a tab bar (see the [stage](../lib/core/stage/README.md#sections-and-tab-bar-navigation)):

- Activating a section shows what was last seen in it, in the state it was left in, when the user comes from another section.
- Activating the section the user is already in shows its start: the index page, or the section's own mod.
- A mod section keeps one root sandbox: repeated visits to Mods show the same mod explorer, repeated visits to Tiles the same collection explorer, and repeated visits to Mosaics the same mosaic explorer.
- The section of what is shown is the current item (`aria-current="page"`). A mod that a section's mod opened stays in that section, also after a reload.

Each item is a link with the section's start address (`#/`, `#/run?mod=collection_explorer`, `#/run?mod=mod_explorer`, `#/run?mod=mosaic_explorer`, `#/guides`), so middle-click and "open in new tab" work too.

## The section registry

The sidebar's sections are data: the registry in `src/main/sections/vanilla_sections.ts`. It is the one file to edit to add, remove or change a section. The later HTML init will build the same value.

```ts
{
  id: "guides",
  label: "Guides",
  icon: { lucide: BookOpen },
  target: { page: true },
  group: "main",
  optional: true,
  comingSoon: false,
}
```

The vanilla registry:

| `id` | `label` | `target` | `group` | `optional` | `comingSoon` |
|---|---|---|---|---|---|
| `home` | Home | `{ page: true }` | `main` | no | no |
| `tiles` | Tiles | `{ mod: { mod: "collection_explorer", collection: null, params: {} } }` | `main` | yes | no |
| `mods` | Mods | `{ mod: { mod: "mod_explorer", collection: null, params: {} } }` | `main` | yes | no |
| `mosaics` | Mosaics | `{ mod: { mod: "mosaic_explorer", collection: null, params: {} } }` | `main` | yes | no |
| `guides` | Guides | `{ page: true }` | `main` | yes | no |
| `settings` | Settings | `{ page: true }` | `footer` | no | no |
| `about` | About | `{ page: true }` | `footer` | no | no |

Tiles opens the [collection explorer](../tiles/explorer/README.md), Mods the [mod explorer](../mods/explorer/README.md) and Mosaics the [mosaic explorer](../mosaics/explorer/README.md). The vanilla registry has no coming-soon section.

### Fields

| Field | Meaning |
|---|---|
| `id` | The section's id. It names its page folder (`pages/<id>/`), its address (`#/<id>`), its stored switch and its stored membership in the history. |
| `label` | The item's name: its text, its accessible name and its tooltip in the rail. |
| `icon` | `{ lucide: Icon }`, a [lucide](https://lucide.dev/icons) icon component, or `{ image: "./icons/example.svg" }`, an image relative to the app. An image is drawn in the item's text color, following the color scheme (a CSS mask, so use a monochrome image); `{ image, tint: false }` draws it with its own colors. Icons are decorative: the label names the item. |
| `target` | `{ page: true }`: the section shows the markdown pages in `pages/<id>/` (the `settings` section shows the Settings page instead). `{ mod: { mod, collection, tile, params } }`: the section runs a mod link, the same value a mod passes to `mods.open`, for example `{ mod: "collection_explorer", collection: null, params: {} }` for Tiles. `tile` is optional: a target written without it has no tile, and equals a typed run link without `tile`. |
| `group` | `main` (top of the sidebar) or `footer` (right after the `main` group, after a divider). Items keep the registry's order within their group. |
| `optional` | Whether the user can hide the item on the Settings page. Hiding only removes the item: links still work (see [Settings](settings/README.md)). |
| `comingSoon` | Shown as a disabled item that says "Coming soon" and does not navigate, for an instantiation's section that is not ready yet. For example, an instantiation could add a section with the id `example_section` and the label Example Section, marked as coming soon. Its target is not used, and its address shows Home, until it becomes available. No vanilla section is coming soon. |

### Rules

The registry is checked before the stage is created. When it breaks a rule, the app does not start: it shows the errors, each naming its section, instead of the app (`StartErrorScreen`, which also shows the [catalog's errors](#start-errors)). A broken registry is a mistake of whoever edited it, so it fails loudly.

- An `id` matches `[a-z][a-z0-9_-]*` and is unique.
- `run` is reserved for run links (`#/run?mod=...`).
- There is a `home` section.
- `home`, `settings` and `about` are always shown: they cannot be `optional`.

### Home: a page or a mod

`home` is the section shown at `#/`, for an empty hash and for every address that is neither a run link nor a page. In the vanilla app it is a page, `pages/home/index.md`. To show a mod at `#/` instead, give `home` a mod target:

```ts
{ id: "home", label: "Home", icon: { lucide: House }, target: { mod: { mod: "mod_explorer", collection: null, params: {} } }, group: "main", optional: false, comingSoon: false }
```

The Home mod runs in a sandbox like any other mod, at the address `#/`, and has no close button. Before this change, the home mod was `home` in the default mod settings (`src/main/default_mods.ts`): an instantiation that set it moves that value to the `home` section's target.

### Sections of switched-off mods

A section whose target is a default mod that the instantiation switched off (`switchedOff` in `src/main/default_mods.ts`) is not part of the app: it is in neither the sidebar nor the Settings page, and its link opens the switched-off error like any link to that mod. Switching off `mod_explorer` removes Mods, switching off `collection_explorer` removes Tiles, and switching off `mosaic_explorer` removes Mosaics. Switching off `collection_viewer` keeps Tiles: the collection explorer then shows an error that names `collection_viewer` when a collection is selected. Likewise, switching off `mosaic_viewer` keeps Mosaics, and the mosaic explorer's "View" shows an error that names `mosaic_viewer`.

### Changing the sections when cloning

- **Add a section**: add an entry in the order it should appear. For a page section, add `public/pages/<id>/index.md` (see [pages](homepage/README.md)). For a mod section, set its target to the mod's link: a default mod name, or a folder or mod file relative to the app.
- **Remove a section**: delete its entry, and its `public/pages/<id>/` folder if it had one. Stored switches of a removed section are dropped on the next start. `home`, `settings` and `about` cannot be removed.
- **Change a section**: edit its fields. Changing an `id` changes its addresses and its folder, and resets its stored switch.
- **Make a coming-soon section available**: set `comingSoon` to `false` and give it its real target, as Mosaics was given `mosaic_explorer`.

## The app catalog

The app's catalog is the list of the mods, collections and mosaics the instantiation offers. The Mods, Tiles and Mosaics explorers list it, and any mod can read it with `catalog.list` (see the [engine module](../lib/core/engine/README.md#app-catalog)). It lives in `src/main/app_catalog.ts`, next to the default mod settings, as three ordered lists of references relative to the app's address:

```ts
export const APP_CATALOG: AppCatalog = {
  mods: [
    "./samples/mods/book_list",
    "./samples/mods/flashcards",
    "./samples/mods/country_map",
  ],
  collections: [
    "./samples/tiles/literature_nobel_laureates/collection.yaml",
    "./samples/tiles/literature_nobel_laureates_books/collection.yaml",
  ],
  mosaics: [
    "./samples/mosaics/nobel_books_list.yaml",
    "./samples/mosaics/nobel_laureates_map.yaml",
  ],
};
```

A mod entry is a mod reference: a default mod name such as `tile_viewer`, a mod folder, or a mod file. A collection entry is a collection file or a folder holding `collection.yaml`, and a mosaic entry a mosaic file or a folder holding `mosaic.yaml`. The order of each list is the order the explorers show. The vanilla catalog lists the samples, and no default mod, fixture or default mosaic: the "List the default mosaics of mods" switch in [Settings](settings/README.md) adds the default mosaics of the catalog's mods after its mosaics.

When cloning the app, edit `APP_CATALOG` to offer other mods, collections and mosaics. The explorers' configs no longer hold lists: a `mods`, `collections` or `mosaics` key in them is ignored.

### Start errors

`main.tsx` checks the catalog with `resolveAppCatalog`, next to the registry, before the stage is created. When an entry is empty, cannot be resolved, or resolves to the same file as an earlier entry of its list (for example `./samples/mods/book_list` and `./samples/mods/book_list/mod_conf.yaml`), the app does not start: `StartErrorScreen` (`StartErrorScreen.tsx`) shows the registry's errors and the catalog's, each under its own title, and each catalog error names its list and the entry as written.

### Switched-off mods

A mod entry that names a default mod the instantiation switched off (`switchedOff` in `src/main/default_mods.ts`) is left out of the catalog, whatever reference names it, and does not stop the app.

## Recently used

The app remembers the mods, collections, mosaics and combinations (mod + collection pairs) the user tried in combination sandboxes, so the stage bar's lists offer them again, also those the catalog does not list (see [The stage bar](#the-stage-bar)). The store is `src/main/settings/recently_used.ts`, built in `main.tsx` before the stage and wired to the stage's `onFilesLoaded` (see the [stage module](../lib/core/stage/README.md#files-a-combination-loaded)):

- **What is recorded**: for a sandbox opened from a mosaic, or from a link with a collection or a tile, its mod once the mod is loaded, its collection once the collection file is loaded, and its mosaic once the mosaic file is loaded, each by its resolved source. For a sandbox opened with a collection and not from a mosaic, with `sites` or without, its mod and collection are also recorded as a combination once both files are loaded. Tiles, the mosaic a link names as `sites`, sandboxes opened from a mod link without a collection or a tile (such as the explorers), and files that failed to load are not recorded. Only `http:` and `https:` addresses are kept, so a picked local file is not.
- **Order and limit**: each kind keeps at most 10 entries (`RECENTLY_USED_LIMIT`), newest first, compared by resolved source, or by both resolved sources for combinations. Recording an entry already kept moves it to the front, and recording an eleventh drops the oldest.
- **Storage**: under `opentesela.recently-used` in `localStorage`, outside the `opentesela.mod-storage:` keys, so no mod storage slot, and no mod's `storage.get`, can reach it (see the [stored keys](settings/README.md#stored-keys)). Stored entries are checked when the app starts: one that is not a valid source, or a combination without a valid mod and collection source, is dropped, and a stored value without combinations reads as none. When the storage cannot be read or written, recently used still works until the page is closed.
- **Clearing**: the Settings page's Catalog group shows the counts and a "Clear" button (`clearRecentlyUsed`), which drops the four kinds, and a list's "Remove" button drops one entry that can no longer be loaded (`removeRecentlyUsed`).

## Stage dialogs

The stage view has four dialogs, drawn by the app outside every mod frame. All are native `<dialog>` elements opened with `showModal()`, so the rest of the page, frames included, is inert while they are open. They share their mechanics through `StageDialog` (`stage/StageDialog.tsx`): Cancel (Show without them in the site consent dialog, Close in a playing player dialog) has the focus, so a key pressed for the mod cannot accept, Escape answers as Cancel, and only the stage closes the dialog, which opens again if a browser closes it while something is still shown. No two are open together: actions, players included, come only from a visible, running sandbox, one at a time, and the questions only from a visible, asking one, which asks one question at a time (the mod API question first, then the site consent question).

- **Action dialog** (`ActionDialog`): shows the action the visible mod asked for (`links.open`, `files.save`, `ui.confirm`), with the mod's title and source. Its accept button ("Open", "Save" or the confirmation's label) performs the action inside its own click.
- **Player dialog** (`PlayerDialog`): shown in place of the action dialog when the shown action is a player (`players.open`, see [Players](../lib/core/engine/README.md#players)). It first asks: the mod's title and source, "wants to play:" with the player's whole title, when the tile gives one, and the site's name for a known site (such as YouTube) and the host the player loads (such as `www.youtube-nocookie.com`), then "Nothing is loaded from <host> until you press Play. <host> will see that you played this.", the "Always play from <host>" checkbox, unchecked, and the buttons "Cancel" (focused) and "Play". Nothing is requested from the site before Play. Cancel and Escape answer `false`. Play, with the checkbox checked, remembers the host for every mod (`src/main/settings/player_sites.ts`), and a remembered host skips the question when the dialog opens. After Play, the dialog, wider, keeps the mod's title and source, the player's title and the host ("is playing:"), shows the player in an `<iframe>` of the app's page whose attributes the app sets (`sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `referrerpolicy="strict-origin"`, sized by the player's shape), covered until the frame fires `load` by a spinner and "Loading the player from <host>…" (`role="status"`; with reduced motion the spinner does not turn), and a "Close" button, focused. Close and Escape answer `true`, and the frame is removed with the dialog, so playback stops. `StageView` records on the stage entry that Play was pressed (`markStageActionPlaying`), so a player removed because its mod stopped being visible answers `true` too.
- **API mismatch dialog** (`ApiMismatchDialog`): asks before starting a mod whose `api` range does not match the app's mod API version. It shows the mod's title, source and version, the mod's range and the app's mod API version. "Run anyway" starts the mod; "Cancel" (or Escape) leaves the sandbox with an error naming both versions and no frame. While it asks, the sandbox shows "Waiting for your answer…" in place of the frame. Going back hides the sandbox and the dialog without answering. See the [stage module](../lib/core/stage/README.md#questions-before-a-mod-starts).

- **Site consent dialog** (`SiteConsentDialog`): asks before starting a mod from another site that declares permissions the user has not decided for it, or a mod opened from a mosaic from another site that declares `show` lines the user has not decided for that mosaic. It shows one group per subject that has lines, the mod's then the mosaic's: each starts with its title (the first one is the dialog's title) and its source, then "This mod comes from another site and asks to:" or "This mosaic comes from another site and asks to:", then one line per site and category: a checkbox, checked when the dialog opens, labeled with the app's verb and the host (such as "show content from https://upload.wikimedia.org", with `"*"` read as "any site"), and the declared reason as plain text, labeled as the mod's words or the mosaic's words ("In the mosaic's words: Shows the book covers"). Then the cost: "Each site you allow can see that you used this mod.", followed, when an "exchange data with" or "load code from" line is listed, by "Sites allowed to exchange data or load code can also receive what the mod shows or keeps." Then the "Remember my answer for this mod" checkbox, unchecked, worded "for this mosaic" when only the mosaic has lines, and "for this mod and this mosaic" when both do. Every site-permission choice of the app is a checkbox, here and in Settings. "Allow" grants the checked lines and refuses the others; "Show without them" (focused) refuses every line; with Remember checked, both keep the answer for that mod, and for that mosaic file apart from the mod, which Settings lists and lets the user change or remove. Allow, Show without them, Escape and Remember act on every line, the mod's and the mosaic's alike. Escape refuses every line and remembers nothing. It shows after the API mismatch dialog when a mod needs both. While it asks, the sandbox shows "Waiting for your answer…". See the [stage module](../lib/core/stage/README.md#questions-before-a-mod-starts).

## Check frames

A mod check (`mods.check`, see the [stage module](../lib/core/stage/README.md#mod-checks)) mounts the checked mod, then runs its tests, in frames the user never sees, one at a time. `StageView` renders one `CheckFrame` (`stage/CheckFrame.tsx`) per entry of the snapshot's `checks`, apart from the sandboxes and outside every `[data-sandbox-id]` wrapper, so a check is not a sandbox and has no stage bar item. Its frame has the same `sandbox="allow-scripts"` as a mod's frame, and the `srcdoc` the check gives: the mod's frame document for the mount check, or the same document with the test runner for the listing and each case. `StageView` keys the frame by the entry's `key`, which changes for each new frame of a check, so React drops the old iframe and makes a new one, and each case gets a fresh page. Its first `load` calls `attachCheckFrame`, and a later one `checkFrameLoadedAgain`, both with the frame's key. When the check ends, its entry leaves the snapshot and React removes the frame.

The frame is hidden by layout, not by `display: none` or a size of zero: it fills the stage area behind the sandboxes (`absolute inset-0 -z-10 size-full`), is transparent (`opacity-0`) and lets every pointer event through (`pointer-events-none`). A frame that is not rendered may get no animation frames, and a mod that waits for one or measures its layout while mounting would hang or see a size of zero. It also has `inert`, so the checked mod cannot take the focus from the visible mod, `aria-hidden="true"` and `tabIndex={-1}`.

## What lives where

| File | Owns |
|---|---|
| `sections/section_registry.ts` | The section types, `validateRegistry`, `availableSections` (drops sections of switched-off mods) and `buildStageRouting` (the plain data the stage gets). |
| `sections/vanilla_sections.ts` | The vanilla registry. |
| `sections/section_switches.ts` | The user's switches of optional sections (see [Settings](settings/README.md)). |
| `sidebar/` | The sidebar's layout state and its view: the heading row, the icon cell, the items and the Theme control. |
| `pages/` | The page view: markdown pages and the Settings page (see [pages](homepage/README.md)). |
| `settings/` | The Settings page, and the stores it shows, recently used (`recently_used.ts`) among them. |
| `stage/` | The stage view: the stage bar with its capsules, lists (`CombinationList`, `ModList`, `CollectionList`, `MosaicList`), Sites chip and "More actions" menu, the frames, the hidden check frames, the action dialog, the player dialog, the API mismatch dialog and the site consent dialog; the remembered theater choice (`theater_setting.ts`), the frames' fullscreen (`stage_fullscreen.ts`) and "Reload tiles" (`tile_reload.ts`). |
| `theme/` | The app's theme, the Settings page's Theme control and the choices both Theme controls offer (`theme_options.ts`). |
| `catalog_icons.ts` | The icon of each catalog kind, shared by the sidebar and the stage bar. |
| `default_mods.ts` | The default mod settings: the default mods folder and the switched-off mods. |
| `app_catalog.ts` | The app catalog: the mods, collections and mosaics the explorers list (see [The app catalog](#the-app-catalog)). |
| `StartErrorScreen.tsx` | What the app shows instead of itself when the registry or the catalog breaks a rule. |
