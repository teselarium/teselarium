# Tasks

## 1. Dependencies and lazy loading

- [ ] 1.1 Add `temml`, `lowlight`, `rehype-highlight` and `remark-gemoji` to the dependencies. Verify `npm install` and `npm run build` pass, and that the build emits the three libraries as separate chunks that `index.html` does not load (check `dist/assets` and the HTML's script tags).
- [ ] 1.2 Split rendering in `src/lib/core/tile_bodies/` into the synchronous scan and `async renderTileBody(tile)` (design.md, D1), and add the detection walk and the once-per-page `import()` promises of D2. Write cases first: a plain body triggers none of the imports, a body with each extra triggers only its own, and two bodies with math import Temml once. Verify `npx vitest run src/lib/core/tile_bodies` passes.

## 2. Rendering the extras

- [ ] 2.1 Add the math pass of design.md, D3, and extend the tile schema with the MathML elements and attributes it lists. In `render_body.test.ts`, update "Asterisks in a formula", "Backslashes in display math", "Prices are not math" and "Escaped dollars" to the new expectations, and add "Fraction", "Math block", "Link command in a formula", "MathML written in a body" and "Unclosed brace", plus a formula over `maxExpand` staying as code. Verify the tests pass.
- [ ] 2.2 Add `remark-gemoji` and `rehype-highlight` as design.md, D4 describes, and allow the `hljs` classes in the tile schema. Add "Labeled JavaScript", "Unlabeled block", "Shortcodes" and "Mermaid block" (unchanged), and a block labeled with an unknown language staying plain. Verify the tests pass.
- [ ] 2.3 Update `docs/modules/lib/core/tile_bodies/README.md`: formulas as MathML with their annotation, failing formulas, untrusted commands, highlighted languages, emoji shortcodes, and when each library loads. In `docs/mod_plugin_spec.md`, say what a body can hold and that a formula's source is in its `<annotation>`. Verify the documented markup matches the test output of "Fraction" and "Labeled JavaScript".

## 3. Theme

- [ ] 3.1 Add the highlight colors and the display math rules of design.md, D5, to `src/lib/core/theme/base_stylesheet.css`, and describe them in `docs/modules/lib/core/theme/README.md`. Verify `npx vitest run src/lib/core/theme` passes, updating any test that pins the stylesheet.

## 4. Mod API version

- [ ] 4.1 Set `MOD_API_VERSION` to `0.1.7`, add the `0.1.7` entry to `mod_api_surface.test.ts` (same surface as `0.1.6`), and update `mod_api_version.test.ts`, the pinned version in `e2e/mod_routes.ts`, and the version in `docs/modules/lib/core/engine/README.md`. Verify `npx vitest run src/lib/core/engine` passes.

## 5. End-to-end

- [ ] 5.1 Add `e2e/tile_body_extras.spec.ts`, with a routed collection whose bodies hold inline and display math, a failing formula, labeled JavaScript, an unlabeled block and shortcodes. Cover: a `<math>` with an `<mfrac>` shown in `ot-tile-body`, "Unclosed brace", "Labeled JavaScript", "Keyword color" in dark and then light without a frame reload, "Shortcodes", and "Plain body" (record the requests: no Temml, highlighting or emoji chunk for a mod whose bodies have none). Verify `npx playwright test e2e/tile_body_extras.spec.ts` passes in the three browsers.

## 6. Verification

- [ ] 6.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Run `openspec validate add-tile-body-extras --strict` and verify it is valid.
- [ ] 6.2 Open a tile with the formulas of the measurement (fractions, roots, sums, integrals, a matrix, `\mathbb` and `\mathcal`) in desktop Chromium, Firefox and WebKit through the built app, and record in the change how each looks. Verify each browser's result is written down, and open an issue for any formula that is wrong.

## 7. Release

- [ ] 7.1 Add `.changeset/add-tile-body-extras.md` with an `"opentesela": patch` bump: the mod API grows from `0.1.6` to `0.1.7` with richer rendered bodies that existing mods keep working with (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "Tile bodies show formulas as math, highlight labeled code blocks and turn :emoji: shortcodes into emoji, loading each only when a body needs it." Verify the file matches the format of the other files in `.changeset/`.

## Workflow follow-up

- Apply and archive `add-tile-bodies-and-players` and `add-tile-body-diagrams` before applying this change: its `tile-bodies` delta modifies requirements that exist only once `add-tile-bodies-and-players` is archived.
