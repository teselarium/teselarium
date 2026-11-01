# Design

## Context

- `add-tile-bodies-and-players` renders a body's mermaid block as `<pre><code class="language-mermaid">`, and defines `ot-tile-body` in the frame loader (`sandbox_loader.js`): it requests `tiles.renderBody`, sets its `innerHTML` and fires `ot-rendered`. The loader keeps the current theme (`applyThemeChanged`) and owns the mod's requests (`requestEngine`), whose port the mod never sees.
- The frame's policy allows scripts from `blob:` (that is how the mod's own code runs) and `'unsafe-eval'`. It allows no script from any host without `code`.
- Engine messages must survive a structured clone (`mod-engine-api`, "Engine messages are plain data"); strings of several megabytes do.
- Measurements (mermaid 11.17.2, desktop, three browsers):
  - **Size:** `mermaid.min.js` is 3.41 MB raw, 0.94 MB gzip, 0.71 MB brotli.
  - **Install:** 95 to 280 ms as a classic `<script src="blob:…">`.
  - **Sending it:** 21 to 54 ms as a string over a `MessagePort`, 3 to 21 ms as a transferred `ArrayBuffer`.
  - **Drawing:** 10 to 90 ms per small diagram the first time, and up to about 220 ms for a flowchart of 60 nodes.
  - **Module import fails:** importing `mermaid.min.js` as a module fails, because it reads a top-level `var` through `globalThis`.
- Mermaid 12.2.0, measured when the change moved to it (headless Chromium, unthrottled): `mermaid.min.js` is 5.49 MB raw and 1.57 MB gzip, most of the growth being the ELK layout engine, now inlined. It installs in about 410 to 490 ms. A flowchart of 13 nodes takes about 80 ms the first time and 32 ms after with the dagre layout, and 280 ms and 52 ms with ELK, mermaid 12's default. Its build targets ES2024 and Safari 17.4 or later.
- The app is built with Vite, which can import a file as a string (`?raw`) in a lazily loaded chunk.

## Goals / Non-Goals

**Goals:**

- No cost for a page or a frame that never draws a diagram: no download, no install.
- Untrusted diagram sources are parsed only inside mod frames.
- The body's text never waits for diagrams.

**Non-Goals:**

- A general plugin system for libraries: the list of libraries is the app's, and adding one is a change of its own.
- A smaller mermaid build, or rendering diagrams in the app's own pages.

## Decisions

### D1. Shipped libraries are a table in the engine

```ts
interface ShippedLibrary {
  /** The major version a mod asks for. */
  major: string;
  /** The full version, from the library's package.json at build time. */
  version: string;
  /** Loads the library's single-file classic script as text, once per page. */
  loadCode: () => Promise<string>;
}

const SHIPPED_LIBRARIES: Record<string, ShippedLibrary> = {
  mermaid: {
    major: "12",
    version: MERMAID_VERSION,
    loadCode: () => import("mermaid/dist/mermaid.min.js?raw").then((module) => module.default),
  },
};
```

The `?raw` import makes Vite put the 5.5 MB string in its own chunk, fetched from the app's host on the first request and kept for the page. Vite does not transpile it, so it runs as mermaid builds it. `mermaid` is a dependency pinned to `^12`; the build raises Vite's chunk size warning limit for that chunk only, so other chunks keep the warning.

*Alternative*: copy `mermaid.min.js` into `public/` and `fetch` it. Rejected: it needs a copy step and a path that instantiations could break, and Vite already gives a hashed, cacheable chunk.

### D2. `libs.load` answers the code, and the frame loader installs it

The engine's handler (`libs_methods.ts`) checks `name` and `version` (D1's table, `-32602` otherwise), awaits `loadCode()` and answers `{ name, version, code }`. The frame loader treats this one method specially:

