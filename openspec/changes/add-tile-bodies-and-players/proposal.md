# Proposal

## Why

A tile's body reaches a mod as raw markdown, and the engine gives no way to show it: each mod has to bundle a markdown parser, sanitize what tile authors write, resolve their relative paths and work around the sandbox, where a plain link stops the mod and the body's images are blocked. And no mod can show a video from a site such as YouTube: the spike of `add-site-consent-dialog` showed that a player embedded in a mod's frame does not play in any browser, because the frame's origin is opaque.

The engine can do both once for every mod: render a tile's body to safe HTML that works inside the sandbox, and show players itself, outside the mod's frame, after asking the reader.

## What Changes

- **Rendered tile bodies**: a new request, `tiles.renderBody { source }`, returns the body of one of the mod's tiles as sanitized HTML: GitHub-flavored markdown, the HTML GitHub allows, relative paths resolved against the tile, images loaded lazily, `<video>` and `<audio>` of direct files kept with `preload="metadata"`, links marked to open through the app, and each embedded player replaced by a placeholder. Mermaid and other extras stay as code blocks.
- **`<ot-tile-body>`**: an element the frame loader defines in every mod frame. Given a tile, it requests the rendered body and shows it in the light DOM, so the theme and the mod's CSS style it, and fires `ot-rendered`.
- **Clicks handled by the frame loader**: in any rendered body, a click on a link sends `links.open`, and a click on a player placeholder sends `players.open`, so a mod writes no code for them.
- **Media in bodies**: the images, video, audio and posters of a body count as media linked by tiles, with the same setting, the same rules and the same private network guard as metadata links.
- **Players**: a new request, `players.open { url }`, shows the player in an app dialog, outside the mod's frame. A player address must come from the mod's tiles: any `https:` iframe in a body, or a page link of a known site (YouTube, Vimeo, SoundCloud) in the metadata or as `![](…)` in a body. A small table turns those page links into players, plays YouTube through its privacy-enhanced mode (`youtube-nocookie.com`), and gives known players their shape. The app sets the player frame's attributes itself and never copies those of the tile.
- **Asking before a site is contacted**: the player dialog first names the site and says it will see that the reader played this. Nothing is requested from the site before **Play**. **Always play from this site** remembers the answer for every mod, and Settings lists and removes it with the decisions of `add-site-consent-dialog`.
- **Test API**: a case can answer `players.open` with `answer("players.open", true)`.

## Capabilities

### New Capabilities

- `tile-bodies`: how the engine renders a tile's body for a mod, what the rendered HTML holds and allows, the `tiles.renderBody` request, the `<ot-tile-body>` element, and the frame loader's handling of clicks in rendered bodies.
- `media-players`: which addresses are players, the table of known sites, the `players.open` request, the player dialog, what the app asks before contacting a site and how it remembers the answer.

### Modified Capabilities

- `mod-sandbox`: media linked by tiles also covers the images, video, audio and posters of tile bodies.
- `mod-app-actions`: `players.open` follows the rules of the other actions: only the visible mod asks, one dialog at a time, and a mod that leaves gets `false`.
- `mod-tests`: `answer` accepts `players.open` with a boolean.
- `mod-api-version`: the mod API version becomes `0.1.5`.
- `app-settings`: the Mod permissions group also lists the sites the reader always plays from.

## Impact

- **Code**:
  - a body renderer in `src/lib/core/engine/` (or a new `src/lib/core/tile_bodies/`), from the markdown packages the app already uses for its pages, plus `rehype-stringify` to write HTML outside React;
  - `collectTileLinks` in `src/lib/core/sandbox/` reads the media of rendered bodies;
  - the session keeps the mod's current tiles, so rendering and player checks follow "Reload tiles";
  - the frame loader (`sandbox_loader.js`) defines `<ot-tile-body>` and handles clicks; the base stylesheet styles placeholders;
  - a player action and `PlayerDialog` in `src/main/stage/`; remembered player sites in the store of `add-site-consent-dialog`.
- **Tests**: unit tests of the renderer (sanitizing, paths, links, media, placeholders), of player addresses and of the table; e2e tests that a body renders with images and links, that a placeholder opens the player dialog, that nothing is requested from the site before Play, that "Always play from" skips the question, and that a check's case can answer `players.open`.
- **Docs**: the engine README (the two requests, the element, clicks), the sandbox README (media of bodies), the theme README (placeholders), the mod plugin spec (showing a body), and the settings docs.
- **Mod API version**: patch, `0.1.4` to `0.1.5`. The change adds two methods (`tiles.renderBody`, `players.open`), an element and its event (`<ot-tile-body>`, `ot-rendered`), and a scripted answer to the test API. It removes and renames nothing, and a mod that ignores them keeps working, which the "Mod API version" section of the engine's README counts as an addition.
- **App version**: patch bump while the app is `0.x`, as much as the mod API.
- **Depends on**: `add-site-consent-dialog`, whose remembered decisions and Settings group this change extends. It is applied and archived first.
- **Out of scope**:
  - mermaid diagrams, math, alerts and other extras of GitHub's renderer: their blocks stay as written, and diagrams come in a change of their own;
  - players inline in the mod's layout, and controlling a player (play, pause, seek) from the mod;
  - pages that are not players from metadata: a metadata link to a page of an unknown site does not become a player;
  - rendering markdown that is not a tile's body.
