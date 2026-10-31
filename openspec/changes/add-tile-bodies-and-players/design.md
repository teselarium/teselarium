# Design

## Context

- **Tiles.** A tile reaches a mod with `metadata`, `body` (raw markdown, as written) and `source`. `buildModLaunch` (`src/lib/core/engine/mod_launch.ts`) builds the mount context, the content hosts and the tile links (`collectTileLinks` in `src/lib/core/sandbox/tile_links.ts`, metadata only), then the policy, which is fixed for the frame's life. "Reload tiles" (`reloadSandboxTiles`) pushes `tiles.changed`, but the session keeps the launch's tiles: nothing in the engine reads tiles after the launch today.
- **Markdown.** The app renders its own pages with `react-markdown`, `remark-gfm`, `rehype-raw` and `rehype-sanitize` (`src/main/pages/page_markdown.tsx`, `page_sanitize_schema.ts`). That pipeline is React; `unified`, `remark-parse` and `remark-rehype` are only transitive dependencies, and nothing can write HTML text (`rehype-stringify` is not installed). The spike measured about 1.7 ms per typical body for parsing and sanitizing.
- **Actions.** `links.open`, `files.save` and `ui.confirm` build an `AppAction` and call `askUser`, which goes through `onRequestAction` to the stage's action queue (`stage_actions.ts`); `ActionDialog` shows the first entry. The queue already handles visibility, ordering and dropping.
- **Frame loader.** `sandbox_loader.js` is plain browser JavaScript inlined in every frame document; the check's test runner and assertions follow it in the same module script. `AnswerMethod` in `sandbox_messages.ts` lists the methods a case can answer.
- **Remembered decisions.** `add-site-consent-dialog` adds `src/main/settings/site_decisions.ts` and the Settings group Mod permissions. Its decisions are per mod and per declared permission.
- **Spike results** (see `add-site-consent-dialog`): players do not play inside the mod's frame and do play in the app's page; Chromium sends no Referer from the mod's frame.

## Goals / Non-Goals

**Goals:**

- One renderer, in `src/lib/core/`, used at launch, on reload and for `tiles.renderBody`, so the policy, the player addresses and the HTML the mod gets always agree.
- The renderer never trusts the body: everything it outputs is built or allowed by a schema, and the iframe attributes the app keeps are only read, never copied.
- No request to a player's site before the reader presses Play.

**Non-Goals:**

- Rendering markdown that is not a tile's body, or rendering in the mod's frame.
- Player controls for mods, and players inline in the mod's layout.
- Drawing mermaid diagrams (`add-tile-body-diagrams`), and rendering math, highlighting code and emoji shortcodes (a later change). This change only keeps math exact, so that change can render it from the same code elements.

## Decisions

### D1. Two modules: `players` and `tile_bodies`

- `src/lib/core/players/`: the table of known sites and `readPlayer(address)` → `{ frameUrl, host, siteName, shape } | null`, where `shape` is `{ ratio }` or `{ height }`. Pure, used by the renderer, the engine's `players.open` and the player dialog.
- `src/lib/core/tile_bodies/`: `renderTileBody(tile) → RenderedBody` with `{ html, mediaUrls, playerAddresses, issues }`. Pure, synchronous, no DOM.

*Alternative*: one module in `engine/`. Rejected: the player dialog in `src/main/` needs the table, and the sandbox module needs the media addresses; neither should import the engine.

### D2. The table of known sites

| Site | Recognized | Plays from | Shape |
|---|---|---|---|
| YouTube | `youtube.com`, `www.`/`m.` subdomains, `youtu.be`, `youtube-nocookie.com`: `/watch?v=<id>`, `/<id>` on `youtu.be`, `/embed/<id>`; `<id>` is 11 characters of `A-Za-z0-9_-` | `https://www.youtube-nocookie.com/embed/<id>` | 16:9 |
| Vimeo | `vimeo.com/<digits>`, `player.vimeo.com/video/<digits>` | `https://player.vimeo.com/video/<digits>` | 16:9 |
| SoundCloud | `soundcloud.com/<user>/<track>` and `/<user>/sets/<name>`; `w.soundcloud.com/player/` | the widget with `url` set to the page | height 166 px (track) or 450 px (set) |

Query parameters of page links are dropped, so a link cannot turn on autoplay. Any other `https:` iframe from a body plays from its own `src`, with the ratio of its `width` and `height` (16:9 without them). The table only adds; leaving a site out of it never blocks an iframe, it only stops page links of that site from becoming players.

### D3. The renderer's pipeline

