# Proposal

## Why

The Android audit (`.audit/android-themes/findings.md`, not committed) found that the app's own interface breaks on phones, in both themes:

- **B1, the stage bar's right side:** the three message buttons, theater, fullscreen and close never fold. They take 278px of a 316px bar on a 412px phone, and of a 264px bar on a 360px phone. The title is reduced to nothing ("Mods" disappears, the version overlaps the warnings icon). The mosaic capsule that the spec folds to "one capsule with the mosaic's title" is a 22px icon. At 360px the bar is wider than the screen, so the page scrolls sideways and Close is cut. Every mod is affected.
- **B2, tooltips on touch:** a tapped rail icon leaves its tooltip on screen.
- **B3, contrast:** the highlighted row of the combination lists draws its secondary text at 3.69:1 in both themes.
- **B4, explorer links:** the lists' explorer links are 20px tall.
- **A1, the drawer:** it has a second, 16px close button.
- **F1, short screens:** on a landscape phone the expanded sidebar's collapse button is cut off and cannot be reached.

No test runs the app on a phone-sized, touch viewport, and no planning rule asks changes to consider phones or both color schemes, which is how these went unnoticed.

## What Changes

- **Stage bar under 480px wide** (the left side already folds into one capsule at that width): the right side folds too.
  - The three message buttons become one **messages button**. It shows the icon of the most severe level that has messages and the total count. Its capsule is filled in the color of the most severe level with unread messages, and muted once all are read.
  - The button opens one popover listing the messages grouped by level (errors, warnings, notifications), with the same unread marks, dismiss buttons and "Clear all" as today.
  - **Theater mode** and **Fullscreen** move into the "More actions" menu, as a checkable item and an item.
  - Close stays last. The right side keeps one fixed size within each width range.
  - From 480px up, the stage bar is unchanged.
- **Tooltips** of the stage bar, its lists and the sidebar open only on devices that can hover. On a touch-only device a tap no longer leaves a tooltip behind. Every tooltip's text is still in its element's accessible name.
- **Combination lists:** a highlighted row draws its secondary text (details, aliases, score) in the accent's foreground color, which meets 4.5:1 in both themes. The explorer links are at least 32px tall.
- **Sidebar on short viewports:** the section items scroll when they do not fit. The heading row and the collapse or expand button always stay visible.
- **Drawer:** the open drawer on a narrow viewport has no close button of its own. The hamburger button, the backdrop and Escape close it.
- **Tests:** a Playwright project emulating a Pixel 7 (touch, 412×915) runs the tests tagged `@mobile`, which cover the narrow stage bar, the tooltips, the drawer and the short sidebar.
- **Planning rule:** `openspec/config.yaml` gets rules for proposals, specs and tasks. A change that adds or changes the app's interface, or the layout of a default or sample mod, must cover a phone viewport (narrow, touch) and both color schemes, in its scenarios and in its tests (`@mobile` tests). This changes how changes are planned, not the app's behavior.
- **Versions:**
  - **Mod API version bump: none.** The stage bar, the sidebar and the lists are the app's interface. No engine method, event, mount context key or mod file key changes, and the fullscreen and theater behavior mods see (`stage-layout`'s layouts and events) is unchanged.
  - **App bump: patch.** This is a fix, and nothing breaks for users or instantiations.

Out of scope:
- The content of mod frames, which is `fix-mod-content-on-phones`.
- The sidebar resize handle on touch (accepted in the audit).
- Mermaid diagram sizing (accepted).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `stage-bar`: under 480px the right side folds: one messages button with a grouped popover, and theater and fullscreen in "More actions". This changes "One-row stage bar", "Theater mode button", "Fullscreen button", "More actions menu" and "The bar folds as it narrows". New requirements cover the messages button, its popover, and tooltips only where the device can hover.
- `stage-layout`: "Fullscreen the visible mod" is started by the fullscreen button or, on a narrow bar, the "Fullscreen" item of "More actions".
- `app-sidebar`: tooltips only where the device can hover. The sidebar's items scroll on short viewports while the heading row and the collapse button stay visible. The narrow drawer has no extra close button.
- `combination-pickers`: the highlighted row's secondary text stays readable, and the explorer links are at least 32px tall.

## Impact

- Stage bar:
  - `src/main/stage/StageBar.tsx` (the right side in two forms switched by the existing container query, as the left side is);
  - `MessageButton.tsx`, `MessagePopover.tsx`, `message_level_views.ts` (a messages button and a grouped popover built from the per-level parts);
  - `MoreActionsMenu.tsx` (the "Theater mode" and "Fullscreen" items);
  - `stage_bar_panels.ts` (the new panel).
- Tooltips: a project wrapper in `src/main/` around shadcn's tooltip, used by the six components that use it today: `SidebarItem.tsx`, `SidebarThemeControl.tsx`, `StageBarIconButton.tsx`, `CombinationCapsule.tsx`, `CombinationList.tsx` and `SitesChip.tsx`. The vendored file is not edited.
- Lists: `src/main/stage/CombinationList.tsx` (highlighted row colors, explorer link size).
- Sidebar: `src/main/sidebar/Sidebar.tsx` (scrolling item area, `showCloseButton={false}` on the drawer's `SheetContent`).
- Tests:
  - `playwright.config.ts` gets a `mobile` project filtered on `@mobile`, run in the default run, since these tests depend on the device;
  - new `@mobile` tests in `e2e/stage_bar.spec.ts` and `e2e/app_sidebar.spec.ts`;
  - unit tests next to the changed modules.
- Docs: the stage bar and sidebar sections of `docs/modules/main/README.md`, and the tooltip wrapper in the "UI components" rules of `docs/code_conventions.md` (when a vendored component needs app behavior, a project component wraps it).
- OpenSpec config: `openspec/config.yaml` (`rules.proposal`, `rules.specs`, `rules.tasks`).
- A changeset `.changeset/fix-app-shell-on-phones.md` (patch).
