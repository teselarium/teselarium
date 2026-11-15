import { describe, expect, it } from "vitest";
import type { RunLink } from "../engine/index.ts";
import {
  closeStageSandbox,
  createStageState,
  openStageEntry,
  readVisibleEntry,
  readVisibleSandbox,
  replaceStageEntry,
  restoreStageEntry,
} from "./stage_state.ts";
import type {
  EntryTarget,
  HomeFallback,
  SandboxOpening,
  StageState,
} from "./stage_state.ts";

const HOME_LINK: RunLink = {
  mod: "mod_explorer",
  collection: null,
  params: {},
};

const HOME_MOD: HomeFallback = {
  route: { kind: "sandbox", hash: "#/", link: HOME_LINK, isHomeMod: true },
  section: "home",
};

const HOME_PAGE: HomeFallback = {
  route: { kind: "page", hash: "#/", section: "home", page: null },
  section: "home",
};

function buildLink(mod: string): RunLink {
  const link: RunLink = { mod, collection: null, params: {} };
  return link;
}

function newSandbox(
  mod: string,
  openerId: string | null = null,
  isHomeMod: boolean = false,
): EntryTarget {
  const target: EntryTarget = {
    kind: "new-sandbox",
    opening: {
      hash: isHomeMod ? "#/" : `#/run?mod=${mod}`,
      link: buildLink(mod),
      openerId,
      isHomeMod,
    },
  };
  return target;
}

function pageView(section: string, page: string | null = null): EntryTarget {
  const target: EntryTarget = { kind: "page", section, page };
  return target;
}

/** Opens the Home mod at position 0, then each mod in turn from the visible sandbox. */
function openInTurn(mods: string[]): StageState {
  let state = openStageEntry(
    createStageState(),
    newSandbox("mod_explorer", null, true),
    "home",
  ).state;
  for (const mod of mods) {
    const openerId = readVisibleSandbox(state)?.id ?? null;
    state = openStageEntry(state, newSandbox(mod, openerId), "home").state;
  }
  return state;
}

function listSandboxIds(state: StageState): string[] {
  const ids: string[] = [];
  for (const sandbox of state.sandboxes) {
    ids.push(sandbox.id);
  }
  return ids;
}

function restoreSandbox(
  state: StageState,
  position: number,
  mod: string,
): StageState {
  const change = restoreStageEntry(
    state,
    position,
    {
      kind: "sandbox",
      hash: `#/run?mod=${mod}`,
      link: buildLink(mod),
      isHomeMod: false,
    },
    null,
  );
  return change.state;
}

