# Tasks

## 1. Setup

- [ ] 1.1 Record the current test counts: run `npm test` and `npm run test:e2e` and note the number of passing tests of each, for the check in 5.1
- [ ] 1.2 Add `@changesets/cli` `^3.0.3` as a dev dependency. Verify that `npx changeset --version` prints a `3.x` version and that `node_modules/@changesets/cli/default-files/README.md` exists

## 2. Changesets

- [ ] 2.1 Write `.changeset/config.json` as in design.md ("Changesets is configured by hand"), with the `$schema` naming the installed `@changesets/config` version (`npm ls @changesets/config`), and copy `node_modules/@changesets/cli/default-files/README.md` to `.changeset/README.md`. Verify that `npx changeset status` runs without a config error and reports no changesets
- [ ] 2.2 Add the `changeset` and `version` scripts to `package.json` as in design.md ("Scripts keep the lockfile in step"). Verify that `npm run changeset -- --help` prints Changesets' help, and that `npm run format:check` passes with `.changeset/` in place

## 3. Versions on the Settings page

- [ ] 3.1 In `vite.config.ts`, add `readAppVersion(): string`, which reads `package.json` with `readFileSync` and returns its `version`, throwing an error that names `package.json` when `version` is not a string, and give it to the config as `define: { __APP_VERSION__: JSON.stringify(readAppVersion()) }`. Add `src/main/app_version.ts` with the module-local `declare const __APP_VERSION__: string` and the documented `APP_VERSION` export. Verify that `npm run build` succeeds and that `grep -r "__APP_VERSION__" dist` is empty (the constant is replaced)
- [ ] 3.2 Write the failing tests first, in `src/main/settings/SettingsPage.test.tsx`, for the `app-settings` scenarios "Vanilla versions" and "Version follows the build": at `#/settings`, the group with the heading `Version` comes after Sidebar and its `Versions` list shows `OpenTesela` with the `version` read from `package.json` by `readFileSync`, and `Mod API` with `MOD_API_VERSION`. Verify they fail because there is no Version group
- [ ] 3.3 Add the Version group to `src/main/settings/SettingsPage.tsx` as in design.md ("The Version group is a description list"), with `APP_VERSION` and `MOD_API_VERSION` from the engine's `index.ts`, and update the page's doc comment. Verify that the tests of 3.2 and the rest of `npx vitest run src/main/settings` pass
- [ ] 3.4 In `e2e/app_settings.spec.ts`, add tests for "Vanilla versions" (the shown versions are the `package.json` version, read with `readFileSync`, and `MOD_API_VERSION`'s value, `0.1.2`) and "Copy the versions" (after `selectText()` on the `Versions` list, `getSelection().toString()` contains both versions). Verify that `npx playwright test e2e/app_settings.spec.ts` passes in Chromium, Firefox and WebKit
- [ ] 3.5 Add **Version** to "What the page holds" in `docs/modules/main/settings/README.md`: the two versions, where each comes from (`package.json` when the app was built, `MOD_API_VERSION`), and that they are plain text to copy into a problem report. Verify that the section lists Appearance, Sidebar and Version in the page's order

## 4. Release guide and workflow rule

- [ ] 4.1 Write `docs/releasing.md`: adding a changeset (`npm run changeset`, or `.changeset/<change-name>.md` by hand, with a one-line summary for users and instantiations), applying them (`npm run version`, then restarting a running dev server), tagging (`npx changeset tag`) and pushing the tag (`git push origin v<version>`), and that `npm version` is never used. Add the bump rule section from proposal.md ("Docs"), linking to the "Mod API version" section of the engine's README for when the mod API bumps. Verify that every command it gives runs as written, except the tag and push, which wait for the release
- [ ] 4.2 Link the guide from `docs/README.md`'s index and add Changesets to `docs/stack.md`. In the "Mod API version" section of `docs/modules/lib/core/engine/README.md`, add one sentence saying that a change that bumps the mod API also bumps the app's version, at least as much, with a link to the guide's bump rule. Verify that both links resolve to existing headings
- [ ] 4.3 Add `rules.tasks` to `openspec/config.yaml`, next to `rules.proposal`: every change's `tasks.md` ends with a task that adds `.changeset/<change-name>.md` with the bump that fits the change, following the bump rule of `docs/releasing.md`, and a change that bumps the mod API bumps the app at least as much. Verify that `openspec instructions tasks --change add-app-versioning --json` lists the new rule

## 5. Integration check

- [ ] 5.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify that all pass, with the counts of 1.1 plus only the tests this change added. Run `openspec validate add-app-versioning` and verify that it reports the change as valid

## 6. First release

- [ ] 6.1 Add `.changeset/add-app-versioning.md`: a `minor` bump of `opentesela`, whose summary says that this is the first versioned release and that the Settings page shows the app's version and its mod API version. Verify that `npx changeset status` lists one minor bump, from `0.0.0` to `0.1.0`
- [ ] 6.2 Run `npm run version`. Verify that `package.json` and both versions in `package-lock.json` are `0.1.0`, that `CHANGELOG.md` has a `0.1.0` entry with the summary of 6.1, that `.changeset/` holds only `config.json` and `README.md`, and that `npm run format:check`, `npx vitest run src/main/settings` and `npx playwright test e2e/app_settings.spec.ts` pass and show `0.1.0`

## Workflow follow-up

- The maintainer commits the change, then creates and pushes the tag: `npx changeset tag` and `git push origin v0.1.0` (design.md, Migration Plan).
- Archive the change with `/opsx:archive` once it has been reviewed.
