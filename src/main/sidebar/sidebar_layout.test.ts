import { describe, expect, it, vi } from "vitest";
import {
  changeSystemPreference,
  createFakeColorSchemeQuery,
} from "../../test/fake_color_scheme_queries.ts";
import type { FakeColorSchemeQuery } from "../../test/fake_color_scheme_queries.ts";
import {
  createBlockedStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  changeSidebarViewport,
  clampSidebarWidth,
  collapseLayout,
  collapseSidebar,
  createSidebarLayout,
  DEFAULT_SIDEBAR_LAYOUT,
  dragLayout,
  dragSidebar,
  expandLayout,
  expandSidebar,
  hideOrShowLayout,
  pressHamburger,
  readSidebarSnapshot,
  readStoredLayout,
  SIDEBAR_LAYOUT_KEY,
  stepLayoutWidth,
  stepSidebarWidth,
  subscribeSidebar,
  toggleLayout,
  toggleSidebar,
} from "./sidebar_layout.ts";
import type {
  SidebarLayout,
  SidebarLayoutStore,
  SidebarMode,
} from "./sidebar_layout.ts";

const WIDE_VIEWPORT = 1280;

/** A viewport's width in each mode: a phone's, a compact one and a wide one. */
const MODE_VIEWPORTS: Readonly<Record<SidebarMode, number>> = Object.freeze({
  narrow: 375,
  compact: 860,
  wide: WIDE_VIEWPORT,
});

function buildLayout(
  state: SidebarLayout["state"],
  from: SidebarLayout["from"] = "expanded",
  width: number = 240,
): SidebarLayout {
  const layout: SidebarLayout = { state, from, width };
  return layout;
}

interface LayoutFixture {
  store: SidebarLayoutStore;
  storage: MemoryStorage;
  narrowQuery: FakeColorSchemeQuery;
  compactQuery: FakeColorSchemeQuery;
}

function buildFixture(
  storage: MemoryStorage = createMemoryStorage(),
  mode: SidebarMode = "wide",
): LayoutFixture {
  const narrowQuery = createFakeColorSchemeQuery(mode === "narrow");
  const compactQuery = createFakeColorSchemeQuery(mode === "compact");
  const store = createSidebarLayout({
    storage,
    narrowQuery,
    compactQuery,
    viewportWidth: MODE_VIEWPORTS[mode],
  });
  const fixture: LayoutFixture = { store, storage, narrowQuery, compactQuery };
  return fixture;
}

/** The window is resized into `mode`: the width changes, then each query that changed fires. */
function resizeInto(fixture: LayoutFixture, mode: SidebarMode): void {
  changeSidebarViewport(fixture.store, MODE_VIEWPORTS[mode]);
  if (fixture.narrowQuery.matches !== (mode === "narrow")) {
    changeSystemPreference(fixture.narrowQuery, mode === "narrow");
  }
  if (fixture.compactQuery.matches !== (mode === "compact")) {
    changeSystemPreference(fixture.compactQuery, mode === "compact");
  }
}

function storeLayout(storage: MemoryStorage, layout: SidebarLayout): void {
  storage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(layout));
}

function readStoredValue(storage: MemoryStorage): unknown {
  const stored = storage.items.get(SIDEBAR_LAYOUT_KEY);
  return stored === undefined ? undefined : JSON.parse(stored);
}