describe("openStageEntry", function describeOpenStageEntry(): void {
  it("counts ids from sandbox-1 and shows the new sandbox", function opensFirst(): void {
    const change = openStageEntry(
      createStageState(),
      newSandbox("mod_explorer", null, true),
      "home",
    );

    expect(change.opened).toEqual({
      id: "sandbox-1",
      hash: "#/",
      link: HOME_LINK,
      openerId: null,
      section: "home",
      isHomeMod: true,
    });
    expect(change.closedIds).toEqual([]);
    expect(change.state.position).toBe(0);
    expect(change.state.entries).toEqual([
      {
        position: 0,
        view: { kind: "sandbox", sandboxId: "sandbox-1" },
        section: "home",
      },
    ]);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-1");
  });

  it("records the opener and keeps the creation order", function recordsOpener(): void {
    const state = openInTurn(["mod_viewer"]);

    expect(listSandboxIds(state)).toEqual(["sandbox-1", "sandbox-2"]);
    expect(state.sandboxes[1].openerId).toBe("sandbox-1");
    expect(state.position).toBe(1);
    expect(readVisibleSandbox(state)?.id).toBe("sandbox-2");
  });

  it("does not change the input state", function keepsInput(): void {
    const state = openInTurn([]);
    const copy = structuredClone(state);

    openStageEntry(state, newSandbox("a", "sandbox-1"), null);
    openStageEntry(state, pageView("settings"), "settings");

    expect(state).toEqual(copy);
  });

  it("A page hides the mods", function opensPage(): void {
    const state = openInTurn(["a"]);

    const change = openStageEntry(state, pageView("settings"), "settings");

    expect(change.opened).toBeNull();
    expect(change.closedIds).toEqual([]);
    expect(listSandboxIds(change.state)).toEqual(["sandbox-1", "sandbox-2"]);
    expect(readVisibleSandbox(change.state)).toBeNull();
    expect(readVisibleEntry(change.state)).toEqual({
      position: 2,
      view: { kind: "page", section: "settings", page: null },
      section: "settings",
    });
  });

  it("points a new entry to an open sandbox without opening one", function reusesSandbox(): void {
    const state = openStageEntry(
      openInTurn([]),
      pageView("guides"),
      "guides",
    ).state;

    const change = openStageEntry(
      state,
      { kind: "sandbox", sandboxId: "sandbox-1" },
      "home",
    );

    expect(change.opened).toBeNull();
    expect(change.state.nextNumber).toBe(state.nextNumber);
    expect(change.state.position).toBe(2);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-1");
  });

  it("keeps an open sandbox that only a dropped forward entry pointed to", function keepsTarget(): void {
    const afterA = openInTurn(["a"]);
    const backToHome = restoreSandbox(afterA, 0, "mod_explorer");

    const change = openStageEntry(
      backToHome,
      { kind: "sandbox", sandboxId: "sandbox-2" },
      null,
    );

    expect(change.closedIds).toEqual([]);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-2");
  });

  it("New link after going back", function dropsForwardEntries(): void {
    const afterB = openInTurn(["a", "b"]);
    const backToA = restoreSandbox(afterB, 1, "a");

    const change = openStageEntry(backToA, newSandbox("c", "sandbox-2"), null);

    expect(change.closedIds).toEqual(["sandbox-3"]);
    expect(listSandboxIds(change.state)).toEqual([
      "sandbox-1",
      "sandbox-2",
      "sandbox-4",
    ]);
    expect(change.state.entries).toHaveLength(3);
    expect(change.state.entries[2].view).toEqual({
      kind: "sandbox",
      sandboxId: "sandbox-4",
    });
  });

  it("New section after going back", function dropsForwardPages(): void {
    // Home page, the book list through a link, then Settings.
    let state = openStageEntry(
      createStageState(),
      pageView("home"),
      "home",
    ).state;
    state = openStageEntry(state, newSandbox("book_list"), null).state;
    state = openStageEntry(state, pageView("settings"), "settings").state;
    state = restoreSandbox(state, 1, "book_list");
    state = restoreStageEntry(state, 0, HOME_PAGE.route, "home").state;

    const change = openStageEntry(state, newSandbox("mod_explorer"), "mods");

    expect(change.closedIds).toEqual(["sandbox-1"]);
    expect(listSandboxIds(change.state)).toEqual(["sandbox-2"]);
    expect(change.state.entries).toHaveLength(2);
  });

  it("keeps a dropped sandbox that an earlier entry still points to", function keepsReferencedSandbox(): void {
    const afterA = openInTurn(["a"]);
    const closed = closeStageSandbox(afterA, "sandbox-2", HOME_MOD).state;
    // The current entry (position 1) now points to sandbox-1, as entry 0 does.
    const backToHome = restoreSandbox(closed, 0, "mod_explorer");

    const change = openStageEntry(
      backToHome,
      newSandbox("c", "sandbox-1"),
      null,
    );

    expect(change.closedIds).toEqual([]);
    expect(listSandboxIds(change.state)).toEqual(["sandbox-1", "sandbox-3"]);
  });
});

