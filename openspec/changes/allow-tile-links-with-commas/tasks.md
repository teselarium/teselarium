# Tasks

## 1. Tile link sources with `,` and `;`

- [ ] 1.1 In `src/lib/core/sandbox/tile_links.test.ts`, write the failing cases first: "Comma in the path" (`https://media.example.net/covers/chronicles,_volume_1.jpg` gives the source `https://media.example.net/covers/chronicles%2C_volume_1.jpg` and no issue), "Semicolon in the path" (replace the current case: `https://media.example.net/a;b.jpg` gives `https://media.example.net/a%3Bb.jpg` and no issue), a link written both with `,` and with `%2C` giving one source (design.md, D2), and `|` still left out with "the sandbox cannot allow this address" in "reports other path characters a source cannot hold", with `,` removed from that case. Verify `npx vitest run src/lib/core/sandbox/tile_links.test.ts` fails only on the new cases.
- [ ] 1.2 In `src/lib/core/sandbox/tile_links.ts`, build each source as `url.origin` plus the path with `,` written as `%2C` and `;` as `%3B`, and check that encoded path against `SOURCE_PATH_PATTERN`, which stays as it is (design.md, D1). Update the doc comments of `TileLinks.sources`, `SOURCE_PATH_PATTERN` and `collectTileLinks`. Verify `npx vitest run src/lib/core/sandbox` passes.
- [ ] 1.3 In `docs/modules/lib/core/sandbox/README.md`, "Media linked by tiles": say in step 6 that `,` and `;` are written as `%2C` and `%3B` in the source, which the browser matches against the address as written, and remove `;` and `,` from the characters left out in practice in "What the policy cannot express", keeping `|`, `[` and `]`. Verify the README's example source and list match the unit tests.

## 2. End-to-end

- [ ] 2.1 In `e2e/mod_sandbox.spec.ts`, under "A tile link allows only the linked file", add "Comma in the path" (the app-origin probe without permissions, `serveLinkedTiles` with the linked URL, `routeImages` for its host: `showImage` is `true` and `issueList` names no tile), and "Other file next to a link with a comma" (`showImage` of `https://media.example.net/covers/chronicles.jpg` is `false`). Under "Tile links the sandbox cannot express", add "Semicolon in the path" (it loads, as for the comma) and "Vertical bar in the path" (blocked, with "the sandbox cannot allow this address"). Verify `npx playwright test e2e/mod_sandbox.spec.ts` passes in Chromium, Firefox and WebKit.

## 3. Verification

- [ ] 3.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Open the sample book list mod without `show` permissions on `public/samples/tiles/literature_nobel_laureates_books/collection.yaml` (for example in a copy of the mod) and verify the covers `Bob_Dylan_Chronicles,_Volume_1.jpg` and `Human_Acts,_cover.png` load and no "cannot allow this address" issue is listed. Then run `openspec validate allow-tile-links-with-commas --strict` and verify it is valid.

## 4. Release

- [ ] 4.1 Add `.changeset/allow-tile-links-with-commas.md` with an `"opentesela": patch` bump: per the "Bump rule" in `docs/releasing.md`, links that were refused now load and nothing breaks while the app is `0.x`, and the mod API does not bump. Use the one-line summary: "Tiles can link images, video and audio whose address has a comma or a semicolon, such as `https://upload.wikimedia.org/…/Human_Acts,_cover.png`." Verify the file matches the format of the other files in `.changeset/`.
