# Tasks

Start after `add-mosaic-editing`'s section 7 is applied: these tasks build on its edit button and its fold widths.

## 1. Undo the first design

- [x] 1.1 Revert the stage bar's room request from the first design of this change: `onAskRoom` and `onShowSandbox` in `use_narrow_stage_bar.ts`, `StageBar.tsx`, `StageView.tsx` and `App.tsx`, their tests, `refuseSidebarRoom` and `ignoreShownSandbox` in `src/test/test_stages.ts`, and "Room is made" in `e2e/stage_bar.spec.ts`. These files go back to their state before this change, commit `d7d6681`. Verify with `git diff d7d6681 -- src/main/stage src/App.tsx src/test/test_stages.ts e2e/stage_bar.spec.ts`, which shows no change.
- [x] 1.2 Remove the step aside from `sidebar_layout.ts`, `Sidebar.tsx` and their tests: `steppedAside`, `roomGrant`, `shownSandboxId`, `isSteppedAside`, `data-stepped-aside`, `showSidebarSandbox`, `askSidebarForRoom` and the comeback rule. Remove the step aside's scenarios from `e2e/app_sidebar.spec.ts`; section 3 writes the new ones. Verify with `npm run test -- src/main/sidebar`.

## 2. The main area keeps 784px

- [x] 2.1 In `sidebar_layout.ts`, clamp the expanded width between 200px and the smaller of 400px and the viewport's width minus 784px, instead of 40% of the viewport (design, decision 1). First update the tests in `sidebar_layout.test.ts`: 400px is drawn 316px wide at 1100px and 400px at 1184px; 200px at 983px; a drag at 1100px stops at 316px; the stored width does not change. Verify with `npm run test -- src/main/sidebar`.
- [x] 2.2 Add the compact mode (design, decision 2): `COMPACT_VIEWPORT_QUERY`, the store's mode from the narrow and compact queries, and the unstored layout of the current mode. Pass `matchMedia(COMPACT_VIEWPORT_QUERY)` in `main.tsx`, and a fake compact query in `src/test/test_app.ts`. First write the tests in `sidebar_layout.test.ts`:
  - a stored expanded sidebar shows the rail on a compact viewport, and a collapsed or hidden one keeps its state;
  - user actions there expand it inline at 200px, and store nothing;
  - leaving to a wide viewport restores the stored layout; entering a narrow one applies its rules; widening from narrow through compact to wide shows the rail until wide.

  Verify with `npm run test -- src/main/sidebar` and `npm run build`.

## 3. End-to-end and docs

- [x] 3.1 Add to `e2e/app_sidebar.spec.ts` the scenarios of "Compact viewports", "Expanding on a compact viewport" and "The main area keeps 784px":
  - narrowing from 1280px to 860px with "Nobel laureates on the map": the rail and the three capsules, the frame not reloaded, and a `MutationObserver` sees no folded capsule while it narrows;
  - widening from 767px to 1024px: a `MutationObserver` sees no expanded sidebar under 984px; expanded at 984px, 240px at 1024px;
  - opening the app on an 860×800 viewport;
  - `Ctrl+B` at 860px: expanded inline at 200px, the frame not reloaded, the rail again after a reload;
  - a stored collapsed sidebar stays collapsed from 1280px to 860px;
  - 400px stored: 316px at 1100px, 400px at 1280px.

  Update the existing e2e tests that expect an expanded sidebar on a viewport from 768px to 983px, or a width clamped to 40% of the viewport. Verify with `npm run test:e2e -- app_sidebar stage_bar`, and with `E2E_RUN=full npx playwright test app_sidebar --project firefox`, where the bug was seen.
- [x] 3.2 Document the main area's 784px and the compact viewports in the sidebar's part of `docs/modules/main/README.md`, and revert the first design's text there on the stage bar's fold. Verify that the documented rules match `sidebar_layout.ts`.

## 4. Release and verification

- [x] 4.1 Update `.changeset/fit-narrow-stage-bar.md`, a `patch` bump ("Bump rule" in `docs/releasing.md`): the change fixes a layout behavior and breaks nothing for users or instantiations. Its one-line summary: the expanded sidebar leaves the main area at least 784px and shows its rail on viewports from 768px to 983px, so the stage bar's capsules no longer fold before the sidebar makes room. Verify the file follows the format of the other files in `.changeset/`.
- [x] 4.2 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. The change touches neither `public/samples/` nor the mod API specs, so `npm run test:e2e:samples` is not needed. Verify each passes.
