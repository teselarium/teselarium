# Stage Module

## Introduction

The stage opens mods from shareable links, each in its own sandbox, and navigates between them like pages of one site. Several sandboxes stay open at once and one is visible. The browser's back and forward buttons return to a sandbox in the state it was left in, and a close button (×) closes it. Mods never own a route: they are values of the link's parameters.

### Run links

The app has one route. Its address hash is a run link:

```
#/run?mod=<reference>&collection=<location>&<params>
```

- `mod` is a mod reference (see the [mod module](../../mod/README.md)): a default mod name such as `mod_viewer`, a folder or a mod file.
- `collection` is the optional location of a collection file. Without it, the mod gets no tiles.
- Every other parameter is passed to the mod as `context.params`, in link order, with the first value of a repeated key.
- Values are percent-encoded, and relative ones are resolved against the app's address when the mod is launched. So a link means the same in the address bar, in a `mods.open` request and after a reload, also under a sub-path such as GitHub Pages' `/<repo>/`.
- Every other hash, including `""`, `#/` and old links such as `#/mods/view`, opens the home mod. The home mod runs in a sandbox like any other mod.

Examples, for an app at `https://example.org/`:

| Address hash | Opens |
|---|---|
| `#/` | the home mod (the mod explorer) |
| `#/run?mod=./samples/mods/book_list&collection=./samples/tiles/books_collection.yaml` | the sample mod with the sample books |
| `#/run?mod=./samples/mods/book_list` | the sample mod without tiles |
| `#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml` | the mod viewer, showing the sample mod |

Mods never build these addresses. A mod sends `mods.open` with `{ mod, collection, params }`, and the stage turns it into the run link.

### Sandboxes and their ids

Each sandbox gets an id from the stage, `sandbox-1`, `sandbox-2`, …, unique in the page. Mods never choose ids. Sandboxes are kept in creation order, so rendering never moves a frame (moving an iframe in the DOM reloads it).

Each sandbox records its link, its hash, whether it is the home mod, and its opener: the sandbox whose mod opened it with `mods.open`, or none for a link the user followed.

### The visible sandbox

Opening a link, whether the user followed it or a mod asked for it, creates a new sandbox and hides the visible one without stopping it. Exactly one sandbox is visible. Only the visible mod can open mods.

### History entries and positions

Each opened sandbox gets its own history entry. The stage stores its position in the entry's state, `{ opentesela: { position } }`, and keeps a list of entries that maps each position to a sandbox. The browser keeps that state across reloads.

- **First load, a typed address, or a link followed in the page**: the entry has no stage state. Its link opens in a new sandbox at the next position, and the entry is replaced with the position in its state. On the very first load the position is `0`.
- **Back and forward**: the entry has a position. When its sandbox is still open, that sandbox is shown again, in the state it was left in. Otherwise (after a reload, or when its sandbox was closed) its link opens in a new sandbox that takes the entry.
- **`mods.open`**: a new sandbox at the next position, with a pushed entry whose address is the run link.

### Opening after going back

When a link opens while the visible sandbox is not the last entry, the forward entries are dropped, as a browser drops them. Every sandbox that no remaining entry points to is closed: its mod is stopped and its frame removed.

### Closing

The stage bar has × for the visible sandbox, except for the home mod opened at `#/`. Closing stops the mod and removes its frame, then shows the sandbox that opened it when it is still open, or a new home sandbox otherwise. The current history entry is replaced with the shown sandbox's address. Other entries that pointed to the closed sandbox stay, and open their link again when visited.

### Issues and load failures

The stage bar lists every issue of the visible sandbox, in the order they were found: tile collection issues, permission issues, blocked requests, mount failures and a stopped mod. Each sandbox keeps its own issues. When the mod file, its entrypoint, its tile type file or the collection cannot be loaded, or a link names a switched-off default mod, the sandbox shows the error and no frame, and keeps its history entry and its ×.

"Reload tiles", for a sandbox opened with a collection, loads and validates the collection again, pushes `tiles.changed` to the running mod and replaces the collection issues.

## Module Details

Implemented in `src/lib/core/stage/`. Other modules import only from the public entry point `src/lib/core/stage/index.ts`.

### The three stage files

The work behind the public API is split so each file has one reason to change:

