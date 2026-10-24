# Proposal

## Why

Nothing tells which version of the mod API a mod was written for. When the engine API or the mod file format changes, a third-party mod breaks in a way that looks like a bug in the mod, and the person running it cannot know why. Mods cannot tell which OpenTesela they run in either, although `docs/mod_plugin_spec.md` says they can ask for it. A version for the mod API, and a range declared by each mod, give both sides that answer, and are what the later "Check mod" action and mod tests will rely on.

## What Changes

- **Mod API version**: the app has one mod API version, separate from the app's own version in `package.json`. It covers what a mod relies on: the engine methods and events, the mount context and the mod file format. It starts at `0.1.0`.
- **`api` in `mod_conf.yaml`**: an optional semver range, with npm's syntax and matching (e.g. `api: "^0.1.0"`). A value that is not a valid range is a mod format error.
- **Mismatch asks the user**: when a mod's range does not match the app's API version, the app asks before starting it, each time the mod is launched. The dialog shows the mod's title and version, its range and the app's API version. "Run anyway" starts the mod. "Cancel" leaves the sandbox with an error naming both versions, and no mod frame.
- **No range, a warning**: a mod without `api` runs, with a warning in the stage bar's issue list, so existing mods keep working.
- **Mods see the version**: the mount context gets `api` with `version`.
- **`mods.inspect`** also returns the mod's `api` range and whether it matches, and the mod viewer shows both.
- **Sample and default mods** declare `api: "^0.1.0"`.
- **Bump rule and guard**: the docs state how the version changes. While it is `0.x`, a breaking change bumps the minor version and an addition or a fix bumps the patch version. A unit test records the API's surface (method and event names, mount context keys, accepted mod file keys) together with the version, and fails when the surface changes and the version does not. A rule in `openspec/config.yaml` asks every proposal that changes the mod API's specs to state its version bump.

## Capabilities

### New Capabilities

- `mod-api-version`: the app's mod API version, how a mod's range is matched against it, what happens when a mod matches, has no range or does not match (the dialog, run anyway, cancel), the version in the mount context, and the range in `mods.inspect`.

### Modified Capabilities

- `mod-loading`: a new requirement for the optional `api` key of the mod file and its format errors. The loaded mod carries `api`.
- `mod-stage`: "Show the mod issues" lists the missing-range warning first, before the tile collection issues.
- `default-mods`: "Mod viewer" also shows the viewed mod's `api` range and whether it matches.

## Impact

- **Code**:
  - `src/lib/mod/`: read and check `api`. The loaded mod and the inspection carry it.
  - `src/lib/core/engine/`: the API version constant, range matching, `context.api`, the inspection fields and the missing-range issue.
  - `src/lib/core/stage/` and `src/main/stage/`: the mismatch dialog before a mod starts, and the cancel error.
  - `public/default_mods/*/mod_conf.yaml` and `public/samples/mods/book_list/mod_conf.yaml`: `api: "^0.1.0"`. The mod viewer shows the range.
- **Dependencies**: a semver range parser, to be chosen in the design (the `semver` package is the reference for npm's matching).
- **Tests**: unit tests for the format, matching, context and inspection; the API surface guard test; e2e tests for the dialog. The fixture `book_list` mod of `bundle-mod-samples` declares the range too, so this change is applied after that one.
- **Docs**: `docs/mod_plugin_spec.md` (the `api` key), `docs/modules/lib/mod/README.md`, `docs/modules/lib/core/engine/README.md` (the version, `context.api`, the inspection fields, the bump rule) and `docs/modules/mods/viewer/README.md`.
- **Workflow**: `openspec/config.yaml` gets the proposal rule about the API version bump.
- **Mods**: no breaking change. Mods without `api` keep running, with a warning.
- **Out of scope**: remembering the user's answer, versioning the app with Changesets (a later change), a workspace package for the mod API, and the "Check mod" action.
