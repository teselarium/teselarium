# Design

## Context

The old name appears in about 300 tracked files in four forms: prose (`OpenTesela`), identifiers (`opentesela`, `openTesela...`), the short prefix `ot` (`--ot-*`, `ot-*`, `data-ot-*`, `dataset.ot*`, uppercase `OT-TILE-BODY` in tests), and persisted or exchanged names (storage keys, the `opentesela-browser:` scheme, icon names). See proposal.md for what is renamed and what is left alone.

Facts that shape the approach:

- `OpenTesela` and `opentesela` are 10 characters, like `Teselarium` and `teselarium`, so renamed prose keeps its line wrapping. `ot-` becomes `tes-` (one more character), so Prettier can reflow a few lines.
- The camel and kebab forms of an attribute must stay a pair: `data-ot-variant` is read as `dataset.otVariant`. One rule renames both, and a check proves the pairs still match.
- `e2e/npm_files/` holds a minified third-party file (Leaflet) that contains `ot-` inside other words. It must never be touched.
- History (`openspec/changes/archive/`, `openspec/discarded-changes/`, `.changeset/`, `CHANGELOG.md`) and this change's own folder keep the old name.
- The mod API surface names (methods, events, context keys) do not change, but the theme variables, attributes, classes and the address scheme mods read do. By "Mod API version" in the engine README that is breaking while 0.x, so `0.1.19` becomes `0.2.0`.

## Goals / Non-Goals

**Goals:**

- One script renames everything that is mechanical, with a dry run that lists what it would change, so a reviewer reads the rules and the report and no agent reads the files.
- The script's rules have their own tests with the tricky cases (words that contain `ot`).
- After the script, a set of searches proves no old name is left outside the history and the paired names still match.

**Non-Goals:**

- No migration or fallback for stored data (see proposal.md).
- No change to behavior, layout or colors.
- No tool for future renames. The script is kept with this change only as the record of what ran.

## Decisions

### D1. One Python script in the change folder

`openspec/changes/rename-to-teselarium/rename.py`, with `rename_test.py` beside it. It lists files with `git ls-files`, so it never touches untracked or ignored files (`dist*`, `node_modules`, `local_tests`). It runs `--dry-run` by default and `--apply` to write.

Alternatives: `sed` one-liners (no tests, and the lookbehind rules need PCRE), a TypeScript script in `build/` (adds project code for a one-time job), manual edits by the agent (the quota cost the user wants to avoid). The change folder is archived with the change, so the script stays reviewable and does not clutter the source tree.

### D2. Rules, in this order

| # | Pattern | Result |
|---|---|---|
| 1 | `\b(an|An) (OpenTesela\|opentesela)` | `a Teselarium` / `A Teselarium` (the article changes) |
| 2 | `OpenTesela` | `Teselarium` |
| 3 | `openTesela` (camel, e.g. `openTeselaYamlCodeRan`) | `teselarium` |
| 4 | `opentesela` | `teselarium` |
| 5 | `(?<![A-Za-z0-9_])OT-` | `TES-` |
| 6 | `(?<![A-Za-z0-9_])ot-` | `tes-` |
| 7 | `(?<![A-Za-z0-9_])ot(?=[A-Z][a-z])` | `tes` |
| 8 | `(?<![A-Za-z])tesela_spec\.md` | `teselarium_spec.md` (the stale links) |

The lookbehind on 5 to 7 keeps `slot-`, `not-`, `data-testid` and `latest-` intact, and still matches `--ot-` and `data-ot-` because `-` is not in the class. Rule 7 needs a lowercase letter after the capital, so `OTHER_API_RANGE` and `OTHERWISE` never match. Rule 5 has no lookahead, so a bare `--ot-` prefix in prose is renamed too. A failure the script cannot see (a word ending in `ot` after `_`) is covered by the dry-run report of every distinct changed token, which the reviewer reads.

Rule 1 runs first so `an OpenTesela` does not become `an Teselarium`.

### D3. File selection and safety checks

