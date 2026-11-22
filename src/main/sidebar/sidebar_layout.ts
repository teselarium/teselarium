/** Expanded with a width, collapsed to an icon rail, or hidden. */
export type SidebarState = "expanded" | "collapsed" | "hidden";

/** The sidebar's layout. `from` is the state a hidden sidebar comes back to. */
export interface SidebarLayout {
  state: SidebarState;
  from: "expanded" | "collapsed";
  /** The expanded width the user chose, in pixels, before the viewport's clamp. */
  width: number;
}

/** The part of `Storage` the layout uses. The app passes `localStorage`. */
export type SidebarStorage = Pick<Storage, "getItem" | "setItem">;

/** The part of `matchMedia(NARROW_VIEWPORT_QUERY)` the layout uses. */
export interface NarrowViewportQuery {
  matches: boolean;
  addEventListener: (type: "change", listener: () => void) => void;
}

export interface SidebarLayoutOptions {
  storage: SidebarStorage;
  narrowQuery: NarrowViewportQuery;
  viewportWidth: number;
}

/** What the sidebar renders. Frozen, and new after every change. */
export interface SidebarSnapshot {
  state: SidebarState;
  /** The expanded width, clamped to the viewport. */
  width: number;
  /** The widest the viewport allows: 400px, or 40% of a smaller viewport. */
  maxWidth: number;
  /** On a narrow viewport, expanded means the drawer over the content. */
  isNarrow: boolean;
  /** The sidebar shows its rail for the stage bar, though it is stored expanded. */
  isSteppedAside: boolean;
}

/** The sidebar showed its rail for the stage bar: the viewport's width then, and the width the rail gave. */
export interface SteppedAside {
  viewportWidth: number;
  room: number;
}

/** The sandbox whose stage bar may ask for room. `null` gives it to the next sandbox shown. */
export interface RoomGrant {
  sandboxId: string | null;
}

/**
 * The sidebar's layout on wide viewports, which is stored, and on narrow
 * ones, which is not. Mutable.
 */
export interface SidebarLayoutStore {
  wide: SidebarLayout;
  narrow: SidebarLayout;
  isNarrow: boolean;
  viewportWidth: number;
  storage: SidebarStorage;
  listeners: Set<() => void>;
  snapshot: SidebarSnapshot;
  /** Not stored: a reload starts from the wide layout. */
  steppedAside: SteppedAside | null;
  roomGrant: RoomGrant | null;
  /** The sandbox the stage bar shows, or `null` before it shows one. */
  shownSandboxId: string | null;
}

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const SIDEBAR_LAYOUT_KEY = "opentesela.sidebar";

/** Viewports narrower than 768px. */
export const NARROW_VIEWPORT_QUERY = "(max-width: 767.98px)";

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayout = Object.freeze({
  state: "expanded",
  from: "expanded",
  width: 240,
});

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const MAX_VIEWPORT_SHARE = 0.4;
/** Released narrower than this, the sidebar collapses. */
const COLLAPSE_BELOW = 160;
/** `--sidebar-rail-width` in `app.css` (3rem), at the default font size. */
const SIDEBAR_RAIL_WIDTH = 48;

/** Replaced as soon as the store is built. */
const DEFAULT_SNAPSHOT: SidebarSnapshot = Object.freeze({
  state: "expanded",
  width: 240,
  maxWidth: 400,
  isNarrow: false,
  isSteppedAside: false,
});

const SIDEBAR_STATES: readonly string[] = ["expanded", "collapsed", "hidden"];
const RESTORED_STATES: readonly string[] = ["expanded", "collapsed"];

/** A width between 200px and the smaller of 400px and 40% of the viewport. */
export function clampSidebarWidth(
  width: number,
  viewportWidth: number,
): number {
  const maxWidth = Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, Math.floor(viewportWidth * MAX_VIEWPORT_SHARE)),
  );
  return Math.min(maxWidth, Math.max(MIN_WIDTH, Math.round(width)));
}

function withState(layout: SidebarLayout, state: SidebarState): SidebarLayout {
  const changed: SidebarLayout = { ...layout, state };
  return changed;
}

export function collapseLayout(layout: SidebarLayout): SidebarLayout {
  return withState(layout, "collapsed");
}

export function expandLayout(layout: SidebarLayout): SidebarLayout {
  return withState(layout, "expanded");
}

/** The hamburger: hides an expanded or collapsed sidebar, and shows a hidden one as it was. */
export function hideOrShowLayout(layout: SidebarLayout): SidebarLayout {
  if (layout.state === "hidden") {
    return withState(layout, layout.from);
  }
  const hidden: SidebarLayout = {
    ...layout,
    state: "hidden",
    from: layout.state,
  };
  return hidden;
}

/** `Ctrl/Cmd+B`: expanded and collapsed swap, and a hidden sidebar is shown as it was. */
export function toggleLayout(layout: SidebarLayout): SidebarLayout {
  if (layout.state === "hidden") {
    return withState(layout, layout.from);
  }
  return withState(
    layout,
    layout.state === "expanded" ? "collapsed" : "expanded",
  );
}

