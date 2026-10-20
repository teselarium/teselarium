import { describe, expect, it } from "vitest";
import type { RunLink } from "../engine/index.ts";
import {
  closeStageSandbox,
  createStageState,
  openStageEntry,
  readVisibleSandbox,
  restoreStageEntry,
} from "./stage_state.ts";
import type { StageState } from "./stage_state.ts";

const HOME_LINK: RunLink = {
  mod: "mod_explorer",
  collection: null,
  params: {},
};

function buildLink(mod: string): RunLink {
  const link: RunLink = { mod, collection: null, params: {} };
  return link;
}

/** Opens home at position 0, then each mod in turn from the visible sandbox. */
function openInTurn(mods: string[]): StageState {
  let state = openStageEntry(
    createStageState(),
    "#/",
    HOME_LINK,
    null,
    true,
  ).state;
  for (const mod of mods) {
    const openerId = readVisibleSandbox(state)?.id ?? null;
    state = openStageEntry(
      state,
      `#/run?mod=${mod}`,
      buildLink(mod),
      openerId,
      false,
    ).state;
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

describe("openStageEntry", function describeOpenStageEntry(): void {
  it("counts ids from sandbox-1 and shows the new sandbox", function opensFirst(): void {
    const change = openStageEntry(
      createStageState(),
      "#/",
      HOME_LINK,
      null,
      true,
    );

    expect(change.opened).toEqual({
      id: "sandbox-1",
      hash: "#/",
      link: HOME_LINK,
      openerId: null,
      isHome: true,
    });
    expect(change.closedIds).toEqual([]);
    expect(change.state.position).toBe(0);
    expect(change.state.entries).toEqual([
      { position: 0, sandboxId: "sandbox-1" },
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

    openStageEntry(state, "#/run?mod=a", buildLink("a"), "sandbox-1", false);

    expect(state).toEqual(copy);
  });

  it("New link after going back", function dropsForwardEntries(): void {
    const afterB = openInTurn(["a", "b"]);
    const backToA = restoreStageEntry(
      afterB,
      1,
      "#/run?mod=a",
      buildLink("a"),
      false,
    ).state;

    const change = openStageEntry(
      backToA,
      "#/run?mod=c",
      buildLink("c"),
      "sandbox-2",
      false,
    );

    expect(change.closedIds).toEqual(["sandbox-3"]);
    expect(listSandboxIds(change.state)).toEqual([
      "sandbox-1",
      "sandbox-2",
      "sandbox-4",
    ]);
    expect(change.state.entries).toEqual([
      { position: 0, sandboxId: "sandbox-1" },
      { position: 1, sandboxId: "sandbox-2" },
      { position: 2, sandboxId: "sandbox-4" },
    ]);
  });

  it("keeps a dropped sandbox that an earlier entry still points to", function keepsReferencedSandbox(): void {
    const afterA = openInTurn(["a"]);
    const closed = closeStageSandbox(afterA, "sandbox-2", HOME_LINK).state;
    // The current entry (position 1) now points to sandbox-1, as entry 0 does.
    const backToHome = restoreStageEntry(
      closed,
      0,
      "#/",
      HOME_LINK,
      true,
    ).state;

    const change = openStageEntry(
      backToHome,
      "#/run?mod=c",
      buildLink("c"),
      "sandbox-1",
      false,
    );

    expect(change.closedIds).toEqual([]);
    expect(listSandboxIds(change.state)).toEqual(["sandbox-1", "sandbox-3"]);
  });
});

describe("restoreStageEntry", function describeRestoreStageEntry(): void {
  it("Back to the previous mod", function showsOpenSandbox(): void {
    const state = openInTurn(["a"]);

    const change = restoreStageEntry(state, 0, "#/", HOME_LINK, true);

    expect(change.opened).toBeNull();
    expect(change.closedIds).toEqual([]);
    expect(change.state.position).toBe(0);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-1");
    expect(change.state.entries).toHaveLength(2);
  });

  it("opens a new sandbox for an entry whose sandbox was closed", function reopensClosedEntry(): void {
    const state = openInTurn(["a", "b"]);
    const backToA = restoreStageEntry(
      state,
      1,
      "#/run?mod=a",
      buildLink("a"),
      false,
    ).state;
    const closed = closeStageSandbox(backToA, "sandbox-3", HOME_LINK).state;

    const change = restoreStageEntry(
      closed,
      2,
      "#/run?mod=b",
      buildLink("b"),
      false,
    );

    expect(change.opened?.id).toBe("sandbox-4");
    expect(change.opened?.link).toEqual(buildLink("b"));
    expect(change.state.entries[2]).toEqual({
      position: 2,
      sandboxId: "sandbox-4",
    });
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-4");
  });

  it("Back after a page reload", function opensUnknownEntry(): void {
    const reloaded = restoreStageEntry(
      createStageState(),
      1,
      "#/run?mod=b",
      buildLink("b"),
      false,
    ).state;

    const change = restoreStageEntry(
      reloaded,
      0,
      "#/run?mod=a",
      buildLink("a"),
      false,
    );

    expect(change.opened).toEqual({
      id: "sandbox-2",
      hash: "#/run?mod=a",
      link: buildLink("a"),
      openerId: null,
      isHome: false,
    });
    expect(change.state.position).toBe(0);
    expect(change.state.entries).toEqual([
      { position: 0, sandboxId: "sandbox-2" },
      { position: 1, sandboxId: "sandbox-1" },
    ]);
  });
});

describe("closeStageSandbox", function describeCloseStageSandbox(): void {
  it("Close the viewer", function showsOpener(): void {
    const state = openInTurn(["mod_viewer"]);

    const change = closeStageSandbox(state, "sandbox-2", HOME_LINK);

    expect(change.closedIds).toEqual(["sandbox-2"]);
    expect(change.opened).toBeNull();
    expect(listSandboxIds(change.state)).toEqual(["sandbox-1"]);
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-1");
    expect(change.state.entries[1]).toEqual({
      position: 1,
      sandboxId: "sandbox-1",
    });
  });

  it("Close a mod opened from a link", function opensHome(): void {
    const linked = openStageEntry(
      createStageState(),
      "#/run?mod=a",
      buildLink("a"),
      null,
      false,
    ).state;

    const change = closeStageSandbox(linked, "sandbox-1", HOME_LINK);

    expect(change.closedIds).toEqual(["sandbox-1"]);
    expect(change.opened).toEqual({
      id: "sandbox-2",
      hash: "#/",
      link: HOME_LINK,
      openerId: null,
      isHome: true,
    });
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-2");
    expect(change.state.entries).toEqual([
      { position: 0, sandboxId: "sandbox-2" },
    ]);
  });

  it("closes a hidden sandbox without changing the visible one", function closesHidden(): void {
    const state = openInTurn(["a"]);

    const change = closeStageSandbox(state, "sandbox-1", HOME_LINK);

    expect(change.closedIds).toEqual(["sandbox-1"]);
    expect(change.opened).toBeNull();
    expect(readVisibleSandbox(change.state)?.id).toBe("sandbox-2");
    expect(change.state.entries[0]).toEqual({
      position: 0,
      sandboxId: "sandbox-1",
    });
  });
});
