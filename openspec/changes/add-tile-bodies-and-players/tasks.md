# Tasks

## 1. Known players

- [ ] 1.1 Add `src/lib/core/players/` with the table of design.md, D2, and `readPlayer(address)` returning `{ frameUrl, host, siteName, shape }` or `null` for a page link or player address of a known site. Write `player_sites.test.ts` first, with the scenarios of "Known sites" ("YouTube in privacy-enhanced mode", "Pasted YouTube iframe", "SoundCloud page"), `youtu.be` and `m.youtube.com` links, an id of 10 or 12 characters, a query that cannot reach the player address (`autoplay=1`), Vimeo, and an unknown site giving `null`. Verify `npx vitest run src/lib/core/players` passes.
- [ ] 1.2 Add `docs/modules/lib/core/players/README.md`: the table, what the app plays from, why YouTube uses its privacy-enhanced mode, and that a site missing from the table only keeps page links as links. Verify every address in the README's examples matches a test case.

## 2. Rendering bodies

- [ ] 2.1 Add `unified`, `remark-parse`, `remark-rehype` and `rehype-stringify` to the dependencies in `package.json`, at the versions `react-markdown` already uses where it pulls them. Verify `npm install` leaves one copy of each in `npm ls` and `npm run build` passes.
- [ ] 2.2 Add `src/lib/core/tile_bodies/` with `renderTileBody(tile)` returning `{ html, mediaUrls, playerAddresses, issues }`, following the pipeline, the players pass, the tile schema and the finishing pass of design.md, D3. Write `render_body.test.ts` first, with cases named after the `tile-bodies` scenarios: "Script in a body", "Script address in a link", "Relative image", "Relative link", "Image attributes", "Video with autoplay", "Pasted YouTube iframe", "Image syntax with a page link", "Plain http page", "Router address" (with its issue), "Mermaid block", plus a fragment link kept as written, a forged `button.ot-player` in a body whose address is not in `playerAddresses`, and `mediaUrls` holding images, sources and posters. Verify `npx vitest run src/lib/core/tile_bodies` passes.
- [ ] 2.3 Add `docs/modules/lib/core/tile_bodies/README.md`: what a rendered body holds, the placeholder's markup and attributes, link marking, media rules, the extras that stay as written, and that sanitizing follows GitHub's schema. Verify the documented markup matches the output of the "Pasted YouTube iframe" test.

## 3. Media of bodies in the policy

- [ ] 3.1 Give `collectTileLinks` each tile's body media addresses with its metadata strings (design.md, D4), so they follow the same six steps and issues. In `tile_links.test.ts`, add the `mod-sandbox` scenarios "Image in the body", "Video and poster in the body" and "URL in the body", and a private address in a body image giving the guard's issue. Verify `npx vitest run src/lib/core/sandbox` passes.
- [ ] 3.2 Update "Media linked by tiles" in `docs/modules/lib/core/sandbox/README.md`: body images, video, audio, sources and posters count; text URLs and links do not. Verify the README's step list matches the code.

## 4. Engine

- [ ] 4.1 Build a `TileBodies` value in `buildModLaunch` from the tiles the mod receives (rendered bodies, player addresses from bodies and recognized metadata strings, media by tile), skipping the collection for bodies without `<`, `![` or a URL scheme. Keep it on the session, and replace it in `pushTilesChanged`, which the stage's reload passes the new value. In `mod_launch.test.ts` and `mod_session.test.ts`, check the player addresses of a body iframe and of a metadata page link, and that a reload replaces them. Verify the tests pass.
- [ ] 4.2 Add `tiles.renderBody` (design.md, D5) in a `tiles_methods.ts` table. In its test, cover "Body of a tile", "Not a tile of the mod", a non-string `source`, an empty body, and "After reloading the tiles". Verify the test passes.
- [ ] 4.3 Add `PlayerAction` to `AppAction` and `players.open` in a `players_methods.ts` table (design.md, D6): `-32602` for a non-`https:` or relative `url`, `-32002` for an address not in the session's player addresses, then `askUser`. In its test, cover "Address not from the tiles", a hidden sandbox (`-32002`, "Hidden mod asks for a player"), and the action built for a YouTube page link and for a generic iframe with `width` and `height`. Verify the test passes.
- [ ] 4.4 Set `MOD_API_VERSION` to `0.1.5`, add the `0.1.5` entry to `mod_api_surface.test.ts` with `tiles.renderBody` and `players.open`, and update `mod_api_version.test.ts` and the pinned version in `e2e/mod_routes.ts`. Verify `npx vitest run src/lib/core/engine` passes.
- [ ] 4.5 Document `tiles.renderBody`, `players.open` and the player action in `docs/modules/lib/core/engine/README.md`, with the version `0.1.5`, and add to its hosting note that a page Content-Security-Policy with `frame-src` must allow the player sites. In `docs/mod_plugin_spec.md`, add a section on showing a tile's body with `ot-tile-body` or `tiles.renderBody`, and on handling clicks yourself with `preventDefault`. Verify the examples in both files use the names in the code.

