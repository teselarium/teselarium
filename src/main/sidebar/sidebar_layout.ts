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

/** The part of `matchMedia(query)` the layout uses. */
export interface ViewportQuery {
  matches: boolean;
  addEventListener: (type: "change", listener: () => void) => void;
}

/**
 * Narrow: under 768px, the drawer over the content. Compact: 768px to
 * 983px, where even a 200px sidebar would leave the main area under 784px.
 * Wide: 984px or more, the stored layout.
 */
export type SidebarMode = "narrow" | "compact" | "wide";

export interface SidebarLayoutOptions {
  storage: SidebarStorage;
  /** `matchMedia(NARROW_VIEWPORT_QUERY)`. */
  narrowQuery: ViewportQuery;
  /** `matchMedia(COMPACT_VIEWPORT_QUERY)`. */
  compactQuery: ViewportQuery;
  viewportWidth: number;
}

/** What the sidebar renders. Frozen, and new after every change. */
export interface SidebarSnapshot {
  state: SidebarState;
  /** The expanded width, clamped to the viewport. */
  width: number;
  /** The widest the viewport allows: 400px, or less to keep the main area 784px wide. */
  maxWidth: number;
  /** On a narrow viewport, expanded means the drawer over the content. */
  isNarrow: boolean;
}

/**
 * The sidebar's layout on wide viewports, which is stored, and on narrow and
 * compact ones, which is not. Mutable.
 */
export interface SidebarLayoutStore {
  wide: SidebarLayout;
  /** The layout of a narrow or compact viewport, built when the mode is entered. */
  unstored: SidebarLayout;
  mode: SidebarMode;
  viewportWidth: number;
  storage: SidebarStorage;
  listeners: Set<() => void>;
  snapshot: SidebarSnapshot;
}

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const SIDEBAR_LAYOUT_KEY = "opentesela.sidebar";

/** Viewports narrower than 768px. */
export const NARROW_VIEWPORT_QUERY = "(max-width: 767.98px)";

/** Viewports from 768px to 983px: 200px of sidebar plus 784px of main area is 984px. */
export const COMPACT_VIEWPORT_QUERY =
  "(min-width: 768px) and (max-width: 983.98px)";

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayout = Object.freeze({
  state: "expanded",
  from: "expanded",
  width: 240,
});

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
/** The main area keeps at least this width beside the expanded sidebar. */
const MIN_MAIN_WIDTH = 784;
/** Released narrower than this, the sidebar collapses. */
const COLLAPSE_BELOW = 160;

/** Replaced as soon as the store is built. */
const DEFAULT_SNAPSHOT: SidebarSnapshot = Object.freeze({
  state: "expanded",
  width: 240,
  maxWidth: 400,
  isNarrow: false,
});

const SIDEBAR_STATES: readonly string[] = ["expanded", "collapsed", "hidden"];
const RESTORED_STATES: readonly string[] = ["expanded", "collapsed"];

/**
 * A width between 200px and the smaller of 400px and the viewport's width
 * minus 784px, so the main area keeps at least 784px beside the sidebar.
 */
export function clampSidebarWidth(
  width: number,
  viewportWidth: number,
): number {
  const maxWidth = Math.max(
    MIN_WIDTH,
    Math.min(MAX_WIDTH, Math.floor(viewportWidth - MIN_MAIN_WIDTH)),
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

/**
 * The unstored layout a mode starts from: collapsed on a narrow viewport;
 * on a compact one, the rail for an expanded sidebar, and a collapsed or
 * hidden one as it is.
 */
function buildUnstoredLayout(
  wide: SidebarLayout,
  mode: SidebarMode,
): SidebarLayout {
  const isRail = mode === "narrow" || wide.state === "expanded";
  const unstored: SidebarLayout = {
    ...wide,
    state: isRail ? "collapsed" : wide.state,
    from: "collapsed",
  };
  return unstored;
}

function readMode(
  narrowQuery: ViewportQuery,
  compactQuery: ViewportQuery,
): SidebarMode {
  if (narrowQuery.matches) {
    return "narrow";
  }
  return compactQuery.matches ? "compact" : "wide";
}

function readCurrentLayout(store: SidebarLayoutStore): SidebarLayout {
  return store.mode === "wide" ? store.wide : store.unstored;
}

function buildSnapshot(store: SidebarLayoutStore): SidebarSnapshot {
  const layout = readCurrentLayout(store);
  const snapshot: SidebarSnapshot = {
    state: layout.state,
    width: clampSidebarWidth(layout.width, store.viewportWidth),
    maxWidth: clampSidebarWidth(MAX_WIDTH, store.viewportWidth),
    isNarrow: store.mode === "narrow",
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
  if (store.mode === "wide") {
    store.wide = layout;
    writeStoredLayout(store.storage, layout);
  } else {
    store.unstored = layout;
  }
  publishSidebar(store);
}

/**
 * Entering a narrow or compact viewport builds its unstored layout from the
 * wide one; a wide viewport shows the stored layout again.
 */
function followViewportQueries(
  store: SidebarLayoutStore,
  options: SidebarLayoutOptions,
): void {
  const mode = readMode(options.narrowQuery, options.compactQuery);
  if (mode === store.mode) {
    return;
  }
  store.mode = mode;
  store.unstored = buildUnstoredLayout(store.wide, mode);
  publishSidebar(store);
}

/** Reads the stored layout and follows the narrow and compact viewport queries. */
export function createSidebarLayout(
  options: SidebarLayoutOptions,
): SidebarLayoutStore {
  const wide = readStoredLayout(options.storage);
  const mode = readMode(options.narrowQuery, options.compactQuery);
  const store: SidebarLayoutStore = {
    wide,
    unstored: buildUnstoredLayout(wide, mode),
    mode,
    viewportWidth: options.viewportWidth,
    storage: options.storage,
    listeners: new Set(),
    snapshot: DEFAULT_SNAPSHOT,
  };
  store.snapshot = buildSnapshot(store);
  const follow = followViewportQueries.bind(undefined, store, options);
  options.narrowQuery.addEventListener("change", follow);
  options.compactQuery.addEventListener("change", follow);
  return store;
}

export function collapseSidebar(store: SidebarLayoutStore): void {
  applyLayout(store, collapseLayout(readCurrentLayout(store)));
}

export function expandSidebar(store: SidebarLayoutStore): void {
  applyLayout(store, expandLayout(readCurrentLayout(store)));
}

export function pressHamburger(store: SidebarLayoutStore): void {
  applyLayout(store, hideOrShowLayout(readCurrentLayout(store)));
}

export function toggleSidebar(store: SidebarLayoutStore): void {
  applyLayout(store, toggleLayout(readCurrentLayout(store)));
}

export function dragSidebar(store: SidebarLayoutStore, width: number): void {
  applyLayout(
    store,
    dragLayout(readCurrentLayout(store), width, store.viewportWidth),
  );
}

export function stepSidebarWidth(
  store: SidebarLayoutStore,
  step: number,
): void {
  applyLayout(
    store,
    stepLayoutWidth(readCurrentLayout(store), step, store.viewportWidth),
  );
}

/** The window was resized: the width is clamped again. The stored width does not change. */
export function changeSidebarViewport(
  store: SidebarLayoutStore,
  viewportWidth: number,
): void {
  if (store.viewportWidth === viewportWidth) {
    return;
  }
  store.viewportWidth = viewportWidth;
  publishSidebar(store);
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
