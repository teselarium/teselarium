# Tasks

## 1. Rename script

- [x] 1.1 Write `openspec/changes/rename-to-teselarium/rename_test.py` first, with one case per rule of design D2 and the guard cases that must not change (`data-testid`, `slot-`, `not-`, `latest-`, `OTHER_API_RANGE`, `OTHERWISE`, `other`, `an OpenTesela` to `a Teselarium`, `--ot-` followed by a backtick, `OT-TILE-BODY`, `dataset.otVariant`, `openTeselaYamlCodeRan`). Verify `python3 -I -m unittest` fails before the script exists
- [x] 1.2 Write `rename.py` (design D1 to D5): file list from `git ls-files`, the exclusions, rules in order, the abort check for names that already exist, `git mv` of `docs/opentesela_spec.md`, the JSON edit of `package-lock.json` names, `--dry-run` by default and `--apply`. Verify the unit tests of 1.1 pass
- [x] 1.3 Run `python3 -I rename.py --dry-run` and read its report: per rule file counts and distinct changed tokens. Verify every token is a real use of the old name, that `e2e/npm_files/` and the history paths are absent, and that the abort check passes. Fix the rules and tests when a token is wrong

## 2. Apply the rename

- [x] 2.1 Run `python3 -I rename.py --apply`. Verify it prints the list of changed files and `git status` shows the changed files and the moved spec only
- [x] 2.2 Run Prettier on the changed files only (`npx prettier --write` with the list the script saved). Verify `npm run format:check` passes
- [x] 2.3 Search for leftovers. Verify `git grep -iE 'opentesela|open tesela'` and `git grep -nE '(^|[^A-Za-z0-9_])ot-|\bot[A-Z][a-z]'` list only history files and `e2e/npm_files/`, and `git grep -nE '(^|[^A-Za-z0-9_])tesela\b' ` lists nothing outside history
- [x] 2.4 Check the pairs. Verify every `dataset.tes<Name>` has a matching `data-tes-<name>` written somewhere (camel to kebab), and every `[data-tes-...]` selector in CSS has a writer, with a short script whose output is empty when they match
- [x] 2.5 Check the conventions. Verify the "Prefixes" section of `docs/code_conventions.md` reads `teselarium.`, `teselarium-` and `tes-` with the examples renamed, and `docs/teselarium_spec.md` exists with no link to the old file name

## 3. Mod API version 0.2.0

- [x] 3.1 Move the ranges that mean "does not match the app" from `^0.2.0` to `^0.3.0` (the `other_api` fixture and the tests and e2e that use it), reviewing each hit of `git grep -n '0\.2\.0'` by hand because the app version `0.2.0` of `app-settings` is not a range. Verify with `npm run test` for the touched modules
- [x] 3.2 Move every `api:` range `^0.1.0` and `^0.1.14` to `^0.2.0`: the default mods' and samples' `mod_conf.yaml`, the fixtures, `TEST_MOD_API_RANGE` in `src/test/sample_mods.ts` and `e2e/mod_routes.ts`, and tests that read the strings. Leave a mod's own `version: "0.1.0"`. Verify `git grep -nE 'api:? *"?\^0\.1'` finds nothing outside history
- [x] 3.3 Set `MOD_API_VERSION` to `0.2.0` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts`, and add the `0.2.0` entry to `SURFACE_BY_VERSION` in `src/lib/core/engine/mod_api_surface.test.ts` (same surface names as `0.1.19`). Verify `mod_api_surface.test.ts` passes
- [x] 3.4 Add the `0.2.0` version note to "Mod API version" in `docs/modules/lib/core/engine/README.md` (what broke: `--tes-*` variables, `data-tes-*` attributes, `tes-*` classes, the `teselarium-browser:` scheme) and update `default_mods/mod_api.d.ts` if it states the version. Verify `git grep -n '0\.1\.19'` finds only history

## 4. Release note

- [x] 4.1 Add `.changeset/rename-to-teselarium.md` with a `minor` bump (the mod API change is breaking while 0.x, see "Bump rule" in `docs/releasing.md`) and the one-line summary "The project is now named Teselarium; mods use the `--tes-*` theme variables and the `teselarium-browser:` address scheme and declare `api: ^0.2.0`". Verify `npm run release:check` passes

## 5. Verification

- [x] 5.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` and `npm run test:e2e:samples`. Verify all pass, including the e2e tests of both color schemes and the phone viewport, which show nothing changed visually
- [x] 5.2 Rerun the searches of 2.3 and 2.4 and `git status` to confirm no old name is left outside history and nothing outside the intended files changed. Verify the report lists nothing unexpected

## Workflow follow-up

- The user commits, and renames the GitHub repository and the `origin` remote.
- The user clears `local_tests/` if it holds files with the old name.
