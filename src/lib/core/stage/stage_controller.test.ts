import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { FakeHistory } from "../../../test/fake_history.ts";
import type { FakeNavigation } from "../../../test/fake_history.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import { APP_ORIGIN, SAMPLE_MOD_SOURCE } from "../../../test/sample_mods.ts";
import { fetchTestFile } from "../../../test/test_files.ts";
import {
  attachFrame,
  closeSandbox,
  createStage,
  followHistory,
  frameLoadedAgain,
  openStageLink,
  readStageSnapshot,
  subscribeStage,
} from "./stage_controller.ts";
import type { SandboxSnapshot, Stage } from "./stage_controller.ts";

const SAMPLE_HASH = "#/run?mod=.%2Fsamples%2Fmods%2Fbook_list";
const VIEWER_LINK = {
  mod: "./samples/mods/book_list",
  collection: "./samples/tiles/books_collection.yaml",
  params: { from: "explorer" },
};

const openPorts: MessagePort[] = [];

afterEach(function closePorts(): void {
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

function buildStage(history: FakeHistory): Stage {
  const stage = createStage({
    history,
    defaults: {
      folder: "./default_mods/",
      home: "./samples/mods/book_list",
      switchedOff: [],
    },
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    storage: createMemoryStorage(),
    fetch: fetchTestFile,
  });
  return stage;
}

async function settleStage(stage: Stage): Promise<void> {
  const launches: Promise<void>[] = [];
  for (const runtime of stage.runtimes.values()) {
    launches.push(runtime.settled);
  }
  await Promise.all(launches);
}

/** Plays `popstate`: the stage follows the entry the fake history moved to. */
async function follow(stage: Stage, navigation: FakeNavigation): Promise<void> {
  followHistory(stage, navigation.hash, navigation.state);
  await settleStage(stage);
}

function readVisible(stage: Stage): SandboxSnapshot {
  for (const sandbox of readStageSnapshot(stage).sandboxes) {
    if (sandbox.isVisible) {
      return sandbox;
    }
  }
  throw new Error("Expected a visible sandbox");
}

function listIds(stage: Stage): string[] {
  const ids: string[] = [];
  for (const sandbox of readStageSnapshot(stage).sandboxes) {
    ids.push(sandbox.id);
  }
  return ids;
}

/** Starts at home, then opens the viewer link from the home sandbox, like the explorer does. */
async function openViewerFromHome(history: FakeHistory): Promise<Stage> {
  const stage = buildStage(history);
  await follow(stage, history.readNavigation());
  openStageLink(stage, VIEWER_LINK, "sandbox-1");
  await settleStage(stage);
  return stage;
}

describe("followHistory", function describeFollowHistory(): void {
  it("No hash", async function opensHome(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);

    await follow(stage, history.readNavigation());

    expect(history.entries).toEqual([
      { state: { opentesela: { position: 0 } }, hash: "#/" },
    ]);
    const visible = readVisible(stage);
    expect(visible).toMatchObject({
      id: "sandbox-1",
      hash: "#/",
      status: "running",
      canClose: false,
      mod: { title: "Book List", version: "1.0.0", source: SAMPLE_MOD_SOURCE },
    });
    expect(visible.sandboxDocument).toContain("Content-Security-Policy");
  });

  it("Second link hides the first mod", async function opensFollowedLink(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const firstRuntime = stage.runtimes.get("sandbox-1");

    await follow(stage, history.followLink(SAMPLE_HASH));

    expect(history.entries[1]).toEqual({
      state: { opentesela: { position: 1 } },
      hash: SAMPLE_HASH,
    });
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-2"]);
    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(readVisible(stage).canClose).toBe(true);
    expect(stage.runtimes.get("sandbox-1")).toBe(firstRuntime);
    expect(firstRuntime?.status).toBe("running");
  });

  it("Back to the previous mod", async function goesBack(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const fakeFrame = createFakeFrame();
    attachFrame(stage, "sandbox-1", fakeFrame.target);
    openPorts.push(readModPort(fakeFrame));
    const firstSession = stage.runtimes.get("sandbox-1")?.session;

    await follow(stage, history.goBack());

    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(stage.runtimes.get("sandbox-1")?.session).toBe(firstSession);
    expect(fakeFrame.posted).toHaveLength(1);
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-2"]);
  });

  it("Forward again", async function goesForward(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const viewerRuntime = stage.runtimes.get("sandbox-2");
    await follow(stage, history.goBack());

    await follow(stage, history.goForward());

    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(stage.runtimes.get("sandbox-2")).toBe(viewerRuntime);
  });

  it("Back after a page reload", async function reopensAfterReload(): Promise<void> {
    const history = new FakeHistory("");
    await openViewerFromHome(history);
    const reloadedStage = buildStage(history);
    await follow(reloadedStage, history.readNavigation());

    await follow(reloadedStage, history.goBack());

    expect(listIds(reloadedStage)).toEqual(["sandbox-1", "sandbox-2"]);
    expect(readVisible(reloadedStage)).toMatchObject({
      id: "sandbox-2",
      hash: "#/",
      status: "running",
    });
  });

  it("opens a new sandbox for an entry whose sandbox was closed", async function reopensClosedEntry(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    await follow(stage, history.goBack());
    closeSandbox(stage, "sandbox-2");

    await follow(stage, history.goForward());

    expect(readVisible(stage).id).toBe("sandbox-3");
    expect(stage.runtimes.has("sandbox-2")).toBe(false);
  });

  it("New link after going back", async function dropsForwardRuntimes(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const viewerRuntime = stage.runtimes.get("sandbox-2");
    await follow(stage, history.goBack());

    await follow(stage, history.followLink(SAMPLE_HASH));

    expect(viewerRuntime?.status).toBe("stopped");
    expect(stage.runtimes.has("sandbox-2")).toBe(false);
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-3"]);
  });
});

describe("openStageLink", function describeOpenStageLink(): void {
  it("pushes the run link and records the opener", async function pushesLink(): Promise<void> {
    const history = new FakeHistory("");

    const stage = await openViewerFromHome(history);

    expect(history.entries).toEqual([
      { state: { opentesela: { position: 0 } }, hash: "#/" },
      {
        state: { opentesela: { position: 1 } },
        hash: "#/run?mod=.%2Fsamples%2Fmods%2Fbook_list&collection=.%2Fsamples%2Ftiles%2Fbooks_collection.yaml&from=explorer",
      },
    ]);
    expect(stage.state.sandboxes[1].openerId).toBe("sandbox-1");
    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      canReloadTiles: true,
    });
  });

  it("Hidden mod tries to open a mod", async function refusesHidden(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);

    const isOpened = openStageLink(stage, VIEWER_LINK, "sandbox-1");

    expect(isOpened).toBe(false);
    expect(history.entries).toHaveLength(2);
    expect(readVisible(stage).id).toBe("sandbox-2");
  });
});

