# Tasks

## 1. Resolving function

- [ ] 1.1 Add `src/lib/core/engine/tile_paths.ts` with `resolveTilePaths(tile)` as in design.md: strings starting with `./` or `../` become `new URL(value, tile.source).href`, lists and mappings are rebuilt with resolved items and values and the same keys, other values and a URL that cannot be built stay as written, and `source`, `body` and `types` are copied. Verify with `tile_paths.test.ts` cases named after the spec scenarios "Image next to the tile", "Path to a parent folder", "Strings in lists and nested mappings", "Strings without the marker are left as written", "Values that are not strings and keys are left as written", "Tile picked from the user's computer" and "Body is not resolved", plus one case each for `"./"` alone, ` ./x` with a leading space, the input tile left unchanged (deep-equal to a clone taken before) and a structured clone of the result deep-equal to it.

## 2. Tiles given to mods

- [ ] 2.1 In `selectModTiles` (`src/lib/core/engine/mod_launch.ts`), map the kept tiles through `resolveTilePaths` after validating and filtering, and update its doc comment. Verify in `mod_launch.test.ts` with a collection whose tile has `image: "./cover.jpg"`: `prepareModLaunch`'s `context.tiles` has the absolute URL, the collection's own tile still has `"./cover.jpg"` ("Loaded tile keeps the path as written"), and the existing "Sample mount context" and "Structured clone of the mount context" cases still pass.
- [ ] 2.2 Cover the reload path: add a case to `describe("reloadSandboxTiles")` in `src/lib/core/stage/stage_sandboxes.test.ts` named "Reloaded tiles have their relative paths resolved", checking that the pushed `tiles.changed` params carry the absolute URL. Verify the case passes with no change to `stage_sandboxes.ts` or `mod_session.ts`.
- [ ] 2.3 Cover the check path: add a case to `mod_bundle_check.test.ts` ("Mount check gets the resolved tiles") checking that `bundleCheck.modTiles.tiles` has the absolute URL. Add a case to `stage_checks.test.ts` checking that the context posted to the mount check's frame has it too. Verify both pass, and that the existing `stage_check_cases.test.ts` cases still pass ("Tiles a test passes to mount are used as given" needs no code change).
- [ ] 2.4 Document it: in `docs/modules/lib/core/engine/README.md`, say in the "Mount context" table's `tiles` row and in the "Tiles" section that metadata strings starting with `./` or `../` arrive resolved against the tile's `source` (and are also resolved in `tiles.changed` and in checks, with the loaded tile and the body left as written), and mention it under `selectModTiles` in "Launch". Note under the tile example in `docs/opentesela_spec.md` that `./fahrenheit_451.jpg` reaches mods as an absolute URL. Add an "Images next to tiles" note after "Assets next to the mod" in `docs/modules/lib/core/sandbox/README.md`: the tile's origin is a content host, so a mod can set `img.src` from the metadata as is. Verify each changed paragraph agrees with the `mod-engine-api` delta spec.

## 3. Mod API version 0.1.4

- [ ] 3.1 Bump `MOD_API_VERSION` to `"0.1.4"` in `src/lib/core/engine/mod_api_version.ts`, update the expectation in `mod_api_version.test.ts`, and add a `"0.1.4"` entry to `mod_api_surface.test.ts` equal to the `"0.1.3"` one, leaving older entries alone. Verify `mod_api_version.test.ts` and `mod_api_surface.test.ts` pass.
- [ ] 3.2 Update `APP_MOD_API_VERSION` and its doc comment in `e2e/mod_routes.ts` to `0.1.4`, and the four `0.1.3` mentions in `docs/modules/lib/core/engine/README.md` (the `api` row, the missing-range message example, the "Mod API version" section and `MOD_API_VERSION` under "API version matching"). Verify `grep -rn '0\.1\.3' src e2e docs` finds nothing outside the surface guard's `"0.1.3"` entry.

## 4. End-to-end

- [ ] 4.1 Add an e2e test to `e2e/mod_engine_api.spec.ts` under a new `test.describe("Relative paths in tiles are resolved")`: serve a mod at the app's origin with the sample entrypoint (`SAMPLE_ENTRYPOINT_CODE`), `show_covers: true` and no tile type, and a collection with one tile that has `image: "./cover.svg"` next to a served `cover.svg`. Open it and verify with `readLoadedCovers` that the cover loaded, and that the request went to the URL next to the tile. Run `npx playwright test e2e/mod_engine_api.spec.ts` and verify it passes.
- [ ] 4.2 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify all pass, then run `openspec validate resolve-relative-tile-paths --strict` and verify it is valid.

## 5. Release

- [ ] 5.1 Add `.changeset/resolve-relative-tile-paths.md` with a `"opentesela": patch` bump (the mod API's patch bump, a fix per the "Bump rule" in `docs/releasing.md`) and the one-line summary: "Tile metadata paths starting with `./` or `../`, such as `image: "./cover.jpg"`, reach mods as absolute URLs next to the tile, so images placed beside a tile load." Verify the file matches the format of the other files in `.changeset/`.
