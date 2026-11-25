# Tasks

Each group writes its tests first (TDD) and names each test after the spec scenario it covers, so every scenario in `specs/theme`, `specs/mod-theme`, `specs/mod-loading` and `specs/mod-stage` can be traced to a test. Unit tests run in Node (Vitest project `lib`), component tests in jsdom (project `app`), and frame behavior in Playwright on the built app (design D13).

## 1. Theme module (design D1, D2, D3, D4, D7)

- [x] 1.1 Create `src/lib/core/theme/theme_tokens.ts` with `ColorScheme`, `ThemeTokens`, `Theme`, the frozen `THEME_TOKENS` table of D2 and `buildTheme(colorScheme)`, exported from `index.ts`. Write the tests first for "Token names", "Color tokens differ between color schemes" and "Resolved tokens are plain data", plus a test that computes the WCAG contrast ratios listed in D2 and expects each to be at least 4.5. Verify with `npm test`.
- [x] 1.2 Add `buildThemeTokenStyles()` in `theme_styles.ts` (D3): inside `@layer opentesela`, the `:root, [data-ot-color-scheme="light"]` block with the light values, then the `[data-ot-color-scheme="dark"]` block with the dark values, each with its `color-scheme`. Test that every token name appears exactly once in each block, that the dark block comes after the light one, and that the text has no `</style`. Verify with `npm test`.
- [x] 1.3 Write `base_stylesheet.css` as in D4, including the `[data-ot-color-scheme]` rule for color scheme sections, entirely inside `@layer opentesela`, with element and attribute selectors only, `var(--ot-…)` values only and no `!important`. Import it with `?raw` and export `THEME_FRAME_STYLES` (token styles, then the base stylesheet). Test that it has no class selectors, no `</style` and no color literals. Verify with `npm test`, `npm run lint` and `npm run format:check`.
- [x] 1.4 Add `theme_choice.ts` (D7): `ThemeChoice`, `ThemeStorage`, `resolveColorScheme`, `readThemeChoice` and `writeThemeChoice` with the key `opentesela.theme-choice`. Write the tests first for "System follows the operating system", "An explicit choice ignores the operating system" and "Unknown stored value", plus a missing value, a read that throws and a write that throws (no error escapes). Verify with `npm test`.
- [x] 1.5 Write `docs/modules/lib/core/theme/README.md` (D14): the token table, the base stylesheet's coverage, the layer and how to override a token, the color scheme attribute and color scheme sections, reading token values from JavaScript, `context.theme`, `theme.changed`, `theme: "none"`, the `prefers-color-scheme` caveat, and the module's functions with an example, in the style of the other module READMEs. Link it from `docs/modules/README.md` if that file lists the core modules. Verify that `npm run format:check` passes.

## 2. Theme setting in the mod file (design D11)

- [x] 2.1 Add `readModTheme` to `src/lib/mod/mod_format.ts` and `theme: ModThemeSetting` to `ModFormat` and `LoadedMod`, exporting the type from `src/lib/mod/index.ts`. Write the tests first for "No theme key", "Opt out" and "Unknown theme value". Verify with `npm test` that these pass and that the existing mod loading tests are unchanged and pass.
- [x] 2.2 Document `theme` in `docs/modules/lib/mod/README.md` (the mod file format section). Verify that `npm run format:check` passes.

## 3. Frame document and frame loader (design D5, D9)

- [x] 3.1 Change `buildSandboxDocument(policy, theme)` so `"default"` adds `<style>` with `THEME_FRAME_STYLES` between the policy `<meta>` and the frame loader, and `"none"` adds nothing. Update its callers and tests. Test the order (policy, styles, loader) and that a `"none"` document has no `<style>`. Verify with `npm test`.
- [x] 3.2 In `sandbox_loader.js`, add `THEME_CHANGED_METHOD`, set `data-ot-color-scheme` on connect from `context.theme.colorScheme`, and on `theme.changed` set it before dispatching and replace `context.theme` while `mount` has not been called (D9). Ignore any `colorScheme` other than `"light"` and `"dark"`. Extend the name test in `sandbox_messages.test.ts` to cover `theme.changed`. Verify with `npm test` and `npm run lint`. The frame behavior is checked in group 7.
- [x] 3.3 Update `docs/modules/lib/core/sandbox/README.md`: the frame document with its styles, the frame loader's color scheme attribute and its handling of `theme.changed`. Verify that `npm run format:check` passes.

## 4. Theme in the mount context and `theme.changed` (design D6)

- [x] 4.1 Add `theme: Theme` to `ModContext`, add `LaunchContext` for the context `prepareModLaunch` builds, and add `theme` to `ModSessionOptions`. `connectModSession` sends the launch context with the session's theme. Write the tests first for "Dark mount context" and "Structured clone of the theme" at the session level, with fake frames. Verify with `npm test`.
- [x] 4.2 Add `pushThemeChanged(session, theme)` to `mod_session.ts` and export it from the engine's `index.ts`. Test that it sends one `theme.changed` notification with the theme, and nothing after the session stopped. Verify with `npm test`.
- [x] 4.3 Update `docs/modules/lib/core/engine/README.md`: `theme` in the mount context and the `theme.changed` event. Verify that `npm run format:check` passes.