## 5. Frame loader and theme

- [ ] 5.1 In `sandbox_loader.js`, define `ot-tile-body` and the window click listener of design.md, D9. Add `players.open` to `AnswerMethod` in `sandbox_messages.ts` with a boolean value, and the engine's scripted answer for it. In `sandbox_messages.test.ts`, check the new answer method and that `"yes"` is refused for it. In `sandbox_document.test.ts`, check that check frames hold the element's definition too. Verify the tests pass.
- [ ] 5.2 Add the `button.ot-player` rules of design.md, D10, to `src/lib/core/theme/base_stylesheet.css`, and describe them in `docs/modules/lib/core/theme/README.md`. Verify `npx vitest run src/lib/core/theme` passes, updating any test that pins the stylesheet.

## 6. Player dialog and Settings

- [ ] 6.1 Add `src/main/settings/player_sites.ts` (design.md, D8) with key `opentesela.player-sites`, the reading, writing and failure rules of `site_decisions.ts`, remember, remove, snapshot and subscribe. Write `player_sites.test.ts` first: invalid entries dropped, duplicates kept once, a throwing `setItem`, listeners, and the key not starting with `opentesela.mod-storage:`. Verify the test passes.
- [ ] 6.2 Add `src/main/stage/PlayerDialog.tsx` (design.md, D7) on `StageDialog`, and render it from `StageView` for a shown action of kind `player`, recording on the stage entry when Play was pressed so a dropped player resolves `true`. Write `PlayerDialog.test.tsx` first: "Question before the player" (no frame before Play), "Cancel", the frame's attributes after Play ("Tile asks for the camera"), Close and Escape removing the frame, "Remembered site" skipping the question, and Always play from remembering only when checked. Verify `npx vitest run src/main/stage` passes.
- [ ] 6.3 Create the store in `src/main.tsx`, pass it to `StageView` and `SettingsPage`, and list the hosts in the Mod permissions group after the site decisions, as `play media from <host>` for every mod, with Remove. In `SettingsPage.test.tsx`, cover "Remembered player site" and Remove. Verify `npm test` passes.
- [ ] 6.4 Describe the player dialog in `docs/modules/main/README.md` next to the action dialog, and add the `opentesela.player-sites` row and the group's player rows to `docs/modules/main/settings/README.md`. Verify the docs name the same buttons and checkbox as the component.

## 7. End-to-end

- [ ] 7.1 Add `e2e/tile_bodies.spec.ts` with `test.describe` blocks named after the `tile-bodies` requirements, using a routed collection whose tiles hold a body with a heading, a relative image, a link, a YouTube iframe, a generic iframe, a video with a poster and a mermaid block. Cover: "Show a body with no code" (`ot-tile-body`, `ot-rendered`), "Tile that is not the mod's", "Click on a body link" (action dialog, mod still running), "Mod handles the click itself", "Nothing requested before a click" (a recording route on `www.youtube.com` and `www.youtube-nocookie.com` sees nothing), and "Placeholder shape". Verify `npx playwright test e2e/tile_bodies.spec.ts` passes.
- [ ] 7.2 Add `e2e/media_players.spec.ts`, with the player sites stubbed by `page.route` so no test reaches the network. Cover: "Click on a placeholder" opening the question, "Cancel", "Played and closed", "Escape while playing", "Referrer" (the stub records the header), "Remembered site" across two mods, "Confirmation after a player", "Back while playing", and "Address not from the tiles". Verify `npx playwright test e2e/media_players.spec.ts` passes.
- [ ] 7.3 Extend `e2e/mod_sandbox.spec.ts` with "Image in the body", "Video and poster in the body" and "URL in the body"; `e2e/mod_tests.spec.ts` with "Player answered"; and `e2e/app_settings.spec.ts` with "Remembered player site" and "Asked again after removing". Verify the three files pass with `npx playwright test`.

## 8. Verification

- [ ] 8.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Run `openspec validate add-tile-bodies-and-players --strict` and verify it is valid.
- [ ] 8.2 With network access, open a tile with a YouTube, a Vimeo and a SoundCloud player in desktop Chromium, Firefox and WebKit through the built app, press Play in each, and record in the change which play. Verify each result is written down, and open an issue for any site that does not play.

## 9. Release

- [ ] 9.1 Add `.changeset/add-tile-bodies-and-players.md` with an `"opentesela": patch` bump: the mod API grows from `0.1.4` to `0.1.5` by additions, which is a patch for the app while both are `0.x` (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "Mods can show a tile's body with one element, and play videos and audio from YouTube, Vimeo, SoundCloud or any embedded player in an app dialog after asking you." Verify the file matches the format of the other files in `.changeset/`.

## Workflow follow-up

- Apply and archive `add-site-consent-dialog` before applying this change.
