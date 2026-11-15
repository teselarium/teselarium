# Design

## Context

See proposal.md for the motivation. It builds on `add-collection-explorer` (`collections.inspect`, `collection_viewer`, mod API `0.1.11`), which is applied and archived in `openspec/changes/archive/2026-11-15-add-collection-explorer/`. References to its decisions below point to that design.md. What the code does today:

- **Run links.** `src/lib/core/stage/run_links.ts`:
  - `readAppRoute` reads `mod`, `collection` and the other params into a `RunLink { mod, collection, params }`, treating `mod` and `collection` as reserved;
  - `buildRunLink` writes the link back;
  - `areSameLinks` (`stage_routes.ts`) compares links for section membership.

  `RunLink` is also the type of a section's mod target in `src/main/sections/section_registry.ts`, which instantiations write.
- **Launching.** `src/lib/core/engine/mod_launch.ts`:
  - `loadLinkTiles` loads the link's collection with `loadModTiles`, which validates it with the mod's tile type through `selectModTiles`, into `ModTiles { collectionSource, tiles, issues }`;
  - `listContentSources` adds the collection and tile sources to the content hosts;
  - `buildModLaunch` collects the media linked by tiles and the bodies, then builds the policy, all before the frame exists;
  - `ModLaunch.collectionSource` drives "Reload tiles" (`stage_controller.ts` `canReloadTiles`, `stage_sandboxes.ts`) and the loaded and reloaded notifications;
  - the runtime keeps `collectionLocation`.
- **Opening from a mod.** `mods.open` (`mods_methods.ts`):
  - `readOpenParams` builds the link;
  - `context.onOpenLink(link)` returns `false` when the requester is not visible, and the handler then answers `-32002`;
  - the controller's `openStageLink(stage, link, openerId)` opens a new sandbox through `openStageEntry`, which pushes an entry, drops forward entries and closes sandboxes no entry points to.
  - `mods.open`'s `params` accepts any key today, so `params: { collection: "…" }` builds a link that reads back as a collection after a reload.
- **The stage state** (`stage_state.ts`) is pure data with pure transitions (`openStageEntry`, `restoreStageEntry`, `closeStageSandbox`) returning `{ state, opened, closedIds }`. `writeStageEntry` (`stage_history.ts`) already has a `"replace"` mode.
- **Section memory** (`stage_sections.ts`) is derived from what the stage shows:
  - `rememberShownEntry` sets a section's `last` view and learns its `root`, which is a sandbox with no opener whose link equals the section's link;
  - `forgetSandboxes` clears what points to closed sandboxes.
- **Clicks in a mod's frame.** The frame loader handles clicks on `a[data-ot-link]` on `window`, in the bubbling phase, and leaves alone a click the mod cancelled. A listener on `document` runs before it.

## Goals / Non-Goals

**Goals:**

- A tile link goes through the same launch path as a collection link, so policy, bodies, players, types, notifications and "Reload tiles" behave the same with no second implementation.
- Replacing a sandbox is one pure stage transition that reuses closing and section memory, not a special case spread through the controller.
- The tile viewer is a small mod in the style of the other default mods.

**Non-Goals:**

- `mods.check` with a tile, which stays collection-only.
- Caching the `from` index between Previous and Next. Each tile viewer is a new frame and inspects `from` again; the browser's HTTP cache may serve the file.
- Rendering video or audio addresses of the metadata as players.

## Decisions

### 1. A tile is a collection of one, from the launch on

`RunLink` gets `tile?: string | null`. It is optional so that instantiations' section targets (`{ mod, collection, params }`) still compile, and absent means `null`. A new `loadModTile(mod, location, options)` in `mod_launch.ts`:
1. loads the tile with `loadTile`;
2. wraps it in a `TileCollection` whose `source` is the tile's source, with an empty `name` and `description`, `tiles: [tile]` and no issues;
3. passes it to the existing `selectModTiles`.

So a tile of another type becomes the same warning as in a collection. A tile that cannot be fetched or parsed throws, and the launch fails like a collection that cannot be loaded. That is the "Show load failures" path, with the tile's address as the error's source.

