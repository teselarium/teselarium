# Tasks

## 1. Tests follow the split requirement

- [x] 1.1 In `e2e/default_mods.spec.ts`, add a `describe` named "Mod viewer reports a missing or failing target" right after "Mod viewer", with an "Empty target" test that opens `#/run?mod=mod_viewer&target=` and expects "No mod was given." in the viewer's frame; verify it passes with `npm run test:e2e -- e2e/default_mods.spec.ts`
- [x] 1.2 In the same `describe`, add a "Target with a format error" test that serves a probe mod with `theme: "dark"` on the app's origin (`serveAppOriginMod` with `buildProbeFiles`), opens the viewer on it, and expects the viewer's alert to say that `theme` must be `"default"` or `"none"`; verify it passes with `npm run test:e2e -- e2e/default_mods.spec.ts`. If either test fails, report the behavior gap rather than changing the viewer, since this change does not change behavior

## 2. Validation

- [x] 2.1 Run `openspec validate split-mod-viewer-requirement --strict` and verify the change is valid
- [x] 2.2 Verify that each of the two requirements' description is 500 characters or fewer, and that the "Mod viewer" description keeps the old wording for everything except the two sentences that moved

## Workflow follow-up

- Archive the change, syncing the `default-mods` delta into the main spec.
- After archiving, run `openspec validate --specs --strict` and verify `default-mods` no longer reports a long requirement.
