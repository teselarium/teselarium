# Tasks

## 1. Library declarations in the mod file

- [ ] 1.1 In `src/lib/mod/mod_format.ts`, read and check `libraries` as the `mod-loading` requirements "Library declarations in the mod file", "npm libraries name an exact version", "Library files" and "Kind of a library file" describe (design.md, decision 2): the name pattern, shipped names refused, only `npm` and `files`, `<package>@<exact version>` checked with `semver`'s `valid`, paths inside the package, kinds by extension, `.mjs` refused. First write the scenarios of those requirements in `mod_format.test.ts`, with their own fixtures. Verify `npx vitest run src/lib/mod/mod_format.test.ts` passes.
- [ ] 1.2 In `src/lib/mod/mod_loader.ts`, add `npmHost` to `ModLoadOptions` and `libraries: LoadedLibrary[]` to the loaded mod, with each file's `source` resolved as decision 2 describes (an empty list without the key). First add "No libraries key", "npm file" and "File next to the mod" to `mod_loader.test.ts`, plus a structured-clone check that the libraries are plain data. Verify `npx vitest run src/lib/mod` passes.
- [ ] 1.3 Describe the `libraries` key in `docs/modules/lib/mod/README.md`: a row in the key table, the rules for names, `npm`, `files` and kinds, and an example. Verify the example passes the format rules of 1.1 by adding it as a case of `mod_format.test.ts`.

## 2. The npm host

- [ ] 2.1 Add `src/main/library_host.ts` with the vanilla npm host `https://cdn.jsdelivr.net/npm/` (design.md, decision 3). Pass it from `main.tsx` through the stage to every mod load: open, `mods.inspect` and `mods.check`. Verify with a unit test next to the stage or launch code that a loaded mod's npm file sources start with the given host, and with `npx tsc -b`.
- [ ] 2.2 Document the npm host as an instantiation setting in `docs/modules/lib/core/engine/README.md`, next to "Default mod settings", and add `connect-src` for it to the "Hosting note". Verify the documented file name and constant match the code.

## 3. Declared libraries in `libs.load`

- [ ] 3.1 In `src/lib/core/engine/libs_methods.ts`, answer `libs.load` for the requesting mod's declared libraries (design.md, decisions 4 and 5):
  - the version rule, and the extended `-32602` message for unknown names;
  - one fetch per file address per page, all files fetched before answering;
  - `-32001` with the host's short plain-text reason when a file can't be fetched, and a failed file left out of the cache;
  - the answer `{ name, version, files: [{ path, kind, text }] }`.

  Keep the answer for shipped libraries unchanged. First write the scenarios of the `mod-libraries` requirements "Load a declared library", "Version of a declared library", "Declared files are fetched once per page and only when needed", "Declared files that cannot be fetched" and the modified "Unknown libraries and versions" in `libs_methods.test.ts`, with a stubbed `fetch`. Verify `npx vitest run src/lib/core/engine/libs_methods.test.ts` passes.
- [ ] 3.2 In `src/lib/core/sandbox/sandbox_loader.js`, install a declared library's answer as decision 4 describes:
  - scripts in order as classic `blob:` scripts;
  - stylesheets as `<style>` elements inserted after the theme `<style>`, or after the `<meta>` elements with `theme: "none"` (decision 6);
  - the mod's request resolved with `{ name, version, files }` holding only the data files;
  - one promise per library name for declared libraries.

  Verify with the e2e tests of 3.3.
- [ ] 3.3 In `e2e/mod_libraries.spec.ts`, answer `https://cdn.jsdelivr.net/npm/**` with local fixture files through `page.route`, so no test reaches the network. Add `test.describe` blocks named after the new and modified `mod-libraries` requirements: "Load a declared library", "Version of a declared library", "Where declared library files come from" (the frame sends no request for them), "Declared files are fetched once per page and only when needed", "Declared files that cannot be fetched", "A mod's styles win over its libraries'" (with and without the theme) and "Declared libraries need no permission" (a foreign probe with no consent dialog). Keep the mermaid tests passing. Verify `npx playwright test e2e/mod_libraries.spec.ts` passes.
- [ ] 3.4 Rewrite the "Libraries" section of `docs/modules/lib/core/engine/README.md`: shipped and declared libraries, the request and its result, kinds, errors (`-32001` in the error code table for library files too), fetching once per page, and what the npm host sees. Verify the examples' names and messages match the tests of 3.1.

## 4. Inspection and check

- [ ] 4.1 Add `libraries` to the result of `mods.inspect` in `src/lib/core/engine/mod_inspection.ts`, without fetching any library file, and to the inspection type in `default_mods/mod_api.d.ts`. First add "Inspect a mod with a library" to `mod_inspection.test.ts`. Verify `npx vitest run src/lib/core/engine` passes, `mod_api_types.test.ts` included, and `npx tsc -b` passes.
- [ ] 4.2 In `src/lib/core/engine/mod_bundle_check.ts`, fetch every declared library file after the entrypoint through the per-page cache of 3.1, with each failure a `bundle` error whose source is the file's address and whose message carries the host's reason (design.md, decision 8). First add "Missing library file" to `mod_bundle_check.test.ts`, plus a case where the mount check's `libs.load` reuses the cached files. Verify `npx vitest run src/lib/core/engine/mod_bundle_check.test.ts` passes.
- [ ] 4.3 Add "Missing library file" to `e2e/mod_check.spec.ts`, with the npm host routed to a 404 that has jsDelivr's text, and describe library files in the bundle check part of `docs/mod_plugin_spec.md` and the engine README's "Mod check". Verify `npx playwright test e2e/mod_check.spec.ts` passes.

## 5. Mod API version and guides

- [ ] 5.1 Set `MOD_API_VERSION` to `0.1.10` in `src/lib/core/engine/mod_api_version.ts`. Add the `0.1.10` entry to `mod_api_surface.test.ts` with `libraries` among the mod file keys (design.md, decision 9), and update `mod_api_version.test.ts`, the pinned version in `e2e/mod_routes.ts` and the version in the engine README. Verify `npx vitest run src/lib/core/engine` passes.
- [ ] 5.2 Update `docs/mod_plugin_spec.md`:
  - the "Libraries" section gains declared libraries, with an npm example and a files-next-to-the-mod example;
  - "Bundling a mod" becomes "bundle or declare": when to declare, picking a UMD/IIFE build, no ES modules, offline mods vendoring their files;
  - the bullet that says a large library comes only from `libs.load` is updated.

  Update the sentence on scripts from the mod's folder in `docs/modules/lib/core/sandbox/README.md`, which should now point to declared libraries. Verify every `mod_conf.yaml` snippet in these docs passes the format rules of 1.1.

## 6. Release

- [ ] 6.1 Add `.changeset/add-mod-declared-libraries.md` with an `"opentesela": patch` bump. The mod API grows from `0.1.9` to `0.1.10` by additions, which is a patch for the app while both are `0.x` (see the "Bump rule" in `docs/releasing.md`). Use the one-line summary: "Mods can declare the npm libraries and files they use in mod_conf.yaml, and libs.load installs them in the mod's frame from the app's npm host, jsDelivr by default." Verify the file matches the format of the other files in `.changeset/`.

## 7. Verification

- [ ] 7.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`, and verify all pass. Run `openspec validate add-mod-declared-libraries --strict` and verify it is valid.
