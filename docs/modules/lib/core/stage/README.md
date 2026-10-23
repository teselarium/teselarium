# Stage Module

## Introduction

The stage opens mods from shareable links, each in its own sandbox, and navigates between them and the app's pages like pages of one site. Several sandboxes stay open at once, and at most one is visible: none while a page is shown. The browser's back and forward buttons return to a page, or to a sandbox in the state it was left in, and a close button (×) closes a sandbox. Mods never own a route: they are values of the link's parameters.

The stage is the only owner of the browser history. It sees the app's sections as plain data (`StageOptions.routing`): which ids are page sections, what Home is, and the mod link of each mod section. It never sees the sidebar, its icons or the markdown of a page.

### Routes

An address hash is one of three routes:

- **Run link**: `#/run?mod=…` with a non-empty `mod` opens a sandbox (below).
- **Page**: `#/<section>` shows the index page of a page section, and `#/<section>/<page>` its page named `<page>`. `<section>` must be one of `routing.pageSections`, and `<page>` must match `[A-Za-z0-9_-]+`. The name is checked on the raw hash, before anything is built from it, so `..`, `/` and their encoded forms (`#/guides/..%2Fabout%2Findex`) never get through. The Home section's index page has the address `#/`, and `#/home` means the same.
- **Home**: every other hash, including `""`, `#/` and old links such as `#/mods/view`. Home is `routing.home`: the index page of a page section (the vanilla app), or a mod. A Home mod opens at `#/` in a sandbox like any other mod, without a close button.

What a page shows is up to the app (`src/main/pages/`): the stage only records which page an entry shows.

### Run links

A run link's address hash is:

```
#/run?mod=<reference>&collection=<location>&<params>
```

- `mod` is a mod reference (see the [mod module](../../mod/README.md)): a default mod name such as `mod_viewer`, a folder or a mod file.
- `collection` is the optional location of a collection file. Without it, the mod gets no tiles.
- Every other parameter is passed to the mod as `context.params`, in link order, with the first value of a repeated key.
- Values are percent-encoded, and relative ones are resolved against the app's address when the mod is launched. So a link means the same in the address bar, in a `mods.open` request and after a reload, also under a sub-path such as GitHub Pages' `/<repo>/`.

Examples, for an app at `https://example.org/`:

| Address hash | Opens |
|---|---|
| `#/` | Home (the Home page in the vanilla app) |
| `#/guides/first_steps` | the page `first_steps` of the Guides section |
| `#/run?mod=mod_explorer` | the mod explorer |
| `#/run?mod=./samples/mods/book_list&collection=./samples/tiles/books_collection.yaml` | the sample mod with the sample books |
| `#/run?mod=./samples/mods/book_list` | the sample mod without tiles |
| `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` | the mod viewer, showing the sample mod |

Mods never build these addresses. A mod sends `mods.open` with `{ mod, collection, params }`, and the stage turns it into the run link.

### Sandboxes and their ids

Each sandbox gets an id from the stage, `sandbox-1`, `sandbox-2`, …, unique in the page. Mods never choose ids. Sandboxes are kept in creation order, so rendering never moves a frame (moving an iframe in the DOM reloads it).

Each sandbox records its link, its hash, its section, whether it is the Home mod, and its opener: the sandbox whose mod opened it with `mods.open`, or none for a link the user followed or a section opened.

### What is visible

Opening a link, whether the user followed it or a mod asked for it, creates a new sandbox and hides the visible one without stopping it. Showing a page hides the visible sandbox the same way. At most one sandbox is visible, and none while a page is shown. Only the visible mod can open mods or ask the user for an action: a mod hidden behind a page can do neither.

### History entries and positions

Each entry points to a view: a sandbox, or a page of a page section. Pages and sandboxes share one history, so back and forward move between them. Several entries may point to one sandbox. The stage stores the entry's position and section in its state, `{ opentesela: { position, section } }`, and keeps a list of entries that maps each position to its view and section. The browser keeps that state across reloads. A missing or invalid `section` (anything but a non-empty string) reads as `null`.

