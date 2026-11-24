# Proposal

## Why

The project is renamed from OpenTesela to Teselarium while it is still private and has no users, so the rename costs no migration and no compatibility layer. Doing it now avoids carrying the old name into the first public release.

## What Changes

- Rename the project name in every live file with one reviewable, dry-runnable script, so the rename needs no per-file reading or editing:
  - `OpenTesela` becomes `Teselarium`, and `opentesela` becomes `teselarium` (prose, `package.json` name, the Vite plugin names, `index.html` title, docs).
  - The short prefix `ot` becomes `tes`: `--ot-*` CSS variables, `ot-*` classes and custom elements, `data-ot-*` attributes and their `dataset.ot*` forms, and the uppercase tag names tests compare against (`OT-TILE-BODY`).
  - Names in shared namespaces rename in place: storage keys (`opentesela.theme-choice`), the browser file URL scheme (`opentesela-browser:` becomes `teselarium-browser:`), the IndexedDB name, and the custom icon names (`lucide-opentesela-mosaic`).
- Rename `docs/opentesela_spec.md` to `docs/teselarium_spec.md`, and fix the links to the nonexistent `tesela_spec.md`.
- Update the "Prefixes" convention in `docs/code_conventions.md` to `teselarium.`, `teselarium-` and `tes-`.
- Leave the history alone: `openspec/changes/archive/`, `openspec/discarded-changes/`, `.changeset/` entries and `CHANGELOG.md` keep the old name, because they record what was true when they were written. Third-party files (`e2e/npm_files/`, `node_modules/`) are never touched.
- **BREAKING** for mods: the theme variables, the `data-ot-*` attributes, the `ot-*` classes and the `opentesela-browser:` address scheme are part of what a mod relies on. The mod API version goes from `0.1.19` to `0.2.0`, and the shipped and sample mods and the test mod ranges follow.
- No migration for stored data: the renamed storage keys and the renamed database start empty. Nothing is read from the old names.
- Out of scope: renaming the GitHub repository and the `origin` remote (the user does it), and any visual or behavioral change. The UI looks and works the same on a phone viewport and in both color schemes; the existing e2e tests for both prove it, so the change adds no new layout or color tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

Each capability below restates the requirements that name the project, use the `ot` prefix, or name a mod API range. Only names and the mod API version change, not behavior.

- `app-pages`, `app-settings`, `app-sidebar`, `stage-layout`: storage keys, attributes and names shown in the interface.
- `browser-files`, `user-catalog`, `catalog`: the `teselarium-browser:` address scheme and the browser database name.
- `mod-theme`, `theme`, `tile-bodies`: the `--tes-*` variables, `data-tes-*` attributes and `tes-*` classes.
- `mod-stage`, `mod-engine-api`, `mod-tests`: names of mod-facing identifiers and the address scheme.
- `mod-api-version`, `mod-check`, `stage-bar`: the mod API version is `0.2.0`, and the range the specs use for a mod that does not match becomes `^0.3.0` (`^0.2.0` would now match).
- `default-mods`, `sample-book-list`, `sample-country-map`, `sample-flashcards`, `combination-pickers`, `mosaic-editing`: the attributes, classes and storage keys these mods and samples use.

## Impact

- About 300 tracked files change, almost all by the script. `git grep -il opentesela` finds only the history files, and the same holds for `ot-`.
- Mod API: breaking while 0.x, so a minor bump to `0.2.0` and a minor app bump, following the "Mod API version" section of the engine README. The surface guard `mod_api_surface.test.ts` gets an entry for `0.2.0`, and the shipped mods' `api` ranges, `TEST_MOD_API_RANGE` in `src/test/sample_mods.ts` and `e2e/mod_routes.ts` follow.
- `package-lock.json`: the name fields change, then the lockfile is checked with `npm ci`.
- Not affected: dependencies, build tooling and the bundled third-party code.
- After the change, the user renames the GitHub repository and updates `origin`.
