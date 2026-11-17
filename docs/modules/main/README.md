# Main Module

The main module is the app's own interface around the stage: the header, the sidebar and its sections, the pages, and the Settings page. It lives in `src/main/`, and `src/App.tsx` lays it out.

## Page layout

```
+------------------------------------------------------------------+
| [=] OpenTesela                                          (header) |
+-------------+----------------------------------------------------+
| Sidebar     | Main area                                          |
|  Home       |   the page of the current entry (Home, Guides,     |
|  Tiles      |   Settings, About...), or the stage: the stage bar |
|  Mods       |   and the visible mod's frame                      |
|  Mosaics    |                                                    |
|  Guides     |                                                    |
|             |                                                    |
|  Settings   |                                                    |
|  About      |                                                    |
+-------------+----------------------------------------------------+
```

- **Header**: the hamburger button, which hides and shows the sidebar and is always visible, then the `OpenTesela` heading.
- **Sidebar**: one item per section, built from the section registry (below). The `main` group is at the top and the `footer` group at the bottom. The sidebar is expanded (resizable, 200–400px), collapsed to an icon rail, or hidden. While its edge is dragged, the sidebar collapses as soon as it is narrower than 160px and expands again at 160px or wider, from the expanded sidebar or from the rail; the release keeps that state. On viewports narrower than 768px it starts collapsed and expands over the content as a drawer. `Ctrl+B` (`Cmd+B` on macOS) toggles expanded and collapsed. The layout is kept in the app's storage under `opentesela.sidebar`.
- **Main area**: what the current history entry shows. A page section's page is rendered by the app ([pages](homepage/README.md)); the stage, with every open sandbox, stays mounted beside it and is hidden while a page shows, so no frame reloads.

### The stage bar

While a sandbox is visible, the stage bar (`stage/StageBar.tsx`) is one row above its frame, and nothing is listed under it:

```
+------------------------------------------------------------------------------+
| Book List (1.0.0) [i] [share] [reload]  [E] [W] [N] | [theater] [full] | [x] |
+------------------------------------------------------------------------------+
```

