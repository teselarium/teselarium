# Tile Bodies Module

## Introduction

A tile's body reaches a mod as raw markdown, as written. This module renders it for every mod, to HTML that is safe and works inside the mod's sandbox: the engine answers `tiles.renderBody` with it, and the frame loader's `<ot-tile-body>` element shows it (see the [engine module](../engine/README.md)). The renderer never trusts the body: everything it outputs is built by it or allowed by its schema.

### What a rendered body holds

GitHub-flavored markdown (tables, task lists, strikethrough, autolinks, footnotes) and the HTML GitHub allows in markdown, plus `<video>`, `<audio>` and `<source>`, and what the renderer adds: player placeholders, alerts, the MathML of formulas, highlighted code and emoji. Sanitizing follows GitHub's schema (`rehype-sanitize`'s default schema), so a rendered body has no script, `style` element or attribute, event handler attribute, form or `<iframe>`, no `href` on MathML, and no `javascript:`, `data:` or `vbscript:` address. The libraries' output is sanitized with the rest of the body, so no library is trusted more than a tile.

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

Inline math (`$…$`), display math (`$$…$$`) and fenced `math` blocks become MathML, which browsers lay out themselves, rendered by [Temml](https://temml.org). The formula is read exactly as written, untouched by markdown's emphasis and backslash escapes, and kept in an `<annotation encoding="application/x-tex">`, so it can still be copied or read by a mod. `$\frac{a}{b}$` gives:

```html
<p><math><semantics><mfrac><mi>a</mi><mi>b</mi></mfrac><annotation encoding="application/x-tex">\frac{a}{b}</annotation></semantics></math></p>
```

Display math and `math` blocks are `<math display="block" class="tml-display">`, without the `<pre>`. The theme gives them a block of their own that scrolls when the formula is wider than the body, and gives every formula the common math fonts before the browser's own, so brackets stretch and `∑` and `∫` grow on systems that have one of them (see the [theme module](../theme/README.md#write-html-get-the-apps-look)).

Dollars follow the rule of GitHub and Pandoc: inline math needs an opening `$` followed by a non-space character, and a closing `$` preceded by a non-space character and not followed by a digit. Other dollars stay text, so `It costs $5 and $10.` is a sentence. Authors can always write `\$` for a dollar.

- **What the MathML may hold.** The MathML Core elements Temml writes, with their presentation attributes and `class` values starting with `tml-`. Temml's `style` attributes are dropped, as any `style` is; MathML written in a body is sanitized the same way, so `<mi href="…">` loses its `href`.
- **Untrusted commands.** Commands that could link or style outside the formula, such as `\href`, `\url`, `\htmlClass` and `\includegraphics`, are never trusted: a formula using one fails, as below. Sizes such as `\rule{100em}{1em}` are capped at 20em, and macros at 1000 expansions, so a self-recursive macro fails instead of running forever.
- **Failing formulas.** A formula Temml cannot read stays as written, as code, with the reason in `data-ot-math-error`; the rest of the body renders as usual. `Before $\frac{a}{$ after.` gives:

```html
<p>Before <code class="language-math math-inline" data-ot-math-error="Unexpected end of input in a macro argument, expected &#x27;}&#x27; at end of input: \frac{a}{">\frac{a}{</code> after.</p>
```

Failed display math is `<pre><code class="language-math math-display">`, and a failed `math` block `<pre><code class="language-math">`.

### Highlighted code

A fenced block labeled with one of the 37 common languages of [highlight.js](https://highlightjs.org) (`js`, `ts`, `python`, `rust`, `go`, `yaml`, `json`, `bash`, `css`, `xml` for HTML, and the others of its common set, with their aliases) gets the class `hljs`, and its tokens are wrapped in `<span>` elements whose classes start with `hljs-`. The text stays the same. The language is never guessed. ```` ```js ```` then `const answer = 42;` gives:

```html
<pre><code class="hljs language-js"><span class="hljs-keyword">const</span> answer = <span class="hljs-number">42</span>;
</code></pre>
```

The theme colors the tokens from its tokens, so highlighted code follows the frame's color scheme without being rendered again (see the [theme module](../theme/README.md#write-html-get-the-apps-look)). A block labeled with another language, such as `dockerfile`, gets `hljs` and no spans. Unlabeled blocks, `mermaid` blocks and `math` blocks are left as they are.

### Emoji

Emoji shortcodes with GitHub's names, such as `:tada:` and `:+1:`, become their emoji, outside code: `` Done :tada:, :not_an_emoji: and `:tada:`. `` gives `<p>Done 🎉, :not_an_emoji: and <code>:tada:</code>.</p>`. Unknown names stay text, and so do code and formulas.

### When the libraries load

Temml, highlight.js's common languages and GitHub's emoji names are each a chunk of their own, which the app's page downloads the first time a body needs it, and keeps:

- Temml, for a formula: inline math, display math or a `math` block. Dollars that stay text, such as prices, are not formulas.
- The highlighter, for a fenced block labeled with anything but `math` and `mermaid`. The page does not know which languages the highlighter has until it loads, so a `dockerfile` block loads it too.
- The emoji names, for `:name:` outside code, `name` being lowercase letters, digits, `_`, `+` or `-`. A time such as `10:30:45` matches too: it loads the names and stays text.

A body without them loads none of the three. When a chunk cannot be loaded, offline or after a new deployment, rendering the body rejects and the page forgets the failed download, so the next body that needs it tries again.

### Rendered on request

The engine scans bodies at launch and renders them only when a mod asks. The scan (`scanTileBody`) finds what the launch needs, the media, the player addresses and the left-out iframes, without the extras, which add no media and no players: it is synchronous and loads no library. The render (`renderTileBody`) is asynchronous, loads the extras the body needs, and gives the HTML.

### Diagrams

The renderer keeps a fenced `mermaid` block as code, `<pre><code class="language-mermaid">`, so the HTML of `tiles.renderBody` holds no diagram. The `<ot-tile-body>` element draws it afterwards, in the mod's frame, with the copy of mermaid the app ships (see [Libraries](../engine/README.md#libraries) in the engine module): a diagram source is untrusted tile content, so it is parsed only in a mod's sandbox, never in the app's page.

- **Text first.** The element shows the body and fires `ot-rendered` before any diagram is drawn. Each block stays as code until its diagram replaces it.
- **When in view.** A block is drawn when it comes into the frame's view, one block at a time, with a paint and a task between two, so the frame and the app keep responding. The library is requested with the first block in view: a body whose blocks are never seen never loads it.
- **The diagram** replaces the `<pre>` with a `<figure>` holding the SVG, which keeps the block's text in `data-mermaid-source`. Mermaid draws at its `strict` security level and without HTML labels, so labels are text and a diagram holds no click handler; `<img src=x onerror=alert(1)>` in a label is shown as text. The layout and the look are mermaid 12's defaults, ELK and neo, which a diagram may change in its front matter or an `%%{init}%%` directive; it cannot turn HTML labels on there.
- **Labels** are SVG text, so a label holds no element: markup in a tile's diagram cannot add an image, which would send a request to any address the tile's author wrote, nor anything else. Line breaks (`<br>`) and mermaid's markdown strings (`` "`**bold** and *italic*`" ``) still work; other tags, such as `<b>`, show as written.
- **Images** of image shapes (`A@{ img: "https://…" }`) load only from the hosts in the mod's `show` permissions, like the mod's other images: an address in a diagram is not a tile link. From another host the frame's policy blocks the image, mermaid cannot draw the diagram, and the block stays as code; the mod's issues list a blocked image request.
- **Icons.** The icons mermaid builds in, such as those of architecture diagrams (`cloud`, `database`, `disk`, `internet`, `server`), are drawn, in mermaid's own colors rather than the theme's. The element registers no icon pack, so an icon shape from a pack (`A@{ icon: "fa:user" }`) is drawn with mermaid's "?" placeholder, and the older `fa:fa-car` syntax in a label shows as written.
- **Colors.** Diagrams take the theme's colors (`background`, `card` for the nodes, `foreground`, `border`, `muted-foreground` for the lines, `muted`, `accent`, the `font-sans` font, and `border` for the neo look's shadow), and are drawn again from their kept text when the color scheme changes, without reloading the frame. The theme styles the figure (see the [theme module](../theme/README.md#write-html-get-the-apps-look)).
- **Busy.** A block in view has `aria-busy="true"` from the moment it waits to be drawn until its figure replaces it, and the base stylesheet pulses it (dimmed and still under `prefers-reduced-motion: reduce`); the first diagram of a frame waits for the library's download and install. The new figure has no `aria-busy`. After a color scheme change, a figure in view is busy until its new drawing replaces it. A block that fails, or that the element drops, loses the mark; a block out of view, and every block with `diagrams = "source"`, never gets it. The pulse is an opacity animation, which keeps moving while mermaid draws in Chromium and Firefox, and stops until the frame is free in WebKit.
- **Failures.** A block mermaid cannot draw, such as `A -->`, stays as code, is logged with `console.warn`, and the element goes on with the next one.
- **`ot-diagrams-drawn`**, a bubbling event, fires on the element each time every block in view has been drawn or has failed: once for a body whose blocks are all in view, and again when the user scrolls to more blocks or the color scheme changes. A body without mermaid blocks fires none. When `tile` is set again, or the element leaves the document, before its diagrams are drawn, it draws none of them and fires no event for that body.
- **`diagrams`**, a property of the element: `"draw"` by default, or `"source"`, which keeps every block as code and never loads the library. Any other value throws a `TypeError`.

```html
<figure data-mermaid-source="flowchart LR
  Tile --> Mod
"><svg id="ot-mermaid-1" …>…</svg></figure>
```

### What stays as written

- Fenced code blocks are `<pre><code class="language-<name>">` with the block's text, including `mermaid` blocks, highlighted only for the common languages of highlight.js (see [Highlighted code](#highlighted-code)). The `<ot-tile-body>` element draws mermaid blocks afterwards (see [Diagrams](#diagrams)); a mod that places the HTML itself shows them as code.
- Unlabeled code is never highlighted.
- Unknown emoji names stay text.

## Module Details

Implemented in `src/lib/core/tile_bodies/`. Other modules import only from the public entry point `src/lib/core/tile_bodies/index.ts`. Pure, with no DOM: it runs in the app's realm on untrusted input, so it never builds a document. The libraries of the extras are plain text transforms.

- `scanTileBody(tile)`: scans the tile's `body` against its `source`, synchronously, without the extras. Returns a `TileBodyScan`. The tile is not changed.
- `renderTileBody(tile)`: renders the tile's `body` against its `source`. Returns a `Promise` of the sanitized HTML, `""` for an empty body, which rejects when a library the body needs cannot be loaded. Each library is loaded once per page. The tile is not changed.
- Types:
  - `TileBodyScan`: `mediaUrls` (the absolute addresses of the body's images, video, audio, sources, posters and `srcset` candidates, in document order, without duplicates), `playerAddresses` (a `Map` from each player address to its `TilePlayer`: `player`, the `Player`, and `title`, the title the body gives it or `null`) and `issues` (one warning per iframe left out for the private network guard).
  - `TileBodyRenderer`: the type of `renderTileBody`.

The pipeline, from `unified` packages:

`remark-parse` → `remark-gfm` → `remark-math` → dollar pass → alerts pass → detection → emoji pass → `remark-rehype` (with raw HTML) → math pass → `rehype-raw` → `rehype-slug` → players pass → highlighting pass → `rehype-sanitize` with the tile schema → finishing pass → `rehype-stringify`.

The scan runs the same steps without the detection, the emoji, math and highlighting passes, and `rehype-stringify`.

- `dollar_pass.ts`: turns inline math that breaks the dollar rule back into the markdown it was.
- `alerts_pass.ts`: turns alert blockquotes into `aside.ot-alert`.
- `body_extras.ts`: the detection walk, which finds the extras a body needs, and their loaders, each an `import()` of its pass kept once per renderer, and forgotten when it fails. `buildTileBodyRenderer(loaders)` in `render_body.ts` builds a renderer from other loaders, which tests use.
- `emoji_pass.ts`: turns shortcodes into emoji with `remark-gemoji`, in a chunk of its own.
- `math_pass.ts`: replaces the math code with Temml's MathML as raw HTML, which `rehype-raw` parses, in a chunk of its own.
- `players_pass.ts`: replaces iframes and known-site images by placeholders or links, before the sanitizer removes iframes.
- `highlight_pass.ts`: highlights labeled code with `rehype-highlight` and its common languages, in a chunk of its own.
- `tile_schema.ts`: GitHub's schema plus video, audio, sources, placeholders, alerts, the math classes and errors, the MathML of formulas and the `hljs` classes.
- `finishing_pass.ts`: resolves addresses, marks links, sets the media attributes and collects the media addresses.

Each pass changes the trees the renderer built, never the tile. A typical body renders in about 2 ms; a formula adds about 0.06 ms, and a 30-line code block about 0.4 ms.
