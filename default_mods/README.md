# Default mods

This folder holds the source of the default mods: the mods the app ships, the mod explorer, the mod viewer, the collection explorer and the collection viewer. Each one is an ordinary sandboxed mod that uses only the engine API (see the [mod guide](../docs/mod_plugin_spec.md)). What each mod does is described in its component doc: [mod explorer](../docs/modules/mods/explorer/README.md), [mod viewer](../docs/modules/mods/viewer/README.md), and [collection explorer and collection viewer](../docs/modules/tiles/explorer/README.md).

## The folder convention

Each subfolder is one mod, named after the mod: `default_mods/mod_viewer/` holds the mod `mod_viewer`. The app serves it at `./default_mods/mod_viewer/`, both in the dev server (`npm run dev`) and in the built site, which has it in `dist/default_mods/mod_viewer/`. The files at the root of this folder, like this README, are not mods and are not served.

The build turns each mod folder into the files it serves (`build/default_mod_build.ts`, run by the Vite plugin in `build/default_mods_plugin.ts`):

| In the mod folder                             | Served as                                      |
| --------------------------------------------- | ---------------------------------------------- |
| `src/main.ts` and the modules it imports      | `main.js`, one self-contained ES module        |
| `test/test.ts` and the modules it imports     | `test.js`, one self-contained ES module        |
| `src/`, `test/`, `README.md`, `tsconfig.json` | not served                                     |
| any other file, such as `mod_conf.yaml`       | the same file, byte for byte, at the same path |

A mod's code may import its own files and npm packages, never a file outside its folder: the build fails when it does. Why each entry point is one self-contained file, and how to bundle a mod of your own, is in [Bundling a mod](../docs/mod_plugin_spec.md#bundling-a-mod). The dev server builds a mod's files when they are requested, and builds them again after a file of the mod's folder changes, so reopening the mod runs the changed code without a restart.

When a mod folder has `src/main.ts` and also a hand-written `main.js`, or `test/test.ts` and also a `test.js`, the build fails with an error that names both files: keep one of them.

## Plain mods

A folder without `src/main.ts` and without `test/test.ts` is copied as it is, apart from the files that are not served. So a plain JavaScript mod, a `mod_conf.yaml` with a hand-written `main.js`, needs no build setup of its own.

## Types, type check and lint

The mods' TypeScript is typed with [`mod_api.d.ts`](mod_api.d.ts), at the root of this folder: the engine object (`request`, typed for `mods.inspect`, `mods.open`, `mods.check` and `collections.inspect`, and `on`), the mount context, the inspection, the collection inspection, the check report, and the test registration `t` with the case context. A mod imports it with `import type`, for example `import type { ModEngine } from "../../mod_api.d.ts";`, so nothing of it reaches the bundle. The file imports nothing, not even the engine's types, so a mod stays standalone. A type test, [`src/lib/core/engine/mod_api_types.test.ts`](../src/lib/core/engine/mod_api_types.test.ts), checks that the engine's mount context, inspection, collection index and check report still fit these declarations, so a change on either side fails `tsc -b`.

[`tsconfig.default_mods.json`](../tsconfig.default_mods.json), at the repository's root and referenced by `tsconfig.json`, type-checks this folder with `tsc -b` (and so with `npm run build`): the DOM and ES2023 libraries, no `types`, and the app's strictness. A mod folder may have its own `tsconfig.json`, for an editor; it is optional and not served.

The project's conventions ([docs/code_conventions.md](../docs/code_conventions.md)) and the lint rules that enforce them apply to the mods as to the app. In [`.oxlintrc.json`](../.oxlintrc.json), an override for `default_mods/**` also forbids imports into the repository's `src/`, `e2e/` and `build/`, so `npm run lint` fails before the build does.

## Tests

Each default mod declares `test_path: "./test.js"` and ships its test cases, built from `test/test.ts`. They are ordinary mod tests (see [Mod tests](../docs/mod_plugin_spec.md#mod-tests)): `mods.check` runs them in hidden frames, each case mounting the mod with its own config or `target` parameter and answering `mods.open` with `null`, so a case opens nothing. They check what the mod draws, the requests it sends and its look: [mod explorer](mod_explorer/test/test.ts), [mod viewer](mod_viewer/test/test.ts), [collection explorer](collection_explorer/test/test.ts), [collection viewer](collection_viewer/test/test.ts). What a case cannot see, such as the sandbox, the stage and the viewer's "Check mod", is tested by `e2e/default_mods.spec.ts`.

To run a default mod's tests, check it in the mod viewer: open `#/run?mod=mod_viewer&target=mod_viewer` (or `target=mod_explorer`, `target=collection_explorer`, `target=collection_viewer`), in `npm run dev` or in a built site, and press "Check mod". The report lists each case. `npm run test:e2e` does the same in "Default mods ship their tests", and fails when a case fails.

### Fixtures

The mods and collections a case inspects are fixtures in the default mod's `fixtures/` folder, for example `mod_viewer/fixtures/other_api/`, small `mod_conf.yaml` files with no code, which only `mods.inspect` reads, or `collection_viewer/fixtures/shown_collection.yaml`, a collection file which only `collections.inspect` reads, with its tiles beside it. They are served with the mod, at `./default_mods/mod_viewer/fixtures/other_api/mod_conf.yaml`, so they are public files of every site that ships the mod. The explorers' configs list only the mods and collections they are meant to show, so the vanilla mod explorer and the vanilla collection explorer never list a fixture.

A case names a fixture by its address in the default mods folder, such as `./default_mods/mod_viewer/fixtures/other_api`, because a case has no mod source to resolve a path against. So the cases pass wherever the app is served and whatever samples it ships, but only while the default mods folder is the vanilla `./default_mods/` (the default mod settings in `src/main/default_mods.ts`). An instantiation that moves the folder sees the cases that inspect a fixture fail, each with the error of the missing fixture.

## Replacing a default mod

- **In the repository:** replace the contents of the mod's folder, for example `default_mods/mod_viewer/`, with your mod. A plain JavaScript mod works as it is. If you keep a hand-written `main.js`, remove `src/main.ts`, and remove `test/test.ts` if you keep a `test.js`.
- **In a built site:** replace the files of the mod's folder in the deployed site, for example `default_mods/mod_viewer/`. The built site serves them as static files.

The app opens a default mod by its name, `mod_viewer`, at `./default_mods/mod_viewer/mod_conf.yaml`, so the replacement keeps the folder's name. The default mods folder and the switched-off mods are the default mod settings in `src/main/default_mods.ts` (see [Default mods](../docs/modules/README.md)).