1. The loader keeps a map from a library's name and requested version to a promise. A second request for the same name and version returns that promise without sending anything; a request for another version goes to the engine, which rejects a major version the app does not ship. A request that fails leaves the map, so a later one can try again.
2. On the answer, it creates a `blob:` URL from `code`, appends a classic `<script>` with it, waits for `load`, revokes the URL, and resolves the mod's promise with `{ name, version }`. The mod never receives `code`, so a test case's `requests` record does not hold 5.5 MB.
3. A script error rejects the promise with a message naming the library.

The special case lives in `requestEngine`, the one function every request of the frame goes through: the mod's `engine.request`, the test runner's recording engine (`requestRecorded`, which records what `requestEngine` resolves with) and `ot-tile-body`. So a test case's record of a `libs.load` holds `{ name, version }` and never the code.

*Alternatives*: a `sandbox.*` notification carrying the code before the response (two messages to keep in order for no gain), or a transferred `ArrayBuffer` (faster in Chromium, but responses are built as plain data today; worth it only if the measurements of D6 show the send matters).

### D3. Drawing in `ot-tile-body`

After it sets its HTML and fires `ot-rendered`, the element:

1. Skips everything when `diagrams` is `"source"`, or when there is no `pre > code.language-mermaid`.
2. Observes each block's `<pre>` with an `IntersectionObserver` (root: the frame's viewport). A block that comes into view joins a queue that all elements of the frame share, and gets `aria-busy="true"`.
3. The queue draws one block at a time: `libs.load` for mermaid (loaded once per frame, D2), `mermaid.initialize` when the theme differs from the last one used, `mermaid.render(id, text)` with ids from a frame-wide counter, then replaces the `<pre>` with `<figure data-mermaid-source>` holding the SVG, which has no `aria-busy`. Between two blocks it waits for an animation frame and a task, so the frame paints and handles input.
4. A failing block stays as it is, loses `aria-busy`, and is logged with `console.warn`. So does every waiting block when `libs.load` fails, for instance when the browser cannot run mermaid's build.
5. A block dropped from the queue (below) loses `aria-busy` if it is still in the element.
6. When the queue is empty and no observed block of the element is waiting, it fires `ot-diagrams-drawn`.