/**
 * While the handle is held, the sidebar follows the pointer within the
 * width's bounds. Narrower than 160px it collapses at once, and keeps its last
 * width for the next expand; at 160px or wider it is expanded again. A release
 * keeps the state the drag reached.
 */
export function dragLayout(
  layout: SidebarLayout,
  width: number,
  viewportWidth: number,
): SidebarLayout {
  if (width < COLLAPSE_BELOW) {
    return withState(layout, "collapsed");
  }
  const dragged: SidebarLayout = {
    ...layout,
    state: "expanded",
    width: clampSidebarWidth(width, viewportWidth),
  };
  return dragged;
}

/** The resize handle's arrow keys. On the rail, the right arrow expands the sidebar at its last width. */
export function stepLayoutWidth(
  layout: SidebarLayout,
  step: number,
  viewportWidth: number,
): SidebarLayout {
  if (layout.state === "collapsed") {
    return step > 0 ? expandLayout(layout) : layout;
  }
  const current = clampSidebarWidth(layout.width, viewportWidth);
  return dragLayout(layout, current + step, viewportWidth);
}

function isStoredLayout(value: unknown): value is SidebarLayout {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.state === "string" &&
    SIDEBAR_STATES.includes(candidate.state) &&
    typeof candidate.from === "string" &&
    RESTORED_STATES.includes(candidate.from) &&
    typeof candidate.width === "number" &&
    Number.isFinite(candidate.width)
  );
}

/** The stored layout. A missing or invalid value, or a storage that cannot be read, gives an expanded sidebar of 240px. */
export function readStoredLayout(storage: SidebarStorage): SidebarLayout {
  try {
    const stored: unknown = JSON.parse(
      storage.getItem(SIDEBAR_LAYOUT_KEY) ?? "null",
    );
    if (isStoredLayout(stored)) {
      const layout: SidebarLayout = {
        state: stored.state,
        from: stored.from,
        width: stored.width,
      };
      return layout;
    }
  } catch {
    // Unreadable or not JSON: counts as no stored layout.
  }
  return DEFAULT_SIDEBAR_LAYOUT;
}

function writeStoredLayout(
  storage: SidebarStorage,
  layout: SidebarLayout,
): void {
  try {
    storage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // The layout still applies until the page is closed.
  }
}

function buildNarrowLayout(wide: SidebarLayout): SidebarLayout {
  const narrow: SidebarLayout = {
    ...wide,
    state: "collapsed",
    from: "collapsed",
  };
  return narrow;
}

/** The wide layout the user sees: collapsed while the sidebar has stepped aside. */
function readSeenWideLayout(store: SidebarLayoutStore): SidebarLayout {
  return store.steppedAside === null ? store.wide : collapseLayout(store.wide);
}

/** The layout the user sees, which every user action starts from. */
function readSeenLayout(store: SidebarLayoutStore): SidebarLayout {
  return store.isNarrow ? store.narrow : readSeenWideLayout(store);
}

function buildSnapshot(store: SidebarLayoutStore): SidebarSnapshot {
  const snapshot: SidebarSnapshot = {
    state: readSeenLayout(store).state,
    width: clampSidebarWidth(store.wide.width, store.viewportWidth),
    maxWidth: clampSidebarWidth(MAX_WIDTH, store.viewportWidth),
    isNarrow: store.isNarrow,
    isSteppedAside: store.steppedAside !== null,
  };
  return Object.freeze(snapshot);
}

function publishSidebar(store: SidebarLayoutStore): void {
  store.snapshot = buildSnapshot(store);
  for (const listener of store.listeners) {
    listener();
  }
}

/** Applies a new layout to the current mode. Only the wide layout is stored. */
function applyLayout(store: SidebarLayoutStore, layout: SidebarLayout): void {
  if (store.isNarrow) {
    store.narrow = layout;
  } else {
    store.wide = layout;
    writeStoredLayout(store.storage, layout);
  }
  publishSidebar(store);
}

/** A user action: it ends the step aside, and no sandbox may ask for room until the window narrows. */
function applyUserLayout(
  store: SidebarLayoutStore,
  layout: SidebarLayout,
): void {
  store.steppedAside = null;
  store.roomGrant = null;
  applyLayout(store, layout);
}

/**
 * Entering narrow mode collapses the sidebar without storing, and ends a
 * step aside; leaving it restores the wide layout.
 */
function followNarrowQuery(
  store: SidebarLayoutStore,
  narrowQuery: NarrowViewportQuery,
): void {
  if (narrowQuery.matches === store.isNarrow) {
    return;
  }
  store.isNarrow = narrowQuery.matches;
  store.narrow = buildNarrowLayout(store.wide);
  if (store.isNarrow) {
    store.steppedAside = null;
  }
  publishSidebar(store);
}

