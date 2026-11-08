# Design

## Context

- Vite copies `public/` into `dist/` without processing it, so `dist/default_mods/` is byte for byte `public/default_mods/` today. The two default mods are plain JavaScript (`mod_explorer/main.js`, 151 lines; `mod_viewer/main.js`, 491 lines) with no `test_path`.
- The engine fetches an entrypoint as text and imports it from a `blob:` URL (`src/lib/core/sandbox/sandbox_loader.js`), and does the same with a test file (`sandbox_test_runner.js`). Relative imports cannot resolve from a `blob:` URL, so each file has to be one self-contained ES module.
- Vite 8.3 bundles with Rolldown, which is already installed as a Vite dependency and compiles TypeScript itself.
- `fetchAppFile` (`src/test/sample_files.ts`) serves `public/` from disk to the unit tests, and `src/main/default_mods.test.ts` loads the default mods through it.
- `e2e/default_mods.spec.ts` (31 tests) tests both mods' UI. The fixture mods it uses (`./test-mods/...`) exist only as Playwright routes (`e2e/mod_routes.ts`).
- The mount data a mod receives is typed in the engine (`ModContext`, `ModInspection`, `ModCheckReport`). The objects a mod calls (`engine`, `t`, the case context) are plain JavaScript in the sandbox scripts and have no types, apart from `sandbox_assertions.d.ts`.
- A case's context has no mod source (see the mod-tests spec, "Case context"), so a case can only name other mods by app-relative references.

## Goals / Non-Goals

**Goals:**
- Use one bundle function, so that dev, build and unit tests serve the same bytes for each default mod file.
- Keep the mods standalone: they import no app code, at type level or at run time.
- Make each default mod's tests pass wherever the app is served.

**Non-Goals:**
- Hot reload of mods. The frame gets its code over the channel, so the user reopens the mod.
- Minifying the default mods. They stay readable, as examples for mod authors.
- Typing `sandbox_loader.js` or `sandbox_test_runner.js`.

## Decisions

### One bundle function, three callers

A module `build/default_mod_build.ts`, included in `tsconfig.node.json`, exports:
- a function that reads one mod folder and returns its served files as a list of `{ path, content }`, or throws an error that names the folder and the file;
- a function that lists the mod folders of `default_mods/`;
- the Vite plugin.

The plugin is a separate file because `vite.config.ts` is already long. The plugin calls the bundle function in two places:
- **Build:** in `generateBundle`, it emits each file as an asset at `default_mods/<name>/<path>`. The e2e instantiation builds (`e2e-home-mod`, `e2e-explorer-off`) get the mods without any extra setup, and Vite's emptying of `dist/` happens before the files are emitted, so no ordering problem arises.
- **Dev:** in `configureServer`, it adds a middleware that is registered before Vite's static handling. The middleware answers `/default_mods/<name>/<path>` from a per-mod cache, or with 404, or with 500 and the error's message. The server's watcher drops a mod's cache entry when a file under that mod's folder changes.

`fetchAppFile` calls the same function, with a per-mod cache, to serve `https://example.org/default_mods/...`. It keeps serving the rest of `public/` from disk.

Alternatives considered:
- A separate `build:mods` script run before or after `vite build`. Vite empties `dist/` first, so the script would have to run after the build, and dev would need a watcher process of its own.
- Generating the output into `public/default_mods/`, either committed or gitignored. A committed output can go stale against its source, and a gitignored one leaves a fresh checkout without mods until something builds them.

### Bundling rules

- **Entry points:** a folder's `src/main.ts` becomes `main.js`, and its `test/test.ts` becomes `test.js`. Each is a separate Rolldown build with ESM output, the browser as platform, ES2023 as target, dynamic imports inlined, no code splitting and no minifying. npm packages are inlined like local modules.
- **Copied files:** every other file, except `src/`, `test/`, `README.md` and `tsconfig.json`, is copied byte for byte, at the same relative path.
- **Plain-mod fallback:** a folder without either entry point is copied unchanged.
- **Conflicts:** an entry point whose output name is also a copied file (`main.js` next to `src/main.ts`) throws before anything is bundled.
- **Boundary:** the bundle fails when a module resolves outside the mod's own folder and `node_modules/`. That makes "mods import no app code" a build rule and not only a lint rule.
- **Output check:** after bundling, an output that still holds an `import` statement or an `import(` call fails the build. This catches a bundler setting that drifts.

The mod folders are the direct subfolders of `default_mods/`. Their files are read with a recursive directory walk. Files at the root of `default_mods/` (`README.md`, `mod_api.d.ts`) are never served.

### Guard against the old folder

When `public/default_mods/` exists, the plugin throws in `configResolved`, naming the old and the new folder. Otherwise Vite would copy the old files, and the plugin would emit the same paths over them, so which version won would depend on Vite's internals.

### Types: standalone `default_mods/mod_api.d.ts`

The file imports nothing. It declares:
- the engine object: `request`, typed through a method map for `mods.inspect`, `mods.open` and `mods.check`, with an untyped fallback for other methods; and `on`;
- the mount context;
- the inspection and the check report;
- the test registration `t` and the case context, including `expect` and `waitFor`.

