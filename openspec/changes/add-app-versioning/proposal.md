# Proposal

## Why

The app has no version: `package.json` says `0.0.0`, there are no tags and no changelog, and nothing in the app says which build is running. Someone reporting a problem with a mod cannot say which OpenTesela they run, and a maintainer cannot tell what changed between two builds. The mod API now has its own version (`add-mod-api-version`), but people only see it in the mismatch dialog and the mod viewer. A simple, recorded way to bump the app's version, and one place in the app that shows both versions, closes that gap.

This change builds on `add-mod-api-version`, whose version the Settings page shows.

## What Changes

- **Changesets** (`@changesets/cli` 3, a dev dependency) manages the app's version in this single-package repository. Each piece of work adds a changeset: a small markdown file under `.changeset/` that gives the bump (`patch`, `minor` or `major`) and a line for the changelog. `npm run version` adds them up, bumps `package.json` and writes `CHANGELOG.md`. `npx changeset tag` tags the release as `v<version>`. Nothing is published.
- **Config**: `.changeset/config.json` with the default changelog generator, which needs no GitHub token, `baseBranch: "main"`, and `privatePackages: { version: true, tag: true }`, because the app is a private package that Changesets 3 would otherwise not version.
- **Scripts**: `npm run changeset` adds a changeset and `npm run version` applies them.
- **First release**: the first changeset is a minor bump, so the app's first version is `0.1.0`.
- **Settings shows the versions**: a Version group on the Settings page shows the app's version and the app's mod API version. The app's version is read from `package.json` when the app is built.
- **Workflow**: a rule in `openspec/config.yaml` that every change's `tasks.md` ends with adding a changeset with the bump that fits the change.
- **Docs**: a release guide (add a changeset, apply them, tag, push the tag) and the bump rule for the app while it is `0.x`: a breaking change for users or instantiations bumps the minor version, anything else the patch version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-settings`: a new requirement for the Version group on the Settings page.

## Impact

- **Code**: `vite.config.ts` gives the build the app's version from `package.json`. The Settings page in `src/main/` gets the Version group, reading the mod API version from the engine.
- **Repository**: `.changeset/config.json`, `.changeset/README.md`, `CHANGELOG.md` (written by the first `npm run version`), and the scripts in `package.json`.
- **Dependencies added**: `@changesets/cli` (dev).
- **Tests**: a component test and an e2e test for the Version group, and a check that the shown app version is the one in `package.json`.
- **Docs**: a release guide in `docs/`, and `docs/modules/main/README.md` for the Version group.
- **Workflow**: `openspec/config.yaml` gets the changeset rule for tasks.
- **Mods**: no change.
- **Out of scope**: a CI workflow, publishing to npm, the workspace restructure for a mod API package, release notes on GitHub, and showing versions anywhere other than Settings.
