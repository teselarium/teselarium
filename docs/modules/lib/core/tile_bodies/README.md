# Tile Bodies Module

## Introduction

A tile's body reaches a mod as raw markdown, as written. This module renders it once for every mod, to HTML that is safe and works inside the mod's sandbox: the engine answers `tiles.renderBody` with it, and the frame loader's `<ot-tile-body>` element shows it (see the [engine module](../engine/README.md)). The renderer never trusts the body: everything it outputs is built by it or allowed by its schema.

### What a rendered body holds

GitHub-flavored markdown (tables, task lists, strikethrough, autolinks, footnotes) and the HTML GitHub allows in markdown, plus `<video>`, `<audio>` and `<source>`, and the elements the renderer adds: player placeholders and alerts. Sanitizing follows GitHub's schema (`rehype-sanitize`'s default schema), so a rendered body has no script, `style` element or attribute, event handler attribute, form or `<iframe>`, and no `javascript:`, `data:` or `vbscript:` address.

### Links

- A link to a fragment of the same body (`#heading`) keeps its `href` as written and gets `data-ot-fragment`.
- Any other link is resolved against the tile's `source`. A link to an `http:` or `https:` address gets `data-ot-link`.

In a mod's frame, the frame loader handles clicks on both, so a body link never navigates the frame (see the [engine module](../engine/README.md#tile-bodies)).

```html
<p><a href="https://example.org/films/stalker.md" data-ot-link="">Next</a></p>
<p><a href="#notes" data-ot-fragment="">See notes</a></p>
```

### Heading ids

Each heading gets GitHub's id: `user-content-` and the heading's slug (lower case, spaces as `-`, punctuation other than `-` and `_` removed, `-1`, `-2` added to repeated slugs). The prefix also keeps a body's ids away from the mod's own. `## Install it!` twice gives:

```html
<h2 id="user-content-install-it">Install it!</h2>
<h2 id="user-content-install-it-1">Install it!</h2>
```

Every other id in the body, and footnote ids, get the same prefix, so a link to `#<id>` reaches `user-content-<id>`.

### Media and pictures

- The `src` of images, video, audio and sources, each `poster` and each `srcset` candidate are resolved against the tile's `source`. One that is not `http:` or `https:` once resolved is dropped.
- Images get `loading="lazy"` and `decoding="async"`, and keep the `width` and `height` the body gives.
- `<video>` and `<audio>` get `controls` and `preload="metadata"`, and lose `autoplay`, whatever the body says.
- `<picture>` keeps its `<source>` children's `srcset` and `media`, and its `<img>`, so a dark-mode picture follows the frame's color scheme.

These addresses are the body's media: they count as media linked by tiles (see the [sandbox module](../sandbox/README.md#media-linked-by-tiles)). Text URLs and links are not media.

### Player placeholders

An `<iframe>` whose `src`, resolved against the tile, is an `https:` address that the private network guard allows becomes a placeholder, and so does an image whose address is a page link of a known site, such as `![Trailer](https://www.youtube.com/watch?v=aqz-KE-bpKQ)` (see the [players module](../players/README.md)). Rendering requests nothing from the site. The placeholder holds the address as written in the body, resolved; the engine turns it into a player when the reader clicks. `<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Big Buck Bunny"></iframe>` gives:

```html
<button type="button" class="ot-player" data-ot-player="https://www.youtube.com/embed/aqz-KE-bpKQ"><span class="ot-player-box"><span class="ot-player-title">Big Buck Bunny</span><span class="ot-player-host">youtube.com</span></span></button>
```

- `ot-player-box` is the box the theme draws, inside the button (see the [theme module](../theme/README.md#write-html-get-the-apps-look)).
- `ot-player-title` holds the iframe's `title` or the image's alt text, otherwise the site's name, otherwise `Player`.
- `ot-player-host` holds the address's host, without `www.`.
- An `http:` iframe becomes a link to it, with `data-ot-link`, showing its `title` or its address.
- An iframe to the user's computer or network, from a tile that is not there, is left out, with the guard's warning: `Not loading https://192.168.1.1/: tiles from other sites cannot link addresses on your computer or network.`
- Any other iframe is left out.

Each player address is recorded with the title the body gives it, the iframe's `title` or the image's alt text, or `null` without one: the player dialog shows it in full, since the placeholder may cut it.

The renderer reads only the iframe's `src`, `title`, `width` and `height`, and the image's `src` and `alt`. A body can write a `button.ot-player` itself, but only the addresses of the placeholders the renderer built are player addresses.

### Alerts

As on GitHub, a blockquote whose first line is only `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`, in any letter case, becomes an alert, without the marker line. Any other blockquote, such as `[!TODO]`, stays a blockquote. `> [!NOTE]` then `> Tiles are markdown files.` gives:

```html
<aside class="ot-alert" data-ot-alert="note">
<p class="ot-alert-title">Note</p>
<p>Tiles are markdown files.</p>
</aside>
```

`data-ot-alert` holds the kind in lower case, and the title the kind's name: `Note`, `Tip`, `Important`, `Warning` or `Caution`.

### Math

Inline math (`$…$`) and display math (`$$…$$`) are kept exactly as written, as code, untouched by markdown's emphasis and backslash escapes:

```html
<p>Inline <code class="language-math math-inline">x*y*z</code>.</p>
<pre><code class="language-math math-display">\{x \mid x > 0\} \\ y</code></pre>
```

Dollars follow the rule of GitHub and Pandoc: inline math needs an opening `$` followed by a non-space character, and a closing `$` preceded by a non-space character and not followed by a digit. Other dollars stay text, so `It costs $5 and $10.` is a sentence. Authors can always write `\$` for a dollar.

### What stays as written

- Fenced code blocks are `<pre><code class="language-<name>">` with the block's text, including `mermaid` and `math` blocks: diagrams are not drawn.
- Math is not rendered and code is not highlighted, as seen above.
- Emoji shortcodes such as `:tada:` stay text.

## Module Details

Implemented in `src/lib/core/tile_bodies/`. Other modules import only from the public entry point `src/lib/core/tile_bodies/index.ts`. Pure and synchronous, with no DOM: it runs in the app's realm on untrusted input, so it never builds a document.

- `renderTileBody(tile)`: renders the tile's `body` against its `source`. Returns a `RenderedBody`. The tile is not changed.
- Types:
  - `RenderedBody`: `html` (the sanitized HTML, `""` for an empty body), `mediaUrls` (the absolute addresses of the body's images, video, audio, sources, posters and `srcset` candidates, in document order, without duplicates), `playerAddresses` (a `Map` from each player address to its `TilePlayer`: `player`, the `Player`, and `title`, the title the body gives it or `null`) and `issues` (one warning per iframe left out for the private network guard).

The pipeline, from `unified` packages:

`remark-parse` → `remark-gfm` → `remark-math` → dollar pass → alerts pass → `remark-rehype` (with raw HTML) → `rehype-raw` → `rehype-slug` → players pass → `rehype-sanitize` with the tile schema → finishing pass → `rehype-stringify`.

- `dollar_pass.ts`: turns inline math that breaks the dollar rule back into the markdown it was.
- `alerts_pass.ts`: turns alert blockquotes into `aside.ot-alert`.
- `players_pass.ts`: replaces iframes and known-site images by placeholders or links, before the sanitizer removes iframes.
- `tile_schema.ts`: GitHub's schema plus video, audio, sources, placeholders, alerts and the math classes.
- `finishing_pass.ts`: resolves addresses, marks links, sets the media attributes and collects the media addresses.

Each pass changes the trees the renderer built, never the tile. A typical body renders in about 2 ms.
