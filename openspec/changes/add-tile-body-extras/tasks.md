# Tasks

## 1. Dependencies and lazy loading

- [ ] 1.1 Add `temml`, `rehype-highlight` and `remark-gemoji` to the dependencies, and not `lowlight`, which `rehype-highlight` brings (design.md, D4). Verify `npm install` and `npm run build` pass, and that the build emits the three libraries as separate chunks that `index.html` does not load (check `dist/assets` and the HTML's script tags).
- [ ] 1.2 Split rendering in `src/lib/core/tile_bodies/` into the synchronous `scanTileBody(tile): TileBodyScan`, which replaces `RenderedBody`, and `async renderTileBody(tile): Promise<string>` (design.md, D1), and add the detection walk after the dollar and alerts passes, and the once-per-page `import()` promises of D2, cleared when they reject. Write cases first: a plain body triggers none of the imports, `It costs $5 and $10.` triggers none, a body with each extra triggers only its own, a block labeled `dockerfile` triggers the highlighter, `mermaid` and `math` blocks do not, "Name that is not an emoji" (`10:30:45` triggers the emoji names and stays text), two bodies with math import Temml once, a rejected import is tried again for the next body, and `scanTileBody` finds the same media, players and issues as before. Verify `npx vitest run src/lib/core/tile_bodies` passes.
- [ ] 1.3 In `src/lib/core/engine/mod_tile_bodies.ts`, make the launch scan each body holding `<`, `![` or `://` with `scanTileBody`, fill `mediaByTile`, `playerAddresses` and `issues` from the scans and render no HTML, make `renderedBodies` a map of HTML promises set on the first request, and make `readTileBodyHtml` async, removing a promise that rejects (design.md, D1). Await it in `tiles_methods.ts`. In `src/lib/core/sandbox/`, make `tile_links.test.ts` take the body media from `scanTileBody(tile).mediaUrls`, and make the doc comment of `collectTileLinks` name `scanTileBody`. Update `mod_launch.test.ts` (no body is rendered at launch) and `tiles_methods.test.ts`, and add cases: two requests at once for one body render it once; "Library that cannot load" and "Next request after a failure"; and "Formula beside an image". Verify `npx vitest run src/lib/core/engine src/lib/core/stage src/lib/core/sandbox` passes.
- [ ] 1.4 Update `docs/modules/lib/core/engine/README.md`: `buildTileBodies` scans the bodies and renders none, `renderedBodies` holds the promise of each body's HTML, and `readTileBodyHtml` is async and drops a promise that rejects; `tiles.renderBody` answers `-32603` for a body that fails to render, and the error codes table gets a `-32603` row (an error the method did not expect, with a message starting with the method's name); the "Tile bodies" section says formulas are rendered as MathML, labeled code is highlighted and shortcodes become emoji, instead of "math kept as code". Verify each statement matches `mod_tile_bodies.ts` and `mod_session.ts`.

## 2. Rendering the extras

- [ ] 2.1 Add the math pass of design.md, D3, and extend the tile schema with the MathML elements and attributes it lists. In `render_body.test.ts`, update "Asterisks in a formula", "Backslashes in display math", "Prices are not math" and "Escaped dollars" to the new expectations, and add "Fraction", "Math block", "Link command in a formula", "MathML written in a body", "Unclosed brace" and "Failing math block", plus a formula over `maxExpand` staying as code. Verify the tests pass.
- [ ] 2.2 Run `remark-gemoji`'s transform on the markdown tree after the dollar and alerts passes, and `rehype-highlight` before sanitizing, as design.md, D4 describes, and allow the `hljs` classes in the tile schema. Add "Labeled JavaScript", "Unlabeled block", "Shortcodes" and "Mermaid block" (unchanged), a block labeled `dockerfile` staying plain, and a shortcode between two prices (`$5 :tada: $10`) becoming its emoji. Verify the tests pass.
- [ ] 2.3 Update `docs/modules/lib/core/tile_bodies/README.md`: formulas as MathML with their annotation, failing formulas, untrusted commands, highlighted languages, emoji shortcodes, when each library loads, that bodies render on request and the launch only scans them, and the pipeline line and module list, to the pipeline of design.md, with `scanTileBody` and `TileBodyScan` in place of `RenderedBody`. In `docs/mod_plugin_spec.md`, say what a body can hold and that a formula's source is in its `<annotation>`. Verify the documented markup matches the test output of "Fraction" and "Labeled JavaScript".

## 3. Theme

- [ ] 3.1 Add the highlight colors and the display math rules of design.md, D5, to `src/lib/core/theme/base_stylesheet.css`, and describe them in `docs/modules/lib/core/theme/README.md`. Verify `npx vitest run src/lib/core/theme` passes, updating any test that pins the stylesheet.

## 4. Mod API version

- [ ] 4.1 Set `MOD_API_VERSION` to `0.1.7`, add the `0.1.7` entry to `mod_api_surface.test.ts` (same surface as `0.1.6`), and update `mod_api_version.test.ts`, the pinned version in `e2e/mod_routes.ts`, and the version in `docs/modules/lib/core/engine/README.md`. Verify `npx vitest run src/lib/core/engine` passes.

## 5. End-to-end

- [ ] 5.1 Add `e2e/tile_body_extras.spec.ts`, with a routed collection whose bodies hold inline and display math, a failing formula, labeled JavaScript, an unlabeled block and shortcodes. Cover: a `<math>` with an `<mfrac>` shown in `ot-tile-body`, "Unclosed brace", "Labeled JavaScript", "Keyword color" in dark and then light without a frame reload, "Shortcodes", and "Plain body" (record the requests: no Temml, highlighting or emoji chunk for a mod whose bodies have none, one of them holding `It costs $5 and $10.`). Verify `npx playwright test e2e/tile_body_extras.spec.ts` passes in the three browsers.

## 6. Verification

- [ ] 6.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Run `openspec validate add-tile-body-extras --strict` and verify it is valid.
- [ ] 6.2 Open a tile with the formulas of the measurement (fractions, roots, sums, integrals, a matrix, `\mathbb` and `\mathcal`) in desktop Chromium, Firefox and WebKit through the built app, and record in the change how each looks. Verify each browser's result is written down. For any formula that is wrong, write a draft issue (the formula, the browser and what it shows) and give it to the user; do not open it.

## 7. Release

- [ ] 7.1 Add `.changeset/add-tile-body-extras.md` with an `"opentesela": patch` bump: the mod API grows from `0.1.6` to `0.1.7` with richer rendered bodies that existing mods keep working with (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "Tile bodies show formulas as math, highlight labeled code blocks and turn :emoji: shortcodes into emoji, loading each only when a body needs it." Verify the file matches the format of the other files in `.changeset/`.
