# Design

## Context

- `add-tile-bodies-and-players` renders bodies in `src/lib/core/tile_bodies/` with one unified pipeline: `remark-parse` → `remark-gfm` → `remark-math` → dollar pass → alerts pass → `remark-rehype` → `rehype-raw` → `rehype-slug` → players pass → `rehype-sanitize` (tile schema) → finishing pass → `rehype-stringify`. Math leaves it as `code.language-math.math-inline`, `pre > code.language-math.math-display`, and fenced ```` ```math ```` blocks as `pre > code.language-math`. At launch, the engine builds `TileBodies` (media addresses, player addresses, rendered bodies) synchronously, for the policy and for `players.open`.
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

- Changing what the launch computes: extras add no media and no players, so `TileBodies`' scan stays synchronous.
- Guessing languages, custom emoji, and a math font.

## Decisions

### D1. Scan at launch, render on request

The scan for media and players stays as `add-tile-bodies-and-players` designed it, synchronous and without extras. Rendering the HTML becomes `async renderTileBody(tile, extras)`: it parses, detects which extras the body needs, awaits their chunks, then runs the full pipeline. `tiles.renderBody` already answers asynchronously and keeps each rendered body, so the mod-facing behavior is unchanged apart from the richer HTML.

*Alternative*: render everything at launch. Rejected: it would load the libraries for every collection that has one formula anywhere, before the mod asks for any body.

### D2. Detection and lazy chunks

After `remark-math` and `remark-gfm`, one walk over the markdown tree finds: `inlineMath`, `math` or a `code` node with `lang` `math` (needs Temml); a `code` node whose `lang` is a registered common language (needs `lowlight`); a text node matching `:[a-z0-9_+-]+:` (needs the emoji names). Each need maps to one `import()` kept in a module-level promise, so a page loads each chunk at most once, and Vite emits each as its own chunk.

### D3. Math with Temml, before sanitizing

A **math pass** runs after `remark-rehype` and before `rehype-raw`:

- For each math code element, `temml.renderToString(text, { displayMode, annotate: true, throwOnError: true, trust: false, maxSize: 20, maxExpand: 1000 })` replaces the code element, or its `<pre>` for display math, with a `raw` node holding the MathML. `rehype-raw` then parses it with the body's own HTML, so no other HTML parser is needed.
- A `ParseError` keeps the code element and adds `data-ot-math-error` with the error's message.

Because sanitizing runs afterwards, Temml's output is filtered like any body HTML. The tile schema allows the MathML Core elements (`math`, `semantics`, `annotation`, `mrow`, `mi`, `mn`, `mo`, `ms`, `mtext`, `mspace`, `mfrac`, `msqrt`, `mroot`, `msub`, `msup`, `msubsup`, `munder`, `mover`, `munderover`, `mmultiscripts`, `mprescripts`, `none`, `mtable`, `mtr`, `mtd`, `mpadded`, `mphantom`, `mstyle`, `menclose`, `merror`) and their presentation attributes (`display`, `displaystyle`, `scriptlevel`, `mathvariant`, `lspace`, `rspace`, `stretchy`, `symmetric`, `fence`, `separator`, `form`, `largeop`, `movablelimits`, `accent`, `accentunder`, `width`, `height`, `depth`, `voffset`, `linethickness`, `columnalign`, `rowalign`, `columnspacing`, `rowspacing`, `notation`, `encoding` on `annotation`), plus `class` values starting with `tml-`. It never allows `href`, `style` or event attributes on MathML.

Temml's `style` attributes are dropped. The screenshots were taken without Temml's stylesheet, so its layout does not depend on them; the base stylesheet adds the few rules display math needs (D5).

*Alternative*: KaTeX with `output: "mathml"`. Rejected after the screenshots: worse in Chromium, and larger.

### D4. Highlighting and emoji

- **Emoji**: `remark-gemoji` in the markdown stage, after `remark-math`, so text inside code and math is never touched.
- **Highlighting**: `rehype-highlight` with `lowlight`'s common languages, `detect: false` and `plainText` left empty, before sanitizing. Unknown languages are left untouched, and the tile schema allows `span` with `class` values starting with `hljs-` and `code` with `hljs`. Mermaid blocks are not a registered language, so they stay plain for `add-tile-body-diagrams`.

### D5. Base stylesheet

- **Highlight colors**: `hljs-keyword`, `hljs-built_in` and `hljs-literal` in `--ot-primary`; `hljs-string` and `hljs-regexp` in `--ot-success`; `hljs-number` in `--ot-warning`; `hljs-title`, `hljs-function` and `hljs-class` in `--ot-secondary`; `hljs-comment` and `hljs-quote` in `--ot-muted-foreground`, italic; `hljs-deletion` in `--ot-destructive`; `hljs-addition` in `--ot-success`. The other classes inherit the code color. Tokens change with the color scheme, so highlighted code needs no redraw.
- **Display math**: `math[display="block"]` gets a block box with a vertical margin and `overflow-x: auto`, so a wide formula scrolls instead of widening the page.

## Risks / Trade-offs

- [Temml parses untrusted LaTeX in the app's page] → It is a pure string transform with no DOM and no evaluation; `trust: false`, `maxSize` and `maxExpand` bound what a formula can ask for; its output is sanitized with the rest of the body; an exception in rendering is caught and the formula stays as code.
- [MathML Core rendering differs between browsers and depends on the system's math fonts] → Temml was chosen for the best results without fonts; a math font can be a later addition.
- [Highlighting of very long code blocks] → About 0.4 ms per 30 lines; a 3,000-line block costs about 40 ms once, and the result is kept.
- [A mod that read math from `code.language-math` changes behavior] → The source stays in each `<math>`'s annotation; the change is documented in the release note and the tile bodies README.
- [Version numbering depends on order] → This change takes `0.1.7` after `add-tile-body-diagrams`'s `0.1.6`; applied in another order, the two version numbers swap.

## Migration Plan

Additions to the rendered HTML only; no stored data. Applied and archived after `add-tile-bodies-and-players` and `add-tile-body-diagrams`.
