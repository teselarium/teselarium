# Tasks

Apply after `adopt-ui-stack` is archived. Each group that changes behavior writes its tests first and names each test after the spec scenario it covers, so every scenario in `specs/app-sidebar`, `specs/app-settings`, `specs/app-pages`, `specs/mod-stage`, `specs/default-mods` and `specs/theme` can be traced to a test. Unit tests run in Node (Vitest project `lib`), component tests in jsdom (project `app`), and the rest in Playwright on the built app.

## 1. Dependencies and components

- [x] 1.1 Install `react-markdown`, `remark-gfm`, `rehype-raw` and `rehype-sanitize`. Verify with `npm run build`.
- [x] 1.2 Run `npx shadcn add card switch label separator tooltip sheet` into the vendored zone, and list them in `src/vendor/shadcn/README.md`. Verify that the files land only in `src/vendor/shadcn/` and that `npm run build` and `npm run lint` pass.

## 2. Move the e2e tests off `#/` (design D11)

- [x] 2.1 Change every e2e test that opens `/` to reach the mod explorer so that it opens `/#/run?mod=mod_explorer` instead (`app.spec.ts`, `app_theme.spec.ts`, `default_mods.spec.ts`, `mod_sandbox.spec.ts`, `mod_stage.spec.ts`, `mod_theme.spec.ts`), leaving the "Home mod" and "Close" scenarios for group 3. Verify with `npm run build && npm run test:e2e` that everything still passes before the stage changes.

## 3. Stage: pages, sections and Home (design D2, D3, D4, specs/mod-stage)

- [x] 3.1 Add `stage_routes.ts` with `readStageRoute(hash, routing)` for run, page and home routes, with the page name check. Move the route part out of `stage_history.ts`. Write the tests first: `#/run?…`, `#/`, `""`, `#/guides`, `#/guides/first_steps`, `#/guides/..%2Fabout%2Findex`, `#/mods/view`, a section that isn't a page section, and the Home mod variant. Verify with `npm test`.
- [x] 3.2 Store and read the section in the history state (`{ opentesela: { position, section } }`), keeping `readHistoryPosition` compatible. Test invalid section values. Verify with `npm test`.
- [x] 3.3 Change `StageEntry` to `{ position, view, section }` and `StageSandbox` to carry `section` and `isHomeMod`. Make `openStageEntry`, `restoreStageEntry` and `keepReachedSandboxes` handle page views. Write the tests first for "A page hides the mods", "Back from a page to a mod", "Forward to a page", "Reload on a page" and "New section after going back" at the state level. Verify with `npm test`.
- [x] 3.4 Add `stage_sections.ts` (section memory) and `openStageSection` in the controller as in D3, and set membership in `openStageLink` (inherit) and `followHistory` (page section, exact link match, stored section). Write the tests first for "Back where you left off", "Activating the current section returns to its start", "One explorer for repeated visits", "Closed root opens a new one", "Last page of a page section", "Back after switching sections", "Viewer keeps Mods active", "Kept after a reload", "Link to another mod" and "Typed link to a section's mod". Verify with `npm test`.
- [x] 3.5 Change closing as in D4 (`canClose = !isHomeMod`, fallback to the Home target) and the snapshot (`visible`, `activeSection`). Replace `StageOptions.defaults.home` with `routing`, and update `src/test/test_stages.ts`. Write the tests first for "Close a mod opened from a link", "Home mod has no close button" and "The explorer can be closed". Verify with `npm test`.
- [x] 3.6 Update `docs/modules/lib/core/stage/README.md`: page entries, routes, sections and tab-bar navigation, the history state, closing, and the routing options. Verify that `npm run format:check` passes.

## 4. Section registry and default mod settings (design D5, specs/default-mods)

