# Tasks

## 1. Decisions and grants in the permissions module

- [ ] 1.1 Add the `SiteDecision` type and give `grantModPermissions` the `decisions` argument (design.md, D1): a mod from the app's origin still gets every permission; a foreign mod gets each declared permission with a matching decision whose `allowed` is `true`, compared by `mod`, `category` and `host` as written. Update every caller to pass `[]` for now, so behavior does not change yet. In `mod_grants.test.ts`, add cases for an allowed decision, a refused one, a decision of another mod, a wildcard decision that does not cover the bare host, and an app-origin mod ignoring decisions. Verify `npx vitest run src/lib/core/permissions` passes.
- [ ] 1.2 Add `listConsentLines(mod, appOrigin, decisions)`: the declared permissions of a foreign mod without a decision for that mod, one per category and host, keeping the first reason; `[]` for an app-origin mod. Add `describePermissionLine(permission)` from `CATEGORY_VERBS` (`"*"` as "any site"), and use it in `describeDeniedPermission`, whose message becomes the one of D7. Export the new functions and type from `index.ts`. Test duplicated declarations, the order of lines (as declared), and the new denial text. Verify the tests pass.
- [ ] 1.3 Update `docs/modules/lib/core/permissions/README.md`: the site-owner rule becomes "app origin: everything; other origins: what the user allowed", the denial message without "for now", decisions and how they match, and the new functions in "Module Details". Verify the quoted message equals the code's.

## 2. Launch inputs and launch

- [ ] 2.1 Split `prepareModLaunch` into `loadModLaunchInputs(request, options)` returning `{ mod, link, modTiles }`, and make `buildModLaunch` take `grants` (design.md, D2). Keep the switched-off refusal and every load error where they are. Move the existing `mod_launch.test.ts` cases to the two functions and add one that a launch built with a granted foreign permission has it in the policy and in `context.permissions.granted`. Verify `npx vitest run src/lib/core/engine/mod_launch.test.ts` passes.
- [ ] 2.2 Add `readSiteDecisions` to `ModMethodContext` and pass its result to `inspectMod`, so `mods.inspect` reports remembered allows as granted. Update `src/test/method_contexts.ts`. In `mod_inspection.test.ts` and `mods_methods.test.ts`, add the scenario "Inspect a foreign mod with a remembered allow". Verify the tests pass.
- [ ] 2.3 Update the "Launch" and "Inspection" parts of `docs/modules/lib/core/engine/README.md` with the two launch functions, the `grants` argument and the decisions inspection reads. Verify the documented signatures match the code.

## 3. Stage

- [ ] 3.1 Add `readSiteDecisions` and `rememberSiteDecisions` to `StageOptions`, `SandboxServices` and `CheckServices` (design.md, D4), and pass the reader into the session's method context. Update `src/test/test_stages.ts` and `src/test/check_stages.ts` with an in-memory list. Make the mount check build its launch with `grantModPermissions(mod, appOrigin, readSiteDecisions())`. In `stage_checks.test.ts`, add "Check a foreign mod without decisions" and a remembered-allow case. Verify the tests pass.
- [ ] 3.2 Keep the launch inputs on the runtime while it asks, add `question: "api" | "sites" | null`, and settle in the order of D3: API question, then `listConsentLines` with the remembered decisions, then build and start. Add `siteConsent` to the snapshot and `answerSiteConsent(stage, sandboxId, answer)` to the stage's exports: checked lines allowed, the rest refused, decisions remembered only with `remember`, `null` (Escape) refusing all without remembering. In `stage_sandboxes.test.ts` and `stage_controller.test.ts`, cover: no question for app-origin mods, mods without permissions and fully decided mods; "Another API first"; "Cancelled for another API"; Allow with one line unchecked; Show without them; Escape with Remember; and a hidden sandbox that keeps waiting. Verify the tests pass.
- [ ] 3.3 Update `docs/modules/lib/core/stage/README.md`: the two questions and their order, `siteConsent` in the snapshot, `answerSiteConsent`, and the two new options. Verify the README's order of questions matches `settleLaunch`.

