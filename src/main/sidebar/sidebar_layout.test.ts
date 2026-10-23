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
  subscribeSidebar,
  toggleLayout,
  toggleSidebar,
} from "./sidebar_layout.ts";
import type { SidebarLayout, SidebarLayoutStore } from "./sidebar_layout.ts";

const WIDE_VIEWPORT = 1280;

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
}

function buildFixture(
  storage: MemoryStorage = createMemoryStorage(),
  isNarrow: boolean = false,
): LayoutFixture {
  const narrowQuery = createFakeColorSchemeQuery(isNarrow);
  const store = createSidebarLayout({
    storage,
    narrowQuery,
    viewportWidth: isNarrow ? 375 : WIDE_VIEWPORT,
  });
  const fixture: LayoutFixture = { store, storage, narrowQuery };
  return fixture;
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

  it("clamps to 40% of a smaller viewport", function clampsToViewport(): void {
    expect(clampSidebarWidth(400, 800)).toBe(320);
    expect(clampSidebarWidth(150, 800)).toBe(200);
    expect(clampSidebarWidth(400, 400)).toBe(200);
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

    changeSidebarViewport(fixture.store, 800);

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      width: 320,
      maxWidth: 320,
    });
    expect(readStoredValue(fixture.storage)).toMatchObject({ width: 400 });
  });
});

describe("narrow viewports", function describeNarrow(): void {
  it("Starts collapsed", function startsCollapsed(): void {
    const storage = createMemoryStorage();
    storage.setItem(
      SIDEBAR_LAYOUT_KEY,
      JSON.stringify({ state: "expanded", from: "expanded", width: 300 }),
    );

    const fixture = buildFixture(storage, true);

    expect(readSidebarSnapshot(fixture.store)).toMatchObject({
      state: "collapsed",
      isNarrow: true,
    });
  });

  it("stores nothing", function storesNothing(): void {
    const fixture = buildFixture(createMemoryStorage(), true);

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