/** Reads the stored layout and follows the narrow viewport query. */
export function createSidebarLayout(
  options: SidebarLayoutOptions,
): SidebarLayoutStore {
  const wide = readStoredLayout(options.storage);
  const store: SidebarLayoutStore = {
    wide,
    narrow: buildNarrowLayout(wide),
    isNarrow: options.narrowQuery.matches,
    viewportWidth: options.viewportWidth,
    storage: options.storage,
    listeners: new Set(),
    snapshot: DEFAULT_SNAPSHOT,
    steppedAside: null,
    roomGrant: { sandboxId: null },
    shownSandboxId: null,
  };
  store.snapshot = buildSnapshot(store);
  options.narrowQuery.addEventListener(
    "change",
    followNarrowQuery.bind(undefined, store, options.narrowQuery),
  );
  return store;
}

export function collapseSidebar(store: SidebarLayoutStore): void {
  applyUserLayout(store, collapseLayout(readSeenLayout(store)));
}

export function expandSidebar(store: SidebarLayoutStore): void {
  applyUserLayout(store, expandLayout(readSeenLayout(store)));
}

export function pressHamburger(store: SidebarLayoutStore): void {
  applyUserLayout(store, hideOrShowLayout(readSeenLayout(store)));
}

export function toggleSidebar(store: SidebarLayoutStore): void {
  applyUserLayout(store, toggleLayout(readSeenLayout(store)));
}

export function dragSidebar(store: SidebarLayoutStore, width: number): void {
  applyUserLayout(
    store,
    dragLayout(readSeenWideLayout(store), width, store.viewportWidth),
  );
}

export function stepSidebarWidth(
  store: SidebarLayoutStore,
  step: number,
): void {
  applyUserLayout(
    store,
    stepLayoutWidth(readSeenWideLayout(store), step, store.viewportWidth),
  );
}

/**
 * Whether the window has widened, since the sidebar stepped aside, by the
 * room the rail gave: the expanded sidebar then leaves the stage bar no
 * narrower than it was beside the rail.
 */
function hasRoomToComeBack(
  steppedAside: SteppedAside,
  viewportWidth: number,
): boolean {
  return viewportWidth >= steppedAside.viewportWidth + steppedAside.room;
}

/**
 * The window was resized: the width is clamped again. The stored width does
 * not change. A narrower window gives the grant to the sandbox shown, and a
 * sidebar that stepped aside comes back once there is room for it.
 */
export function changeSidebarViewport(
  store: SidebarLayoutStore,
  viewportWidth: number,
): void {
  if (store.viewportWidth === viewportWidth) {
    return;
  }
  if (viewportWidth < store.viewportWidth) {
    store.roomGrant = { sandboxId: store.shownSandboxId };
  }
  if (
    store.steppedAside !== null &&
    hasRoomToComeBack(store.steppedAside, viewportWidth)
  ) {
    store.steppedAside = null;
  }
  store.viewportWidth = viewportWidth;
  publishSidebar(store);
}

/**
 * An open grant goes to the sandbox shown; showing another sandbox than the
 * one it is bound to ends it.
 */
function followShownSandbox(
  grant: RoomGrant | null,
  sandboxId: string,
): RoomGrant | null {
  if (grant === null) {
    return null;
  }
  if (grant.sandboxId !== null && grant.sandboxId !== sandboxId) {
    return null;
  }
  const bound: RoomGrant = { sandboxId };
  return bound;
}

/**
 * The stage bar shows `sandboxId`. The sandbox shown when the app opened,
 * or right after the window narrowed, may ask for room; one the user opens
 * after it may not. A step aside stays: the sidebar never moves under the user.
 */
export function showSidebarSandbox(
  store: SidebarLayoutStore,
  sandboxId: string,
): void {
  if (store.shownSandboxId === sandboxId) {
    return;
  }
  store.shownSandboxId = sandboxId;
  store.roomGrant = followShownSandbox(store.roomGrant, sandboxId);
}

function canStepAside(store: SidebarLayoutStore, sandboxId: string): boolean {
  return (
    !store.isNarrow &&
    store.wide.state === "expanded" &&
    store.steppedAside === null &&
    store.roomGrant?.sandboxId === sandboxId
  );
}

/**
 * The stage bar of `sandboxId` asks for room before folding its capsules.
 * An expanded sidebar on a wide viewport shows its rail, without storing it,
 * when the grant is the sandbox's. Returns whether it did.
 */
export function askSidebarForRoom(
  store: SidebarLayoutStore,
  sandboxId: string,
): boolean {
  if (!canStepAside(store, sandboxId)) {
    return false;
  }
  const expandedWidth = clampSidebarWidth(
    store.wide.width,
    store.viewportWidth,
  );
  store.steppedAside = {
    viewportWidth: store.viewportWidth,
    room: expandedWidth - SIDEBAR_RAIL_WIDTH,
  };
  publishSidebar(store);
  return true;
}

export function readSidebarSnapshot(
  store: SidebarLayoutStore,
): SidebarSnapshot {
  return store.snapshot;
}

function unsubscribeSidebar(
  store: SidebarLayoutStore,
  listener: () => void,
): void {
  store.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeSidebar(
  store: SidebarLayoutStore,
  listener: () => void,
): () => void {
  store.listeners.add(listener);
  return unsubscribeSidebar.bind(undefined, store, listener);
}
