# Proposal

## Why

The app has no version: `package.json` says `0.0.0`, there are no tags and no changelog, and nothing in the app says which build is running. Someone reporting a problem with a mod cannot say which OpenTesela they run, and a maintainer cannot tell what changed between two builds. The mod API has its own version (`MOD_API_VERSION`, see the `mod-api-version` spec), but people only see it in the mismatch dialog and the mod viewer. A simple, recorded way to bump the app's version, and one place in the app that shows both versions, closes that gap.

The two versions stay separate, as the `mod-api-version` spec requires, but a change that bumps the mod API also bumps the app, at least as much.

## What Changes

- **Changesets** (`@changesets/cli` 3, a dev dependency) manages the app's version in this single-package repository. Each piece of work adds a changeset: a small markdown file under `.changeset/` that gives the bump (`patch`, `minor` or `major`) and a line for the changelog. `npm run version` adds them up, bumps `package.json` and writes `CHANGELOG.md`. `npx changeset tag` tags the release as `v<version>`. Nothing is published.
- **Config**: `.changeset/config.json` with the default changelog generator, which needs no GitHub token, `baseBranch: "main"`, and `privatePackages: { version: true, tag: true }`, because the app is a private package that Changesets 3 would otherwise not version.
- **Scripts**: `npm run changeset` adds a changeset and `npm run version` applies them.
- **First release**: the first changeset is a minor bump, so the app's first version is `0.1.0`.
- **Settings shows the versions**: a Version group on the Settings page shows the app's version and the app's mod API version. The app's version is read from `package.json` when the app is built.
- **Workflow**: a rule under `rules.tasks` in `openspec/config.yaml`, next to the `rules.proposal` rule for the mod API bump: every change's `tasks.md` ends with adding a changeset with the bump that fits the change, and a change that bumps the mod API bumps the app at least as much, as the release guide says.
- **Docs**: a release guide (add a changeset, apply them, tag, push the tag) with the app's bump rule:
  - While the app is `0.x`, a breaking change for users or instantiations bumps the minor version, anything else the patch version.
  - From `1.0.0` on, semver's usual rule applies: major for a breaking change, minor for a feature, patch for a fix.
  - A change that bumps the mod API bumps the app at least as much: a breaking mod API change is a breaking change for the app, an addition is a feature, and a fix is a fix. While both are `0.x`, a mod API minor bump means an app minor bump and a patch means a patch. From `1.0.0` on, major means major, minor means minor and patch means patch.

  For when the mod API itself bumps, the guide links to the "Mod API version" section of the engine's README rather than restating it, and that section links back to the guide.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-settings`: a new requirement for the Version group on the Settings page.

## Impact

- **Code**: `vite.config.ts` gives the build the app's version from `package.json`. The Settings page in `src/main/` gets the Version group, reading `MOD_API_VERSION` from the engine's entry point.
- **Repository**: `.changeset/config.json`, `.changeset/README.md`, `CHANGELOG.md` (written by the first `npm run version`), and the scripts in `package.json`.
- **Dependencies added**: `@changesets/cli` (dev).
- **Tests**: a component test and an e2e test for the Version group, and a check that the shown app version is the one in `package.json`.
- **Docs**: a release guide in `docs/`, `docs/modules/main/settings/README.md` for the Version group, and a link from the "Mod API version" section of `docs/modules/lib/core/engine/README.md` to the guide's bump rule.
- **Workflow**: `openspec/config.yaml` gets the changeset rule under `rules.tasks`.
- **Mods**: no change, and no mod API bump: the change does not touch the mod API's specs.
- **Out of scope**: a CI workflow, publishing to npm, the workspace restructure for a mod API package, release notes on GitHub, and showing versions anywhere other than Settings.