| File | Owns |
|---|---|
| `stage_history.ts` | Addresses and history entries. The only file that calls `History` (`pushState`, `replaceState`) and the run link functions of `run_links.ts`. |
| `stage_sandboxes.ts` | The runtime of one sandbox: launch, frame, session, issues, reload and stop. |
| `stage_controller.ts` | Connects them: applies each state change by writing history, starting and stopping runtimes, and publishing a snapshot. |

`stage_state.ts` holds the pure stage state (sandboxes, entries, position): each function returns the new state with the sandboxes to open and close, and the controller applies them. All of these are browser-free apart from the `postMessage` targets and the `History` subset they receive, so they are tested in Node.

### Public API

- `createStage(options)`: builds a stage. `StageOptions` are `history` (the `state`, `pushState` and `replaceState` of `History`), `defaults` (`DefaultModSettings`), `appOrigin`, `baseUrl` (the app's address), `storage` (`localStorage`) and an optional `fetch`.
- `followHistory(stage, hash, historyState)`: follows the current entry, on start and on each `popstate`.
- `openStageLink(stage, link, openerId)`: opens a `RunLink` a mod asked for. Returns `false` when the opener is not the visible sandbox. The sessions call it through their `onOpenLink`.
- `closeSandbox(stage, id)`: the × button.
- `reloadTiles(stage, id)`: the "Reload tiles" button.
- `attachFrame(stage, id, frameTarget)`: on a frame's first `load`, connects its mod's session.
- `frameLoadedAgain(stage, id)`: on any later `load` of a frame: its mod navigated, so it is stopped with the issue `The mod left its page and was stopped.` and its frame removed.
- `readStageSnapshot(stage)` and `subscribeStage(stage, listener)`: a frozen `StageSnapshot` that is new after every change, for React's `useSyncExternalStore`. `subscribeStage` returns the function that unsubscribes.
- Types: `Stage`, `StageOptions`, `StageSnapshot`, `SandboxSnapshot` (`id`, `hash`, `isVisible`, `canClose`, `status`, `mod`, `sandboxDocument`, `canReloadTiles`, `issues`, `errorMessage`), `SandboxStatus` (`loading`, `failed`, `running` or `stopped`), `StageHistory`.

### How the page wires the stage

`src/main.tsx` builds the stage once at module level, outside React, so StrictMode's double effect run in dev does not launch mods twice:

```ts
import { createStage, followHistory } from "./lib/core/stage/index.ts";
import { DEFAULT_MODS } from "./main/default_mods.ts";

const stage = createStage({
  history: window.history,
  defaults: DEFAULT_MODS,
  appOrigin: location.origin,
  baseUrl: document.baseURI,
  storage: localStorage,
});
followHistory(stage, location.hash, history.state);
window.addEventListener("popstate", function followPopState(): void {
  followHistory(stage, location.hash, history.state);
});
```

Fragment navigations fire `popstate` too, so `hashchange` is not needed. `App` then renders `StageView`, which reads the snapshot with `useSyncExternalStore`, renders every sandbox in creation order (hidden unless visible), and calls `attachFrame`, `frameLoadedAgain`, `closeSandbox` and `reloadTiles`.

### Why no router library

TanStack Router was listed in `docs/stack.md` and was removed for this change:

- The app has one route. Nested routes, loaders, preloading and code splitting would go unused, and typed search params are about 50 lines in `run_links.ts`.
- The stage alone must decide what each history entry means: show an open sandbox, or open its link in a new one. With a router, the router resolves the navigation first and the stage reacts, so two layers read one navigation. TanStack Router also keeps its own keys in `history.state`, where the stage keeps its positions.
- Frames must never remount. Route-driven rendering mounts the matched route's component, so the routes would render nothing and the stage would sit beside the outlet, working around the router.
- The history code is tested in Node with a fake `History` subset. A router needs a router instance and its async navigation in every stage test.

Revisit when the app gets pages that are not mods, such as the Settings and About sections of `docs/modules/main/`. Adopting a router then replaces `stage_history.ts` and `run_links.ts` only; the stage state and the sandboxes do not change. An embedding page that also writes `history.state` would overwrite the stage's positions: the stage then treats the entry as new and opens its link again, and `stage_history.ts` is the one file to change to share the state.