- **First load, a typed address, or a link followed in the page**: the entry has no stage state. Its page is shown, or its link opens in a new sandbox, at the next position, and the entry is replaced with the position and section in its state, and with the canonical address (`#/` for Home). On the very first load the position is `0`.
- **Back and forward**: the entry has a position. When its view is a page, or a sandbox that is still open, it is shown again, the sandbox in the state it was left in. Otherwise (after a reload, or when its sandbox was closed) the address's page is shown, or its link opens in a new sandbox that takes the entry, with the stored section.
- **`mods.open`**: a new sandbox at the next position, in the opener's section, with a pushed entry whose address is the run link.
- **A section** (`openStageSection`): a pushed entry, see below.

### Opening after going back

When a link, a page or a section opens while the current entry is not the last one, the forward entries are dropped, pages included, as a browser drops them. Every sandbox that no remaining entry points to is closed: its mod is stopped and its frame removed.

### Sections and tab-bar navigation

Every entry belongs to one section or to none, and the snapshot's `activeSection` is the current entry's section:

- A section opened with `openStageSection` sets it.
- `mods.open` copies the opener's section, so a viewer opened by the explorer stays in Mods.
- A typed address or a followed link: a page belongs to its section, the Home mod to the Home section, and a run link to the first section whose mod link it exactly equals (same `mod`, `collection` and params), or to none. `#/run?mod=mod_explorer` is in Mods; `#/run?mod=./samples/mods/book_list` is in no section.
- An entry with stage state keeps its stored section, so membership survives a reload.

