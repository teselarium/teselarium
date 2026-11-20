# Tasks

## 1. Phone test project

- [ ] 1.1 Add a `mobile` project to `playwright.config.ts` (design D9):
  - `devices["Pixel 7"]`, `grep: /@mobile/`;
  - `buildProjectFilters` makes the desktop projects skip `@mobile`;
  - the `samples` run leaves the `mobile` project out;
  - the comment over `projects` explains the new project.

  Verify `npx playwright test --list` shows the `mobile` project in the default and full runs and not in `E2E_RUN=samples`, and that no existing test moves between projects.

## 2. Tooltips only where the pointer can hover (stage-bar, app-sidebar)

- [ ] 2.1 Add `src/main/HoverTooltip.tsx` (design D4):
  - it wraps the vendored tooltip;
  - it renders it only while `matchMedia("(hover: hover)")` matches, following changes;
  - otherwise it renders only the trigger.

  Add a unit test with a fake media query (as `src/test/fake_color_scheme_queries.ts` does for the color scheme) that covers hover, no hover and a change. Verify `npm run test` passes.
- [ ] 2.2 Switch `SidebarItem`, `SidebarThemeControl`, `StageBarIconButton`, `CombinationCapsule`, `CombinationList` and `SitesChip` to `HoverTooltip`. Extend each component's existing unit test, or add one, to check that the tooltip's text is in the element's accessible name or visible text. Verify `npm run test` passes, and that the desktop tooltip tests in `e2e/app_sidebar.spec.ts` and `e2e/stage_bar.spec.ts` still pass.
- [ ] 2.3 Add `@mobile` e2e tests for the two "tooltips need a pointer that can hover" requirements:
  - tap the Mods rail icon: no tooltip;
  - tap the messages button twice: no tooltip.

  Verify they fail before 2.2 and pass after.
- [ ] 2.4 Add the tooltip wrapper to the "UI components" rules of `docs/code_conventions.md` (tooltips go through `HoverTooltip`). Verify the rule names the file.

## 3. The stage bar folds its right side under 480px (stage-bar, stage-layout)

- [ ] 3.1 Add `pickMessagesView`, `pickUnreadView` and `describeMessagesButton` to `src/main/stage/message_level_views.ts` (design D2), with unit tests:
  - most severe level first, empty case, unread versus read;
  - the accessible name gives each level's count and the unread total.

  Verify `npm run test` passes.
- [ ] 3.2 Add the `useNarrowStageBar` hook (design D1): a `ResizeObserver` on the bar's content box, `true` under 480px. Add a unit test with a fake observer at 479, 480 and 481px. Verify `npm run test` passes.
- [ ] 3.3 Build the messages button and its grouped popover:
  - extract `MessagePopover`'s item renderer;
  - add `MessagesButton` and `MessagesPopover`;
  - add the `messages` panel to `stage_bar_panels.ts`.

  Add component tests: groups and headings in severity order, an empty level left out, "No messages.", unread marks, dismiss and "Clear all", reading on open and on close. Verify `npm run test` passes, and that the existing `MessageButton` and `MessagePopover` tests are unchanged and pass.
- [ ] 3.4 Give `MoreActionsMenu` a narrow mode (design D3):
  - "Theater mode" as a checkbox item;
  - "Fullscreen" only with a running mod frame;
  - the theater and fullscreen handlers passed in as props and shared with the buttons.

  Add component tests: the items show only in narrow mode, the check follows theater mode, and the fullscreen item is absent without a frame. Verify `npm run test` passes.
- [ ] 3.5 Wire the narrow form into `StageBar.tsx`:
  - the right side holds the messages button, then a separator and Close when the sandbox can close;
  - the narrow flag is passed to `MoreActionsMenu`;
  - an open message panel closes when the flag changes.

  Verify the existing desktop e2e tests in `e2e/stage_bar.spec.ts` and `e2e/stage_layout.spec.ts` still pass unchanged.