## 5. Theme in the stage (design D8)

- [x] 5.1 Add `colorScheme` to `StageOptions`, `theme` to `Stage`, and `readTheme` to `SandboxServices`, so `attachSandboxFrame` connects sessions with the current theme. Write the test first for "Color scheme changed while the mod loads": change the color scheme between launch and attach, and expect the sent context to have the new theme. Update `src/test/test_stages.ts`. Verify with `npm test`.
- [x] 5.2 Add `changeStageColorScheme(stage, colorScheme)` and export it from the stage's `index.ts`. Write the tests first for "Visible and hidden mods are told" (two running sandboxes, one hidden, each gets one push) and "Same color scheme, no event". Add a test that a loading runtime gets no push and connects with the new theme. Verify with `npm test`.
- [x] 5.3 Update `docs/modules/lib/core/stage/README.md` with the stage's theme and `changeStageColorScheme`. Verify that `npm run format:check` passes.

## 6. App theme, header and full-height layout (design D8, D10)

- [x] 6.1 Create `src/main/theme/app_theme.ts` (D8): create from storage, a `MediaQueryList` and the stage; `chooseTheme`; subscribe and snapshot functions; the document attribute; calls to `changeStageColorScheme`. Write `app` tests first with a fake `MediaQueryList` and memory storage, for "Default choice", "Operating system changes while the app is open", "Storage cannot be written" and that the choice is written to the storage. Verify with `npm test`.
- [x] 6.2 Create `ThemeControl.tsx` (a labeled `<select>` "Theme" with System, Light and Dark) and `AppHeader.tsx` (the `<h1>` and the control). Render `AppHeader` in `App.tsx`. In `main.tsx`, append the token styles to `<head>`, create the app theme next to the stage and pass the initial color scheme to `createStage`. Write a component test that choosing Dark calls `chooseTheme` and shows Dark. Verify with `npm test` and `npm run lint`.
- [x] 6.3 Add `src/main/app.css` and change `stage.css` as in D10: tokens for every color, the full-height grid, the frame at `height: 100%` with `min-height: 16rem`, and `.sandbox[hidden]` kept hidden. Verify with `npm run build` and by opening `npm run preview`: no color literals are left in `stage.css` and `app.css`, and hidden sandboxes stay hidden.
- [x] 6.4 Add Playwright tests for "Choose Dark", "Choice kept after a reload", "Dark app", "Back to light", "Mods cannot reach the choice" (a probe mod reads `storage.get` for the theme key and a few likely keys and gets `null`) and the four scenarios of "The visible frame fills the stage area" (probe mod with 3000 pixels of content, `page.setViewportSize` for the resize and the small viewport). Use `page.emulateMedia({ colorScheme })` for the operating system. Verify with `npm run test:e2e`.

## 7. Theme in mod frames, end to end (design D5, D9, D13)

- [x] 7.1 Add Playwright tests for "Attribute at mount", "Attribute before the handlers", "Page follows the color scheme", "Colors switch without a reload" (with `markFrame`/`isFrameMarked`), "Pressed button", "Tokens are readable as CSS variables", "Token values readable from JavaScript", "Dark section in a light frame", "Section keeps its color scheme", "Mod rule wins" and "Mod overrides a token", using probe mods served by `e2e/mod_routes.ts`. Verify with `npm run test:e2e`.
- [x] 7.2 Add Playwright tests for "Blank frame" and "Opted-out mod still gets the theme" with a probe mod whose file sets `theme: "none"`, and for the end-to-end "Visible and hidden mods are told" through the explorer and the viewer. Verify with `npm run test:e2e`.
- [x] 7.3 With the emulated color scheme dark, open the sample mod and record screenshots right after the frame's `load` (design, Risks). If the frame shows a light background before it turns dark, apply the fallback from Risks (hide the `<iframe>` until the stage attaches it) and add a test for it. Record the result in design.md. Verify with `npm run test:e2e`.

## 8. Sample and default mods (design D12)

- [x] 8.1 Trim the styles of `public/samples/mods/book_list/main.js`, `public/default_mods/mod_explorer/main.js` and `public/default_mods/mod_viewer/main.js` as in D12, leaving no color literals. Add Playwright tests for "Dark sample mod", "Selection uses the accent" and "Dark default mods". Verify with `npm run test:e2e` that these pass and that the existing sample and default mod tests still pass.

## 9. Integration check

- [x] 9.1 On a clean install (`npm ci`), run `npm run build`, `npm test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed, that each scenario in the four spec files has a test named after it, that the imports follow the direction of design D1 with each module imported only through its `index.ts`, and that `git status` shows only the files listed in the proposal's Impact section and this change's folder.
- [x] 9.2 Manually open `npm run preview` in Firefox and, if available, Safari or Playwright WebKit (design, Risks). Switch the Theme control between System, Light and Dark with the sample mod, the explorer and the viewer open, and change the operating system's preference with System chosen. Check that the app and every frame switch together without reloading, and that the frame fills the stage area when the window is resized. Record any difference in design.md.