- **Left**: the mod's name and its version in an outline Badge. Before the mod file is loaded, "Loading mod…" takes their place, and "Mod not loaded" when the sandbox failed or stopped first; once the mod file is loaded, the name and version stay, even when the sandbox fails later. For a sandbox opened from a mosaic, the mosaic's title comes first, in bold, and the mod's name follows in muted text, so the mosaic reads as the subject and the mod as how it is shown, with the other items and their order kept, in one row. Until the mosaic file is loaded, "Loading mosaic…" takes the place of the titles and the version, and "Mosaic not loaded" when the sandbox failed or stopped first; once it is loaded, the mosaic's title stays and the mod's name follows the rules for a mod, such as the mosaic's title then "Mod not loaded" when its mod file is missing. Then the information button (`Mod information`), the Share button (`ShareMenu`) and, for a sandbox opened with a collection or a tile, the "Reload tiles" icon button.
- **Right**: the errors, warnings and notifications buttons (`MessageButton`), a vertical Separator, the theater mode button, the fullscreen button while the sandbox has a running mod frame, then a second vertical Separator and the close button (×), the last two only for a sandbox that has a close button. A Home mod at `#/` ends with the fullscreen button.
- **Theater mode**: a toggle button (lucide's `RectangleHorizontal`) whose name and tooltip are "Theater mode" in both states, with `aria-pressed="true"` while theater mode is on. It is shown for every visible sandbox, also while its mod loads, asks or after it failed. Pressing it turns theater mode on or off for every running mod at once (`changeTheaterMode` in `stage/theater_setting.ts`, then `changeStageTheaterMode`), without reloading any frame: the mods' `<body>` loses or gets back its `--ot-content-width` limit (see the [stage module](../lib/core/stage/README.md#frame-layout)). The choice is kept in the app's storage under `opentesela.theater-mode`, outside the `opentesela.mod-storage:` keys, so no mod can read or change it. It is on after a reload only when the stored value is `true`; a missing or unknown value is off, and when the storage cannot be written, the choice still applies until the page is closed.
- **Fullscreen**: an icon button (lucide's `Maximize`) named "Fullscreen", shown only while the sandbox's mod runs in its frame: not while it loads, waits for an answer or after it failed. Pressing it shows the visible mod's frame fullscreen (`requestFullscreen()` on the iframe, during the click), without reloading it. The open popover or menu closes, since nothing outside the frame is visible, and the frame gets the focus, so the keyboard reaches the mod. The frame is shown without its border and rounded corners, and the stage bar is hidden. Esc, or the browser's own exit, leaves fullscreen and shows the frame under the stage bar again. When the browser refuses, the sandbox gets a `warning` from the app, "Fullscreen is not available: <the browser's reason>", whose source is the mod's source (`warnFullscreenRefused`). `StageView` follows every `fullscreenchange` of the app's page (`stage/stage_fullscreen.ts`), so a fullscreen the mod asked for itself gets the `fullscreen` layout too.
- **Buttons**: every button is shadcn's `icon-sm` ghost Button (`StageBarIconButton`), whose accessible name is also its tooltip, except while the Share button says how a copy went. A message button's name gives the level, the exact count and the unread count, such as `Warnings: 2, 1 unread`.
- **Counts**: a message button shows its level's count in a capsule over the icon's bottom-right corner, `99+` above 99. The capsule is absolutely placed with a minimum width and `tabular-nums`, so no count changes a button's box or moves another item, and the gap after each message button leaves room for a `99+` capsule. A level without messages has no capsule and a dimmed icon, but its button stays focusable.
- **Read state**: the capsule is filled in the level's color (`destructive` for errors, `warning` for warnings, `primary` for notifications) while the level has unread messages, and muted (`muted`) once all were read. Opening a level's popover calls `markMessagesRead` for that level, and closing it calls it again, for the messages that arrived while it was open, however it closes. Until then, such a message keeps the capsule filled. Read state is the stage's, per sandbox (see the [stage module](../lib/core/stage/README.md#messages-and-load-failures)).
- **Unread marks**: the snapshot's `isRead` turns true as soon as a popover opens, so the bar records, when a level's popover opens, the ids of that level that were unread and the highest id of that level (`unread_marks.ts`). An item is marked when its id is in that set or above that id, so a message that arrives while the popover is open is marked too. A marked item (`MessageItem`) has a light background in its level's color (`bg-destructive/10`, `bg-warning/10` or `bg-primary/10`) and a dot with visually hidden text "Unread", so color is not the only cue. Every item keeps the dot's place, so an item does not move when its mark comes or goes. The record is dropped when the popover closes, so the items read on the last opening are plain.
- **Popovers**: each message button opens a shadcn Popover, rendered in a portal on the app's page, outside every mod frame, with that level's messages newest first (`MessagePopover`), or "No errors.", "No warnings." or "No notifications.". `listNewestFirst` (`message_level_views.ts`) sorts them by id, descending: ids grow as messages are added, and a reload gives its issues new ids, so a new message, a reloaded tile issue included, arrives at the top. The snapshot keeps the stage's order. Each item (`MessageItem`) shows its producer, "App" as an outline Badge or "Mod" as a secondary Badge with the mods' icon, then the source and the text as plain text. Notifications have a dismiss button each (`Dismiss: <text>`), and "Clear all" with two or more; errors and warnings have neither. A level's list ends, next to the oldest messages, with how many older messages from the mod were dropped, if any. The information popover (`ModInfoPopover`) shows, for a sandbox opened from a mosaic, the mosaic file's address first (`Mosaic`), then the mod's source, or the resolved mod reference when the mod file did not load (left out while a mosaic's file is not loaded yet, since its mod is not known), the collection's location when there is one, and the run link, as text the user can select, with no copy button. Its title is the mosaic's title, or the mod's.
- **Share menu**: the Share button, with a share icon, opens a shadcn DropdownMenu (`ShareMenu`) of the ways to share the sandbox, for now "Copy link" alone, so a later way to share is a new item. The menu has the menu role, arrow keys, and the focus on its first item when opened with the keyboard. It is not modal: Radix's modal menu would turn off pointer events on the page, and a click in the mod's frame would not reach the mod. "Copy link" writes `origin + pathname + search` followed by the run link's hash with `navigator.clipboard.writeText`. The menu closes, and the Share button's tooltip is held open for 2 seconds with "Link copied", or "Cannot copy the link" when the write is refused or the browser has no clipboard. The accessible name stays "Share", and the same text goes to the bar's polite live region.
- **Closing**: one popover or menu is open at a time, and it closes when the visible sandbox changes. Radix closes it on a click elsewhere in the app's page. A click in a mod's frame never reaches the app's document, but it moves the focus into the frame and the window gets a `blur`, so the bar closes the open popover or menu when the focus is then on an `iframe` (`frame_focus.ts`). It checks a moment after the `blur`, because Firefox fires it while the focus is still on the body and gives the focus to the frame afterwards. The click itself goes to the mod, and the focus stays in the frame instead of going back to the button that opened the popover (`onCloseAutoFocus`), so the mod keeps the keyboard. A `blur` toward another window closes nothing.
- **Attention**: the bar remembers, per level, the newest message id it has seen of the visible sandbox (`message_attention.ts`). When a newer one arrives, that level's icon flashes once, with a `motion-safe:` animation (`stage-bar-flash` in `stage.css`), so a user who asked for reduced motion sees only the filled capsule. A new error is also written to a visually hidden `aria-live="polite"` region, which also says how a copy with the Share menu went. When another sandbox is shown, or the bar mounts again after a page, it starts from what the sandbox has, so messages that arrived while it was hidden do not flash.

The theme tokens give everything its colors, fonts and spacing (see the [theme module](../lib/core/theme/README.md)), so the app, the pages and the mods look alike.

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
| `group` | `main` (top of the sidebar) or `footer` (bottom). Items keep the registry's order within their group. |
| `optional` | Whether the user can hide the item on the Settings page. Hiding only removes the item: links still work (see [Settings](settings/README.md)). |
| `comingSoon` | Shown as a disabled item that says "Coming soon" and does not navigate, for an instantiation's section that is not ready yet. For example, an instantiation could add a section with the id `example_section` and the label Example Section, marked as coming soon. Its target is not used, and its address shows Home, until it becomes available. No vanilla section is coming soon. |

### Rules

The registry is checked before the stage is created. When it breaks a rule, the app does not start: it shows the errors, each naming its section, instead of the app. A broken registry is a mistake of whoever edited it, so it fails loudly.

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
| `sidebar/` | The sidebar's layout state and its view. |
| `pages/` | The page view: markdown pages and the Settings page (see [pages](homepage/README.md)). |
| `settings/` | The Settings page. |
| `stage/` | The stage view: the stage bar, the frames, the hidden check frames, the action dialog, the player dialog, the API mismatch dialog and the site consent dialog; the remembered theater choice (`theater_setting.ts`) and the frames' fullscreen (`stage_fullscreen.ts`). |
| `theme/` | The app's theme and the Theme control. |
| `default_mods.ts` | The default mod settings: the default mods folder and the switched-off mods. |