- Included: every tracked text file except the exclusions below. A file that does not decode as UTF-8 is skipped and reported.
- Excluded: `openspec/changes/archive/**`, `openspec/discarded-changes/**`, `openspec/changes/rename-to-teselarium/**`, `.changeset/**`, `CHANGELOG.md`, `e2e/npm_files/**`, `package-lock.json` (D5).
- Before writing, the script aborts if the new names already exist in the included files (`tes-`, `--tes-`, `data-tes-`, `Teselarium`, `teselarium`), because a merge would be silent. The check ignores `test-` and `latest-` by the same lookbehind.
- The dry run prints, per rule, the file count and the distinct tokens it changes with their counts. The reviewer reads this short list instead of the diff.

### D4. File rename and the docs

`git mv docs/opentesela_spec.md docs/teselarium_spec.md` runs in the same script, before the text pass, so links to it are renamed by rule 4. The "Prefixes" section of `docs/code_conventions.md` changes by the same rules (`teselarium.`, `teselarium-`, `tes-`); a check reads that section after the run.

### D5. `package-lock.json`

Only the `name` fields of the root package change. The script edits those two fields by parsing the JSON, not by regex, then `npm ci` confirms the lockfile is consistent. A regex pass over the lockfile would risk touching dependency names.

### D6. The mod API bump is a separate, hand-reviewed step

The bump is not mechanical, so it is not in the script. Order matters, because `^0.2.0` currently means "a range this app does not match" in tests and fixtures:

1. Change the "non matching" ranges `^0.2.0` to `^0.3.0` (the `other_api` fixture, the tests and e2e that use it, `app-settings` is unaffected because `0.2.0` there is the app version).
2. Change every `api:` range `^0.1.0` and `^0.1.14` to `^0.2.0`: the default mods' `mod_conf.yaml`, `public/samples/**/mod_conf.yaml`, the fixtures, `TEST_MOD_API_RANGE` in `src/test/sample_mods.ts` and `e2e/mod_routes.ts`, and the tests that read these strings.
3. Set `MOD_API_VERSION` and `APP_MOD_API_VERSION` to `0.2.0`, and add the `0.2.0` entry to `SURFACE_BY_VERSION` (the surface names are the same as `0.1.19`).
4. Add the `0.2.0` version note to the engine README, and update `default_mods/mod_api.d.ts` if it states the version.

Only `api:` lines change. A mod's own `version: "0.1.0"` is unrelated and must stay. The delta specs already say this: the "other API" examples use `^0.3.0`, and the semver examples in `mod-api-version` that test the range function itself (`0.1.0` against `^0.1.0`) are left alone because they do not depend on the app's version.

### D7. Delta specs are generated, not written

The 22 delta specs restate the 67 affected requirements. They were generated from the main specs with the same rules (plus the version changes of D6), and validated with `openspec validate`. The script also renames the main specs, so the repository is consistent before archive; the archive then replaces those requirements with identical text. A scenario title cannot change in a MODIFIED requirement, so "Mods for 0.1.0 still match" keeps its title while its text uses `^0.2.0`.

## Risks / Trade-offs

- [A rule matches something it should not] → the unit tests of the rules, the dry-run token report, and the project's type check, tests and e2e run, which fail on a broken identifier.
- [A name changes on one side of a pair only (CSS `[data-ot-x]` against `dataset.otX`)] → both come from one rule set, and a check lists every `dataset.tes*` and `data-tes-*` and compares them as camel and kebab.
- [Tests that depend on name order or width (sorted token lists, snapshots, line wrapping)] → `npm run test` and `npm run format:check` catch them; Prettier runs on the changed files after the script.
- [Old names remain in an ignored folder] → `dist*`, `test-results` and `local_tests` are untracked; a clean `npm ci` and build regenerate them, and the user clears `local_tests` if it has old names.
- [Old stored data in a browser used during development] → accepted: it is ignored and the app starts empty (no users).
- [Mods with `api: "^0.1.x"` no longer match] → accepted: the shipped, sample and test mods move to `^0.2.0` in this change, and there are no other mods.
- [A reviewer wants the history renamed too] → the exclusion list is the only place to change, and a second dry run would show the extra files.

## Migration Plan

1. Write the script and its tests, run `--dry-run`, read the token report.
2. Run `--apply`, then Prettier on the changed files, then the searches of tasks.md.
3. Do the mod API bump (D6) and add the changeset.
4. Run the full verification. The user commits.
5. After merge, the user renames the GitHub repository and updates `origin`. Rollback before commit is `git restore -SW .` and `git clean` of the new files.