`remark-parse` → `remark-gfm` → `remark-math` → **dollar pass** → **alerts pass** → `remark-rehype` (with raw HTML) → `rehype-raw` → `rehype-slug` → **players pass** → `rehype-sanitize` with the tile schema → **finishing pass** → `rehype-stringify`.

- **Math**: `remark-math` takes `$…$` and `$$…$$` out of markdown's hands, so emphasis and backslash escapes never touch a formula; `remark-rehype` then writes them as `code.language-math.math-inline` and `pre > code.language-math.math-display`, the elements a later change can render. `remark-math` alone reads `It costs $5 and $10.` as a formula (checked with `remark-math` 6): the **dollar pass** turns back into text, from the source positions, each inline math whose opening `$` is followed by a space, or whose closing `$` follows a space or is followed by a digit, which is GitHub's and Pandoc's rule.
- **Alerts pass**: a blockquote whose first paragraph starts with a line that is only `[!KIND]` (the five kinds, any case) becomes an `aside` (through `data.hName`) with `class="ot-alert"`, `data-ot-alert` and a title paragraph; the marker line is removed. No dependency.
- **Heading ids**: `rehype-slug` gives GitHub's slugs (checked: `Install it!` twice gives `install-it` and `install-it-1`), and the sanitizer's clobber prefix turns them into `user-content-…`, as on GitHub. This also keeps a body's ids away from the mod's own.

- **Players pass**, before sanitizing, because the schema removes iframes. For each `<iframe>`: resolve `src` against the tile; when it is a player address (D4), replace the element with `button.ot-player` holding `data-ot-player`, a span with the `title` and a span with the host; otherwise with a link (`http:`/`https:` allowed by the guard) or nothing, with an issue for a private address. For each `<img>` whose `src` is a known-site page link, the same placeholder with the alt text. The pass only reads `src`, `title`, `width`, `height` and `alt`; the elements it creates are new.
- **Tile schema**: GitHub's default schema (which keeps `picture`, `source` with `srcset`, `details`, `kbd`, `sup` and `sub`) plus `video`, `audio` and `source` (`src`, `poster`, `width`, `height`, `type`, `media`), `button` with `type`, `class` `ot-player` and `data-ot-player`, `aside` and `p` with the `ot-alert` classes and `data-ot-alert` (the five kinds), and `code` with the `math-inline` and `math-display` classes. Sanitizing runs after the players pass, so a body cannot forge a placeholder with its own `data-ot-player` value that the engine did not produce: the attribute stays, but `players.open` only accepts addresses the renderer recorded (D4).
- **Finishing pass**: resolve `src`, `poster`, each `srcset` candidate and `href` against the tile; mark links to `#…` with `data-ot-fragment` and leave their `href`; add `loading="lazy"` and `decoding="async"` to images; force `controls` and `preload="metadata"` and drop `autoplay` on video and audio; add `data-ot-link` to `http:`/`https:` links; collect the addresses of images, video, audio, sources, posters and `srcset` candidates into `mediaUrls`.

`unified`, `remark-parse`, `remark-rehype`, `rehype-stringify`, `remark-math` and `rehype-slug` become direct dependencies. The first three are already in the bundle through `react-markdown`; the others are small.

*Alternative*: reuse `PageMarkdown` in a hidden React root and read its HTML. Rejected: it needs a DOM, runs in the app's realm on untrusted input, and its link rules are the pages'.

### D4. Rendered bodies live with the session

`buildModLaunch` renders the bodies of the tiles the mod receives into a `TileBodies` value: rendered bodies by tile source, the player addresses (from bodies, and from metadata strings that `readPlayer` recognizes), and the media addresses by tile. `collectTileLinks` gets each tile's body media addresses with its metadata strings, so body media follow the same six steps, the same issues and the reload notice.

The session keeps `TileBodies` and replaces it when the stage reloads the tiles (`pushTilesChanged` gains the new value), so `tiles.renderBody` and `players.open` follow "Reload tiles". The policy stays the launch's.

Bodies without `<`, `![` or a URL scheme skip the players and media collection, but still render on request: most plain-text bodies cost nothing at launch.

### D5. `tiles.renderBody`

Reads `source` and returns `{ html }` from the session's `TileBodies`, rendering on first request and keeping the result. Errors: `-32602` for a missing or non-string `source`, or one that names no tile of the mod.

### D6. `players.open` is an app action

