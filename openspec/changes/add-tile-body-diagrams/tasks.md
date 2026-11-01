# Tasks

## 1. Measurements

- [x] 1.1 Outside the project, extend the mermaid spike whose measurements are in design.md's Context (design.md, D5): in Chromium, Firefox and WebKit, block a sandboxed `srcdoc` frame for 500 ms and time a `requestAnimationFrame` in the parent page; in Chromium, time the first small diagram with the CPU slowed 4× (`Emulation.setCPUThrottlingRate`). Write the results and the chosen pause between diagrams as a note under D5 in `design.md`, and remove its open question. Verify the note gives a number per browser.

## 2. Shipped libraries

- [x] 2.1 Add `mermaid` `^11` to the dependencies, and give the build its version as `MERMAID_VERSION`, read from `mermaid/package.json` as the app's version is read. Raise Vite's chunk size warning only for the mermaid chunk: Vite has one limit for every chunk, so it gets the mermaid limit and a plugin in `vite.config.ts` keeps 500 kB for the others. Verify `npm run build` passes with no warning about the mermaid chunk and the same chunk size warnings as before (the main chunk was already above 500 kB), and that the chunks the app loads at start hold no mermaid code and grow only by this change's own code, the `libs.load` handler and the frame loader's text (compare `dist/assets` with the previous build).
- [x] 2.2 Add `SHIPPED_LIBRARIES` and `libs.load` in `src/lib/core/engine/libs_methods.ts` (design.md, D1 and D2), loading the code once per page. Write `libs_methods.test.ts` first, with "Load mermaid" (the result has `code` and the full version), "Unknown library", "Other major version", a non-string `version`, and the code loaded once for two requests. Verify `npx vitest run src/lib/core/engine/libs_methods.test.ts` passes.
- [x] 2.3 Set `MOD_API_VERSION` to `0.1.6`, add the `0.1.6` entry to `mod_api_surface.test.ts` with `libs.load`, and update `mod_api_version.test.ts` and the pinned version in `e2e/mod_routes.ts`. Verify `npx vitest run src/lib/core/engine` passes.
- [x] 2.4 Document `libs.load` and the shipped libraries in `docs/modules/lib/core/engine/README.md`, with the version `0.1.6`, and add a "Libraries" section to `docs/mod_plugin_spec.md` with the R2 example: load mermaid, draw a block, redraw on `theme.changed`. Verify the example's names match the code.

## 3. Frame loader

- [x] 3.1 In `requestEngine` in `sandbox_loader.js`, handle `libs.load` as design.md, D2 describes: one promise per library name, a classic `blob:` script, the result without `code`, and a rejection naming the library on a script error. Keep the newest theme in `loader.theme` from the connect message and every `theme.changed` (design.md, D3). Verify with the e2e tests of group 5 ("Load mermaid", "Two requests", "Other frames", and "In a test case", whose recorded `libs.load` result has no `code`).

## 4. Diagrams in the tile body element

- [x] 4.1 Add the drawing of design.md, D3 to `ot-tile-body`: the `diagrams` property (`"draw"` by default, `"source"`), the intersection observer, the frame-wide queue with a paint between blocks, `mermaid.initialize` with the token mapping from `loader.theme`, the `<figure data-mermaid-source>`, failing blocks kept, `ot-diagrams-drawn`, and dropping a body's waiting blocks when `tile` is set again or the element leaves the document. Verify with the e2e tests of group 5.
- [x] 4.2 Add the redraw of design.md, D4 on `theme.changed`. Verify with the e2e test "Switch to dark".
- [x] 4.3 Add a `figure[data-mermaid-source]` rule to the base stylesheet (centered, `max-width: 100%`, scrolling sideways when wider) and describe it in `docs/modules/lib/core/theme/README.md`. Describe diagrams, the property and the event in `docs/modules/lib/core/tile_bodies/README.md` and in the `ot-tile-body` section of `docs/mod_plugin_spec.md`. Verify `npx vitest run src/lib/core/theme` passes, updating any test that pins the stylesheet.

## 5. End-to-end

