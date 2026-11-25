# Tasks

## 1. Tests follow the split requirement

- [x] 1.1 In `e2e/sample_mod.ts`, add the flashcards mod file path and a `readFlashcardsModSource(page)` next to `readSampleModSource(page)`
- [x] 1.2 In `e2e/default_mods.spec.ts`, move the checks of the "Select a mod" test into a function that selects a mod by title in the explorer and expects the mod viewer to show it with that mod's source as `target`, and use it in "Select a mod"
- [x] 1.3 In the same file, add a `describe` named "Mod explorer vanilla config" right after "Mod explorer", with a "Select the flashcards sample" test that uses that function for `Flashcards` and the flashcards mod's source; verify both explorer `describe` blocks pass with `npm run test:e2e -- e2e/default_mods.spec.ts`. If the new test fails, report the behavior gap rather than changing the explorer, since this change does not change behavior

## 2. Validation

- [x] 2.1 Run `openspec validate split-mod-explorer-requirement --strict` and verify the change is valid
- [x] 2.2 Verify that each of the two requirements' description is 500 characters or fewer, and that the "Mod explorer" description keeps the old wording for everything except the sentence that moved

## Workflow follow-up

- Archive the change, syncing the `default-mods` delta into the main spec.
- After archiving, run `openspec validate --specs --strict` and verify `default-mods` no longer reports a long requirement.