A new `PlayerAction` (`kind: "player"`, `frameUrl`, `host`, `siteName`, `shape`) joins `AppAction`, so the action queue gives `players.open` the visibility, ordering and dropping rules of `mod-app-actions` without new code. The handler checks `url` (`-32602` when it is not an absolute `https:` address), looks it up in the session's player addresses (`-32002` otherwise), builds the action with `readPlayer` (or the iframe's own data) and calls `askUser`. A dropped player resolves `true` when it was already playing: the stage records on the entry whether Play was pressed.

### D7. `PlayerDialog`

A `StageDialog` rendered by `StageView` when the shown action's kind is `player`; `ActionDialog` keeps the other three.

- **Question**: mod title and source, site name and host, the cost sentence, the **Always play from <host>** checkbox, Cancel (focused) and Play.
- **Player**: a frame with `src` = `frameUrl`, `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `referrerPolicy="strict-origin"`, sized by `shape`, and a Close button. `allow-same-origin` is safe here because the frame's origin is the site's, never the app's; popups let the player's own "Watch on YouTube" link open a tab.
- The dialog reads the remembered hosts (D8) when it opens: a remembered host skips the question.

### D8. Remembered player hosts

A small store, `src/main/settings/player_sites.ts`, with the key `opentesela.player-sites` (a JSON array of hosts), the same reading, writing and failure rules as `site_decisions.ts`. A separate key keeps the format of `add-site-consent-dialog` unchanged. The Mod permissions group lists both stores: decisions per mod, then player hosts as `play media from <host>` for every mod.

### D9. The frame loader

- **`ot-tile-body`**: a custom element defined in the loader, so check frames get it too. Setting `tile` sends `tiles.renderBody` with `tile.source`; a newer `tile` set before the answer wins (a request counter). On success it sets its `innerHTML` to the result and dispatches `ot-rendered` (`bubbles: true`); on failure it shows the message as text with `role="alert"`.
- **Clicks**: one `click` listener on `window`, in the bubbling phase. When the event was not cancelled, `closest("[data-ot-player]")` sends `players.open`, and `closest("a[data-ot-link]")` cancels the navigation and sends `links.open` with the link's `href`, and `closest("a[data-ot-fragment]")` cancels the navigation and scrolls to the heading: it walks up from the link and scrolls to the first `#user-content-<slug>` found inside an ancestor, so with several bodies on a page, a link reaches the heading of its own body. A fragment without such a heading does nothing. A rejected request is logged with `console.warn`.
- `AnswerMethod` gains `players.open` (boolean).

### D10. Base stylesheet

`button.ot-player` gets a block box, full width, `aspect-ratio: 16 / 9`, the card colors, the title on top and the host in the muted color, and a play mark drawn with CSS. `aside.ot-alert` gets a left border and a bold title in its kind's token: `note` `--ot-primary`, `tip` `--ot-success`, `important` `--ot-secondary`, `warning` `--ot-warning`, `caution` `--ot-destructive`. Math code looks like code. A mod with `theme: "none"` gets plain elements.

## Risks / Trade-offs

- [A page shown in an app dialog can imitate the app, such as a fake sign-in] → The question names the host before anything loads; the dialog's header, drawn by the app, keeps showing the host while the player plays; the frame cannot reach or navigate the app.
- [Rendering every body at launch slows large collections] → Bodies without images, media, iframes or URLs skip the collection (D4); rendering for the mod happens on request and is kept. At about 2 ms per body with media, 500 such tiles add about a second, which the docs mention.
- [A mod stops a click's propagation without cancelling it, and a body link then navigates its frame, stopping the mod] → Documented: cancel the click (`preventDefault`) to handle links yourself.
- [`youtube-nocookie.com` still lets Google keep data after Play] → The question says the site sees the play; the privacy mode only reduces what happens after it.
- [A site in the table changes its addresses] → The table is small, tested by address examples, and a broken entry only turns a page link back into a plain link; iframes pasted from the site keep working as generic players.
- [The app's page has a Content-Security-Policy with `frame-src`] → Players are blocked by the host's own policy; the hosting note in the engine README says to allow the player sites.
- [Vimeo was not verified by the spike] → The e2e tests stub the players; a manual check in a desktop browser is part of the verification task.
- [The dollar rule differs from GitHub in rare cases (GitHub's exact rules are not published)] → It matches the common cases, prices and currency included; an author can always write `\$`. Tests pin the cases the spec names.
- [Two rendered bodies on one page can repeat heading ids] → Fragment clicks search from the link outward (D9), so each body's links reach its own headings; the ids only matter to those clicks.

## Migration Plan

No stored data changes: the new key starts empty. The mod API grows by additions, so existing mods keep working; the version becomes `0.1.5` and the surface guard records it. Applied and archived after `add-site-consent-dialog`.
