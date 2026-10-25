# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `package.json` is a single private package (`"private": true`, `"version": "0.0.0"`), and `package-lock.json` repeats the version twice. Prettier skips `package-lock.json`, `docs/` and `openspec/`, but not the repository root, so `.changeset/` and `CHANGELOG.md` are formatted.
- `@changesets/cli` 3.0.3 is the latest release. Checked in the published package: it needs Node `^22.11 || ^24 || >=26` (the dev machine has 26) and npm `>=10.9.0`. `@changesets/config` 4 defaults `privatePackages` to `{ version: false, tag: false }`, so a private package is neither versioned nor tagged without the config the proposal gives. `changeset init` is interactive (it asks about the GitHub changelog, commits, access and the base branch). For a root package, `changeset tag` (an alias of `git-tag`) creates `v<version>`. `changeset version` does not touch `package-lock.json`.
- `vite.config.ts` builds the app, the two e2e instantiation builds and Vitest's two projects from one `defineConfig`, so whatever it defines reaches every build and every test.
- `src/main/settings/SettingsPage.tsx` lays out two shadcn `Card`s, Appearance and Sidebar, each with a `CardTitle` given `role="heading"` and `aria-level={2}`. `src/main/` already imports from `../../lib/core/engine/index.ts`, which exports `MOD_API_VERSION`.
- Playwright builds every app it serves at each run (`reuseExistingServer: false`), and runs each test in Chromium, Firefox and WebKit.

## Goals / Non-Goals

**Goals:**
- The app's version has one source, `package.json`, and the build reads it, so the shown version cannot drift from the released one.
- The bump rule lives in one document, the release guide. The engine's README and `openspec/config.yaml` point to it rather than restating it.
- Bumping, tagging and writing the changelog are each one command.

**Non-Goals:**
- Checking that a change adds a changeset. Without CI (out of scope), the `rules.tasks` rule and `npx changeset status` are the guard.
- Changelog entries for the work done before `0.1.0`. The first entry says that it is the first versioned release.
- Showing the version during development as anything other than the version of `package.json` when the dev server started.

## Decisions

### The build defines the app's version as a constant

`vite.config.ts` reads `package.json` with `readFileSync` and gives its `version` to the build through `define`: `__APP_VERSION__` is replaced by the version as a string literal. A small function, `readAppVersion(): string`, reads and returns it, and throws an error naming `package.json` when `version` is not a string. `src/main/app_version.ts` is the only reader:

```ts
declare const __APP_VERSION__: string;

/** The app's version, from `package.json` when the app was built. */
export const APP_VERSION: string = __APP_VERSION__;
```

The `declare const` is local to the module, so no global declaration file or tsconfig change is needed, and the rest of the code imports `APP_VERSION` like any other constant. The same `define` reaches the dev server and Vitest, so tests see the real version.

*Alternatives:* (a) importing `version` from `package.json` in `src/main/`. Rejected: app code would reach outside `src/` for a build file, it needs `resolveJsonModule`, and whether the bundle keeps only `version` depends on JSON tree-shaking. (b) `import.meta.env.APP_VERSION`. Rejected: it needs an `ImportMetaEnv` declaration file for the same effect, and mixes a build constant with environment variables.

### The Version group is a description list

A third `Card` after Sidebar, titled `Version` like the other two (`CardTitle` with `role="heading"` and `aria-level={2}`). Its content is a `<dl aria-label="Versions">` with two rows: `<dt>OpenTesela</dt><dd>{APP_VERSION}</dd>` and `<dt>Mod API</dt><dd>{MOD_API_VERSION}</dd>`, laid out as a two-column grid with Tailwind utilities and the theme's tokens. The versions are plain text with no `select-none`, so a drag or a triple click selects them, and a copy keeps "OpenTesela 0.1.0" and "Mod API 0.1.2" on their own lines.

`SettingsPage` imports both constants directly. They do not change while the app runs, so they are not props or store snapshots.

*Alternatives:* (a) a shadcn `Table`. Rejected: two label-value pairs are a description list, and a table adds a header the group does not need. (b) a "Copy" button. Rejected: the specs ask for selectable text, and a button would need the clipboard permission, which the engines handle differently.

### Tests compare with `package.json`, they never edit it

The scenario "Version follows the build" is met by the build reading `package.json`, not by a test that edits it. A test that rewrote `package.json` to `0.2.0` would change a tracked file and race with other test runs. Instead:

- The component test (`SettingsPage.test.tsx`) reads `package.json` with `readFileSync` and expects the group to show its `version` and `MOD_API_VERSION`.
- The e2e test (`app_settings.spec.ts`) does the same against the vanilla build, which Playwright builds fresh at each run. The shown version therefore comes from the `package.json` of that build.
- The copy scenario selects the `<dl>`'s text with `locator.selectText()` and reads `getSelection().toString()`, which is what a copy takes, without the clipboard API, whose permissions differ between Chromium, Firefox and WebKit.

### Changesets is configured by hand

`.changeset/config.json` is written rather than produced by the interactive `changeset init`. It holds `init`'s defaults with the proposal's choices:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "baseBranch": "main",
  "access": "restricted",
  "format": "auto",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "ignore": [],
  "fixed": [],
  "linked": [],
  "updateInternalDependencies": "patch",
  "privatePackages": { "version": true, "tag": true }
}
```

`.changeset/README.md` is a copy of the one `init` writes (`node_modules/@changesets/cli/default-files/README.md`). `format: "auto"` formats the changeset files and `CHANGELOG.md` with the repository's Prettier, so `npm run format:check` stays green. `commit: false` keeps commits with the maintainer, as the code conventions require.

### Scripts keep the lockfile in step

```json
"changeset": "changeset",
"version": "changeset version && npm install --package-lock-only"
```

`npm run changeset` runs `changeset add`, the default command. `npm run version` applies the changesets, then has npm write the new version into `package-lock.json`, which Changesets leaves at the old one. The script is named `version`, as the proposal says, which is also an npm lifecycle name (see Risks).

### A changeset is named after its change

Each OpenSpec change's changeset is `.changeset/<change-name>.md`, written by hand or with `npm run changeset`, then renamed. A pending changeset then shows which change it comes from, and two changes never collide. Its summary is one line for the changelog, written for the people who use or instantiate the app. The `rules.tasks` rule asks for it.

### The bump rule lives in the release guide

`docs/releasing.md` holds the release steps and the bump rule from the proposal: the app's own `0.x` and `1.0.0` rules, and "a change that bumps the mod API bumps the app at least as much", mapped by meaning (breaking, addition, fix), so it still holds if one version leaves `0.x` before the other. When several changesets are applied together, Changesets takes the highest bump, which is what the rule needs.

The engine README's "Mod API version" section keeps its own rule for the mod API and gets one sentence linking to the guide's bump rule. The `rules.tasks` entry in `openspec/config.yaml` points to the guide. `docs/README.md` lists the guide, and `docs/stack.md` lists Changesets.

*Alternative:* the app's rule in the engine README next to the mod API's. Rejected: the engine README is about the engine, and the app's version covers the whole app.

### The first release is applied in this change

This change's own changeset, `.changeset/add-app-versioning.md`, is a `minor` bump whose summary says that it is the first versioned release and that the Settings page shows both versions. Its last task runs `npm run version`, so the change ends with `package.json` at `0.1.0`, a `CHANGELOG.md` and no pending changeset. Creating the `v0.1.0` tag needs the commit, so it is left to the maintainer (see Migration Plan).

## Risks / Trade-offs

- [The `version` script also runs as a lifecycle hook during `npm version`] → The release guide says that Changesets owns the version and that `npm version` is never used. With `"private": true` there is no `npm publish` to pair it with.
- [A change forgets its changeset, and its work reaches the changelog unnamed or not at all] → The `rules.tasks` rule puts it in every change's tasks, and `npx changeset status` lists the pending changesets before a release.
- [The dev server keeps the version it started with] → `define` is read when the config loads. The release guide says to restart the dev server after `npm run version`, and builds and tests always read it fresh.
- [Changesets 3 changes its config or defaults in a later minor] → The dependency is `^3.0.3`, and the config's `$schema` names the `@changesets/config` version it was written for.

## Migration Plan

After this change is applied and reviewed:

1. The maintainer commits the change, including `package.json` at `0.1.0` and `CHANGELOG.md`.
2. `npx changeset tag` creates `v0.1.0` on that commit, and `git push origin v0.1.0` publishes it.

Rollback: delete the tag (`git tag -d v0.1.0`, `git push origin :refs/tags/v0.1.0`) and revert the commit. Nothing is published to npm, so no registry needs cleaning.
