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
    major: "11",
    version: MERMAID_VERSION,
    loadCode: () => import("mermaid/dist/mermaid.min.js?raw").then((module) => module.default),
  },
};
```

The `?raw` import makes Vite put the 3.4 MB string in its own chunk, fetched from the app's host on the first request and kept for the page. `mermaid` is a dependency pinned to `^11`; the build raises Vite's chunk size warning limit for that chunk only, so other chunks keep the warning.

*Alternative*: copy `mermaid.min.js` into `public/` and `fetch` it. Rejected: it needs a copy step and a path that instantiations could break, and Vite already gives a hashed, cacheable chunk.

### D2. `libs.load` answers the code, and the frame loader installs it

The engine's handler (`libs_methods.ts`) checks `name` and `version` (D1's table, `-32602` otherwise), awaits `loadCode()` and answers `{ name, version, code }`. The frame loader treats this one method specially:

1. The loader keeps a map from library name to a promise. A second request for a name already in the map returns that promise without sending anything.
2. On the answer, it creates a `blob:` URL from `code`, appends a classic `<script>` with it, waits for `load`, revokes the URL, and resolves the mod's promise with `{ name, version }`. The mod never receives `code`, so a test case's `requests` record does not hold 3.4 MB.
3. A script error rejects the promise with a message naming the library.

*Alternatives*: a `sandbox.*` notification carrying the code before the response (two messages to keep in order for no gain), or a transferred `ArrayBuffer` (faster in Chromium, but responses are built as plain data today; worth it only if the measurements of D6 show the send matters).

### D3. Drawing in `ot-tile-body`

After it sets its HTML and fires `ot-rendered`, the element:

1. Skips everything when `diagrams` is `"source"`, or when there is no `pre > code.language-mermaid`.
2. Observes each block's `<pre>` with an `IntersectionObserver` (root: the frame's viewport). A block that comes into view joins a queue that all elements of the frame share.
3. The queue draws one block at a time: `libs.load` for mermaid (loaded once per frame, D2), `mermaid.initialize` when the theme differs from the last one used, `mermaid.render(id, text)` with ids from a frame-wide counter, then replaces the `<pre>` with `<figure data-mermaid-source>` holding the SVG. Between two blocks it waits for an animation frame and a task, so the frame paints and handles input.
4. A failing block stays as it is and is logged with `console.warn`.
5. When the queue is empty and no observed block of the element is waiting, it fires `ot-diagrams-drawn`.

`mermaid.initialize` options: `startOnLoad: false`, `securityLevel: "strict"`, `theme: "base"`, and `themeVariables` from the theme tokens (`background`, `primaryColor` from `card`, `primaryTextColor` from `foreground`, `primaryBorderColor` from `border`, `lineColor` from `muted-foreground`, `secondaryColor` from `muted`, `tertiaryColor` from `accent`, `darkMode` from the color scheme). The token mapping lives in one function, tested by the e2e color check.

### D4. Redrawing on a theme change

The loader keeps a set of connected `ot-tile-body` elements. On `theme.changed`, after it updates the color scheme attribute, it asks each element to redraw: every `figure[data-mermaid-source]` becomes a pending block again, kept in place until its new SVG replaces it, and goes through the same queue when it is in view.

### D5. Where the measurements go

Before the pacing of D3 is tuned, a spike outside the project measures, in the three browsers:
- whether a sandboxed `srcdoc` frame runs on the app's main thread, by blocking the frame for 500 ms and timing a `requestAnimationFrame` in the app;
- the first diagram's time under a 4× CPU slowdown, in Chromium only, which is the only browser Playwright can slow down.

Results go into this design as a note. They can change only the pause between blocks, not the approach.

## Risks / Trade-offs

- [Mermaid has had cross-site scripting issues; a diagram source is tile content] → `securityLevel: "strict"`; drawing happens only in the mod's sandbox, so the worst case is a script with that mod's grants, not the app's; the library stays pinned to `^11` and is updated with the app's dependencies.
- [3.4 MB per frame that draws diagrams: memory and parse time] → Loaded only when a block comes into view; two mods drawing diagrams each pay the install (blob scripts are not shared), which the docs mention.
- [Drawing blocks the frame for up to a few hundred milliseconds per large diagram] → One block at a time with a paint in between; D5 checks whether the app stutters too.
- [Content shifts when a diagram replaces its code block] → Accepted: it happens where the reader is looking, since only blocks in view are drawn.
- [The shipped version moves under mods] → Mods ask for a major version; a new major would be added beside the old one or bump the mod API, decided in that change.
- [The `mermaid` dependency is large in `node_modules` and the build output] → Only one chunk; the app's first load does not grow. The release note mentions the build size.

## Migration Plan

Additions only: mod API `0.1.6`, a new chunk, no stored data. Applied and archived after `add-tile-bodies-and-players`.

## Open Questions

- The pause between two diagrams, after the measurements of D5.
