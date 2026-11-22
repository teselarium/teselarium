# Design

## Context

- The sidebar's layout is a store in `src/main/sidebar/sidebar_layout.ts`. It holds a stored `wide` layout and an unstored `narrow` one, and publishes a frozen snapshot. `App.tsx` turns the snapshot into the `--sidebar-column` width, and `main.tsx` passes window resizes to `changeSidebarViewport`.
- The stage bar folds in `src/main/stage/use_narrow_stage_bar.ts`. A `ResizeObserver` reads the bar's content width. A layout effect then measures whether the capsule row overflows and applies the pure `followBarFold`, which records `foldedAt` so the bar stays narrow until it is wider.
- Each runs before the paint: the store publishes synchronously, and `useSyncExternalStore` re-renders synchronously in a layout effect. A window resize runs before layout, and `ResizeObserver` runs after layout, all before the paint.
- The stage module doesn't import the sidebar, and it should stay that way.

## Goals / Non-Goals

**Goals:**
- The capsules fold only when the sidebar can give no more room.
- The sidebar never moves when the user didn't resize the window, and never fights a choice the user made.
- Nothing is stored, and no frame reloads.

**Non-Goals:**
- Hiding the sidebar, or stepping aside on viewports narrower than 768px.
- Making room for anything other than the stage bar's capsules.

## Decisions

### 1. The step aside is sidebar state, not stored

- `SidebarLayoutStore` gains:
  - `steppedAside: { viewportWidth: number; room: number } | null`, the window's width and the width the rail gave (the expanded width minus the rail's);
  - `roomGrant: { sandboxId: string | null } | null`, which sandbox may ask for room (`null` inside: the next sandbox shown);
  - `shownSandboxId: string | null`, the sandbox the stage bar shows (decision 2).
- The rail gives the expanded width, clamped to the viewport, minus `SIDEBAR_RAIL_WIDTH`, 48px, the value of `--sidebar-rail-width` in `app.css` at the default font size.
- `wide`, the stored layout, never changes for a step aside, so `writeStoredLayout` writes nothing new.
- While `steppedAside` is set, the snapshot's `state` is `"collapsed"`. `App.tsx`, the rail and its expand button then work unchanged. The snapshot also gains `isSteppedAside`, which the sidebar shows as `data-stepped-aside` for tests and the docs.
- Alternative: write `collapsed` into the `wide` layout, then restore it. Rejected: a reload, or a crash between the two, would keep a state the user never chose.

### 2. Who may ask, and when: the room grant

- The grant goes to the sandbox **shown**, not to the first one that asks. A bar asks only when its capsules overflow, so a sandbox whose capsules fit never asks, and a grant left open would go to the next sandbox the user opens.
- The store keeps `shownSandboxId: string | null`, which `showSidebarSandbox(store, sandboxId)` sets. The stage bar calls it in a layout effect declared before its fold's measure, so the store knows the shown sandbox before that sandbox asks.
- `roomGrant` starts as `{ sandboxId: null }`, open for the next sandbox shown. `showSidebarSandbox` binds an open grant to the sandbox it shows: that is "the sandbox shown when the app opened". Showing another sandbox than the bound one sets `roomGrant` to `null`, so opening another mosaic never moves the sidebar. It does not end a step aside: the sidebar stays as the user sees it.
- `changeSidebarViewport` to a narrower width sets it to `{ sandboxId: shownSandboxId }`, so the shown sandbox may ask right after the window narrowed.
- Every user action on the sidebar (`collapseSidebar`, `expandSidebar`, `pressHamburger`, `toggleSidebar`, `dragSidebar`, `stepSidebarWidth`) clears both `steppedAside` and `roomGrant`. It starts from the layout the user sees: while the sidebar has stepped aside, its wide layout collapsed. So `Ctrl+B` and the rail's button expand it at once, and the bar folds, as the spec says.
- `askSidebarForRoom(store, sandboxId): boolean` steps aside, and answers `true`, only when all of these hold: the viewport is not narrow, `wide.state` is `"expanded"`, nothing has stepped aside yet, and the grant is bound to `sandboxId`.
- Alternative: step aside whenever the capsules overflow. Rejected: opening a long mosaic would move the sidebar under the user, and coming back would need a test expansion on every change.
- Alternative: the first sandbox that asks gets the grant. Rejected: when the sandbox shown first fits, a mosaic opened later would get it.
- Alternative: one callback called on every measure, whose first call binds the grant. Rejected: the callback would mean "a measure happened" instead of "I need room", and the fold's tests would cover the grant.

### 3. Coming back without going back and forth

- `changeSidebarViewport` clears `steppedAside` once `viewportWidth >= steppedAside.viewportWidth + steppedAside.room`. At that width the expanded sidebar leaves the bar at least the width it had beside the rail. So if the capsules fit beside the rail, they fit after the comeback, and widening never steps aside and back on each pixel.
- Entering a narrow viewport clears `steppedAside`, so widening back past 768px restores the stored expanded layout.
- Alternative: come back as soon as the window is wider than where the sidebar stepped aside. Rejected: the bar would overflow again 1px later, and would step aside again on every pixel of a resize.

### 4. The stage bar asks through a callback

- `useNarrowStageBar` gains `onAskRoom: () => boolean`. In `measureFold`, when the bar is wide, at least 480px, and its capsules overflow, it calls `onAskRoom()` before folding. On `true` it keeps the bar wide. The sidebar re-renders before the paint, the bar's width grows, and `ResizeObserver` measures again, so a bar that still overflows folds then.
- `followBarFold` stays pure. The measure carries the answer as `roomGiven: boolean`, and only the effect calls the callback.
- `StageBar` binds the callback to its sandbox's id. `StageView` takes `onAskRoom: (sandboxId: string) => boolean` and `onShowSandbox: (sandboxId: string) => void` as props, and `App.tsx` passes `askSidebarForRoom.bind(undefined, layout)` and `showSidebarSandbox.bind(undefined, layout)`. The stage module learns nothing about the sidebar.
- Alternative: the stage bar reads the sidebar's store. Rejected: it would tie the stage module to the sidebar's internals.

## Risks / Trade-offs

- [A flash of the folded capsule, if a browser paints between the sidebar's re-render and the bar's measure.] → Every step runs in a layout effect or a `ResizeObserver` callback, before the paint. An e2e test narrows the window with the folded capsule watched by a `MutationObserver`, in Chromium and Firefox, where the bug was seen.
- [Engines differ by a few pixels in where the capsules overflow.] → The rule depends only on measured overflow, not on fixed widths. The e2e scenarios use widths with margin (860px against a fold measured at about 870px).
- [A user who wanted the expanded sidebar sees it collapse while narrowing the window.] → One press of the rail's expand button or `Ctrl+B` brings it back and stops further steps aside until the window narrows again.