- [ ] 3.6 Add `@mobile` e2e tests for the stage-bar and stage-layout scenarios:
  - phone at 360×740: right side order, no sideways scroll, Close inside the viewport;
  - the title is readable: the capsule is at least 120px;
  - the messages button with an error and notifications, its grouped popover, all read, empty;
  - theater and fullscreen from the menu, with the frame not reloaded;
  - the wide bar's menu without those items, at 1280×800 in a desktop test;
  - the switch at 479 and 481px wide.

  Verify they pass, and that they fail on the current code where the requirement is new.
- [ ] 3.7 Describe the narrow stage bar in the stage bar section of `docs/modules/main/README.md`:
  - under 480px: one messages button and its grouped popover;
  - theater mode and fullscreen in "More actions".

  Verify the section names the 480px threshold that "The bar folds as it narrows" uses.

## 4. Combination lists (combination-pickers)

- [ ] 4.1 Give `CombinationList`'s rows the `group` class and their secondary spans `group-data-[selected=true]:text-accent-foreground` (design D5). Add e2e checks in the existing combination list tests: the highlighted row's aliases compute to `--ot-accent-foreground`, with a contrast of at least 4.5:1, in the light and dark schemes. Verify they fail before the change and pass after.
- [ ] 4.2 Remove the height overrides from the explorer links (design D6), and add an e2e check that "Open the collection explorer" is at least 32px tall. Verify it passes, and that "Open the collection explorer" still shows the Tiles section.

## 5. Sidebar on short and narrow viewports (app-sidebar)

- [ ] 5.1 Put the section `<nav>` and the theme list in one scrolling wrapper between the heading row and the toggle row in `Sidebar.tsx` (design D7). Add tests:
  - a `@mobile` e2e test at 915×412: the "Collapse sidebar" button is inside the viewport and collapses the sidebar, and the theme control can be scrolled into view;
  - a desktop e2e check at 1280×800: the items cannot scroll.

  Verify both pass, and that the existing sidebar tests still pass.
- [ ] 5.2 Set `showCloseButton={false}` on the drawer's `SheetContent` (design D8). Add a unit test in `Sidebar.test.tsx`: the open drawer has no button named "Close". Add a `@mobile` e2e test: the hamburger button, the backdrop and Escape each close the drawer. Verify both pass.
- [ ] 5.3 Describe the scrolling items and the drawer's close controls in the sidebar section of `docs/modules/main/README.md`. Verify it matches "Sidebar fits short viewports" and "Drawer has no extra close button".

## 6. Planning rule for phones and color schemes

- [ ] 6.1 Add the rules of design D10 to `openspec/config.yaml`, under `rules.proposal`, `rules.specs` and `rules.tasks`, after the existing rules and with the same style. Verify `openspec validate --all` still passes, and that `openspec instructions proposal --change fix-app-shell-on-phones --json`, and the same for `specs` and `tasks`, each show the new rule.

## 7. Release note

- [ ] 7.1 Add `.changeset/fix-app-shell-on-phones.md` with a `patch` bump for `opentesela`, following the bump rule in `docs/releasing.md`, and a one-line summary: the app's shell works on phones (the stage bar folds into one messages button and moves theater and fullscreen into "More actions", no stray tooltips on touch, readable highlighted list rows, a scrollable sidebar on short screens). Verify `npx changeset status` lists it.

## 8. Verification

- [ ] 8.1 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`, which includes the new `mobile` project. Verify all pass.
- [ ] 8.2 Re-run the local audit: `cd .audit/android-themes && node audit.mjs 01-app-shell`, `node audit.mjs 02-stage-chrome --frames=app` and `node behaviors.mjs`. Before running, remove the B1–B4 and A1 entries from `known.json`. Confirm that no B1–B4, A1 or F1 finding remains, and that the 19 behavior checks still pass. Then look at the stage bar screenshots on `pixel7` and `small`. Record the result in `.audit/android-themes/findings.md`.
