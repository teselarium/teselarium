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

The theme tokens give everything its colors, fonts and spacing (see the [theme module](../lib/core/theme/README.md)), so the app, the pages and the mods look alike.

## Section navigation

The sidebar works like a tab bar (see the [stage](../lib/core/stage/README.md#sections-and-tab-bar-navigation)):

- Activating a section shows what was last seen in it, in the state it was left in, when the user comes from another section.
- Activating the section the user is already in shows its start: the index page, or the section's own mod.
- A mod section keeps one root sandbox: repeated visits to Mods show the same explorer.
- The section of what is shown is the current item (`aria-current="page"`). A mod that a section's mod opened stays in that section, also after a reload.

Each item is a link with the section's start address (`#/`, `#/guides`, `#/run?mod=mod_explorer`), so middle-click and "open in new tab" work too.

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

### Fields

| Field | Meaning |
|---|---|
| `id` | The section's id. It names its page folder (`pages/<id>/`), its address (`#/<id>`), its stored switch and its stored membership in the history. |
| `label` | The item's name: its text, its accessible name and its tooltip in the rail. |
| `icon` | `{ lucide: Icon }`, a [lucide](https://lucide.dev/icons) icon component, or `{ image: "./icons/atlas.svg" }`, an image relative to the app. An image is drawn in the item's text color, following the color scheme (a CSS mask, so use a monochrome image); `{ image, tint: false }` draws it with its own colors. Icons are decorative: the label names the item. |
| `target` | `{ page: true }`: the section shows the markdown pages in `pages/<id>/` (the `settings` section shows the Settings page instead). `{ mod: { mod, collection, params } }`: the section runs a mod link, the same value a mod passes to `mods.open`, for example `{ mod: "mod_explorer", collection: null, params: {} }`. |
| `group` | `main` (top of the sidebar) or `footer` (bottom). Items keep the registry's order within their group. |
| `optional` | Whether the user can hide the item on the Settings page. Hiding only removes the item: links still work (see [Settings](settings/README.md)). |
| `comingSoon` | Shown as a disabled item that says "Coming soon" and does not navigate. Its target is not used, and its address shows Home, until it becomes available. |

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

A section whose target is a default mod that the instantiation switched off (`switchedOff` in `src/main/default_mods.ts`) is not part of the app: it is in neither the sidebar nor the Settings page, and its link opens the switched-off error like any link to that mod. Switching off `mod_explorer` removes Mods.

### Changing the sections when cloning

- **Add a section**: add an entry in the order it should appear. For a page section, add `public/pages/<id>/index.md` (see [pages](homepage/README.md)). For a mod section, set its target to the mod's link: a default mod name, or a folder or mod file relative to the app.
- **Remove a section**: delete its entry, and its `public/pages/<id>/` folder if it had one. Stored switches of a removed section are dropped on the next start. `home`, `settings` and `about` cannot be removed.
- **Change a section**: edit its fields. Changing an `id` changes its addresses and its folder, and resets its stored switch.
- **Make a coming-soon section available**: set `comingSoon` to `false` and give it its real target.

## Stage dialogs

The stage view has four dialogs, drawn by the app outside every mod frame. All are native `<dialog>` elements opened with `showModal()`, so the rest of the page, frames included, is inert while they are open. They share their mechanics through `StageDialog` (`stage/StageDialog.tsx`): Cancel (Show without them in the site consent dialog, Close in a playing player dialog) has the focus, so a key pressed for the mod cannot accept, Escape answers as Cancel, and only the stage closes the dialog, which opens again if a browser closes it while something is still shown. No two are open together: actions, players included, come only from a visible, running sandbox, one at a time, and the questions only from a visible, asking one, which asks one question at a time (the mod API question first, then the site consent question).

- **Action dialog** (`ActionDialog`): shows the action the visible mod asked for (`links.open`, `files.save`, `ui.confirm`), with the mod's title and source. Its accept button ("Open", "Save" or the confirmation's label) performs the action inside its own click.
- **Player dialog** (`PlayerDialog`): shown in place of the action dialog when the shown action is a player (`players.open`, see [Players](../lib/core/engine/README.md#players)). It first asks: the mod's title and source, "wants to play:" with the player's whole title, when the tile gives one, and the site's name for a known site (such as YouTube) and the host the player loads (such as `www.youtube-nocookie.com`), then "Nothing is loaded from <host> until you press Play. <host> will see that you played this.", the "Always play from <host>" checkbox, unchecked, and the buttons "Cancel" (focused) and "Play". Nothing is requested from the site before Play. Cancel and Escape answer `false`. Play, with the checkbox checked, remembers the host for every mod (`src/main/settings/player_sites.ts`), and a remembered host skips the question when the dialog opens. After Play, the dialog, wider, keeps the mod's title and source, the player's title and the host ("is playing:"), shows the player in an `<iframe>` of the app's page whose attributes the app sets (`sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `referrerpolicy="strict-origin"`, sized by the player's shape), covered until the frame fires `load` by a spinner and "Loading the player from <host>…" (`role="status"`; with reduced motion the spinner does not turn), and a "Close" button, focused. Close and Escape answer `true`, and the frame is removed with the dialog, so playback stops. `StageView` records on the stage entry that Play was pressed (`markStageActionPlaying`), so a player removed because its mod stopped being visible answers `true` too.
- **API mismatch dialog** (`ApiMismatchDialog`): asks before starting a mod whose `api` range does not match the app's mod API version. It shows the mod's title, source and version, the mod's range and the app's mod API version. "Run anyway" starts the mod; "Cancel" (or Escape) leaves the sandbox with an error naming both versions and no frame. While it asks, the sandbox shows "Waiting for your answer…" in place of the frame. Going back hides the sandbox and the dialog without answering. See the [stage module](../lib/core/stage/README.md#questions-before-a-mod-starts).

- **Site consent dialog** (`SiteConsentDialog`): asks before starting a mod from another site that declares permissions the user has not decided for it. It shows the mod's title and source, then one line per site and category: a checkbox, checked when the dialog opens, labeled with the app's verb and the host (such as "show content from https://upload.wikimedia.org", with `"*"` read as "any site"), and the mod's reason as plain text, labeled as the mod's words. Then the cost: "Each site you allow can see that you used this mod.", followed, when an "exchange data with" or "load code from" line is listed, by "Sites allowed to exchange data or load code can also receive what the mod shows or keeps." Then the "Remember my answer for this mod" checkbox, unchecked. Every site-permission choice of the app is a checkbox, here and in Settings. "Allow" grants the checked lines and refuses the others; "Show without them" (focused) refuses every line; with Remember checked, both keep the answer for that mod, which Settings lists and lets the user change or remove. Escape refuses every line and remembers nothing. It shows after the API mismatch dialog when a mod needs both. While it asks, the sandbox shows "Waiting for your answer…". See the [stage module](../lib/core/stage/README.md#questions-before-a-mod-starts).

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
| `stage/` | The stage view: the stage bar, the frames, the hidden check frames, the action dialog, the player dialog, the API mismatch dialog and the site consent dialog. |
| `theme/` | The app's theme and the Theme control. |
| `default_mods.ts` | The default mod settings: the default mods folder and the switched-off mods. |
