# Proposal

## Why

The default mods are plain JavaScript files in `public/`, which Vite copies unchanged. So they get no type checking, and the mod explorer and mod viewer have no tests of their own: their behavior is tested only by e2e tests of the vanilla UI. Mod authors who want TypeScript and tests that ship with the mod have no example in the project, and neither do contributors. This change makes the default mods that example. It is also the first step towards default mods that can be replaced without breaking anything.

## What Changes

- The default mods' source moves from `public/default_mods/<name>/` to a top-level `default_mods/<name>/` folder. `public/default_mods/` is removed. The app still serves the mods at `./default_mods/<name>/`, and the built site still has them in `dist/default_mods/<name>/`.
- A Vite plugin builds the default mods with Rolldown, using one bundle function for `vite build`, for the dev server and for the unit tests:
  - a mod folder's `src/main.ts` becomes `main.js` and its `test/test.ts` becomes `test.js`, each one self-contained ES module;
  - every other file is copied unchanged, except `src/`, `test/`, `README.md` and `tsconfig.json`, which are not shipped;
  - a folder without TypeScript source is copied unchanged, so a plain JavaScript mod can be dropped into `default_mods/<name>/`;
  - a TypeScript source next to a hand-written file with the same output name fails the build with an error that names both files.
- `mod_explorer` and `mod_viewer` are rewritten in TypeScript, with the same behavior.
- Each of them declares `test_path` and ships test cases that `mods.check` runs. These cases take over the behavior tests of `e2e/default_mods.spec.ts` that a case can express. The e2e tests keep what a case cannot see: slot resolution, the sandbox, the stage, and the viewer's "Check mod".
- A standalone `default_mods/mod_api.d.ts` types the parts of the mod API that the two mods use. A compile-time test guards it against the engine's own types. The mods get their own tsconfig, and a lint rule forbids them from importing app code.
- Docs: a "Bundling a mod" section in the mod guide, a `default_mods/README.md` for the folder's rules, and updated paths in the module docs.

## Capabilities

### New Capabilities
- `default-mod-build`: how the app's build turns the default mods folder into the mods it serves: TypeScript bundling, the plain-mod fallback, files that are not shipped, and the same output in dev and build.

### Modified Capabilities
- `default-mods`: the default mods ship their own tests, which pass when each default mod is checked.

## Impact

- **Mod API version: no bump.** No engine method, event, mount context key, mod file key or test API changes. The default mods only add `test_path`, which the mod file format already accepts.
- **App version: patch.** For people who use the app, nothing changes. For instantiations, the deployed `default_mods/` layout is the same, so replacing a default mod in a built site works as before. Only the folder in the repository moves, and a fork that still has `public/default_mods/` gets a build error that says where the folder went.
- Code: a new Vite plugin in `vite.config.ts` or next to it; `src/test/sample_files.ts` (`fetchAppFile`); `tsconfig.json` with a new tsconfig for the mods; `.oxlintrc.json`; `e2e/default_mods.spec.ts` and the e2e specs that use the default mods; `src/main/default_mods.test.ts`.
- Dependencies: `rolldown` becomes a direct devDependency, with the version that Vite 8 already installs.
- Docs: `docs/mod_plugin_spec.md`, the new `default_mods/README.md`, `docs/modules/README.md`, `docs/modules/lib/mod/README.md`, `docs/modules/mods/explorer/README.md`, `docs/modules/mods/viewer/README.md`, `docs/stack.md`.
- Out of scope: contracts between the default mod slots, end-user overrides of default mods, publishing the mod API types, typing the sandbox scripts, and scripting `mods.check` answers in tests.
