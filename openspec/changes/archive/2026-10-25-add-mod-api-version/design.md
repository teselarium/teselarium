# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `src/lib/mod/mod_format.ts` reads each key of the `mod` mapping with its own reader (`readModTheme`, `readOptionalPath`, …) and ignores unknown keys. `ModFormat`, `ModFile` and `LoadedMod` carry the result, and `buildRequestingMod` in `src/test/method_contexts.ts` writes a `LoadedMod` literal by hand.
- `prepareModLaunch` in `src/lib/core/engine/mod_launch.ts` loads the mod and the link's collection, grants the permissions and builds the `LaunchContext` and the permission issues. `inspectMod` in `mod_inspection.ts` builds `mods.inspect`'s result from the mod file.
- In `src/lib/core/stage/stage_sandboxes.ts`, a runtime goes from `loading` to `running` or `failed` when the launch settles. The snapshot gives a frame document only to a `running` sandbox. `readSandboxIssues` lists `collectionIssues`, then `issues` (permission issues, then the issues found while running).
- The engine's requests that need the user (`links.open`, `files.save`, `ui.confirm`) go through the stage's action queue (`stage_actions.ts`) and `ActionDialog`, a native `<dialog>` opened with `showModal()`. An action is only kept while its sandbox is visible and running. `dropActions` answers `false` to the actions of a sandbox that is hidden.
- The engine's method names are the keys of five handler tables merged in `mod_session.ts`. `theme.changed` has a constant (`THEME_CHANGED_METHOD`). `tiles.changed` is a literal.
- No semver library is installed.

## Goals / Non-Goals

**Goals:**
- One place holds the mod API version, and one function matches a range against it, used by the launch, `mods.inspect` and later by `mods.check`.
- The mismatch dialog follows the action dialog's rules: drawn by the app, modal, Cancel focused, Escape cancels.
- A test fails when the API's surface changes and the version does not.
- Existing tests keep passing without each one adding `api`.

**Non-Goals:**
- Normalizing or rewriting a mod's range. The loaded mod keeps the text the author wrote.
- An issue after "Run anyway". The specs ask for none, and the user has just been told.
- Asking before loading the collection. A mod whose files cannot be loaded fails as today, without a dialog.

## Decisions

### `semver` for the range syntax and the matching

`semver` 7 (the package npm itself uses) becomes a dependency, with `@types/semver` as a dev dependency. Only two functions are imported, by their own paths, so the bundle gets only those:

- `semver/ranges/valid.js` in `src/lib/mod/`, to reject a value that is not a range.
- `semver/functions/satisfies.js` in `src/lib/core/engine/`, to match the app's version.

`validRange` accepts `""` and blank text as `*`, so the reader first requires a non-empty string, after trimming.

*Alternatives:* (a) a hand-written parser for `^`, `~` and comparisons. Rejected: the specs promise npm's syntax and matching, with `||`, hyphen ranges, `x` ranges and the `0.x` caret rule, and a partial copy would disagree with npm in edge cases mod authors know from `package.json`. (b) A smaller library such as `compare-versions`. Rejected: its range support is a subset of npm's.

### The range is read by the mod library, matched by the engine

`mod_format.ts` gets `readModApiRange`, which returns `null` for a missing key and raises `ModFormatError` (`"api" must be a semver range, such as "^0.1.0"`) for anything else that `validRange` refuses. `ModFormat`, `ModFile` and `LoadedMod` get `api: string | null`.

`src/lib/core/engine/mod_api_version.ts` holds:
- `MOD_API_VERSION = "0.1.0"`;
- `matchModApiRange(range: string | null): boolean | null`, which is `null` without a range and `satisfies(MOD_API_VERSION, range)` otherwise;
- the texts of the missing-range warning and of the cancel error, both naming the range (when there is one) and `MOD_API_VERSION`.

`inspectMod` sets `api` and `apiCompatible` from these. `buildModContext` adds `api: { version: MOD_API_VERSION }`, and `ModContext` gets the field.

*Alternative:* matching inside `src/lib/mod/`. Rejected: the loader would then know the app's version, and the library is meant to read any mod file without knowing which app runs it.

### The launch carries the result, the stage decides

`ModLaunch` gets `apiCompatible: boolean | null` and `fileIssues: ModIssue[]`, the issues of the mod file itself. Today that is only the missing-range warning, whose source is the mod file's source. The runtime copies `fileIssues` when it starts, and `readSandboxIssues` lists them first: `fileIssues`, `collectionIssues`, then `issues`. Reloading the tiles replaces only `collectionIssues`, so the warning stays.

### A new sandbox status, `asking`

When the launch settles with `apiCompatible === false`, the runtime becomes `asking` instead of `running`. Its `launch` is set, so the stage bar shows the mod's title, version and source, but the snapshot gives no frame document. `SandboxSnapshot` gets `apiMismatch: { range, apiVersion } | null`, set only while asking.

The controller exports `answerApiMismatch(stage, sandboxId, runAnyway)`. It does nothing unless the sandbox is visible and still `asking`, so a late or repeated click is ignored. "Run anyway" starts the runtime as a matching launch would. "Cancel" fails it with the cancel error. The sandbox keeps its history entry and its close button, as for any load failure.