describe("sidebar layout transitions", function describeTransitions(): void {
  it("collapses and expands", function collapsesAndExpands(): void {
    expect(collapseLayout(buildLayout("expanded"))).toEqual(
      buildLayout("collapsed"),
    );
    expect(expandLayout(buildLayout("collapsed"))).toEqual(
      buildLayout("expanded"),
    );
  });

  it("hides from either state and shows the state it came from", function hidesAndRestores(): void {
    const hiddenFromCollapsed = hideOrShowLayout(buildLayout("collapsed"));
    const hiddenFromExpanded = hideOrShowLayout(buildLayout("expanded"));

    expect(hiddenFromCollapsed).toEqual(buildLayout("hidden", "collapsed"));
    expect(hiddenFromExpanded).toEqual(buildLayout("hidden", "expanded"));
    expect(hideOrShowLayout(hiddenFromCollapsed)).toEqual(
      buildLayout("collapsed", "collapsed"),
    );
    expect(hideOrShowLayout(hiddenFromExpanded)).toEqual(
      buildLayout("expanded", "expanded"),
    );
  });

  it("toggles expanded and collapsed, and shows a hidden sidebar", function toggles(): void {
    expect(toggleLayout(buildLayout("expanded"))).toEqual(
      buildLayout("collapsed"),
    );
    expect(toggleLayout(buildLayout("collapsed"))).toEqual(
      buildLayout("expanded"),
    );
    expect(toggleLayout(buildLayout("hidden", "collapsed"))).toEqual(
      buildLayout("collapsed", "collapsed"),
    );
  });

  it("Drag wider", function dragsWider(): void {
    expect(dragLayout(buildLayout("expanded"), 340, WIDE_VIEWPORT)).toEqual(
      buildLayout("expanded", "expanded", 340),
    );
  });

  it("Width is clamped", function clampsDrag(): void {
    expect(dragLayout(buildLayout("expanded"), 600, WIDE_VIEWPORT).width).toBe(
      400,
    );
    expect(dragLayout(buildLayout("expanded"), 170, WIDE_VIEWPORT).width).toBe(
      200,
    );
  });

  it("Drag to collapse", function collapsesWhileDragging(): void {
    const dragged = dragLayout(buildLayout("expanded"), 300, WIDE_VIEWPORT);

    const collapsed = dragLayout(dragged, 120, WIDE_VIEWPORT);

    expect(collapsed).toEqual(buildLayout("collapsed", "expanded", 300));
  });

  it("Drag back before releasing", function expandsAgainWhileDragging(): void {
    const collapsed = dragLayout(buildLayout("expanded"), 120, WIDE_VIEWPORT);

    const expanded = dragLayout(collapsed, 300, WIDE_VIEWPORT);

    expect(collapsed).toEqual(buildLayout("collapsed"));
    expect(expanded).toEqual(buildLayout("expanded", "expanded", 300));
  });

  it("Resize with the keyboard", function stepsWidth(): void {
    expect(
      stepLayoutWidth(buildLayout("expanded"), 16, WIDE_VIEWPORT).width,
    ).toBe(256);
    expect(
      stepLayoutWidth(
        buildLayout("expanded", "expanded", 392),
        16,
        WIDE_VIEWPORT,
      ).width,
    ).toBe(400);
  });

  it("Drag to expand", function expandsFromRail(): void {
    expect(dragLayout(buildLayout("collapsed"), 300, WIDE_VIEWPORT)).toEqual(
      buildLayout("expanded", "expanded", 300),
    );
  });

  it("Short drag stays collapsed", function staysCollapsed(): void {
    const rail = buildLayout("collapsed");

    expect(dragLayout(rail, 120, WIDE_VIEWPORT)).toEqual(rail);
  });

  it("expands from the rail at 160px, at the smallest width", function expandsAtThreshold(): void {
    expect(dragLayout(buildLayout("collapsed"), 160, WIDE_VIEWPORT)).toEqual(
      buildLayout("expanded", "expanded", 200),
    );
  });

  it("Expand with the keyboard", function expandsWithArrow(): void {
    const rail = buildLayout("collapsed", "expanded", 300);

    expect(stepLayoutWidth(rail, 16, WIDE_VIEWPORT)).toEqual(
      buildLayout("expanded", "expanded", 300),
    );
    expect(stepLayoutWidth(rail, -16, WIDE_VIEWPORT)).toEqual(rail);
  });

  it("keeps the main area at least 784px wide", function clampsToMainArea(): void {
    expect(clampSidebarWidth(400, 1100)).toBe(316);
    expect(clampSidebarWidth(400, 1184)).toBe(400);
    expect(clampSidebarWidth(240, 1024)).toBe(240);
    expect(clampSidebarWidth(240, 1000)).toBe(216);
  });

  it("is never narrower than 200px", function clampsToMinimum(): void {
    expect(clampSidebarWidth(150, 1280)).toBe(200);
    expect(clampSidebarWidth(400, 983)).toBe(200);
    expect(clampSidebarWidth(400, 400)).toBe(200);
  });

  it("stops a drag where the main area keeps 784px", function stopsDrag(): void {
    expect(dragLayout(buildLayout("expanded"), 380, 1100).width).toBe(316);
  });
});

