# Design

## Context

- The sidebar's layout is a store in `src/main/sidebar/sidebar_layout.ts`. It holds a stored `wide` layout and an unstored `narrow` one, and publishes a frozen snapshot. `main.tsx` passes it `matchMedia(NARROW_VIEWPORT_QUERY)` and window resizes (`changeSidebarViewport`), and `App.tsx` turns the snapshot into the `--sidebar-column` width.
- Entering a narrow viewport rebuilds the narrow layout from the wide one, collapsed; user actions there change only the narrow layout; leaving it shows the wide layout again. Nothing in that mechanism depends on history.
- The expanded width is clamped between 200px and the smaller of 400px and 40% of the viewport (`clampSidebarWidth`).
- The stage bar (`src/main/stage/use_narrow_stage_bar.ts`) folds its capsules when they don't fit its width. It knows nothing of the sidebar, and keeps it that way.

## Goals / Non-Goals

**Goals:**
- The stage bar's capsules get room before they fold, from the layout alone.
- The sidebar's state is a function of the viewport's width and the stored layout: it never moves when the user didn't resize the window, and never goes back and forth while it is resized.
- Nothing new is stored, and no frame reloads.

**Non-Goals:**
- Changing the stage bar's fold.
- Fitting every possible title: a mosaic long enough to fold beside 784px of main area folds, as beside a collapsed sidebar today.
- Changing viewports narrower than 768px.

## Decisions

### 1. The main area keeps 784px beside the expanded sidebar

- `clampSidebarWidth(width, viewportWidth)` clamps between 200px and the smaller of 400px and `viewportWidth - 784` (`MIN_MAIN_WIDTH`), instead of 40% of the viewport. 784px leaves the stage bar about 760px with the shell's gaps, well above the about 606px at which "Nobel laureates on the map" folds in Firefox.
- The 40% cap goes: on a viewport of 984px or more, `viewportWidth - 784` is always the smaller of the two whenever it is under 400px, so 40% never binds.
- The stored width doesn't change: a 400px sidebar is drawn 316px wide on an 1100px viewport, and 400px again at 1184px.
- Because the drag is clamped the same way, a drag never takes the main area under 784px, and never switches the mode while the handle is held.
- Alternative: a switch point that depends on the stored width (rail when the viewport is narrower than the width plus 784px). Rejected: dragging wider would cross it, and the sidebar would collapse under the pointer.

### 2. A compact mode, from a second media query

- Under 984px (200px + 784px), even the narrowest expanded sidebar leaves less than 784px. `COMPACT_VIEWPORT_QUERY` is `(min-width: 768px) and (max-width: 983.98px)`, which `main.tsx` passes beside the narrow query.
- The store's mode is `"narrow" | "compact" | "wide"`, from the two queries; `isNarrow` stays in the snapshot. The unstored `narrow` layout becomes the layout of the current unstored mode:
  - entering narrow builds it collapsed, as today;
  - entering compact builds it from the wide layout, expanded shown as collapsed, collapsed and hidden kept;
  - user actions in either change only it; leaving to wide shows the stored layout.
- On a compact viewport the resize handle stays, and the expanded sidebar is inline, clamped to 200px by decision 1. The user's expansion is a choice for this viewport, not stored.
- The mode follows the queries' `change` events, not the resize events, as the narrow mode does today. It never depends on what the stage bar shows.
- Alternative: raise the narrow breakpoint to 984px. Rejected: between 768px and 983px, expanding would open the drawer over the content instead of inline.
- Alternative: the stage bar asks the sidebar for room when its capsules overflow (the first design of this change). Rejected after implementing it: it needed a grant bound to the sandbox shown, a comeback width, exceptions for user actions and narrow viewports, and still made the sidebar expand and collapse again when the window widened past 768px.

### 3. The stage bar is unchanged

- The bar keeps folding by its own width and overflow. It gets its room because the main area keeps 784px, so it needs no callback, and the stage module still knows nothing of the sidebar.

## Risks / Trade-offs

- [A short title gets the rail from 768px to 983px though it would fit beside the expanded sidebar.] → The rail is one press, or `Ctrl+B`, away, and the main area is wider for it.
- [The expanded sidebar is narrower than its stored width on viewports under 1184px.] → It shows the stored width again once the viewport is wide enough, and the user's drag still works within the bound.
- [Engines differ by a few pixels in where the capsules fold.] → The rule doesn't depend on measuring the capsules; 784px leaves about 150px of margin over the measured fold.