## 4. The dialog

- [ ] 4.1 Add `src/main/stage/SiteConsentDialog.tsx` as in design.md, D6, on `StageDialog`, and render it from `StageView` for the visible sandbox while `siteConsent` is set, calling `answerSiteConsent`. Write `SiteConsentDialog.test.tsx` first, with the scenarios "Lines of a foreign mod", "Markup in a reason", "Show only", "A connect line", the focus on Show without them, Escape answering `null`, and Remember unchecked by default. Verify `npx vitest run src/main/stage` passes.
- [ ] 4.2 Describe the site consent dialog next to the other two in `docs/modules/main/README.md`, including that it is never open together with them. Verify the description names the same buttons and checkbox as the component.

## 5. Settings

- [ ] 5.1 Add `src/main/settings/site_decisions.ts` (design.md, D5): key `opentesela.site-decisions`, reading that drops invalid entries and keeps the last of duplicates, remember, remove, snapshot and subscribe, with failed writes ignored. Write `site_decisions.test.ts` first: valid and invalid entries, duplicates, a throwing `setItem` ("Storage cannot be written"), listeners, and the key not starting with `opentesela.mod-storage:`. Verify the test passes.
- [ ] 5.2 In `src/main.tsx`, create the store and give the stage `readSiteDecisions` and `rememberSiteDecisions` from it. Pass it through `App` and `PageView` to `SettingsPage`, and add the Mod permissions group between Privacy and Version (D8). In `SettingsPage.test.tsx`, cover the empty state, "One remembered allow", "A remembered refusal", Remove, and the group order Appearance, Sidebar, Privacy, Mod permissions, Version. Verify `npm test` passes.
- [ ] 5.3 In `docs/modules/main/settings/README.md`, add the Mod permissions group to "What the page holds" and the `opentesela.site-decisions` row to "Stored keys". Verify the documented value shape matches `SiteDecision`.

## 6. End-to-end

- [ ] 6.1 In `e2e/mod_sandbox.spec.ts`, rename the block "Mods from other origins run with the default policy" to the new requirement name and update its tests: Show without them gives the warning of D7 and blocked images; Allow loads them; an allowed `open` lets the foreign mod inspect a mod on another site. Keep "Foreign mod without permissions". Verify `npx playwright test e2e/mod_sandbox.spec.ts` passes.
- [ ] 6.2 Add `e2e/site_consent.spec.ts` with `test.describe` blocks named after the `site-consent` requirements, using `FOREIGN_HOST` routes as `mod_sandbox.spec.ts` does. Cover: the dialog before the frame, no dialog for the sample mod, Allow with one line unchecked, Escape with Remember, "Remembered allow" and "Remembered refusal", "Another mod declares the same site", "A new permission in a later version", "Kept after a reload", "Another API first", "Cancelled for another API", "Opened by another mod", and a check from the mod explorer that shows no dialog. Verify `npx playwright test e2e/site_consent.spec.ts` passes.
- [ ] 6.3 In `e2e/app_settings.spec.ts`, extend "Vanilla settings page" with the empty Mod permissions group, and add "Asked again after removing" and "Running mod keeps its permission". Verify `npx playwright test e2e/app_settings.spec.ts` passes.

## 7. Verification

- [ ] 7.1 Run `npm test`, `npm run build`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, and verify all pass. Check that `mod_api_surface.test.ts` passes unchanged, since the mod API does not bump. Then run `openspec validate add-site-consent-dialog --strict` and verify it is valid.

## 8. Release

- [ ] 8.1 Add `.changeset/add-site-consent-dialog.md` with an `"opentesela": patch` bump: per the "Bump rule" in `docs/releasing.md`, nothing breaks while the app is `0.x`, and the mod API does not bump. Use the one-line summary: "Mods from other sites can use the sites they declare once you allow them; the app asks before the mod starts, can remember your answer, and lists remembered answers in Settings." Verify the file matches the format of the other files in `.changeset/`.