describe("readStoredLayout", function describeReadStoredLayout(): void {
  it("Invalid stored layout", function readsInvalid(): void {
    const values = [
      "wide",
      '"wide"',
      "null",
      "{}",
      '{"state":"wide","from":"expanded","width":240}',
      '{"state":"hidden","from":"hidden","width":240}',
      '{"state":"expanded","from":"expanded","width":"240"}',
      '{"state":"expanded","from":"expanded","width":null}',
    ];

    for (const value of values) {
      const storage = createMemoryStorage();
      storage.setItem(SIDEBAR_LAYOUT_KEY, value);
      expect(readStoredLayout(storage)).toEqual(DEFAULT_SIDEBAR_LAYOUT);
    }
  });

  it("gives an expanded sidebar of 240px when nothing is stored", function readsMissing(): void {
    expect(readStoredLayout(createMemoryStorage())).toEqual({
      state: "expanded",
      from: "expanded",
      width: 240,
    });
  });
});

describe("sidebar layout store", function describeStore(): void {
  it("Collapsed after a reload", function keepsCollapsed(): void {
    const fixture = buildFixture();
    collapseSidebar(fixture.store);

    const reloaded = buildFixture(fixture.storage);

    expect(readSidebarSnapshot(reloaded.store)).toMatchObject({
      state: "collapsed",
      isNarrow: false,
    });
  });

  it("Width after a reload", function keepsWidth(): void {
    const fixture = buildFixture();
    dragSidebar(fixture.store, 320);

    const reloaded = buildFixture(fixture.storage);

    expect(readSidebarSnapshot(reloaded.store).width).toBe(320);
  });

  it("keeps the state hidden came from after a reload", function keepsHidden(): void {
    const fixture = buildFixture();
    collapseSidebar(fixture.store);
    pressHamburger(fixture.store);

    expect(readStoredValue(fixture.storage)).toEqual({
      state: "hidden",
      from: "collapsed",
      width: 240,
    });
    const reloaded = buildFixture(fixture.storage);
    pressHamburger(reloaded.store);

    expect(readSidebarSnapshot(reloaded.store).state).toBe("collapsed");
  });

  it("still applies when the storage cannot be read or written", function survivesBlockedStorage(): void {
    const fixture = buildFixture(createBlockedStorage());

    collapseSidebar(fixture.store);

    expect(readSidebarSnapshot(fixture.store).state).toBe("collapsed");
  });

  it("notifies every change with a new frozen snapshot", function notifiesChanges(): void {
    const fixture = buildFixture();
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeSidebar(fixture.store, listener);
    const before = readSidebarSnapshot(fixture.store);

    toggleSidebar(fixture.store);
    unsubscribe();
    toggleSidebar(fixture.store);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readSidebarSnapshot(fixture.store)).not.toBe(before);
    expect(Object.isFrozen(before)).toBe(true);
  });

  it("re-clamps the width when the viewport shrinks, and keeps the stored one", function reclampsWidth(): void {
    const fixture = buildFixture();
    dragSidebar(fixture.store, 400);

    changeSidebarViewport(fixture.store, 1100);

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      width: 316,
      maxWidth: 316,
    });
    expect(readStoredValue(fixture.storage)).toMatchObject({ width: 400 });
    changeSidebarViewport(fixture.store, 1184);
    expect(readSidebarSnapshot(fixture.store).width).toBe(400);
  });
});