describe("restoreStageEntry", function describeRestoreStageEntry(): void {
  it("Back to the previous mod", function showsOpenSandbox(): void {
    const state = openInTurn(["a"]);

    const change = restoreSandbox(state, 0, "mod_explorer");

    expect(change.position).toBe(0);
    expect(readVisibleSandbox(change)?.id).toBe("sandbox-1");
    expect(change.entries).toHaveLength(2);
  });

  it("Back from a page to a mod", function showsSandboxBehindPage(): void {
    const state = openStageEntry(
      openInTurn(["a"]),
      pageView("settings"),
      "settings",
    ).state;

    const change = restoreSandbox(state, 1, "a");

    expect(readVisibleSandbox(change)?.id).toBe("sandbox-2");
    expect(listSandboxIds(change)).toEqual(["sandbox-1", "sandbox-2"]);
    expect(change.entries).toHaveLength(3);
  });

  it("Forward to a page", function showsPageAgain(): void {
    const state = openStageEntry(
      openInTurn(["a"]),
      pageView("settings"),
      "settings",
    ).state;
    const back = restoreSandbox(state, 1, "a");

    const change = restoreStageEntry(
      back,
      2,
      { kind: "page", hash: "#/settings", section: "settings", page: null },
      "settings",
    );

    expect(change.opened).toBeNull();
    expect(readVisibleSandbox(change.state)).toBeNull();
    expect(readVisibleEntry(change.state)?.view).toEqual({
      kind: "page",
      section: "settings",
      page: null,
    });
  });

  it("Reload on a page", function placesPageEntry(): void {
    const change = restoreStageEntry(
      createStageState(),
      3,
      { kind: "page", hash: "#/about", section: "about", page: null },
      "about",
    );

    expect(change.opened).toBeNull();
    expect(change.state.position).toBe(3);
    expect(change.state.entries).toEqual([
      {
        position: 3,
        view: { kind: "page", section: "about", page: null },
        section: "about",
      },
    ]);
  });

  it("opens a new sandbox for an entry whose sandbox was closed", function reopensClosedEntry(): void {
    const state = openInTurn(["a", "b"]);
    const backToA = restoreSandbox(state, 1, "a");
    const closed = closeStageSandbox(backToA, "sandbox-3", HOME_MOD).state;

    const change = restoreStageEntry(
      closed,
      2,
      {
        kind: "sandbox",
        hash: "#/run?mod=b",
        link: buildLink("b"),
        isHomeMod: false,
      },
      "home",
    );

    expect(change.opened?.id).toBe("sandbox-4");
    expect(change.opened?.link).toEqual(buildLink("b"));
    expect(change.opened?.section).toBe("home");
    expect(change.state.entries[2]).toEqual({
      position: 2,
      view: { kind: "sandbox", sandboxId: "sandbox-4" },
      section: "home",
    });
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-4");
  });

  it("Back after a page reload", function opensUnknownEntry(): void {
    const reloaded = restoreSandbox(createStageState(), 1, "b");

    const change = restoreStageEntry(
      reloaded,
      0,
      {
        kind: "sandbox",
        hash: "#/run?mod=a",
        link: buildLink("a"),
        isHomeMod: false,
      },
      "mods",
    );

    expect(change.opened).toEqual({
      id: "sandbox-2",
      hash: "#/run?mod=a",
      link: buildLink("a"),
      openerId: null,
      section: "mods",
      isHomeMod: false,
    });
    expect(change.state.position).toBe(0);
    expect(change.state.entries).toEqual([
      {
        position: 0,
        view: { kind: "sandbox", sandboxId: "sandbox-2" },
        section: "mods",
      },
      {
        position: 1,
        view: { kind: "sandbox", sandboxId: "sandbox-1" },
        section: null,
      },
    ]);
  });
});

describe("closeStageSandbox", function describeCloseStageSandbox(): void {
  it("Close the viewer", function showsOpener(): void {
    const state = openInTurn(["mod_viewer"]);

    const change = closeStageSandbox(state, "sandbox-2", HOME_MOD);

    expect(change.closedIds).toEqual(["sandbox-2"]);
    expect(change.opened).toBeNull();
    expect(listSandboxIds(change.state)).toEqual(["sandbox-1"]);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-1");
    expect(change.state.entries[1]).toEqual({
      position: 1,
      view: { kind: "sandbox", sandboxId: "sandbox-1" },
      section: "home",
    });
  });

  it("opens a new Home mod sandbox when the Home target is a mod", function opensHomeMod(): void {
    const linked = openStageEntry(
      createStageState(),
      newSandbox("a"),
      null,
    ).state;

    const change = closeStageSandbox(linked, "sandbox-1", HOME_MOD);

    expect(change.closedIds).toEqual(["sandbox-1"]);
    expect(change.opened).toEqual({
      id: "sandbox-2",
      hash: "#/",
      link: HOME_LINK,
      openerId: null,
      section: "home",
      isHomeMod: true,
    });
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-2");
    expect(change.state.entries).toEqual([
      {
        position: 0,
        view: { kind: "sandbox", sandboxId: "sandbox-2" },
        section: "home",
      },
    ]);
  });

  it("Close a mod opened from a link", function showsHomePage(): void {
    const linked = openStageEntry(
      createStageState(),
      newSandbox("a"),
      null,
    ).state;

    const change = closeStageSandbox(linked, "sandbox-1", HOME_PAGE);

    expect(change.closedIds).toEqual(["sandbox-1"]);
    expect(change.opened).toBeNull();
    expect(change.state.sandboxes).toEqual([]);
    expect(readVisibleSandbox(change.state)).toBeNull();
    expect(change.state.entries).toEqual([
      {
        position: 0,
        view: { kind: "page", section: "home", page: null },
        section: "home",
      },
    ]);
  });

  it("closes a hidden sandbox without changing the visible one", function closesHidden(): void {
    const state = openInTurn(["a"]);

    const change = closeStageSandbox(state, "sandbox-1", HOME_MOD);

    expect(change.closedIds).toEqual(["sandbox-1"]);
    expect(change.opened).toBeNull();
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-2");
    expect(change.state.entries[0].view).toEqual({
      kind: "sandbox",
      sandboxId: "sandbox-1",
    });
  });
});

