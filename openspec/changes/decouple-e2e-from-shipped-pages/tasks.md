# Tasks

## 1. Shared page helper

- [x] 1.1 Move `servePage` and `answerMarkdown` from `e2e/app_pages.spec.ts` to `e2e/page_routes.ts`, and import them where used. Verify `npx playwright test e2e/app_pages.spec.ts -g "Replaced page"` passes and `npm run lint` reports nothing

## 2. Tests with their own pages

- [x] 2.1 In `e2e/app_pages.spec.ts`, serve a fixture `home/index` with a heading the test names in the `Pages look like mods`, `Pages are drawn on the canvas`, `Pages keep clear of the hamburger chip` and `Pages keep a reading width` tests, and in `Page load failures`. Verify these tests pass in chromium, with the phone viewport and both color schemes they already cover, and that none reads `public/pages`
- [x] 2.2 In `e2e/app_sidebar.spec.ts` (`Back after switching sections`) and `e2e/mod_stage.spec.ts` (`New section after going back`), serve a fixture Home and assert its heading. Verify both tests pass
- [x] 2.3 In `e2e/default_mods.spec.ts` (`Vanilla home is not a mod`), assert any level 1 heading and no frame. In `e2e/app.spec.ts`, look for the product name heading inside `main`. Verify both pass

## 3. Structural test of the shipped pages

- [x] 3.1 Rewrite the `Vanilla pages` tests of `e2e/app_pages.spec.ts` per the `app-pages` delta: Home, Guides and About each show a level 1 heading, have the current sidebar item, and raise no browser error, with no wording check. Verify they pass, and that changing the text of `public/pages/home/index.md` does not fail them

## 4. Sample mosaic lists

- [x] 4.1 In `e2e/default_mods.spec.ts`, make the Mosaic explorer tests (`Vanilla explorer lists the sample mosaics`, `Only the sample mosaics`, `Vanilla default mosaics`, `Switch turned on behind the explorer`) expect the titles of the mosaics the vanilla catalog lists, read from `src/main/instance_catalog.ts` and the mosaic files. Verify `npm run test:e2e:samples` passes, and that adding a mosaic to the catalog and its file does not fail them

## 5. Release note

- [x] 5.1 Add `.changeset/decouple-e2e-from-shipped-pages.md` with a `patch` bump (the spec changes, the app does not, see "Bump rule" in `docs/releasing.md`) and the summary "The vanilla pages requirement no longer depends on the pages' wording". Verify `npx changeset status` lists it

## 6. Verification

- [x] 6.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`. Verify all pass
