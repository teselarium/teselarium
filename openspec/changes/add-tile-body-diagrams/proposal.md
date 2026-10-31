# Proposal

## Why

Tile authors write diagrams as mermaid blocks, as they do on GitHub, but a rendered tile body (`add-tile-bodies-and-players`) shows them as code. A mod cannot simply bundle mermaid: the library is 3.4 MB, a mod is one entrypoint, and loading code from elsewhere needs the `code` permission. Drawing diagrams in the app's own page is not an option either, since it would run a large library on untrusted tile content in the app's origin.

The app can keep one vetted copy of mermaid and hand it, only when needed, to the mod frames that draw diagrams, where untrusted content belongs. `<ot-tile-body>` can then draw diagrams with no code from the mod.

## What Changes

- **Libraries the app delivers**: a new request, `libs.load { name, version }`, installs a library the app ships in the requesting mod's frame and resolves once it is ready. The first and only library is `mermaid`, major version `11`, available as `globalThis.mermaid`. The app downloads it only on the first request in a page, from its own host, never from a third party. A frame receives it once.
- **Diagrams in `<ot-tile-body>`**: after showing a body, the element draws its mermaid blocks with the library, in the theme's colors and with mermaid's strict security level. The text shows first: each block stays as code until its diagram replaces it, blocks are drawn when they come into view, one at a time, and a block that fails stays as code. Diagrams are drawn again when the color scheme changes. A new event, `ot-diagrams-drawn`, fires when the visible diagrams are drawn; `ot-rendered` keeps its meaning.
- **Opting out**: `diagrams = "source"` on the element keeps mermaid blocks as code and never loads the library.
- **Advanced mods** load the library with `libs.load` and draw diagrams themselves.

## Capabilities

### New Capabilities

- `mod-libraries`: the libraries the app delivers to mod frames, how a mod requests one, the versions it can ask for, where the app gets the code and what a frame receives.

### Modified Capabilities

- `tile-bodies`: the tile body element draws mermaid diagrams, when and how, with the opt-out and the new event. The rendered HTML of `tiles.renderBody` does not change.
- `mod-api-version`: the mod API version becomes `0.1.6`.

## Impact

- **Code**:
  - `mermaid` becomes a dependency; the engine loads its single-file build lazily (a Vite `?raw` import), so the app's first load does not grow;
  - a `libs_methods.ts` table in `src/lib/core/engine/` and the list of shipped libraries;
  - the frame loader installs a delivered library as a classic `blob:` script, and `ot-tile-body` draws diagrams.
- **Tests**: unit tests of `libs.load` (names, versions, errors, once per frame); e2e tests that a body's diagram appears as an SVG after its text, that a failing block stays as code, that `diagrams = "source"` loads nothing, that the color scheme redraws, and that a mod can draw with `libs.load`.
- **Measurements**: before tuning the drawing pace, measure in the three browsers whether a mod frame shares its main thread with the app, and the first diagram's time with a slowed CPU. The spike measured 3.41 MB raw (0.94 MB gzip), 95 to 280 ms to install, and 10 to 90 ms per small diagram on a desktop.
- **Docs**: the engine README (`libs.load`), a library section in the mod plugin spec, the tile bodies README (diagrams), and the bundle size note for instantiators.
- **Mod API version**: patch, `0.1.5` to `0.1.6`. The change adds a method, a library name, an element property and an event, and removes or renames nothing; existing mods keep working, which the "Mod API version" section of the engine's README counts as an addition.
- **App version**: patch bump while the app is `0.x`, as much as the mod API.
- **Depends on**: `add-tile-bodies-and-players`, whose `<ot-tile-body>` and rendered bodies this change extends. It is applied and archived first.
- **Out of scope**: other libraries; rendering math, highlighting code and emoji shortcodes (a later change; `add-tile-bodies-and-players` already keeps math exact and renders alerts); diagrams in the app's own pages; a smaller mermaid build with fewer diagram types.