function buildOpening(mod: string): SandboxOpening {
  const opening: SandboxOpening = {
    hash: `#/run?mod=${mod}`,
    link: buildLink(mod),
    openerId: null,
    isHomeMod: false,
  };
  return opening;
}

describe("replaceStageEntry", function describeReplaceStageEntry(): void {
  it("points the current entry to the new sandbox at the same position and section", function replacesEntry(): void {
    const state = openInTurn(["a"]);

    const change = replaceStageEntry(state, buildOpening("b"), "sandbox-2");

    expect(change.opened).toMatchObject({
      id: "sandbox-3",
      hash: "#/run?mod=b",
      link: buildLink("b"),
      section: "home",
      isHomeMod: false,
    });
    expect(change.state.position).toBe(1);
    expect(change.state.entries).toEqual([
      {
        position: 0,
        view: { kind: "sandbox", sandboxId: "sandbox-1" },
        section: "home",
      },
      {
        position: 1,
        view: { kind: "sandbox", sandboxId: "sandbox-3" },
        section: "home",
      },
    ]);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-3");
    expect(change.state.nextNumber).toBe(4);
  });

  it("gives the new sandbox the requester's opener", function keepsOpener(): void {
    const state = openInTurn(["a"]);

    const change = replaceStageEntry(
      state,
      { ...buildOpening("b"), openerId: "sandbox-2" },
      "sandbox-2",
    );

    expect(change.opened?.openerId).toBe("sandbox-1");
  });

  it("keeps the forward entries", function keepsForwardEntries(): void {
    const state = restoreSandbox(openInTurn(["a", "b"]), 1, "a");

    const change = replaceStageEntry(state, buildOpening("c"), "sandbox-2");

    expect(change.state.entries).toHaveLength(3);
    expect(change.state.entries[2].view).toEqual({
      kind: "sandbox",
      sandboxId: "sandbox-3",
    });
    expect(listSandboxIds(change.state)).toEqual([
      "sandbox-1",
      "sandbox-3",
      "sandbox-4",
    ]);
  });

  it("closes the requester", function closesRequester(): void {
    const state = openInTurn(["a"]);

    const change = replaceStageEntry(state, buildOpening("b"), "sandbox-2");

    expect(change.closedIds).toEqual(["sandbox-2"]);
    expect(listSandboxIds(change.state)).toEqual(["sandbox-1", "sandbox-3"]);
  });

  it("restores by link another entry that pointed to the requester", function restoresOtherEntry(): void {
    const opened = openInTurn(["a"]);
    const onPage = openStageEntry(opened, pageView("guides"), null).state;
    const backToA = openStageEntry(
      onPage,
      { kind: "sandbox", sandboxId: "sandbox-2" },
      "home",
    ).state;
    const replaced = replaceStageEntry(
      backToA,
      buildOpening("b"),
      "sandbox-2",
    ).state;

    expect(replaced.entries[1].view).toEqual({
      kind: "sandbox",
      sandboxId: "sandbox-2",
    });
    const change = restoreStageEntry(
      replaced,
      1,
      {
        kind: "sandbox",
        hash: "#/run?mod=a",
        link: buildLink("a"),
        isHomeMod: false,
      },
      "home",
    );
    expect(change.opened?.id).toBe("sandbox-4");
    expect(change.opened?.link).toEqual(buildLink("a"));
  });

  it("does not change the input state", function keepsInput(): void {
    const state = openInTurn(["a"]);
    const copy = structuredClone(state);

    replaceStageEntry(state, buildOpening("b"), "sandbox-2");

    expect(state).toEqual(copy);
  });

  it("refuses a requester that is not the visible sandbox", function refusesHidden(): void {
    const state = openInTurn(["a"]);

    expect(function replaceHidden(): void {
      replaceStageEntry(state, buildOpening("b"), "sandbox-1");
    }).toThrow(
      'Cannot replace sandbox "sandbox-1": the visible sandbox is "sandbox-2".',
    );
  });
});
