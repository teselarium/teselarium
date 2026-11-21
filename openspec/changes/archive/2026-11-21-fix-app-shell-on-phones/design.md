# Design

## Context

See proposal.md (Why) and the audit notes (`.audit/android-themes/findings.md`: B1–B4, A1, F1). Measured and read in the code:

- **Stage bar** (`src/main/stage/StageBar.tsx`): a `<section class="stage-bar @container">` with a left `div` (`min-w-0 flex-1`) and a right `div` (`shrink-0`, `gap-3`). The left side already folds with Tailwind container variants (`@max-[479px]`, `@min-[480px]`, …), so it is pure CSS. The right side is always 278px: five 32px buttons, three more for theater, fullscreen and close, and two separators. The bar's content box is 316px on a 412px phone and 264px on a 360px phone.
- **Messages:**
  - `MESSAGE_LEVEL_VIEWS` and the helpers in `message_level_views.ts` (`listLevelMessages`, `countUnreadMessages`, `describeLevelButton`, `describeCapsuleCount`) build one `MessageButton` and one `MessagePopover` per level.
  - `StageBar` keeps one open panel at a time (`openPanel`, see `stage_bar_panels.ts`).
  - Read state lives in the stage (`markMessagesRead` in `src/lib/core/stage/stage_controller.ts`, per level).
- **"More actions"** (`MoreActionsMenu.tsx`): a shadcn `DropdownMenu`, whose content is **portaled** to `document.body`, outside the bar's container. The vendored menu has `DropdownMenuCheckboxItem`.
- **Tooltips:** six project components use the vendored shadcn tooltip directly: `SidebarItem`, `SidebarThemeControl`, `StageBarIconButton`, `CombinationCapsule`, `CombinationList` and `SitesChip`. On a touch device, Radix opens a tooltip on focus, which a tap gives, and keeps it until the focus moves.
- **Combination lists** (`CombinationList.tsx`): rows are cmdk items. The vendored item draws `data-[selected=true]:bg-accent text-accent-foreground`, but the row's secondary spans force `text-muted-foreground`. That color on `--ot-accent` is 3.69:1 in both schemes. The explorer link is a `Button variant="link" size="sm"` whose classes bring it down to 20px.
- **Sidebar** (`Sidebar.tsx`):
  - The `<aside>` is `flex-col overflow-hidden`. It holds the heading row, the section `<nav>` (`shrink-0`), the theme list and the toggle row (`mt-auto`).
  - When the content is taller than the aside, nothing scrolls and the toggle row is clipped.
  - The narrow drawer is a shadcn `SheetContent`, whose `showCloseButton` defaults to `true`.
- **Playwright** (`playwright.config.ts`):
  - three desktop projects, filtered by `buildProjectFilters` from `E2E_RUN`;
  - no project emulates a phone (`isMobile`, `hasTouch`), so `(hover: none)` and touch taps are never exercised.

## Goals / Non-Goals

**Goals:**
- One threshold, 480px of stage bar content width, for both sides of the bar and for the menu, so they never disagree.
- Reuse the per-level message parts for the messages button and its grouped popover, so the read, unread, dismiss and flash rules stay in one place.
- Fix the tooltips once, for every component that uses them, without editing vendored code.
- Every behavior that depends on the device runs in a phone project, and only those tests.
- Keep phone width and both color schemes in every future interface change's plan, not only in this one.

**Non-Goals:**
- No change to the left side's folding or to the stage's message model (levels, read state, limits).
- No new interaction on desktop: from 480px up, the bar, its popovers and its menu are as today.
- No redesign of the drawer or the sidebar beyond the scroll area and the extra close button.

## Decisions

### D1. The bar decides once whether it is narrow, and both sides and the menu follow it

A small hook, `useNarrowStageBar`, observes the bar's content box and its left side with a `ResizeObserver`. It returns `true` (narrow) when:
- the bar's content box is under 480px; or
- the bar is wide and its left side, or the capsule row in it, overflows (`scrollWidth > clientWidth`): its capsules have reached their minimum width (D11) and still do not fit beside the bar's other items. The row is measured too because it shrinks with the left side: its capsules can overflow it, under the "More actions" button, while the left side itself does not.

When it turns narrow because of an overflow, it records the bar's content width at that moment, and stays narrow until the bar is wider than that width. While narrow, the capsule row is hidden and cannot be measured, and the recorded width keeps the bar from switching back and forth. The record is dropped when what the bar holds changes (the sandbox, the Sites chip, the fullscreen or the close button), and the bar is measured again in its wide form.

The right side renders either its wide form (as today) or its narrow form from that value, and passes it to `MoreActionsMenu`. The bar carries it as a `data-narrow` attribute, which the left side's fold step follows (`group-data-[narrow]` variants) in place of the `@max-[480px]` container variant. The 720px and 960px steps stay container variants: they only hide text inside capsules.