`mermaid.initialize` options: `startOnLoad: false`, `securityLevel: "strict"`, `htmlLabels: false` (also under `flowchart`), `secure` (mermaid's default list plus `"htmlLabels"`), `suppressErrorRendering: true`, `theme: "base"`, and `themeVariables` from the theme tokens (`background`, `primaryColor` from `card`, `primaryTextColor` from `foreground`, `primaryBorderColor` from `border`, `lineColor` from `muted-foreground`, `secondaryColor` from `muted`, `tertiaryColor` from `accent`, `darkMode` from the color scheme). `fontFamily` comes from `font-sans`, and `dropShadow` is `drop-shadow(1px 2px 2px <border>)`. The token mapping lives in one function, tested by the e2e color check.

`layout` and `look` are left to mermaid: its defaults in 12 are the ELK layout and the neo look, so a diagram looks as it does in other renderers of mermaid 12, and a diagram may ask for another layout or look in its own configuration. Neo draws node outlines with a gradient between `primaryBorderColor` and `secondaryBorderColor`, both computed from the tokens, and a drop shadow whose color is the base theme's `dropShadow`, a fixed light gray that glows on a dark background; mapping it to the border token keeps every color from the theme. `--ot-shadow` cannot be used as it is: it is a `box-shadow` with two layers and a spread, which `drop-shadow()` does not take.

`htmlLabels: false` was added while applying the change: with HTML labels, the strict level sanitizes a label but keeps an element such as `<img src="x">` (without its `onerror`), which would still send a request; SVG text labels hold no element. A diagram can still change the configuration in its front matter or in an `%%{init}%%` directive, which mermaid allows for every option outside `secure`; its default `secure` list does not hold `htmlLabels`, so a diagram could turn HTML labels back on (checked with mermaid 11.17.2 and 12.2.0: the `<img>` was kept and requested). Adding `"htmlLabels"` to `secure` removes it from a diagram's configuration, at the top level and under `flowchart`, and leaves `layout` and `look` to the diagram. The frame's policy limits what such an image could reach to the hosts the mod may show, but the requirement is that labels hold no element at all. `suppressErrorRendering` keeps mermaid from adding its error drawing to the page when a block fails.

**Busy blocks.** Frames run on the app's main thread (D5), and the first diagram of a frame waits for the chunk's download, mermaid's install and its drawing, about 0.8 s on a desktop and several times that on a slow device. Without a sign, a block looks like plain code that will never change. The base stylesheet already pulses any `[aria-busy="true"]` element (`ot-busy-pulse`, an opacity animation) and shows it dimmed and still under `prefers-reduced-motion: reduce`, so marking the block is all the element does; assistive technology also hears that the block is busy. Browsers can run an opacity animation without the main thread, so the pulse may go on while mermaid draws; D5 checks it in each browser, and where it stops, the block still shows dimmed. A mod with `theme: "none"` gets the attribute and no pulse, as for its other busy elements.

The tokens come from the theme object, not from the frame's CSS: mermaid computes colors from its variables, so it needs values rather than `var(--ot-…)`, and a mod with `theme: "none"` has no theme styles in its frame. Today the loader keeps the theme only until the mod mounts (`applyThemeChanged` updates `loader.context.theme` while `loader.mounted` is false) and afterwards keeps only the `data-ot-color-scheme` attribute. It now keeps the newest theme in `loader.theme`, set from the connect message's context and from every `theme.changed`, mounted or not, and the queue reads it there.

A new body replaces the old one's blocks. Setting `tile` again, or removing the element from the document, drops the element's waiting blocks from the queue and stops observing them. A block being drawn when that happens finishes, but its SVG is not inserted, since its `<pre>` is no longer in the element. `ot-diagrams-drawn` fires only for the blocks of the body the element shows, so a body replaced before its diagrams are drawn fires none. The element keeps a body counter, like `#requestCount`, and each queued block carries the body it belongs to.

### D4. Redrawing on a theme change

The loader keeps a set of connected `ot-tile-body` elements. On `theme.changed`, after it updates the color scheme attribute and `loader.theme` (D3), it asks each element to redraw: every `figure[data-mermaid-source]` becomes a pending block again, kept in place until its new SVG replaces it, and goes through the same queue when it is in view. Like a code block, a figure in the queue has `aria-busy="true"` until the new figure replaces it, and loses it if its redraw fails.

### D5. Where the measurements go

Before the pacing of D3 is tuned, a spike outside the project measures, in the three browsers:
- whether a sandboxed `srcdoc` frame runs on the app's main thread, by blocking the frame for 500 ms and timing a `requestAnimationFrame` in the app;
- the first diagram's time under a 4× CPU slowdown, in Chromium only, which is the only browser Playwright can slow down.

Results go into this design as a note. They can change only the pause between blocks, not the approach.

**Note (measured with mermaid 11.17.2 and Playwright 1.64's headless browsers, 3 runs each):**

- **Shared main thread:** the parent page's longest gap between two animation frames was 18 to 19 ms idle and 502 to 504 ms while the frame blocked for 500 ms in Chromium, 503 to 504 ms in Firefox and 508 to 511 ms in WebKit. In all three browsers a sandboxed `srcdoc` frame runs on the app's main thread, so a diagram being drawn holds up the app too.
- **Slow CPU (Chromium, 4×):** the first small diagram took 157 to 165 ms, and the second 57 to 61 ms, against 36 to 41 ms and 12 to 13 ms without the slowdown. Installing the library took 880 to 905 ms, against 310 to 380 ms.
- **Unthrottled, for comparison:** the first small diagram took 23 to 25 ms in Firefox and 49 to 54 ms in WebKit.

**Pause chosen:** one animation frame and then a task (`setTimeout(…, 0)`) between two blocks, with no fixed delay. A single `mermaid.render` cannot be split, so a longer pause would only spread the same long tasks further apart. Waiting for the frame lets the app and the frame paint, and the task lets pending input run before the next block.

**With mermaid 12:** the same spike runs again with mermaid 12.2.0 and its default layout: the slow CPU timings in Chromium (install, first and second small diagram) and the first small diagram in Firefox and WebKit. It also checks, in each browser, whether a busy block's pulse keeps moving while the frame is blocked for 500 ms. The results go in a second note here. They can change the pause, and they decide nothing about the busy mark, which stays where the pulse stops.

**Note (measured with mermaid 12.2.0, its default configuration and Playwright 1.64's headless browsers, 3 runs each):** the layout was `elk` and a flowchart's look `neo` (mermaid 12 keeps `classic` at the top level and sets `neo` for flowcharts and most other diagrams).

- **Slow CPU (Chromium, 4×):** the first small diagram took 792 to 938 ms, and the second 105 to 110 ms, against 189 to 243 ms and 24 to 31 ms without the slowdown. Installing the library took 266 to 285 ms, against 205 to 285 ms unthrottled: unlike the diagrams, the install barely slowed down.
- **First small diagram, unthrottled:** 69 ms in Firefox (second 28 ms) and 206 to 227 ms in WebKit (second 34 to 36 ms).
- **Busy pulse while the frame is blocked for 500 ms:** screenshots wait for the main thread, so a video of the frame was recorded, with the pulsing square beside a bar the frame's main thread moves every animation frame; in the 11 to 13 video frames where the bar stood still, the square's brightness kept changing in Chromium and Firefox, and stayed fixed in WebKit. So the pulse goes on during a drawing in Chromium and Firefox, and in WebKit it stops at its current opacity, between full and half, until the frame is free.

**Pause kept:** one animation frame and then a task, as with mermaid 11. The first diagram under a slow CPU is now close to a second long, but it is one `mermaid.render` that cannot be split, so a longer pause would not shorten it; the busy mark shows the wait.

## Risks / Trade-offs

- [Mermaid has had cross-site scripting issues; a diagram source is tile content] → `securityLevel: "strict"`; drawing happens only in the mod's sandbox, so the worst case is a script with that mod's grants, not the app's; the library stays pinned to `^12` and is updated with the app's dependencies.
- [A diagram can change mermaid's configuration in its own front matter or `%%{init}%%` directive] → `secure` keeps `htmlLabels` out of its reach (D3), besides mermaid's own list (`securityLevel`, `maxTextSize`, …); `layout`, `look` and colors stay the author's to choose.
- [Mermaid 11 depended on a katex release with an advisory (GHSA-238p-pmpm-9mq7)] → Mermaid 12.2.0 depends on a fixed katex. `npm audit` may still list the katex of `remark-math`, which the app does not bundle: it parses math and keeps it as code.
- [Mermaid 12 targets ES2024 and Safari 17.4 or later; the app's build targets older browsers, and Vite does not transpile the library] → On an older browser, installing mermaid fails with a syntax error, `libs.load` rejects, and the blocks stay as code without the busy mark. Accepted: the body stays readable.
- [ELK, mermaid 12's default layout, draws about 1.6 times slower than dagre, and 3.5 times slower for a frame's first diagram] → Accepted, so diagrams look as mermaid 12 draws them elsewhere; the busy mark shows the wait, and a diagram may ask for dagre. The ELK code is in the single-file build whatever the layout, so dagre would not shrink the download.
- [5.5 MB per frame that draws diagrams: memory and parse time] → Loaded only when a block comes into view; two mods drawing diagrams each pay the install (blob scripts are not shared), which the docs mention.
- [Drawing blocks the frame for up to a few hundred milliseconds per large diagram] → One block at a time with a paint in between; D5 checks whether the app stutters too.
- [Content shifts when a diagram replaces its code block] → Accepted: it happens where the reader is looking, since only blocks in view are drawn.
- [The shipped version moves under mods] → Mods ask for a major version; a new major would be added beside the old one or bump the mod API, decided in that change.
- [The `mermaid` dependency is large in `node_modules` and the build output] → Only one chunk; the app's first load does not grow. The release note mentions the build size.

## Migration Plan

Additions only: mod API `0.1.6`, a new chunk, no stored data. Applied and archived after `add-tile-bodies-and-players`.