- [x] 5.1 Add `e2e/mod_libraries.spec.ts` with `test.describe` blocks named after the `mod-libraries` requirements: "Load mermaid", "Unknown library", "Other major version", "Two requests", "No third-party request" (record every request while loading), "Not downloaded before a request" (the mermaid chunk is not requested), "Other frames" and "In a test case". Verify `npx playwright test e2e/mod_libraries.spec.ts` passes.
- [x] 5.2 Add `e2e/tile_body_diagrams.spec.ts` with blocks named after the new `tile-bodies` requirements: "Body with a diagram" (paragraph visible while the block is code, then an SVG with both labels), "Markup in a label", "Block below the fold" (no `libs.load` until scrolled), "Syntax error", "Switch to dark" (a node's fill changes, no frame reload), "Events in order", "New tile while drawing" and "Source only". Verify `npx playwright test e2e/tile_body_diagrams.spec.ts` passes.

## 6. Verification

- [x] 6.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Run `openspec validate add-tile-body-diagrams --strict` and verify it is valid.

## 7. Release

- [x] 7.1 Add `.changeset/add-tile-body-diagrams.md` with an `"opentesela": patch` bump: the mod API grows from `0.1.5` to `0.1.6` by additions, a patch for the app while both are `0.x` (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "Tile bodies show mermaid diagrams, drawn in the mod's frame from the app's own copy of mermaid, which mods can also load with libs.load." Verify the file matches the format of the other files in `.changeset/`.

## 8. Mermaid 12, protected labels and busy blocks

- [x] 8.1 Outside the project, run the spike of task 1.1 again with mermaid 12.2.0 and its default layout (design.md, D5, "With mermaid 12"): in Chromium with the CPU slowed 4×, time the install and the first and second small diagram; time the first small diagram in Firefox and WebKit; and in the three browsers, check whether an `aria-busy="true"` element's pulse keeps moving while the frame is blocked for 500 ms. Write the results as a second note under D5 in `design.md`, with any change to the pause. Verify the note gives a number or an answer per browser.
- [x] 8.2 Move to mermaid 12 (design.md, D1): `mermaid` `^12` in the dependencies, `major: "12"` in `SHIPPED_LIBRARIES` and in the frame loader's `MERMAID_LIBRARY`, and the mermaid chunk's size limit in `vite.config.ts` raised to 6000 kB. First update `libs_methods.test.ts` and `e2e/mod_libraries.spec.ts` to the `mod-libraries` scenarios ("Load mermaid" asks for `"12"`, "Other major version" asks for `"11"`), then the code, then `docs/modules/lib/core/engine/README.md` and the example of `docs/mod_plugin_spec.md`. Verify `npx vitest run src/lib/core/engine` and `npx playwright test e2e/mod_libraries.spec.ts` pass, and that `npm run build` gives no warning about the mermaid chunk and the same other chunk warnings as before.
- [x] 8.3 Set the mermaid configuration of design.md, D3: `secure` with mermaid's default list and `"htmlLabels"`, `dropShadow` from the border token, and no `layout` or `look`. First add the e2e test "HTML labels in the diagram's configuration" to `e2e/tile_body_diagrams.spec.ts`, with one block using front matter and one an `%%{init}%%` directive. Verify `npx playwright test e2e/tile_body_diagrams.spec.ts` passes, updating the colors "Switch to dark" checks if the neo look draws its node with others.
- [x] 8.4 Mark busy blocks as design.md, D3 and D4 describe: `aria-busy="true"` when a block or a figure joins the queue, removed when its drawing fails or it is dropped, and absent from a new figure. First add the e2e tests "Busy while drawing", "Failed block is not busy", "Busy while redrawn" and "Not busy out of view or as code" to `e2e/tile_body_diagrams.spec.ts`. Describe the busy mark in `docs/modules/lib/core/tile_bodies/README.md` and in the `ot-tile-body` section of `docs/mod_plugin_spec.md`. Verify the tests pass.
- [x] 8.5 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Run `openspec validate add-tile-body-diagrams --strict` and verify it is valid, and verify `npm audit` no longer lists `mermaid`.