The dialog is derived from the snapshot: it is shown while the visible sandbox is `asking`. Going back hides the sandbox, and so the dialog, and the mod stays unstarted. Going forward to the same entry shows the question again. Closing the sandbox stops the runtime, and a stopped runtime ignores any answer. A reload or a new run link creates a new sandbox, which asks again, so nothing has to remember an answer.

*Alternative:* a new kind of stage action in the existing queue. Rejected: the queue belongs to running mods and answers `false` to the actions of a sandbox that is hidden. Going back would then cancel the mod as if the user had pressed "Cancel", and the specs say the dialog is removed, not answered.

### The mismatch dialog shares the action dialog's mechanics

The native-dialog mechanics of `ActionDialog` move to a shared component in `src/main/stage/`: `showModal()` while there is something to ask, focus on Cancel, Escape as Cancel, and opening again after a stray close. `ActionDialog` and a new `ApiMismatchDialog` render their content inside it, so both dialogs behave the same. `ApiMismatchDialog` shows the mod's title, source and version, its range and the app's mod API version, with "Run anyway" and "Cancel". `StageView` renders it for the visible sandbox, and shows "Waiting for your answer…" in that sandbox's place, in the same way as "Loading…".

The two dialogs are never open together: actions come only from a visible, running sandbox, and the question only from a visible, asking one.

*Alternative:* one dialog that also renders the question. Rejected: the action dialog's accept button performs the action inside its click, and the question would add a second kind of answer to the same code path.

### The surface guard is a record of versions

`src/lib/core/engine/mod_api_surface.test.ts` keeps a mapping from each mod API version to its surface:
- the method names;
- the event names;
- the mount context's keys, and the keys of its fixed mappings (`mod`, `api`, `permissions`, `theme`);
- the `mod` mapping's keys;
- the permission categories.

The test builds the current surface from the code, and checks that the entry for `MOD_API_VERSION` equals it and that `MOD_API_VERSION` is the highest version recorded. Changing the surface without bumping the version fails, with a message that points to the bump rule. A bump adds an entry, so the record also shows how the API grew.

To build the surface from the code:
- `mod_session.ts` exports its merged method table.
- `tiles.changed` gets a constant next to `THEME_CHANGED_METHOD`.
- `mod_format.ts` exports `MOD_FILE_KEYS`, the keys `readModFormat` reads, and its doc comment points to that list. `PERMISSION_CATEGORIES` already exists.
- The context keys come from the launch of the fixture mod.

*Alternatives:* (a) a stored hash of the surface. Rejected: a failure would not say what changed. (b) A single recorded surface. Rejected: it can be edited together with the code without touching the version, and a record per version makes that a visible edit of an older entry.

### Test mods declare a range unless a test says otherwise

`src/test/sample_mods.ts` and `e2e/mod_routes.ts` each define `TEST_MOD_API_RANGE = "^0.1.0"`:
- `serveTestMod`, `serveUntypedMod`, `buildModConf` and `buildProbeFiles` write it as the first line under `mod`, and take an optional range whose `null` leaves the line out.
- `buildRequestingMod` sets `api` to it.
- Inline mod files that tests write by hand get the line only where a test expects no issues.

The value is a literal, like the shipped mods' ranges, so the e2e helpers need no import from `src/`. A later breaking bump updates the shipped mods and these two constants together.

Tests that need another range or none build their mods through these helpers or through constants in `src/test/sample_mods.ts` and `e2e/sample_mod.ts`, so no fixtures or sample path is written outside them. The fixture `book_list` mod gets `api: "^0.1.0"` directly.

*Alternative:* adding `api` only where a test fails. Rejected: test mods that do not matter to a test would then carry a warning, and a later test that checks issues would fail for an unrelated reason.

### The bump rule and the proposal rule

`docs/modules/lib/core/engine/README.md` gets a "Mod API version" section:
- what the version covers;
- that it is `MOD_API_VERSION` in `mod_api_version.ts`;
- the rule while it is `0.x`: a breaking change bumps the minor version, an addition or a fix the patch version;
- that each bump adds an entry to the surface guard.

`openspec/config.yaml` gets `rules.proposal`, asking a proposal that changes the specs of the mod API to state the bump and to follow that section. The mod API's specs are `mod-engine-api`, `mod-loading`'s mod file format, `mod-api-version`, `mod-theme`'s context and events, and `mod-app-actions`.

## Risks / Trade-offs

- [`semver` is CommonJS] → Vite bundles CommonJS dependencies, and Vitest runs them in Node. `npm run build` and a Vitest run of the format tests are early tasks, so a problem shows before the rest is built.
- [A permissive range such as `*` or `>=0.0.0` always matches] → That is the author's choice, and npm treats it the same way. The viewer shows the range as written.
- [The surface guard misses a change it does not record, such as a new param or a changed result] → It records names and keys, which are the changes a mod notices first. The proposal rule and review cover the rest.
- [Adding a default range to the helpers changes the inputs of many tests] → The helpers write one more line and the assertions do not change. The unit and e2e test counts must stay the same before the new tests are added.
- [A mod opened and hidden while asking keeps a sandbox that does nothing] → It is the same as a hidden failed sandbox. It is closed like any other when no history entry reaches it.