- **Why JavaScript and not container variants, as the left side used:** the menu is portaled outside the bar, where no container query reaches. Rendering both right sides and hiding one with CSS would also keep two sets of popover triggers mounted, and an open popover anchored to a hidden trigger is drawn at the corner. A container query cannot know whether the capsules fit either.
- **Why both sides agree:** they read the same flag. The 480px part compares the content box, which `ResizeObserver`'s `contentBoxSize` reports and which the container queries of the other steps compare too.
- **Crossing between narrow and wide:** when the value changes, `StageBar` closes an open message panel (`setOpenPanel(null)`). It's the same thing it already does before fullscreen.
- **Alternatives:** move the whole bar to JavaScript widths, a larger rewrite of the left side for no user-visible gain; or a fixed higher threshold (about 600px), which ignores whether the bar has a Sites chip or a close button, and would fold bars that fit.

### D2. The messages button and popover are built from the per-level parts

- **Pure functions** in `message_level_views.ts`, unit-tested:
  - `pickMessagesView(messages)`: the most severe level with messages, else notifications as dimmed;
  - `pickUnreadView(messages)`: the most severe level with unread messages, or none;
  - `describeMessagesButton(messages)`: the accessible name, which gives each level's count and the unread total.
- **`MessagesButton`** renders the chosen level's icon with a capsule built by the same capsule code as `MessageButton`, holding the total count. The capsule is filled with the unread view's class, or `READ_CAPSULE_CLASS_NAME` when everything is read. It flashes on the same `flashId` rule, with the newest message of any level.
- **`MessagesPopover`** renders, for each level with messages and in severity order, the level's heading and that level's items, using `MessagePopover`'s item renderer. The renderer is extracted, not copied, so marks, the dismiss button and "Clear all" behave the same. "No messages." covers the empty case.
- **Read state:** opening it calls `markMessagesRead` for each level. Closing it marks what arrived while it was open, as the level popovers do. The panel id is `messages` in `stage_bar_panels.ts`.
- **Alternative:** tabs per level inside one popover. That's one more tap to reach a level, and a new pattern in the app.

### D3. Theater mode and Fullscreen as menu items on a narrow bar

When the bar is narrow, `MoreActionsMenu` adds, after a separator:
- a `DropdownMenuCheckboxItem` "Theater mode", checked from the theater setting, which calls the same handler as the button;
- a `DropdownMenuItem` "Fullscreen", only while the sandbox has a running mod frame, which calls `onFullscreen`.

The handlers move out of `StageBar`'s closure into props, so the button and the item share one code path.

- **Why theater stays reachable** although it has no visible effect on a phone frame: the setting is shared with the user's other screen sizes (`stage-layout`, remembered). The narrow bar must not make it impossible to turn off.

### D4. A project tooltip that opens only where the pointer can hover

`src/main/HoverTooltip.tsx` wraps the vendored `Tooltip`, `TooltipTrigger` and `TooltipContent`:
- It reads `matchMedia("(hover: hover)")` with `useSyncExternalStore`, so it follows changes such as docking a tablet.
- Where the primary pointer can hover, it renders the vendored tooltip as today.
- Where it cannot, it renders only the trigger.

The six components switch to it. The vendored file is unchanged, as the code conventions ask ("When a vendored component needs app behavior, a project component in `src/main/` wraps it").

- **Why `(hover: hover)`:** it describes the primary pointer. A touch laptop with a mouse keeps its tooltips, and a phone loses them.
- **Accessible names:** every current tooltip text is already the element's accessible name or visible text. A unit test per component pins this, so nothing is lost on touch.
- **Alternative:** Radix's `delayDuration` or `disableHoverableContent` don't stop focus-opened tooltips. Patching the vendored file is not allowed.

### D5. Highlighted rows: the row's text follows the accent pair

The cmdk item gets the `group` class (through its `className` prop, so the vendored file stays unchanged). The row's secondary spans (details, aliases, score, muted score, spinner) add `group-data-[selected=true]:text-accent-foreground`. `--ot-accent-foreground` on `--ot-accent` is a pair that `theme`'s "Token contrast" already guarantees at 4.5:1 in both schemes, so no token changes.

### D6. Explorer links at the small button size

The explorer link drops the classes that override its height, so `size="sm"` gives it the 32px of the app's small buttons. It stays `variant="link"`.

### D7. The sidebar's items scroll between fixed first and last rows

In `Sidebar.tsx`, the section `<nav>` and the theme list move into one wrapper, `min-h-0 flex-1 overflow-y-auto`. The heading row stays above it and the toggle row below, outside the scroller, so both are always visible. The `<nav>` loses `shrink-0`.

The same structure serves the rail and the drawer's content. On tall viewports the wrapper does not overflow, so nothing changes.

- **Alternative:** scroll the whole `<aside>`. That would scroll the hamburger and the toggle away, which is the bug.

### D8. The drawer loses its extra close button

`SheetContent` gets `showCloseButton={false}`. The hamburger button, the backdrop and Escape still close the drawer (Radix Dialog's own handling plus the sidebar's).

