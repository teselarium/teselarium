# Proposal

## Why

Since `add-sample-flashcards`, the `default-mods` "Mod explorer" requirement description is over the 500-character limit, so `openspec validate --specs --strict` fails on the main specs. It packs two behaviors into one requirement: what the mod explorer does with any config, and what its vanilla config lists.

## What Changes

- Cut the "Mod explorer" requirement description down to what the explorer does with its config: the `open` permission, listing the mods of `mods` through `mods.inspect`, listing a reference that cannot be inspected, and opening the selected mod in `viewer`. Its wording for those stays the same.
- Add a requirement "Mod explorer vanilla config" with the sentence taken out of "Mod explorer": the vanilla config lists the sample book list mod, then the sample flashcards mod, and uses `mod_viewer` as viewer. It also states a case the explorer already handles but no scenario covers: selecting the flashcards sample opens it in the mod viewer.
- "Mod explorer" keeps all its scenarios, including the two vanilla config ones, because a MODIFIED requirement cannot drop scenarios. The new requirement gets the new case as its scenario.
- No behavior changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `default-mods`: the "Mod explorer" requirement is split in two, with the same behavior.

## Impact

- `openspec/specs/default-mods/spec.md` once archived; `openspec validate --specs --strict` no longer warns about it.
- `e2e/default_mods.spec.ts`: a new `describe` block named after the new requirement, with one test for its scenario, so the tests still mirror the spec. The "Select a mod" test shares its checks with the new test. Its behavior is unchanged.
- No change to the mod explorer, the app or the mod API, so no mod API version bump.
- No change for the people who use or instantiate the app, so no changeset.