`openStageSection(stage, section)` works like a tab bar. The stage remembers, for each section, its **root** (the sandbox of the section's own mod link that no mod opened: the one the section opened, or after a reload the restored one with that link) and its **last** view (the view of the latest entry shown in the section). This memory is derived from what is shown and never stored. A closed sandbox is cleared from it. Activating a section pushes an entry, in that section, that shows:

- the section's last view, when the user comes from another section and there is one;
- otherwise the section's start: the index page of a page section; for a mod section, its root while it is open, or a new sandbox for its link, which becomes the root. The Home section's mod opens at `#/` as the Home mod.

So repeated visits to Mods keep one explorer, Mods shows the viewer where the user left it, and activating Mods while in Mods returns to the explorer. No frame is reloaded: the new entry points to the open sandbox. After a reload the memory is empty, so the worst case is the section's start.

### Closing

The stage bar has × for the visible sandbox, except for the Home mod opened at `#/`. Closing stops the mod and removes its frame, then shows the sandbox that opened it when it is still open, or Home otherwise: the Home page, or a new Home mod sandbox, in the Home section. The current history entry is replaced with the address of what is shown. Other entries that pointed to the closed sandbox stay, and open their link again when visited.

### Issues and load failures

The stage bar lists every issue of the visible sandbox, in the order they were found: tile collection issues, permission issues, blocked requests, mount failures and a stopped mod. Each sandbox keeps its own issues. When the mod file, its entrypoint, its tile type file or the collection cannot be loaded, or a link names a switched-off default mod, the sandbox shows the error and no frame, and keeps its history entry and its ×.

"Reload tiles", for a sandbox opened with a collection, loads and validates the collection again, pushes `tiles.changed` to the running mod and replaces the collection issues.

### Actions the user answers

A mod asks the app to open a link, save a file or confirm something with `links.open`, `files.save` and `ui.confirm` (see the [engine module](../engine/README.md)). The engine checks the params into an action, and the stage queues it until the user answers in the page's action dialog.

- Only the visible sandbox, while its mod is running, can ask. Any other gets no queued action, and the engine answers `-32002`.
- The stage has one queue, oldest first. The snapshot's `action` is the oldest one, with the asking mod's title and source, and later ones wait their turn, so the page shows one dialog at a time.
- Each queued action has an id from the stage, `1`, `2`, …, and the page answers the id it shows, so a double click or a late answer cannot answer the next action. An unknown id does nothing.
- After every stage change (back, forward, a followed or opened link, a close) and when a mod navigates its frame, every action whose sandbox is no longer visible or no longer running is removed and answers `false`. A stopped mod's session drops that answer, so the mod gets none.

### The theme

The stage keeps the app's current theme, built from the resolved color scheme (see the [theme module](../theme/README.md)). It does not know where the color scheme comes from: the app tells it with `changeStageColorScheme`.

- A mod's session connects, on the frame's first `load`, with the theme current at that moment, so a mod opened while the color scheme changes mounts with the new one.
- When the color scheme changes, every running mod, visible or hidden, gets `theme.changed` once. A mod still loading gets nothing: it connects with the new theme. A change to the current color scheme pushes nothing.

### The frame size

The visible sandbox's frame fills the stage area: the page's width left beside the sidebar, and the viewport height left under the app header and the stage bar. It follows the window's size and the sidebar's width, and never depends on the mod's content: content taller than the frame scrolls inside the frame, not the page. The frame is at least 16rem tall; when less room is left, the page scrolls. The layout lives in `src/main/app.css` and `src/main/stage/stage.css`.

## Module Details

Implemented in `src/lib/core/stage/`. Other modules import only from the public entry point `src/lib/core/stage/index.ts`.

### The stage files

The work behind the public API is split so each file has one reason to change:

| File | Owns |
|---|---|
| `stage_routes.ts` | Addresses: what a hash means (run link, page or Home), page addresses, and which section a link belongs to. The only file that calls the run link reader of `run_links.ts`. |
| `stage_history.ts` | History entries: the only file that calls `History` (`pushState`, `replaceState`), and reads and writes the stage's `{ position, section }`. |
| `stage_sections.ts` | The section memory: each section's root and last view. |
| `stage_sandboxes.ts` | The runtime of one sandbox: launch, frame, session, issues, reload and stop. |
| `stage_actions.ts` | The queue of actions waiting for the user: add, show the oldest, answer by id, drop. |
| `stage_controller.ts` | Connects them: applies each state change by writing history, starting and stopping runtimes, and publishing a snapshot. |

`stage_state.ts` holds the pure stage state (sandboxes, entries with their view and section, position): each function returns the new state with the sandboxes to open and close, and the controller applies them. All of these are browser-free apart from the `postMessage` targets and the `History` subset they receive, so they are tested in Node.

### Public API

- `createStage(options)`: builds a stage. `StageOptions` are `history` (the `state`, `pushState` and `replaceState` of `History`), `defaults` (`DefaultModSettings`), `routing` (below), `appOrigin`, `baseUrl` (the app's address), `storage` (`localStorage`), an optional `fetch` and `colorScheme`, the color scheme the app starts with.
- `followHistory(stage, hash, historyState)`: follows the current entry, on start and on each `popstate`.
- `openStageSection(stage, section)`: activates a section, as the sidebar does. Returns `false`, and does nothing, for an id that is neither a page section nor a mod section.
- `openStageLink(stage, link, openerId)`: opens a `RunLink` a mod asked for. Returns `false` when the opener is not the visible sandbox. The sessions call it through their `onOpenLink`.
- `closeSandbox(stage, id)`: the × button.
- `reloadTiles(stage, id)`: the "Reload tiles" button.
- `attachFrame(stage, id, frameTarget)`: on a frame's first `load`, connects its mod's session.
- `frameLoadedAgain(stage, id)`: on any later `load` of a frame: its mod navigated, so it is stopped with the issue `The mod left its page and was stopped.` and its frame removed.
- `answerStageAction(stage, id, accepted)`: answers the action the page shows, so the mod's request resolves with `accepted` and the next action is shown. Does nothing for an unknown id.
- `requestStageAction(stage, sandboxId, action)`, not exported: queues an action and resolves with the user's answer, or returns `null` when the sandbox is not the visible one or not running. The sessions call it through their `onRequestAction`.
- `changeStageColorScheme(stage, colorScheme)`: switches the stage's theme and pushes `theme.changed` to every running mod, visible or hidden. Does nothing when the color scheme is the current one. The stage's current `Theme` is `stage.theme`.
- `readStageSnapshot(stage)` and `subscribeStage(stage, listener)`: a frozen `StageSnapshot` that is new after every change, for React's `useSyncExternalStore`. `subscribeStage` returns the function that unsubscribes.
- Types: `Stage`, `StageOptions`, `StageRouting`, `StageHome`, `SectionLink`, `StageSnapshot` (`sandboxes`, `action`, `visible` and `activeSection`), `VisibleView` (`{ kind: "sandbox", id }`, `{ kind: "page", section, page }` with `page: null` for the index, or `null` before the first entry), `ActionSnapshot` (`id`, `mod` with `title` and `source`, and `action`), `ActionMod`, the engine's `AppAction`, `LinkAction`, `SaveFileAction` and `ConfirmAction` re-exported as types, so the page imports them from the stage, `SandboxSnapshot` (`id`, `hash`, `isVisible`, `canClose`, `status`, `mod`, `sandboxDocument`, `canReloadTiles`, `issues`, `errorMessage`), `SandboxStatus` (`loading`, `failed`, `running` or `stopped`), `StageHistory`.

### Routing options

`StageOptions.routing` is plain data the app builds from its section registry (`src/main/sections/`):

```ts
interface StageRouting {
  pageSections: readonly string[]; // ids whose target is a page, e.g. ["home", "guides", "settings", "about"]
  home:
    | { kind: "page"; section: string } // Home is that section's index page, at #/
    | { kind: "mod"; section: string; link: RunLink }; // Home is a mod, at #/
  sectionLinks: readonly { section: string; link: RunLink }[]; // mod sections, in sidebar order
}
```

`home.section` is the Home section's id, used for membership and for the close fallback. A section listed in neither `pageSections` nor `sectionLinks` is unknown to the stage: its addresses show Home.

### How the page wires the stage

`src/main.tsx` builds the stage once at module level, outside React, so StrictMode's double effect run in dev does not launch mods twice:

```ts
import { createStage, followHistory } from "./lib/core/stage/index.ts";
import { DEFAULT_MODS } from "./main/default_mods.ts";

const stage = createStage({
  history: window.history,
  defaults: DEFAULT_MODS,
  routing, // built from the available sections
  appOrigin: location.origin,
  baseUrl: document.baseURI,
  storage: localStorage,
  colorScheme: "light",
});
followHistory(stage, location.hash, history.state);
window.addEventListener("popstate", function followPopState(): void {
  followHistory(stage, location.hash, history.state);
});
```

Fragment navigations fire `popstate` too, so `hashchange` is not needed. The app's theme (`src/main/theme/app_theme.ts`) passes the resolved color scheme as `colorScheme` and calls `changeStageColorScheme` when it changes. `App` then renders the page the snapshot's `visible` names, if any, and `StageView`, which stays mounted, reads the snapshot with `useSyncExternalStore`, renders every sandbox in creation order (hidden unless visible), and calls `attachFrame`, `frameLoadedAgain`, `closeSandbox` and `reloadTiles`. Its `ActionDialog` shows the snapshot's `action`, performs it from the accept button's click and calls `answerStageAction`.

### Why no router library

TanStack Router was listed in `docs/stack.md` and was removed for this change:

- The app has three kinds of address (run links, pages and Home). Nested routes, loaders, preloading and code splitting would go unused, and typed search params are about 50 lines in `run_links.ts`.
- The stage alone must decide what each history entry means: show an open sandbox, or open its link in a new one. With a router, the router resolves the navigation first and the stage reacts, so two layers read one navigation. TanStack Router also keeps its own keys in `history.state`, where the stage keeps its positions.
- Frames must never remount. Route-driven rendering mounts the matched route's component, so the routes would render nothing and the stage would sit beside the outlet, working around the router.
- The history code is tested in Node with a fake `History` subset. A router needs a router instance and its async navigation in every stage test.

Pages that are not mods (Home, Guides, Settings and About) did not change this: they are stage entries next to the sandboxes, so the stage stays the one writer of the history and back, forward and reload keep their rules across pages and mods. Adopting a router would replace `stage_routes.ts`, `stage_history.ts` and `run_links.ts` only; the stage state and the sandboxes would not change. An embedding page that also writes `history.state` would overwrite the stage's positions: the stage then treats the entry as new and opens its link again, and `stage_history.ts` is the one file to change to share the state.
