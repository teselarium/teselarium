# Proposal

## Why

The `default-mods` "Mod viewer" requirement description is 509 characters, over the 500-character limit, so `openspec validate --strict` fails on the main specs. It packs two behaviors into one requirement: showing a mod, and reporting when there is no mod to show.

## What Changes

- Cut the "Mod viewer" requirement description down to showing the target mod: the `open` permission, the details it shows through `mods.inspect`, and not needing a collection. Its wording for those stays the same.
- Add a requirement "Mod viewer reports a missing or failing target" with the two sentences taken out of "Mod viewer": no `target` means the viewer says that no mod was given, and a mod that cannot be inspected means it shows the error message. It also states two cases the viewer already handles but no scenario covers: an empty `target`, and a target that fails for a reason other than a missing file.
- "Mod viewer" keeps all its scenarios, including "No target" and "Missing target", because a MODIFIED requirement cannot drop scenarios. The new requirement gets the two new cases as its scenarios.
- No behavior changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `default-mods`: the "Mod viewer" requirement is split in two, with the same behavior.

## Impact

- `openspec/specs/default-mods/spec.md` once archived; `openspec validate --specs --strict` no longer warns about it.
- `e2e/default_mods.spec.ts`: a new `describe` block named after the new requirement, with one test per new scenario, so the tests still mirror the spec. Existing tests are unchanged.
- No change to the mod viewer, the app or the mod API, so no mod API version bump.
