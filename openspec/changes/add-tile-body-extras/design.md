# Design

## Context

- `add-tile-bodies-and-players` renders bodies in `src/lib/core/tile_bodies/` with one unified pipeline: `remark-parse` → `remark-gfm` → `remark-math` → dollar pass → alerts pass → `remark-rehype` → `rehype-raw` → `rehype-slug` → players pass → `rehype-sanitize` (tile schema) → finishing pass → `rehype-stringify`. Math leaves it as `code.language-math.math-inline`, `pre > code.language-math.math-display`, and fenced ```` ```math ```` blocks as `pre > code.language-math`. The markdown stage only parses (`MARKDOWN_PARSER.parse()`), so a remark plugin that transforms the tree instead of extending the syntax never runs there.
- At launch, `buildTileBodies` (`src/lib/core/engine/mod_tile_bodies.ts`) builds `TileBodies` synchronously, for the policy and for `players.open`: for each body holding `<`, `![` or `://` it runs the whole renderer and keeps the HTML with the media, players and issues; other bodies render on their first `tiles.renderBody`. `readTileBodyHtml` is synchronous. The `tiles.renderBody` handler is already `async`, and an error it throws that is not a `ModMethodError` is answered with `-32603` and a message starting with the method's name.
- Measurements (minified with the project's `rolldown`; timings in Node):
  - **Sizes and speed:** Temml 0.14 is 201 KB (58 KB gzip) at 0.06 ms per display formula; KaTeX 0.19 with MathML output is 253 KB (75 KB gzip) at 0.08 ms; `lowlight` with its 37 common languages is 160 KB (50 KB gzip) at 0.4 ms per 30-line block, and 7 ms when it has to guess the language; `remark-gemoji` with GitHub's names is 42 KB (17 KB gzip).
  - **Output:** in Chromium, KaTeX's MathML showed `\mathbb{R}` and `\mathcal{O}` as plain letters and did not stretch matrix brackets, and Temml rendered all three. Both looked right in Firefox and WebKit, apart from KaTeX's `n log n` spacing in WebKit.
  - **Safety:** both libraries render `\href{javascript:…}` as red error text by default, and Temml stops a self-recursive macro with an error.
  - **Source kept:** Temml's `annotate` option adds `<semantics>` and `<annotation encoding="application/x-tex">` with the source.

## Goals / Non-Goals

**Goals:**

- Finished HTML from `tiles.renderBody`, with nothing for mods to run.
- Library output goes through the same sanitizer as the body, so no library is trusted more than a tile.
- No cost for bodies without extras: the libraries are lazy chunks, loaded once per page.

**Non-Goals:**

- Changing what the launch finds: extras add no media and no players, so the launch's scan stays synchronous and finds the same media, players and issues.
- Guessing languages, custom emoji, and a math font.

## Decisions

**Pipeline.** A full render runs `remark-parse` → `remark-gfm` → `remark-math` → dollar pass → alerts pass → detection (D2) → emoji (D4) → `remark-rehype` → math pass (D3) → `rehype-raw` → `rehype-slug` → players pass → highlighting (D4) → `rehype-sanitize` (tile schema) → finishing pass → `rehype-stringify`. The scan runs the same pipeline without detection, emoji, the math pass, highlighting and the writer.

### D1. Scan at launch, render on request

`src/lib/core/tile_bodies/` exports two functions that share the pipeline's steps:

- `scanTileBody(tile): TileBodyScan`: synchronous, with no HTML and no extras. A `TileBodyScan` holds `mediaUrls`, `playerAddresses` and `issues`, and replaces `RenderedBody`.
- `async renderTileBody(tile): Promise<string>`: the HTML. It parses, runs the dollar and alerts passes, detects which extras the body needs, awaits their chunks, then runs the full pipeline.

In `mod_tile_bodies.ts`, the launch scans each body holding `<`, `![` or `://` with `scanTileBody`, as it renders them today, fills `mediaByTile`, `playerAddresses` and `issues` from the scans, and renders no HTML. `TileBodies.renderedBodies` becomes a map from tile source to the promise of its HTML, set on the first request. `readTileBodyHtml` becomes `async` and answers `Promise<string | null>`: it returns the kept promise, so two requests for one body render it once. A promise that rejects is removed from the map, so a later request renders again; the request is answered with `-32603` and a message starting with `tiles.renderBody`, which `ot-tile-body` shows with `role="alert"` as it shows any failed request. The mod-facing behavior is unchanged apart from the richer HTML.

*Alternative*: render everything at launch. Rejected: it would load the libraries for every collection that has one formula anywhere, before the mod asks for any body. Keeping the launch's HTML and rendering only the extras later was rejected too: it would keep two HTML results per body.

### D2. Detection and lazy chunks

After the dollar pass and the alerts pass, one walk over the markdown tree finds: `inlineMath`, `math` or a `code` node with `lang` `math` (needs Temml); a `code` node with a `lang` other than `math` and `mermaid` (needs `rehype-highlight`); a text node matching `:[a-z0-9_+-]+:` (needs the emoji names). Walking after the dollar pass matters: `remark-math` parses `It costs $5 and $10.` as inline math, and only the dollar pass turns it back into text, so a price loads nothing.

The main chunk keeps no list of highlight.js's language names and aliases: a block labeled with a language outside the common set, such as `dockerfile`, loads the highlighter and stays plain. That costs one download per page, against a list to keep in step with `lowlight`. The emoji pattern makes the same trade: it also matches `:30:` in `10:30:45`, which loads the emoji names once per page, because a list of names in the main chunk would cost what the emoji chunk saves.

Each need maps to one `import()` kept in a module-level promise, so a page loads each chunk at most once, and Vite emits each as its own chunk. A promise that rejects is cleared, so the next body that needs it tries again.

### D3. Math with Temml, before sanitizing

A **math pass** runs after `remark-rehype` and before `rehype-raw`:

- The math code elements are `code.math-inline` (inline), and `pre > code.math-display` and `pre > code.language-math`, a fenced `math` block (display). For each, `temml.renderToString(text, { displayMode, annotate: true, throwOnError: true, trust: false, maxSize: 20, maxExpand: 1000 })` replaces the code element, or its `<pre>` for display math, with a `raw` node holding the MathML. `rehype-raw` then parses it with the body's own HTML, so no other HTML parser is needed.
- A `ParseError` keeps the element's markup as it was, `<pre>` included, and adds `data-ot-math-error` with the error's message to the code element.

Because sanitizing runs afterwards, Temml's output is filtered like any body HTML. The tile schema allows the MathML Core elements (`math`, `semantics`, `annotation`, `mrow`, `mi`, `mn`, `mo`, `ms`, `mtext`, `mspace`, `mfrac`, `msqrt`, `mroot`, `msub`, `msup`, `msubsup`, `munder`, `mover`, `munderover`, `mmultiscripts`, `mprescripts`, `none`, `mtable`, `mtr`, `mtd`, `mpadded`, `mphantom`, `mstyle`, `menclose`, `merror`) and their presentation attributes (`display`, `displaystyle`, `scriptlevel`, `mathvariant`, `lspace`, `rspace`, `stretchy`, `symmetric`, `fence`, `separator`, `form`, `largeop`, `movablelimits`, `accent`, `accentunder`, `width`, `height`, `depth`, `voffset`, `linethickness`, `columnalign`, `rowalign`, `columnspacing`, `rowspacing`, `notation`, `encoding` on `annotation`), plus `class` values starting with `tml-`. It never allows `href`, `style` or event attributes on MathML.

Temml's `style` attributes are dropped. The screenshots were taken without Temml's stylesheet, so its layout does not depend on them; the base stylesheet adds the few rules display math needs (D5).

*Alternative*: KaTeX with `output: "mathml"`. Rejected after the screenshots: worse in Chromium, and larger.

### D4. Highlighting and emoji

- **Emoji**: `remark-gemoji` transforms the tree, so it is not added to `MARKDOWN_PARSER`, which only parses. Once loaded, its transform runs on the markdown tree right after the dollar pass and the alerts pass, before `remark-rehype`. Code and math are not text nodes, so their text is never touched, and dollars turned back into text get their emoji.
- **Highlighting**: `rehype-highlight` 7 with its default languages, the common set of `lowlight`, which it bundles, so `lowlight` is not a direct dependency; `detect: false` and `plainText` left empty, before sanitizing. Unknown languages are left untouched, and the tile schema allows `span` with `class` values starting with `hljs-` and `code` with `hljs`. Mermaid blocks are not a registered language, so they stay plain for `add-tile-body-diagrams`.

### D5. Base stylesheet

- **Highlight colors**: `hljs-keyword`, `hljs-built_in` and `hljs-literal` in `--ot-primary`; `hljs-string` and `hljs-regexp` in `--ot-success`; `hljs-number` in `--ot-warning`; `hljs-title`, `hljs-function` and `hljs-class` in `--ot-secondary`; `hljs-comment` and `hljs-quote` in `--ot-muted-foreground`, italic; `hljs-deletion` in `--ot-destructive`; `hljs-addition` in `--ot-success`. The other classes inherit the code color. Tokens change with the color scheme, so highlighted code needs no redraw.
- **Display math**: `math[display="block"]` gets a block box with a vertical margin and `overflow-x: auto`, so a wide formula scrolls instead of widening the page.

## Risks / Trade-offs

- [Temml parses untrusted LaTeX in the app's page] → It is a pure string transform with no DOM and no evaluation; `trust: false`, `maxSize` and `maxExpand` bound what a formula can ask for; its output is sanitized with the rest of the body; an exception in rendering is caught and the formula stays as code.
- [MathML Core rendering differs between browsers and depends on the system's math fonts] → Temml was chosen for the best results without fonts; a math font can be a later addition.
- [Highlighting of very long code blocks] → About 0.4 ms per 30 lines; a 3,000-line block costs about 40 ms once, and the result is kept.
- [A mod that read math from `code.language-math` changes behavior] → The source stays in each `<math>`'s annotation; the change is documented in the release note and the tile bodies README.
- [A body with media or players is parsed twice, by the scan at launch and by the render on request] → Bodies are small and the scan costs what the launch's render costs today; the HTML is kept after the first request.
- [An extra's chunk fails to load, offline or after a new deployment] → The request is answered with `-32603` and `ot-tile-body` shows the message; the import and the body's promise are cleared, so the next request tries again.

## Migration Plan

Additions to the rendered HTML only; no stored data. Applied after `add-tile-bodies-and-players` and `add-tile-body-diagrams`, which are both archived.
