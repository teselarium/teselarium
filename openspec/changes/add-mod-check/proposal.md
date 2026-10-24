# Proposal

## Why

Whether a mod works today is only found out by running it and reading the stage bar. Someone who runs a third-party mod cannot tell beforehand whether its files are complete, whether its sample tiles match its type, or whether it still works with this app's mod API. A mod author has no single step that answers the same questions. A check that any mod can be put through, with no code from its author, answers them, and gives the later mod tests (`add-mod-tests`) a report to add their results to.

This change builds on `add-mod-api-version`: the check reports the API range, and `mods.check` is the API's first addition.

## What Changes

- **`mods.check`**: a new engine method. `{ mod, collection? }` checks the mod and returns a report. Relative references resolve against the app's address, and the same `open` permission and switched-off rules as `mods.inspect` apply. Only the visible mod can ask for a check.
- **Bundle check**: the mod file, its entrypoint and its tile type load, and the given collection, or else the mod's sample collection, loads and validates against the type. The API range is checked against the app's mod API version: a missing range or a mismatch is a warning, never a dialog.
- **Mount check**: when the bundle check found no error, the mod is mounted in a hidden frame with the permissions it would get if it were opened, the matching tiles and a throwaway storage slot. The check waits for `mount` to finish, then 1 second more, and fails after 10 seconds without a finished mount. It records:
  - a mount that throws or rejects;
  - a stopped mod;
  - blocked requests and blocked browser dialogs;
  - every request the engine answers with `-32600`, `-32601` or `-32602`, the API compatibility signal;
  - requests that would need the user (`links.open`, `files.save`, `ui.confirm` and `mods.open`), which are answered as cancelled or refused without any dialog.
- **The check leaves no trace**: no sandbox, no history entry, no change to the visible mod or its issues, and the mod's real storage slot is neither read nor written.
- **Report**: plain data with the mod's `source`, `status` (`pass`, `warn` or `fail`), whether the mount check ran, and a list of findings `{ step, level, source, message }`.
- **Mod viewer**: a "Check mod" button that shows the report.
- **Mod API version**: `0.1.0` becomes `0.1.1`, an addition by the bump rule. Mods that declare `^0.1.0` still match.
- **Reuse**: the bundle check is a library function with no browser dependency, so a Node script can run it later. An e2e test checks every sample and default mod through `mods.check`.

## Capabilities

### New Capabilities

- `mod-check`: the `mods.check` method and its rules, the bundle check, the mount check and what it records, the throwaway slot and hidden frame, the report's shape and status, and the guarantee that a check leaves the stage and storage unchanged.

### Modified Capabilities

- `mod-api-version`: "Mod API version" changes from `0.1.0` to `0.1.1`.
- `default-mods`: a new requirement for the mod viewer's "Check mod" button and how it shows the report.

## Impact

- **Code**:
  - `src/lib/mod/` or `src/lib/tile/`: the bundle check as a function with no DOM.
  - `src/lib/core/engine/`: `mods.check` in `mods_methods.ts`, the report, the API version constant, an in-memory `ModStorage`, recording of request errors and of requests that need the user.
  - `src/lib/core/stage/` and `src/lib/core/sandbox/`: a hidden check frame outside the history, with the 1-second settle time and the 10-second limit.
  - `public/default_mods/mod_viewer/`: the "Check mod" button and the report.
- **Tests**: unit tests for the bundle check, the method's rules and the report; e2e tests for the mount check, the throwaway slot and the viewer; an e2e test that checks every shipped mod. The API surface guard test of `add-mod-api-version` gets `mods.check` and the new version.
- **Docs**: `docs/modules/lib/core/engine/README.md` (`mods.check`, the report, the version), `docs/modules/mods/viewer/README.md`, and `docs/mod_plugin_spec.md` (how to check a mod).
- **Mods**: an API addition. Existing mods are unaffected.
- **Out of scope**: tests written by mod authors (`add-mod-tests`), a command-line check, a CI workflow, checking a mod without the `open` permission, and remembering past reports.