describe("closeSandbox", function describeCloseSandbox(): void {
  it("Close the viewer", async function closesViewer(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const viewerRuntime = stage.runtimes.get("sandbox-2");

    closeSandbox(stage, "sandbox-2");

    expect(viewerRuntime?.status).toBe("stopped");
    expect(listIds(stage)).toEqual(["sandbox-1"]);
    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(history.entries[1]).toEqual({
      state: { opentesela: { position: 1 } },
      hash: "#/",
    });
  });

  it("Close a mod opened from a link", async function closesLinkedMod(): Promise<void> {
    const history = new FakeHistory(SAMPLE_HASH);
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    closeSandbox(stage, "sandbox-1");
    await settleStage(stage);

    expect(listIds(stage)).toEqual(["sandbox-2"]);
    expect(readVisible(stage)).toMatchObject({ hash: "#/", canClose: false });
    expect(history.entries).toEqual([
      { state: { opentesela: { position: 0 } }, hash: "#/" },
    ]);
  });
});

describe("frameLoadedAgain", function describeFrameLoadedAgain(): void {
  it("Mod navigates its frame", async function stopsNavigatingMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    frameLoadedAgain(stage, "sandbox-1");

    const visible = readVisible(stage);
    expect(visible.status).toBe("stopped");
    expect(visible.sandboxDocument).toBeNull();
    expect(visible.issues).toEqual([
      {
        level: "error",
        source: SAMPLE_MOD_SOURCE,
        message: "The mod left its page and was stopped.",
      },
    ]);
  });
});

describe("subscribeStage", function describeSubscribeStage(): void {
  it("notifies every change with a new frozen snapshot", async function notifiesChanges(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeStage(stage, listener);
    const emptySnapshot = readStageSnapshot(stage);

    await follow(stage, history.readNavigation());
    const runningSnapshot = readStageSnapshot(stage);
    unsubscribe();
    closeSandbox(stage, "sandbox-1");

    expect(emptySnapshot.sandboxes).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(runningSnapshot).not.toBe(emptySnapshot);
    expect(Object.isFrozen(runningSnapshot)).toBe(true);
    expect(Object.isFrozen(runningSnapshot.sandboxes)).toBe(true);
    expect(Object.isFrozen(runningSnapshot.sandboxes[0])).toBe(true);
    expect(Object.isFrozen(runningSnapshot.sandboxes[0].issues)).toBe(true);
    expect(readStageSnapshot(stage)).toBe(readStageSnapshot(stage));
  });

  it("lists issues found while the mod runs", async function listsRunningIssues(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const fakeFrame = createFakeFrame();
    attachFrame(stage, "sandbox-1", fakeFrame.target);
    const modPort = readModPort(fakeFrame);
    openPorts.push(modPort);

    modPort.postMessage({
      jsonrpc: "2.0",
      method: "sandbox.blocked",
      params: {
        blockedUrl: "https://images.example.net/a.jpg",
        directive: "img-src",
      },
    });
    await waitForMessages();

    expect(readVisible(stage).issues).toHaveLength(1);
    expect(readVisible(stage).issues[0].message).toContain(
      "https://images.example.net",
    );
  });
});