- [x] 4.1 Add `src/main/sections/section_registry.ts` (types, `validateRegistry`, `availableSections`) and `vanilla_sections.ts`. Write the tests first for "Reserved id", "Duplicate id", "Invalid id", a missing `home` section, and switched-off filtering ("Explorer switched off" at the unit level). Verify with `npm test`.
- [x] 4.2 Remove `home` from `DefaultModSettings`, `ResolvedDefaultModSettings` and `DEFAULT_MODS`, and update their tests. In `main.tsx`, validate the registry, build the stage's `routing` from the available sections, and render an error screen that lists the registry errors instead of the app. Verify with `npm test` and `npm run lint`.
- [x] 4.3 Add the e2e tests for "No hash", "Unknown hash", "Home as a mod" (with a test registry served through a route override or a test build flag), "Vanilla settings", "Vanilla home is not a mod" and "Explorer from the default folder". Verify with `npm run build && npm run test:e2e -- mod_stage default_mods`.
- [x] 4.4 Document the registry in `docs/modules/main/README.md`: the page layout, every field, the rules, how to add, remove or change a section when cloning, Home as a page or a mod, and switched-off sections. Verify that `npm run format:check` passes.

## 5. Layout and switch stores (design D6, D10)

- [x] 5.1 Add `src/main/sidebar/sidebar_layout.ts`: transitions, clamping, the narrow mode, storage under `opentesela.sidebar`, and an external store. Write the tests first for every transition in D6, "Collapsed after a reload", "Width after a reload", "Invalid stored layout", a storage that throws, and that narrow mode stores nothing. Verify with `npm test`.
- [x] 5.2 Add `src/main/sections/section_switches.ts` under `opentesela.sidebar-sections`. Write the tests first for "Kept after a reload", "Removed section is dropped", "New section starts on" and "Storage cannot be written". Verify with `npm test`.

## 6. Sidebar, header and layout (design D7, D8, specs/app-sidebar)

- [x] 6.1 Build `Sidebar`, `SidebarItem`, `SectionIcon` and `HamburgerButton`, and the grid layout of D8 in `src/App.tsx` with `StageView` always mounted. Add the `--sidebar*` aliases to `src/main/app.css` (D7). Move the Theme control out of `AppHeader`. Write the component tests first for "Vanilla sidebar", "Lucide icon", "Full-color image", "Tiles is coming soon", "Hamburger state" and `aria-current` from `activeSection`. Verify with `npm test`.
- [x] 6.2 Add the collapsed rail with shadcn `Tooltip`s, the collapse button, the `Ctrl/Cmd+B` shortcut, and the narrow `Sheet` drawer. Write the component tests first for the tooltip being present on focus, "Toggle with the keyboard", and the drawer closing on Escape. Verify with `npm test`.
- [x] 6.3 Add `SidebarResizeHandle` (pointer capture, `pointer-events: none` on the stage while dragging, keyboard arrows, clamp, collapse under 160px). Write the component test first for "Resize with the keyboard". Verify with `npm test`.
- [x] 6.4 Add e2e tests for "Vanilla sidebar", "Tinted image follows the color scheme", "Tiles is coming soon", "Explorer switched off", every "Section navigation" and "Active section" scenario, "Hide and restore", "Collapse keeps mods running", "Tooltip on hover", every "Resize the sidebar" scenario (including "Drag over a mod's frame"), "Collapsed after a reload", "Width after a reload", "Mods cannot reach the layout", the three "Narrow viewports" scenarios, "Toggle with the keyboard", "Frame beside the sidebar", "The explorer can be closed" and "Dark sidebar". Verify with `npm run build && npm run test:e2e`.
- [x] 6.5 Let the collapsed rail's resize handle expand the sidebar: dragging to 160px or wider expands it and follows the pointer, a shorter drag leaves it collapsed, and the right arrow key expands it (D6, D7). Write the tests first for "Drag to expand", "Short drag stays collapsed" and "Expand with the keyboard", as unit, component and e2e tests. Verify with `npm test` and `npm run build && npm run test:e2e -- app_sidebar`.
- [x] 6.6 Apply the 160px threshold live while the handle is held: dragging narrower than 160px collapses the sidebar at once, dragging back expands it, and releasing keeps the state the drag reached (D7). Write the tests first for "Drag to collapse" (collapsed before release) and "Drag back before releasing", as unit, component and e2e tests. Verify with `npm test` and `npm run build && npm run test:e2e -- app_sidebar`.