### D9. A `mobile` Playwright project for `@mobile` tests

- **The project:** `playwright.config.ts` adds a project `mobile` with `devices["Pixel 7"]` (Chromium, `isMobile`, `hasTouch`, 412×915), filtered with `grep: /@mobile/`.
- **Filters:** `buildProjectFilters` gains the rule that the desktop projects skip `@mobile`, and the `samples` run skips the `mobile` project.
- **Runs:** the `default` and `full` runs include it, since these tests guard everyday phone use.
- **What gets the tag:** only tests whose result depends on the device, that is on touch or on a pointer that cannot hover: tooltips with `(hover: none)` and drawer taps.
- **Phone sizes without the tag:** the narrow bar at 360×740 and 412×915, the switch at 479 and 481px, and the short sidebar at 915×412 depend only on the viewport's size. They run in the default project with `page.setViewportSize`, as `fix-mod-content-on-phones` tested its phone layouts. Running them under device emulation as well would be an expensive variant their result doesn't depend on, which the code conventions advise against.
- **Shared test parts:**
  - the phone and desktop viewports (`PHONE_VIEWPORT` 412×915, `SMALL_PHONE_VIEWPORT` 360×740, `DESKTOP_VIEWPORT` 1280×800), today copied in `e2e/default_mods.spec.ts` and `e2e/sample_book_list.spec.ts`, move to `e2e/layout_probes.ts`;
  - the new tests use them, and that file's `readElementBox` and `isFullyShown` for "inside the viewport" and width checks.
- **The rest:** pure logic (D2's functions) and component behavior (the menu items, the grouped popover, no close button in the drawer) are tested with Vitest and Testing Library at their own level, as the code conventions ask.

### D10. Phone and color scheme rules in `openspec/config.yaml`

The project's OpenSpec config gets one rule per artifact, applied to every change that adds or changes the app's interface, or the layout of a default or sample mod:
- **proposal:** state how the change behaves on a phone viewport and in both color schemes, or why that does not apply;
- **specs:** layout requirements get at least one scenario on a phone viewport (360×740 or 412×915), and color requirements say what holds in both color schemes;
- **tasks:**
  - layout that depends only on the viewport's size gets e2e tests at a phone viewport (360×740 or 412×915) with `page.setViewportSize`, using the viewports of `e2e/layout_probes.ts`;
  - behavior that depends on touch or on a pointer that cannot hover gets `@mobile` e2e tests;
  - new or changed colors get a check in both color schemes.

- **Why `rules` and not `context`:** `openspec instructions` hands each artifact's rules to whoever writes that artifact, at the moment they write it. A line in `context` is background that is easy to skip.
- **Why in this change:** the rule's `@mobile` tests need the `mobile` project that D9 adds.
- **Alternative:** an automated phone and theme sweep over every screen. It catches what the rule can't (screens nobody planned for), but it's a change of its own, and it was left for later.

### D11. A capsule is never narrower than its icon and chevron

`CombinationCapsule` replaces `min-w-0` with a minimum width of its padding, its icon, its chevron and the gaps between them (and the title's gaps when the title is shown), so when the capsules shrink, the title shrinks to its ellipsis and the icons stay inside the capsule. When even that does not fit, the bar turns narrow (D1).

- **Alternative:** `min-w-min`, which would count the title's longest word and keep capsules too wide.

## Risks / Trade-offs

- [A capsule's full title is only in its tooltip on desktop, and touch has none] → The capsule's accessible name holds the full title (stage-bar "Narrow bar"). On a narrow bar, the capsule's menu rows name the mosaic, mod and collection.
- [The bar's sides could disagree at the fold] → Both follow the hook's flag (D1). The other steps' container variants name their lower bound, `@max-[720px]` and `@max-[960px]`, which Tailwind compiles to `width < 720px` and `width < 960px`. (`@max-[479px]`, used before, compiled to `width < 479px`, so between 479 and 480px both left-side forms showed.) An e2e check at 479 and 481px pins the fold.
- [Folding on overflow could flip back and forth] → The bar stays narrow until it is wider than the width at which it folded (D1), and that width is measured again only when the bar's content changes.
- [An open popover when the bar crosses 480px] → D1 closes it, as fullscreen does.
- [Theater mode moves out of sight on phones] → It is in "More actions", checked when on. Its effect on a phone frame is nil anyway.
- [The mobile project lengthens the default e2e run] → Only `@mobile` tests run there, a handful.
- [`(hover: hover)` misreports on some hybrid devices] → The tooltip text is never the only source of information (D4), so a wrong guess costs a hint, not access.
- [A rule is advice: a change can still skip phones] → It is shown with every proposal, specs and tasks instruction, and reviewers can point to it. An automated sweep, the stronger guard, remains possible as a later change.

## Migration Plan

No data or API migration. The theater setting and the sidebar layout keep their storage keys and values. Ships as a patch, and rollback is reverting the change.
