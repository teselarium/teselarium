# Proposal

## Why

A mod author who wants an existing library, such as a map library, has two choices today: set up a bundler so the library ends up inside the one entrypoint, or declare a host-wide `code` permission and load scripts from a CDN by hand. The first makes a plain JavaScript mod need a toolchain. The second trusts a whole host ("all of `cdn.jsdelivr.net`") when the author means one file ("Leaflet 1.9.4"), and nothing in the app can show or check it. The app's own `libs.load` stays a curated exception (mermaid, for tile bodies): OpenTesela is not meant to redistribute libraries.

Mods should be able to name the libraries they use in their mod file, as exact npm versions or files next to the mod, and get them through `libs.load`, which the engine delivers as it already delivers the entrypoint and mermaid. Authoring stays easy, every dependency is explicit, and the frame's content policy does not widen.

## What Changes

- **Library declarations in the mod file**: a new optional `libraries` mapping under `mod`. Each entry names a library and lists its `files`, either from npm, with `npm: "<package>@<exact version>"` and paths inside the package, or next to the mod, with paths resolved against the mod file like `entrypoint`. A version range, a tag, an unknown key, a name the app ships (`mermaid`) or an `.mjs` file is a mod format error.
- **No integrity hashes**: an exact npm version is pinned because npm never replaces a published version. The format has no `integrity` key.
- **Declared libraries through `libs.load`**: `libs.load { name }` loads a library the requesting mod declares, `version` being optional and, when given, the declared version. The engine fetches each file once per page, the npm ones from the app's npm host, which is `https://cdn.jsdelivr.net/npm/` in the vanilla app. A file's extension sets its kind: `.js` is installed as a classic script, `.css` as a stylesheet, and any other file is returned to the mod as text in the result, `{ name, version, files }`. The frame never contacts the npm host, so its content policy is unchanged.
- **Libraries the app ships are unchanged**: `libs.load { name: "mermaid", version: "12" }` works and answers as before.
- **No new consent**: declared libraries need no permission and add no line to the site consent dialog. The engine, not the mod, makes the requests, to a host the instance chose, from a list fixed in the mod file.
- **Visible and checked**: `mods.inspect` lists a mod's declared libraries, and the mod check's bundle step loads every declared file, so a missing package, version or file is a `bundle` error that names it.
- **Mod API version**: `0.1.9` becomes `0.1.10`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-libraries`: libraries can also be declared by the mod; how `libs.load` finds, fetches, installs and returns them; where their files come from; the errors for undeclared names, other versions and files that cannot be fetched.
- `mod-loading`: the mod file format gains `libraries`, with its rules and format errors, and the loaded mod carries the declared libraries.
- `mod-engine-api`: the result of `mods.inspect` also has the mod's declared libraries.
- `mod-check`: the bundle check loads the declared library files.
- `mod-api-version`: the mod API version becomes `0.1.10`.

## Impact

- **Code**:
  - `src/lib/mod/`: reading and checking `libraries` in `mod_format.ts`, and the declared libraries in the loaded mod (`mod_loader.ts`);
  - `src/lib/core/engine/`: `libs_methods.ts` answers declared libraries, fetching each file once per page from the npm host or next to the mod; the inspection (`mod_inspection.ts`) and the bundle check (`mod_bundle_check.ts`) include them;
  - `src/lib/core/sandbox/sandbox_loader.js`: installs a library's scripts in order and its stylesheets, and gives the mod the data files;
  - `src/main/`: the npm host as an instantiation setting, next to the default mod settings.
- **Tests**: unit tests of the format rules, of `libs.load` for declared libraries with a stubbed `fetch`, of the inspection and of the bundle check; e2e tests in `e2e/mod_libraries.spec.ts` that answer `https://cdn.jsdelivr.net/npm/**` with local fixtures, so no test reaches the network.
- **Docs**: the engine README (Libraries, the error of a file that cannot be fetched, the hosting note for pages with their own content policy), the mod module README (the `libraries` key), the mod plugin guide (Libraries, and "Bundling a mod", which becomes "bundle or declare"), and the sandbox README's note on scripts from the mod's folder.
- **Dependencies**: none added. The app reads exact versions with `semver`, which it already uses.
- **Network**: when a mod loads a declared npm library, the app page requests its files from `cdn.jsdelivr.net`, which sees the user's address and the package names, not the mod. An instantiation can point the npm host elsewhere. A page that embeds OpenTesela with its own content policy must allow `connect-src` to the npm host.
- **Mod API version**: patch, `0.1.9` to `0.1.10`. The change adds an optional mod file key, a result key of `mods.inspect` and a wider `libs.load` that still answers the shipped libraries as before, and removes or renames nothing; existing mods keep working, which the "Mod API version" section of the engine's README counts as an addition.
- **App version**: patch bump while the app is `0.x`, as much as the mod API.
- **Out of scope**: ES module libraries (`.mjs`, or ESM-only packages such as Leaflet 2, still in beta); integrity hashes; private npm registries and the registry protocol; stylesheets whose relative `url()` must keep working; a sample that uses declared libraries (the follow-up change `add-sample-country-map`).
