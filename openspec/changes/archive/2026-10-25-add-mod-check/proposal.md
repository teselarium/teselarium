# Proposal

## Why

Whether a mod works today is only found out by running it and reading the stage bar. Someone who runs a third-party mod cannot tell beforehand whether its files are complete, whether its sample tiles match its type, or whether it still works with this app's mod API. A mod author has no single step that answers the same questions. A check that any mod can be put through, with no code from its author, answers them, and gives the later mod tests (`add-mod-tests`) a report to add their results to.

This change builds on `add-mod-api-version`: the check reports the API range, and `mods.check` is the API's first addition.

## What Changes

- **`mods.check`**: a new engine method. `{ mod, collection? }` checks the mod and returns a report. Relative references resolve against the app's address, and the same `open` permission and switched-off rules as `mods.inspect` apply. Only the visible mod can ask for a check.
- **Bundle check**: the mod file, its entrypoint and its tile type load, and the given collection, or else the mod's sample collection, loads and validates against the type. The API range is checked against the app's mod API version: a missing range or a mismatch is a warning, never a dialog. That warning comes right after the mod file's findings, as the stage bar lists the missing range first.
- **Mount check**: when the bundle check found no error, the mod is mounted in a hidden frame with the permissions it would get if it were opened, the matching tiles and a throwaway storage slot. The stage's dialog for a mod written for another API is never shown for it. The check waits for `mount` to finish, then 1 second more, and fails after 10 seconds without a finished mount. It records:
  - a mount that throws or rejects;
  - a stopped mod;
  - blocked requests and blocked browser dialogs;
  - every request the engine answers with `-32600`, `-32601` or `-32602`, the API compatibility signal;
  - requests that would need the user (`links.open`, `files.save`, `ui.confirm` and `mods.open`), which are answered as cancelled or refused without any dialog.
- **The check leaves no trace**: no sandbox, no history entry, no change to the visible mod or its issues, and the mod's real storage slot is neither read nor written.
- **Report**: plain data with the mod's `source`, `status` (`pass`, `warn` or `fail`), whether the mount check ran, and a list of findings `{ step, level, source, message }`.
- **Mod viewer**: a "Check mod" button, there only while a mod is shown, that shows the report with its status as a badge.
- **Mod API version**: `0.1.0` becomes `0.1.1`, an addition by the bump rule. Mods that declare `^0.1.0` still match.
- **Reuse**: the bundle check is a library function with no browser dependency, so a Node script can run it later. An e2e test checks every sample and default mod through `mods.check`.

## Capabilities

### New Capabilities

- `mod-check`: the `mods.check` method and its rules, the bundle check, the mount check and what it records, the throwaway slot and hidden frame, the report's shape and status, and the guarantee that a check leaves the stage and storage unchanged.

### Modified Capabilities

- `mod-api-version`: "Mod API version" changes from `0.1.0` to `0.1.1`.
- `default-mods`: two new requirements: the mod viewer's "Check mod" button, and how the viewer shows the report.

## Impact

- **Code**:
  - `src/lib/core/engine/`: the bundle check as a function with no DOM, next to `matchModApiRange` and `describeMissingApiRange`, so the check's missing-range warning reads like the stage's issue; `mods.check` in `mods_methods.ts`; the report; a launch builder shared by opening and checking; the bump of `MOD_API_VERSION` in `mod_api_version.ts`; session options for a finished mount and for error responses (see design.md).
  - `src/lib/mod/`: the entrypoint loaded as its own step, so the check can name it.
  - `src/lib/core/storage/`: an in-memory `ModStorage` for the throwaway slot.
  - `src/lib/core/sandbox/`: the frame loader reports a finished mount (`sandbox.mounted`), a loader notification outside the mod API.
  - `src/lib/core/stage/`: the checks, kept apart from the sandboxes and the history, with the 1-second settle time and the 10-second limit. A check never enters the step where the stage asks before starting a mod written for another API.
  - `src/main/stage/`: the hidden check frame.
  - `public/default_mods/mod_viewer/`: the "Check mod" button and the report, with the viewer's existing badge and alert patterns.
- **Tests**:
  - Unit tests for the bundle check, the method's rules and the report; e2e tests for the mount check, the throwaway slot and the viewer; an e2e test that checks every shipped mod.
  - The bump: the API surface guard (`mod_api_surface.test.ts`) gets a new `"0.1.1"` entry with `mods.check`, and its `0.1.0` entry is not edited. The version test in `mod_api_version.test.ts` and `APP_MOD_API_VERSION` in `e2e/mod_routes.ts` become `0.1.1`. `TEST_MOD_API_RANGE` stays `^0.1.0`, since a patch bump does not change ranges.
  - Unit tests run the bundle check and the method's rules on the fixture `book_list` mod (`./fixtures/mods/book_list`). It passes with no findings because `add-mod-api-version` gave it `api: "^0.1.0"`. They drive the mount check with a fake frame that plays the frame loader, as the stage tests do today. The mod's code only runs in e2e tests, on the shipped sample and default mods.
  - The test mods without a range and for another API already exist: `serveNoApiBookMod`, `serveOtherApiMod` and `OTHER_API_RANGE` in `src/test/sample_mods.ts`, and the `apiRange` parameter of `buildModConf` and `buildProbeFiles` in `e2e/mod_routes.ts`. New test mods (an entrypoint that answers 404, a mount that throws, an unknown method, a request that needs the user) are named through `src/test/sample_mods.ts` in unit tests and through `e2e/sample_mod.ts` and `e2e/mod_routes.ts` in e2e, as `centralize-test-sample-references` set up.
- **Docs**: `docs/modules/lib/core/engine/README.md` (`mods.check`, the report, and the version where it names `0.1.0` as current: the mount context table, the "Mod API version" section and the exports list), the READMEs of the modules the check touches under `docs/modules/lib/` (`mod`, `core/storage`, `core/sandbox`, `core/stage`) and `docs/modules/main/README.md`, `docs/modules/mods/viewer/README.md`, and `docs/mod_plugin_spec.md` (how to check a mod).
- **Mods**: an API addition. Existing mods are unaffected.
- **Out of scope**: tests written by mod authors (`add-mod-tests`), a command-line check, a CI workflow, checking a mod without the `open` permission, and remembering past reports.