describe("narrow viewports", function describeNarrow(): void {
  it("Starts collapsed", function startsCollapsed(): void {
    const storage = createMemoryStorage();
    storage.setItem(
      SIDEBAR_LAYOUT_KEY,
      JSON.stringify({ state: "expanded", from: "expanded", width: 300 }),
    );

    const fixture = buildFixture(storage, "narrow");

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "collapsed",
      isNarrow: true,
    });
  });

  it("stores nothing", function storesNothing(): void {
    const fixture = buildFixture(createMemoryStorage(), "narrow");

    expandSidebar(fixture.store);
    toggleSidebar(fixture.store);
    pressHamburger(fixture.store);

    expect(readSidebarSnapshot(fixture.store).state).toBe("hidden");
    expect(fixture.storage.items.size).toBe(0);
  });

  it("collapses on entering narrow mode and restores the stored layout on leaving it", function followsQuery(): void {
    const fixture = buildFixture();
    dragSidebar(fixture.store, 320);

    changeSystemPreference(fixture.narrowQuery, true);
    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "collapsed",
      isNarrow: true,
    });
    expandSidebar(fixture.store);
    changeSystemPreference(fixture.narrowQuery, false);

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "expanded",
      width: 320,
      isNarrow: false,
    });
  });
});

describe("compact viewports", function describeCompact(): void {
  it("shows the rail for a stored expanded sidebar", function showsRail(): void {
    const fixture = buildFixture(createMemoryStorage(), "compact");

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "collapsed",
      isNarrow: false,
    });
  });

  it("keeps a stored collapsed or hidden sidebar", function keepsStoredState(): void {
    for (const state of ["collapsed", "hidden"] as const) {
      const storage = createMemoryStorage();
      storeLayout(storage, buildLayout(state));

      const fixture = buildFixture(storage, "compact");

      expect(readSidebarSnapshot(fixture.store).state).toBe(state);
    }
  });

  it("expands inline at 200px, and stores nothing", function expandsInline(): void {
    const fixture = buildFixture(createMemoryStorage(), "compact");

    toggleSidebar(fixture.store);
    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "expanded",
      width: 200,
      maxWidth: 200,
      isNarrow: false,
    });
    dragSidebar(fixture.store, 120);
    expect(readSidebarSnapshot(fixture.store).state).toBe("collapsed");
    stepSidebarWidth(fixture.store, 16);
    expect(readSidebarSnapshot(fixture.store).state).toBe("expanded");
    pressHamburger(fixture.store);

    expect(readSidebarSnapshot(fixture.store).state).toBe("hidden");
    expect(fixture.storage.items.size).toBe(0);
  });

  it("restores the stored layout once the viewport is wide", function restoresWide(): void {
    const storage = createMemoryStorage();
    storeLayout(storage, buildLayout("expanded", "expanded", 320));
    const fixture = buildFixture(storage);

    resizeInto(fixture, "compact");
    expect(readSidebarSnapshot(fixture.store).state).toBe("collapsed");
    pressHamburger(fixture.store);
    resizeInto(fixture, "wide");

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "expanded",
      width: 320,
    });
    expect(readStoredValue(storage)).toEqual(
      buildLayout("expanded", "expanded", 320),
    );
  });

  it("applies the narrow rules on entering a narrow viewport", function entersNarrow(): void {
    const fixture = buildFixture(createMemoryStorage(), "compact");
    toggleSidebar(fixture.store);

    resizeInto(fixture, "narrow");

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "collapsed",
      isNarrow: true,
    });
  });

  it("shows the rail from narrow through compact, and expands once wide", function widensThroughCompact(): void {
    const fixture = buildFixture(createMemoryStorage(), "narrow");

    resizeInto(fixture, "compact");
    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "collapsed",
      isNarrow: false,
    });
    resizeInto(fixture, "wide");

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "expanded",
      width: 240,
    });
  });
});
