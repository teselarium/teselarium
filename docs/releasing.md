# Releasing

The app's version is the `version` of `package.json`. The build reads it, and the Settings page shows it next to the mod API version (see the [Settings page](modules/main/settings/README.md)). [Changesets](https://changesets.dev) (`@changesets/cli`) manages it: each piece of work adds a changeset, and a release adds them up into a new version and an entry of `CHANGELOG.md`. Nothing is published to npm.

Changesets owns the version: `npm version` is never used, and `package.json`'s `version` is never edited by hand. (`npm version` would also run the `version` script below as a lifecycle hook.)

## Add a changeset

Each change adds one changeset, a markdown file under `.changeset/` that gives the bump and a one-line summary for the changelog. The summary is written for the people who use the app or instantiate it, not for its maintainers. An OpenSpec change names its changeset after itself, `.changeset/<change-name>.md`, so a pending changeset shows where it comes from and two changes never collide.

Either run:

```sh
npm run changeset
```

which asks for the bump (`patch`, `minor` or `major`) and the summary and writes a changeset with a random name, then rename the file to `<change-name>.md`. Or write the file by hand:

```md
---
"opentesela": patch
---

The mod viewer shows the mod's license.
```

`npx changeset status` lists the pending changesets and the version they add up to.

## Apply the changesets

```sh
npm run version
```

applies every pending changeset: it bumps `package.json` by the highest bump among them, writes their summaries into `CHANGELOG.md`, deletes them, and updates `package-lock.json` to the new version. Review the diff and commit it.

A running dev server keeps the version it started with: restart it after `npm run version`. Builds and tests always read the version fresh.

## Tag the release

On the commit of the new version:

```sh
npx changeset git-tag
git push origin v<version>
```

`npx changeset git-tag` creates the tag `v<version>`, for example `v0.1.0`, and `git push origin v<version>` publishes it.

## Bump rule

Pick the bump of a changeset by what the change means for the people who use the app or instantiate it.

While the app is `0.x`:

- A breaking change for users or instantiations bumps the minor version (`0.1.0` → `0.2.0`).
- Anything else bumps the patch version (`0.1.0` → `0.1.1`).

From `1.0.0` on, semver's usual rule applies: major for a breaking change, minor for a feature, patch for a fix.

A change that bumps the mod API bumps the app at least as much. A breaking mod API change is a breaking change for the app, an addition is a feature, and a fix is a fix:

- While both are `0.x`, a mod API minor bump means an app minor bump, and a mod API patch bump means an app patch bump.
- From `1.0.0` on, a mod API major bump means an app major bump, minor means minor and patch means patch.

When the mod API itself bumps, and by how much, is the rule of the "[Mod API version](modules/lib/core/engine/README.md#mod-api-version)" section of the engine's README.

When several changesets are applied together, Changesets takes the highest bump among them.