## 7. Markdown pages (design D9, specs/app-pages)

- [x] 7.1 Add `src/main/pages/page_links.ts` and `page_sanitize_schema.ts`. Write the tests first for the D9 link table, image resolution, and the sanitizer: "Card from markdown", "Badge from markdown", "Script removed", "Event handler removed", "Style attribute removed", plus `javascript:` links, `<iframe>`, `<form>`, `role="button"` and `data-ot-variant` on a `<div>` (all removed). Verify with `npm test`.
- [x] 7.2 Add `MarkdownPage` (fetch, front matter dropped, react-markdown pipeline, shadow root with `THEME_FRAME_STYLES` and the host rules, error `Alert`) and `PageView`. Write the component tests first for "Front matter", "Missing page" and a stale fetch being ignored. Verify with `npm test`.
- [x] 7.3 Add `public/pages/home/index.md`, `public/pages/guides/index.md` and `public/pages/about/index.md` as in D9. Verify that each has a level 1 heading and a `role="status"` note.
- [x] 7.4 Add e2e tests for "Index page", "Sub-page", "Name with a path", "Index file", "Replaced page", "Same heading as a mod", "Card in a page", "Page styles stay inside", "Dark page", "Sibling page", "Run link", "Other site", "Image next to the page", "Missing page" and "Vanilla Home", plus "Script removed" in a real browser. Verify with `npm run build && npm run test:e2e`.
- [x] 7.5 Replace the `# TODO` stubs in `docs/modules/main/homepage/README.md` and `docs/modules/main/about/README.md` (or make one the pages doc and link it from the other): files and addresses, sub-pages and name rules, the allowed HTML with examples (card, alert, badge, details, color scheme section), links and images, and how pages share the mods' look. Verify that `npm run format:check` passes.

## 8. Settings page (design D10, specs/app-settings, specs/theme)

- [x] 8.1 Add `SettingsPage` with the Appearance card (`ThemeControl`) and the Sidebar card (rows, switches, "Always shown", "Coming soon"), and connect the sidebar to the switches. Write the component tests first for "Vanilla settings page", "Hide Guides", "Hide a coming-soon section" and "Show it again". Verify with `npm test`.
- [x] 8.2 Add e2e tests for "Vanilla settings page", "Hide Guides", "Explorer through a link while Mods is hidden", "Guides page while Guides is hidden", "Current again after switching on", "Kept after a reload" (switches), "Mods cannot reach the switches", and the theme scenarios "Default choice", "Choose Dark" and "No Theme control in the header". Update `e2e/app_theme.spec.ts`'s `chooseTheme` helper to open Settings first. Verify with `npm run build && npm run test:e2e -- app_theme`.
- [x] 8.3 Replace the `# TODO` stub in `docs/modules/main/settings/README.md`: what the page holds, the stored keys, and what hiding a section does and does not do. Verify that `npm run format:check` passes.

## 9. Integration

- [x] 9.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`. Verify that all pass.
- [x] 9.2 Check in `npm run preview`, in light and dark, at 1280×800 and 375×700: the expanded, collapsed and hidden sidebar, resizing over a frame, tab-bar navigation through Mods, Home, Guides and Settings with back and forward, a markdown page next to a mod (same look), the Settings page, and the drawer on the narrow viewport. Verify with screenshots, and fix anything that differs from the specs.

## Workflow follow-up

- The user reviews and commits the changes manually.
- Archive the change with `/opsx:archive` after review.
- After archiving, edit the Purpose of `openspec/specs/mod-stage/spec.md` by hand, since a delta can't change it: it says one sandbox is visible, and becomes at most one, with pages in between.