`ModTiles.collectionSource`, `ModLaunch.collectionSource` and the runtime's `collectionLocation` are renamed to `tilesSource` and `tilesLocation`: "the location the link's tiles come from". `loadLinkTiles` chooses between the collection and the tile, so "Reload tiles", `canReloadTiles`, `tiles.changed` and the two notifications work for both with no new branch. The notification texts already count tiles, so a tile gives "1 tile", or "0 tiles" when it isn't of the mod's type.

Alternatives considered:
- **A new launch kind beside the collection path.** It would duplicate the policy, body and notification wiring.
- **The engine synthesizes a collection file.** There is nothing to fetch, and the error sources would be wrong.

### 2. Links with both a collection and a tile fail before any request

`readAppRoute` reads `tile` like `collection` (empty means `null`) and reserves it. `buildRunLink` writes `tile` after `collection`. `areSameLinks` compares `tile` too, with an absent `tile` equal to `null`.

A link with both a collection and a tile is a launch failure thrown before the mod file is requested, by a `RunLinkConflictError` whose source is the run link's mod reference. So the sandbox shows the error, no frame starts and no file is requested. `mods.open` refuses the same combination earlier, with `-32602`.

Alternative considered:
- **Letting `tile` win.** A typed link would silently ignore part of what it says.

### 3. `mods.open` reads `tile`, `replace` and reserved params

`readOpenParams` reads:
- `tile`, like `collection`;
- `replace` as an optional boolean;
- `params`, refusing the keys `mod`, `collection` and `tile` with `mods.open: "params.<key>" is reserved`.

It refuses `collection` and `tile` together. It returns `{ link, replace }`.

`context.onOpenLink(link, { replace })` returns an outcome, `"opened" | "not-visible" | "home-mod"`, instead of a boolean. The handler maps `"not-visible"` to the existing `-32002` message and `"home-mod"` to `mods.open: the home mod cannot be replaced`. Check and case frames keep answering `mods.open` as they do today, so a case records `tile` and `replace` in `requests` and answers `null`.

### 4. Replacing is one pure stage transition

`replaceStageEntry(state, opening, requesterId)` in `stage_state.ts`:
1. builds the new sandbox with `openerId` set to the requester's `openerId`;
2. points the current entry, at the same position and with the same section, to the new sandbox;
3. removes the requester, returning its id in `closedIds`.

Forward entries stay. Other entries that pointed to the requester stay, and are restored by link when visited, as after any close.

