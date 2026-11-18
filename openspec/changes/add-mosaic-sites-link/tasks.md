# Tasks

## 1. Prerequisite

- [ ] 1.1 Check that `add-app-catalog` is applied (mod API `0.1.15` in `mod_api_version.ts`), and that this change's `mod-api-version` delta starts from that text. Verify with `openspec validate add-mosaic-sites-link --strict`.

## 2. Run links and the reserved name

- [ ] 2.1 Add `sites` to `RunLink`, to `run_links.ts` parsing and building (after `collection` and `tile`, empty means none), and to `RUN_LINK_RESERVED_NAMES`. Verify with `run_links.test.ts` (parse, build, round trip, not in `params`), and with `mods_methods.test.ts` and `mosaics_methods.test.ts` cases for both "Sites is a reserved parameter" scenarios.
- [ ] 2.2 Add `sites` to the mosaic link conflict check and its error text. Verify with `mod_launch.test.ts` for "Mosaic and sites" and the updated "Mosaic and mod" text, with no file requested.

## 3. Launch and grants

- [ ] 3.1 Add `loadLaunchSites` and `role` on `LaunchMosaicGrants`. Grant the `sites` mosaic's `show` lines through `grantLaunchMosaic`, with `context.mosaic`, config, aliases and the storage slot left as for a mod link. Verify with `mod_launch.test.ts` for "Covers kept for another mod" (`params` is `{}`, `mosaic` is `null`), "Covers of the books' mosaic for Flashcards" and "Other mod with sites".
- [ ] 3.2 Turn a `sites` mosaic that cannot be loaded or parsed into a warning issue, and continue the launch. Verify with a launch test and a stage test for "Missing sites mosaic" (the mod runs, and a warning labeled "App" names the mosaic file's address and `404`).
- [ ] 3.3 Report refused `sites` lines, hint blocked requests with the mosaic file, and ask consent for a foreign `sites` mosaic in the mosaic group, with decisions remembered per mosaic file. Verify with stage tests for "Refused line of a foreign sites mosaic", "Remembered from the mosaic" and "Asked once for a new mosaic".

## 4. Version and docs

- [ ] 4.1 Bump `MOD_API_VERSION` to `0.1.16`, add the surface guard's `0.1.16` entry (same names as `0.1.15`), and update the version tests. Verify that `npm run test` passes the surface guard and the version tests.
- [ ] 4.2 Document `sites`:
  - engine README: run link fields, reserved names, and a `0.1.16` version note saying it's taken as a patch;
  - stage README: "Run links";
  - mosaic module README: where a mosaic's `show` lines apply.

  Verify that each README names `sites` and that the version note matches the proposal.

## 5. End-to-end

- [ ] 5.1 Add e2e tests:
  - `e2e/mod_sandbox.spec.ts`: a `sites` link from the app's origin (Flashcards with the books, and `https://covers.openlibrary.org` covers load);
  - `e2e/site_consent.spec.ts`: a foreign `sites` mosaic (dialog group, remembered decision applied to another mod);
  - `e2e/mod_stage.spec.ts`: "Shared link after a reload" and "Missing sites mosaic".

  Verify that they pass with `npm run test:e2e`.

## 6. Release note

- [ ] 6.1 Add `.changeset/add-mosaic-sites-link.md` with a `patch` bump for `opentesela`: the mod API patch `0.1.16` means an app patch. Its summary: "Run links can name a mosaic as `sites` to give another mod that mosaic's show permissions, so the collection's images still load (mod API 0.1.16)." Verify that the file follows the format of the other changesets.

## 7. Verification

- [ ] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and, because the change touches the mod API specs, `npm run test:e2e:samples`. Verify that each passes.
