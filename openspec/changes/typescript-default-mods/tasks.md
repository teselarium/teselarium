# Tasks

## 1. Bundle function

- [ ] 1.1 Add `rolldown` as a direct devDependency at the version Vite already installs, and verify that `npm ls rolldown` shows one version
- [ ] 1.2 Write failing tests for the bundle function with fixture mod folders under `src/test/fixtures/default_mods/`. Cover: split `src/main.ts` to one `main.js`, split `test/test.ts` to one `test.js`, files that are not shipped, copied files byte for byte, the plain-mod fallback, the `main.js`/`test.js` conflict error, a syntax error, an import outside the mod folder, and a dynamic import inlined. Verify that they fail for the missing module
- [ ] 1.3 Implement the bundle function and the mod folder listing in `build/default_mod_build.ts`, include `build/` in `tsconfig.node.json`, and verify that the tests of 1.2 pass and that `tsc -b` passes

## 2. Vite plugin and the move out of public/

- [ ] 2.1 Add the plugin: emit the files in `generateBundle`, serve them in dev with the middleware and the watcher-invalidated cache, and throw on `public/default_mods/` in `configResolved`. Verify with plugin tests for the old-folder error and for dev answers of 200, 404 and 500 with the message
- [ ] 2.2 Move `public/default_mods/mod_explorer/` and `mod_viewer/` unchanged to `default_mods/`, and delete `public/default_mods/`. Verify that `npm run build` gives a `dist/default_mods/` with the same bytes as before the move
- [ ] 2.3 Make `fetchAppFile` serve `https://example.org/default_mods/...` through the cached bundle function. Verify that `src/main/default_mods.test.ts` and the rest of `npm test` pass
- [ ] 2.4 Verify that `npm run test:e2e` passes unchanged, including the e2e instantiation builds, and that `npm run dev` serves `/default_mods/mod_explorer/main.js`
- [ ] 2.5 Write `default_mods/README.md` (folder convention, plain-mod fallback, files that are not shipped, how to replace a default mod in the repository or in a built site), and update the `public/default_mods/` paths in `docs/modules/README.md`, `docs/modules/lib/mod/README.md` and `docs/modules/mods/{explorer,viewer}/README.md`. Verify with `grep -rn "public/default_mods" docs default_mods src e2e` finding nothing

## 3. Types, type check and lint

- [ ] 3.1 Add `default_mods/mod_api.d.ts` with the engine object, the mount context, the inspection, the check report, `t` and the case context, and verify that it has no `import`
- [ ] 3.2 Add `tsconfig.default_mods.json` and reference it from `tsconfig.json`. Verify that `tsc -b` type-checks `default_mods/` by adding a temporary type error, then removing it
- [ ] 3.3 Add the type guard `src/lib/core/engine/mod_api_types.test.ts` that checks `ModContext`, `ModInspection` and `ModCheckReport` can be assigned to the declared types. Verify that `tsc -b` fails when a declared field is renamed, then restore it
- [ ] 3.4 Add the `.oxlintrc.json` override for `default_mods/**` that forbids imports into `src/`, `e2e/` and `build/`. Verify that `npm run lint` fails on a temporary forbidden import and passes without it
- [ ] 3.5 Document `mod_api.d.ts`, the tsconfig and the import rule in `default_mods/README.md`, and verify that the README's paths exist

## 4. Mod explorer in TypeScript with its tests

- [ ] 4.1 Rewrite `mod_explorer` as `src/main.ts` plus modules split by concern, following `docs/code_conventions.md`. Verify that `npm run lint`, `tsc -b` and every explorer test of `e2e/default_mods.spec.ts` pass
- [ ] 4.2 Add the explorer's fixtures in `default_mods/mod_explorer/fixtures/`, its `test/test.ts` cases (cards, alert for a failed inspect, `mods.open` with `viewer` and `target`, layout-only styles, card background), and `test_path: "./test.js"`. In the same step, delete the e2e tests the cases replace. Verify that checking `mod_explorer` in the mod viewer gives "Check passed" with every case passed
- [ ] 4.3 Add the e2e test "Explorer passes its check", and verify that it passes and fails when a case is broken on purpose

## 5. Mod viewer in TypeScript with its tests

- [ ] 5.1 Rewrite `mod_viewer` as `src/main.ts` plus modules split by concern, following `docs/code_conventions.md`. Verify that `npm run lint`, `tsc -b` and every viewer test of the e2e suite pass, including the "Check mod" tests
- [ ] 5.2 Add the viewer's fixtures in `default_mods/mod_viewer/fixtures/` (for example `listed_mod/`, `other_api/`, `no_range/`, `bad_theme/`), its `test/test.ts` cases (metadata, API range three ways, no, empty or failing `target`, format error, the `mods.open` of each run choice, badges, primary button, layout-only styles), and `test_path: "./test.js"`. In the same step, delete the e2e tests the cases replace, following the table in design.md. Verify that checking `mod_viewer` gives "Check passed" with every case passed
- [ ] 5.3 Add the e2e tests "Viewer passes its check" and "Cases without the samples" (the samples routed to 404), and verify that both pass
- [ ] 5.4 Document `fixtures/`, how to run a default mod's tests, and the tie to the vanilla `./default_mods/` folder in `default_mods/README.md`. Update `docs/modules/mods/{explorer,viewer}/README.md` to say where each mod's tests live, and verify that the links resolve

## 6. Guide for mod authors

- [ ] 6.1 Add the "Bundling a mod" section to `docs/mod_plugin_spec.md` (one ESM file per entry point, dependencies inlined, no code splitting, libraries through bundling, `libs.load` or `ot-tile-body`, test files bundled the same way, HTTP caching), with the default mods as the worked example. Link it from `default_mods/README.md`, list Rolldown in `docs/stack.md`, and verify that the links resolve

## 7. Integration and release

- [ ] 7.1 Run `npm run lint`, `npm run format:check`, `tsc -b`, `npm test`, `npm run build` and `npm run test:e2e`, and verify that all pass
- [ ] 7.2 Add `.changeset/typescript-default-mods.md` with a `patch` bump and the summary: "The default mods are built from TypeScript in `default_mods/` at the repository's root and ship their own tests; built sites serve them at the same addresses." Verify that `npx changeset status` lists it