The controller's open path takes a mode:
- **push** (today's behaviour): `openStageEntry`, then `writeStageEntry("push")`;
- **replace**: `replaceStageEntry`, then `writeStageEntry("replace")` with the new sandbox's run link, then the usual close side effects for `closedIds`. Those side effects stop the session, remove the frame and drop the requester's dialogs through the existing "a mod that leaves gets no" rule.

Section memory needs no new rule. `forgetSandboxes(closedIds)` clears a root or last that was the requester. Then `rememberShownEntry` sets the section's last view to the new sandbox. A replaced root leaves the section without a root, so activating the section while in it opens its start again, as after closing a root. The explore notes suggested passing the root on to the new sandbox. That's dropped as unneeded: a tile viewer is never a section's root in the vanilla app, and the derived memory already gives "come back to where you were".

The requester gets no answer because its session is stopped inside `onOpenLink`, before the handler returns. `mod_session.ts` already answers a request only while the session is not stopped. The tasks include a test of that for replace, and of the response `null` for push.

Alternative considered:
- **Back-then-push** (close the requester and push the new entry). It would add a history entry and drop forward entries, which is what replace is meant to avoid.

### 5. `tile_viewer` modules

`default_mods/tile_viewer/`, config `{ tile_viewer: "tile_viewer", collection_viewer: "collection_viewer" }`, no `type_path`, and its fixture collection `fixtures/tiles_collection.yaml` as `sample_collection`. `tiles.renderBody` renders only the tiles of the check's collection, not tiles a case passes to `mount`, so without a sample collection no case could render a body (the flashcards sample works the same way). So the mount check mounts the viewer with the fixture tiles and shows the first one, without findings. The cases render the bodies of the fixture tiles (`context.tiles`). The tiles a case builds itself have an empty body, and the viewer draws no `<ot-tile-body>` for an empty body, so it sends no `tiles.renderBody` for them. "No tile was given." is a case that mounts with no tiles. Modules:

| Module | What it does |
|---|---|
| `main.ts`, `viewer_page.ts` | the page; draws the card at once, then the place in the collection when `from` is inspected |
| `tile_heading.ts` | pure: the tile in, the heading text out (`title`, else the decoded last path segment) |
| `tile_card.ts` | one `<article>` for the whole tile: the `<h1>`, the source in `<small>`, an `<hr>` (the theme's separator), the metadata in a `<section aria-label="Metadata">`, then, for a non-empty body, another `<hr>` and the body. Keeping the body in the card reads as one document; a second card for the body would make it look like a second object |
| `metadata_list.ts` | the recursive `<dl>`, each key and value wrapped in a `<div>`, which HTML allows in a `<dl>`, so a field hides as one element; the visible `<div>`s are `display: contents`, so the grid sees their `<dt>` and `<dd>`. Mappings give a nested `<dl>`, lists a `<ul>`, strings a text node or a link, other scalars `String(value)`. Layout-only CSS, scoped to the metadata section so it never reaches a rendered body, makes each `<dl>` a two-column grid (keys at most as wide as the longest, values beside them), so a single value stays on its key's row, and each `<ul>` a column without bullets, one item per line. Lists stay lists, for screen readers. Short lists as tag badges were considered and left for a later change |
| `metadata_lines.ts` | pure: the metadata in, the collapsed preview out. It counts each value's lines (1 for a scalar, 2 for an image address, the sum of the items or values of a list or a mapping, 1 for an empty one), then walks the fields in order with a budget of 6 lines: a field that fits shows whole, a list that does not fit shows the items that fit in the budget less one line, for its `and <n> more` line, and every field after the first that does not fit is hidden. The first field always shows, a list with at least one item. Counting lines from the values, not clipping by height, keeps whole values: a clipped height would cut a value or a thumbnail and leave hidden links in the tab order. A long URL that wraps takes more lines than it counts, which is accepted |
| `metadata_section.ts` | the `<section aria-label="Metadata">`: a `<header>` with an `<h2>` holding `<small>Metadata</small>` (the theme's muted, smaller text: a default mod sets no font) and, when the preview hides anything, a button with `aria-expanded` and `aria-controls`, `Show all <n> fields` or `Show fewer fields`; then the list. The button is the theme's outline button, so it has a border and the page background (`--ot-background`) without a pointer over it: a ghost button read as text. Matching the card's background would take a theme change for every mod's outline buttons in cards, and a default mod sets no color, so the outline button's background is kept. Layout-only CSS lowers its minimum height and padding, so it is no taller than the heading. Collapsing sets `hidden` on the hidden fields' pairs and lists' items, so they leave the tab order and the accessibility tree, and shows the `and <n> more` lines. Each viewer starts collapsed, also after Previous or Next: the state is not stored. `<details>` was not used, since it hides everything but its summary |
| `metadata_addresses.ts` | pure: `isWebAddress`, `isImageAddress` (the extension list, on `URL.pathname`, lower-cased) and `isTileAddress` (`.md`) |
| `metadata_link.ts` | `<a href data-ot-link>` holding the address. An image address also gets an `<img loading="lazy" decoding="async" alt="">` with an `error` listener that sets `hidden`. The thumbnail is two lines of text high (`block-size: 2lh`), before the address on the same row, so an image address takes 2 lines. The mod's own rules are outside the theme's layer and win over its `[hidden]` rule, so no rule that sets `display` may match a hidden thumbnail (`add-collection-explorer`, decision 7). |
| `tile_body.ts` | an `<ot-tile-body>` whose `tile` is the tile, or none for an empty body |
| `collection_place.ts` | `collections.inspect(from)`, the tile's index in `tiles`, the breadcrumb `<nav aria-label="Collection">` with the name as a button and `<i> of <n>`, and Previous (outline) and Next (primary) |
| `tile_links.ts` | one `click` listener on `document`: for `closest("a[data-ot-link]")` whose address is a tile address, it calls `preventDefault()` and sends `mods.open` |

How the viewer opens other views:
- **Next and Previous** send `{ mod: config.tile_viewer, tile: tiles[i ± 1], params: { from }, replace: true }`.
- **The collection's name** sends `{ mod: config.collection_viewer, params: { target: from } }`.
- **A link to a tile** sends `{ mod: config.tile_viewer, tile: href, params }`, where `params` holds `from` only when `href` is in the inspected `tiles`. Until the inspection settles, the link has no `from`.

Errors of `mods.open` are shown in a `role="status"` region, as the explorers do. It stays empty until an error, because the theme draws a non-empty `role="status"` as an alert box. So the position (`3 of 16`) is plain text, not that region. A failed `from` sends `ui.notify` with level `"warning"` and source `from`.

The `.md` check is on the path only, so `https://example.org/a.md?raw=1` is a tile address and `https://example.org/readme.md.html` is not. The viewer has no tile type, so any text file opens: without frontmatter, the whole text is the body.

Alternatives considered:
- **Opening linked tiles with `replace`.** Following a link is navigation, so Back should return. Only Previous and Next are page turns.
- **Using `context.mod.source` for the viewer itself.** It would put the mod file's full URL in the links instead of `tile_viewer`, so a typed `#/run?mod=tile_viewer&…` link would no longer equal it. The config key keeps links short and lets an instantiation point to another viewer.
- **Sharing label code with `collection_viewer`.** Each default mod is one bundle, so the few lines of decoding are duplicated, as in `add-collection-explorer`, decision 6.

### 6. Collection viewer rows become buttons

`tile_list.ts` of `collection_viewer` draws the tiles as rows of a table in a card ("Tile" and "Address" columns, see `add-collection-explorer`, design.md, decision 7). The "Tile" cell of each row holds the label as a `<button type="button">` whose accessible name is the label, and the "Address" cell keeps the full address in muted text. Its click sends `{ mod: config.tile_viewer, tile: source, params: { from: inspection.source } }`. Errors, such as `-32003`, go to a `role="status"` region that the viewer adds for them, as the explorers have, and which draws nothing while it is empty. It is not the tile count under the filter, which stays an `aria-live` line. `mod_conf.yaml` gets `config: { tile_viewer: "tile_viewer" }`. The reason of its `open` permission, today "Shows the collection you are viewing", becomes "Shows the collection you are viewing and opens the tiles you pick", because `mods.open` is checked against `open` just as `collections.inspect` is. The filter keeps hiding rows with `hidden`, so hidden buttons leave the tab order.

A refused open is covered by a case, not end to end. With no queued answer, a case's `mods.open` is refused with `-32002`, which the region shows. The `e2e-explorer-off` build can't test a switched-off tile viewer, because `add-collection-explorer` switched off `collection_viewer` there too. Switching off a default mod is already tested end to end by the collection explorer's "Viewer switched off". A build mode just for this would add a full build and server to every e2e run.

### 7. Mod API `0.1.12`

`MOD_API_VERSION` becomes `0.1.12`. The surface guard records names only, and this change adds none, so its `0.1.12` entry repeats `0.1.11`'s. `default_mods/mod_api.d.ts` gets `tile?: string` and `replace?: boolean` in `ModOpenParams`. The engine README's version notes say that `tile` became a reserved link name in `0.1.12`, and why this was taken as a patch (proposal, Impact).

## Risks / Trade-offs

- **[A mod used a `tile` link parameter or a reserved `params` key]** → It now gets a loaded tile or `-32602`. No shipped, test or known mod does, which the search of the repository confirmed. The README states it.
- **[Every Previous and Next starts a new frame and inspects `from` again]** → That's one tile request and one small YAML request per step. Replace keeps at most one tile viewer frame alive per step. Prefetching is not worth its complexity now.
- **[The replaced mod might act after it is replaced]** → Its session is stopped inside `onOpenLink`, before control returns to it, and a stopped session sends and receives nothing. A test checks that no response reaches the requester.
- **[A thumbnail guessed from the extension may not be an image]** → It is hidden on error, and the link stays.
- **[A `.md` address on another site opens as a tile]** → That's intended, because tile identity is the address. The site must allow the app to read it, and the fetch error's hint from `add-collection-explorer` says so.
- **[The breadcrumb opens a second collection viewer instead of going back]** → Accepted for now (explore: approach c is later). Back still returns to the first one.

## Migration Plan

Nothing to migrate:
- Section targets without `tile` keep working.
- Existing run links have no `tile`, or had it as a plain parameter, which no mod uses.
- `^0.1.0` mods keep matching.