The mods import it with `import type`, so the import is erased and nothing reaches the bundle.

The guard is a type test in `src/lib/core/engine/mod_api_types.test.ts`. With vitest's `expectTypeOf`, it checks that `ModContext`, `ModInspection` and `ModCheckReport` can be assigned to the declared types. `tsc -b` compiles it under `tsconfig.test.json`, so a shape change in the engine fails the type check.

Alternatives considered:
- Re-exporting the engine's types. The mods' type check would then compile engine files, and the file could not be published by itself later.
- A public types module inside the engine, which the engine itself would use. That changes engine code, beyond this change's scope.

### Type check and lint for the mods

`tsconfig.default_mods.json`, at the root next to `tsconfig.app.json`, `tsconfig.node.json` and `tsconfig.test.json`, is added to the references of `tsconfig.json`. It uses the DOM and ES2023 libs, no `types`, `noEmit`, the same strictness flags as the app, and `include: ["default_mods"]`. A mod folder's own `tsconfig.json` is allowed but optional, and is not shipped.

An `.oxlintrc.json` override for `default_mods/**` forbids imports into the repository's `src/`, `e2e/` and `build/`. The project's conventions, and the lint rules that enforce them, apply to the mods as to the app.

### Moving the tests

| Moves to the mod's `test/` | Stays in `e2e/default_mods.spec.ts` |
|---|---|
| Explorer: cards, alert for a failed inspect, `mods.open` with `viewer` and `target` | Explorer from the default folder; the sandbox value and `parent.document` |
| Viewer: metadata, API range (matching, not matching, missing), no, empty or failing `target`, format error | Vanilla settings and vanilla home |
| Viewer: the `mods.open` of each run choice; the relative collection sent as typed | "Select a mod" making the viewer visible and changing the address; run choices actually opening the mod |
| Look: layout-only stylesheets, the card background, badges, the primary button, using computed styles in the case frame | All "Check mod" scenarios, because a case cannot script `mods.check` |

Two e2e tests are added: checking `mod_explorer` and checking `mod_viewer` through the mod viewer both give "Check passed", with every case passed.

Each moved e2e test is deleted in the same task as the case that replaces it, so no behavior is ever left untested.

### Fixtures shipped with the mods

The cases inspect fixture mods in `default_mods/<name>/fixtures/`, for example `other_api/`, `no_range/` and `bad_theme/`. They name them by app-relative references, such as `./default_mods/mod_viewer/fixtures/other_api/`, because a case has no mod source to resolve against. A missing target is a path under `fixtures/` that does not exist. The explorer's cases replace its config's `mods` with fixtures, so they do not depend on `samples/`.

Alternatives considered:
- Using the app's `samples/`. Instantiations can remove the samples, and the tests have to pass wherever the mod is served.
- Adding the mod's source to the case context. That changes the test API and needs a mod API patch bump, which is out of scope here.

### Docs

- **`docs/mod_plugin_spec.md`, new section "Bundling a mod":** the supported practices, one ESM file per entry point, dependencies inlined, no code splitting, libraries through bundling, `libs.load` or `ot-tile-body`, test files bundled the same way, and HTTP caching.
- **`default_mods/README.md`:** the folder convention, the plain-mod fallback, the files that are not shipped, `fixtures/`, `mod_api.d.ts`, how to run the tests, and how to replace a default mod in the repository or in a built site. It links to the bundling section instead of repeating it.
- **Component docs:** they stay in `docs/modules/mods/<component>/README.md`, with their paths updated, as in `docs/modules/README.md` and `docs/modules/lib/mod/README.md`.
- **`docs/stack.md`:** lists Rolldown.

## Risks / Trade-offs

- [Rolldown's API changes between versions] → Pin the version Vite installs as the direct devDependency, and keep its use inside the bundle function.
- [Shipped cases are tied to the vanilla `./default_mods/` folder setting] → Documented in `default_mods/README.md`. An instantiation that moves the folder sees failing cases, which names the cause. Adding the mod source to the case context would remove the tie later.
- [Fixture mods are public files of every deployment] → They are small YAML files with no code that runs. `default_mods/README.md` says what they are.
- [Bundling in unit tests slows down vitest] → One cached build per mod per test run. Rolldown builds a 500-line mod in milliseconds.
- [The dev cache serves stale bytes if the watcher misses an event] → Reopening after a restart always rebuilds. The cache is a speed-up, never a source of truth.
- [Moving tests could drop coverage] → The table above maps every test, and each move deletes the e2e test only together with its replacement case.
- [Forks that customized `public/default_mods/`] → The guard fails the build with the new location, and the changeset summary says so.

## Migration Plan

1. Add the bundle function, the plugin and the guard, and test the bundle rules with fixture folders under `src/test/fixtures/`.
2. Move both mods to `default_mods/<name>/` as they are (plain JS, copied by the fallback), and remove `public/default_mods/`. The app and every test should behave as before.
3. Add `mod_api.d.ts`, the tsconfig, the lint override and the type guard.
4. Rewrite each mod in TypeScript, keeping all tests green.
5. Add the fixtures and cases, and move the e2e tests one by one.
6. Write the docs and the changeset.

Rollback: revert the change. Nothing is stored or migrated in users' browsers.
