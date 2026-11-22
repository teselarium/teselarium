# Tasks

Start after `add-mosaic-editing`'s section 7 is applied: these tasks build on its edit button and its fold widths.

## 1. The sidebar steps aside

- [ ] 1.1 In `src/main/sidebar/sidebar_layout.ts`, add `steppedAside`, `roomGrant`, the snapshot's `isSteppedAside`, and `askSidebarForRoom(store, sandboxId)` (design, decisions 1 and 2). First write the tests in `sidebar_layout.test.ts`:
  - an expanded wide sidebar steps aside for the first sandbox that asks, and the snapshot says `collapsed`;
  - it refuses another sandbox until the viewport narrows, then grants the shown one;
  - it refuses when collapsed, hidden or on a narrow viewport;
  - every user action clears the step aside and the grant;
  - the stored layout stays expanded at its width.

  Verify with `npm run test -- src/main/sidebar`.
- [ ] 1.2 Come back in `changeSidebarViewport` once the viewport has widened by the room the rail gave, and clear the step aside on entering a narrow viewport (design, decision 3). First write the tests: not back at +40px, back at +room, back to expanded after 700px then 1280px. Verify with `npm run test -- src/main/sidebar`.
- [ ] 1.3 Show `data-stepped-aside` on the sidebar while it has stepped aside. Verify with a test in `Sidebar.test.tsx` that the rail's button is named as for a collapsed sidebar and that pressing it expands it. Verify with `npm run test -- src/main/sidebar`.

## 2. The stage bar asks for room

- [ ] 2.1 In `src/main/stage/use_narrow_stage_bar.ts`, take `onAskRoom` and call it before a fold because the capsules don't fit, with the answer in the measure as `roomGiven` so `followBarFold` stays pure (design, decision 4). First write the tests in `use_narrow_stage_bar.test.tsx`:
  - an overflow at 480px or more asks once, and stays wide on `true`;
  - it folds on `false`;
  - it never asks under 480px or while narrow.

  Verify with `npm run test -- src/main/stage`.
- [ ] 2.2 Pass `onAskRoom` from `App.tsx` (`askSidebarForRoom.bind(undefined, layout)`) through `StageView` to `StageBar`, which binds its sandbox's id. Update `src/test/test_app.ts` and the components' tests that build `StageView`. Verify with `npm run build` and `npm run test`.

## 3. End-to-end and docs

- [ ] 3.1 Add to `e2e/app_sidebar.spec.ts` the scenarios of `app-sidebar`:
  - narrowing from 1280px to 860px with "Nobel laureates on the map": the rail and the three capsules, the frame not reloaded;
  - not back at 900px, back at 1280px;
  - `Ctrl+B` keeps it expanded, and the bar folds;
  - reload: expanded at 240px;
  - opening a long mosaic on a 900px window keeps the sidebar expanded;
  - opening the app on an 860px window;
  - 860px, then 700px, then 1280px.

  Add to `e2e/stage_bar.spec.ts` "Room is made": while the window narrows, a `MutationObserver` sees no folded capsule. Verify with `npm run test:e2e -- app_sidebar stage_bar`, in Chromium and Firefox.
- [ ] 3.2 Document the step aside in `docs/modules/main/README.md`, in the sidebar's layout section and in the stage bar's fold section. Verify that the documented rules match `sidebar_layout.ts`.

## 4. Release and verification

- [ ] 4.1 Add `.changeset/fit-narrow-stage-bar.md` with a `patch` bump ("Bump rule" in `docs/releasing.md`): the change fixes a layout behavior and breaks nothing for users or instantiations. Add a one-line summary: the sidebar shows its rail before the stage bar folds its capsules when the window narrows. Verify the file follows the format of the other files in `.changeset/`.
- [ ] 4.2 On a clean install (`npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. The change touches neither `public/samples/` nor the mod API specs, so `npm run test:e2e:samples` is not needed. Verify each passes.
