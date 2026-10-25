import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { FakeHistory } from "../../../test/fake_history.ts";
import type { FakeNavigation } from "../../../test/fake_history.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_RUN_HASH,
} from "../../../test/sample_mods.ts";
import { fetchTestFile } from "../../../test/test_files.ts";
import {
  MOD_HOME_ROUTING,
  PAGE_HOME_ROUTING,
} from "../../../test/test_stages.ts";
import type { AppAction } from "../engine/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { ColorScheme } from "../theme/index.ts";
import type { StageRouting } from "./stage_routes.ts";
import {
  answerStageAction,
  attachFrame,
  changeStageColorScheme,
  closeSandbox,
  createStage,
  followHistory,
  frameLoadedAgain,
  openStageLink,
  openStageSection,
  readStageSnapshot,
  requestStageAction,
  subscribeStage,
} from "./stage_controller.ts";
import type { SandboxSnapshot, Stage } from "./stage_controller.ts";

/** The sample mod with its collection: no section has this link. */
const COLLECTION_HASH = SAMPLE_COLLECTION_RUN_HASH;
const VIEWER_LINK = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: SAMPLE_COLLECTION_REFERENCE,
  params: { from: "explorer" },
};

const openPorts: MessagePort[] = [];

afterEach(function closePorts(): void {
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

/** A stage whose Home is the sample mod, unless `routing` says otherwise. */
function buildStage(
  history: FakeHistory,
  colorScheme: ColorScheme = "light",
  routing: StageRouting = MOD_HOME_ROUTING,
): Stage {
  const stage = createStage({
    history,
    defaults: { folder: "./default_mods/", switchedOff: [] },
    routing,
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    storage: createMemoryStorage(),
    fetch: fetchTestFile,
    colorScheme,
  });
  return stage;
}

/** Attaches a fake frame to a sandbox, and keeps what its mod receives. */
function attachCollectingFrame(
  stage: Stage,
  id: string,
): { posted: unknown[]; received: unknown[]; modPort: MessagePort } {
  const fakeFrame = createFakeFrame();
  attachFrame(stage, id, fakeFrame.target);
  const modPort = readModPort(fakeFrame);
  openPorts.push(modPort);
  const posted: unknown[] = [];
  for (const post of fakeFrame.posted) {
    posted.push(post.message);
  }
  const attached = { posted, received: collectMessages(modPort), modPort };
  return attached;
}

/** The `colorScheme` of the mount context in a posted `sandbox.connect`. */
function readConnectColorScheme(message: unknown): string {
  const connect = message as {
    params: { context: { theme: { colorScheme: string } } };
  };
  return connect.params.context.theme.colorScheme;
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

/** The history state the stage writes for an entry. */
function stageState(position: number, section: string | null): unknown {
  const historyState = { opentesela: { position, section } };
  return historyState;
}

/** Starts the vanilla-like stage, whose Home is a page, at `hash`. */
async function startPageStage(history: FakeHistory): Promise<Stage> {
  const stage = buildStage(history, "light", PAGE_HOME_ROUTING);
  await follow(stage, history.readNavigation());
  return stage;
}

/** Activates a section, as the sidebar does, and waits for any launch. */
async function openSection(stage: Stage, section: string): Promise<void> {
  openStageSection(stage, section);
  await settleStage(stage);
}

/** On the page stage: opens Mods, then the viewer from the explorer. */
async function openViewerFromMods(history: FakeHistory): Promise<Stage> {
  const stage = await startPageStage(history);
  await openSection(stage, "mods");
  openStageLink(stage, VIEWER_LINK, "sandbox-1");
  await settleStage(stage);
  return stage;
}

describe("followHistory", function describeFollowHistory(): void {
  it("No hash", async function opensHomePage(): Promise<void> {
    const history = new FakeHistory("");

    const stage = await startPageStage(history);

    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
    ]);
    expect(readStageSnapshot(stage)).toMatchObject({
      sandboxes: [],
      visible: { kind: "page", section: "home", page: null },
      activeSection: "home",
    });
  });

  it("Unknown hash", async function opensHomeForUnknownHash(): Promise<void> {
    const history = new FakeHistory("#/mods/view");

    const stage = await startPageStage(history);

    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
    ]);
    expect(readStageSnapshot(stage).visible).toEqual({
      kind: "page",
      section: "home",
      page: null,
    });
  });

  it("Home as a mod", async function opensHomeMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);

    await follow(stage, history.readNavigation());

    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
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
    expect(readStageSnapshot(stage).visible).toEqual({
      kind: "sandbox",
      id: "sandbox-1",
    });
  });

  it("Sub-page", async function opensSubPage(): Promise<void> {
    const history = new FakeHistory("#/guides/first_steps");

    const stage = await startPageStage(history);

    expect(history.entries).toEqual([
      { state: stageState(0, "guides"), hash: "#/guides/first_steps" },
    ]);
    expect(readStageSnapshot(stage)).toMatchObject({
      visible: { kind: "page", section: "guides", page: "first_steps" },
      activeSection: "guides",
    });
  });

  it("Second link hides the first mod", async function opensFollowedLink(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const firstRuntime = stage.runtimes.get("sandbox-1");

    await follow(stage, history.followLink(COLLECTION_HASH));

    expect(history.entries[1]).toEqual({
      state: stageState(1, null),
      hash: COLLECTION_HASH,
    });
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-2"]);
    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(readVisible(stage).canClose).toBe(true);
    expect(stage.runtimes.get("sandbox-1")).toBe(firstRuntime);
    expect(firstRuntime?.status).toBe("running");
  });

  it("A page hides the mods", async function hidesModsForPage(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);
    const runtime = stage.runtimes.get("sandbox-1");

    await openSection(stage, "settings");

    const snapshot = readStageSnapshot(stage);
    expect(snapshot.visible).toEqual({
      kind: "page",
      section: "settings",
      page: null,
    });
    expect(snapshot.sandboxes).toHaveLength(1);
    expect(snapshot.sandboxes[0].isVisible).toBe(false);
    expect(runtime?.status).toBe("running");
    expect(history.entries[1]).toEqual({
      state: stageState(1, "settings"),
      hash: "#/settings",
    });
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

  it("Back from a page to a mod", async function goesBackFromPage(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);
    const runtime = stage.runtimes.get("sandbox-1");
    await openSection(stage, "settings");

    await follow(stage, history.goBack());

    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(stage.runtimes.get("sandbox-1")).toBe(runtime);
  });

  it("Forward to a page", async function goesForwardToPage(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);
    await openSection(stage, "settings");
    await follow(stage, history.goBack());

    await follow(stage, history.goForward());

    expect(readStageSnapshot(stage).visible).toEqual({
      kind: "page",
      section: "settings",
      page: null,
    });
  });

  it("Reload on a page", async function reloadsOnPage(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);
    await openSection(stage, "about");
    const reloadedStage = buildStage(history, "light", PAGE_HOME_ROUTING);

    await follow(reloadedStage, history.readNavigation());
    expect(readStageSnapshot(reloadedStage)).toMatchObject({
      visible: { kind: "page", section: "about", page: null },
      activeSection: "about",
    });
    await follow(reloadedStage, history.goBack());

    expect(readVisible(reloadedStage).hash).toBe(SAMPLE_RUN_HASH);
    expect(readStageSnapshot(reloadedStage).sandboxes).toHaveLength(1);
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
      canClose: false,
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

    await follow(stage, history.followLink(SAMPLE_RUN_HASH));

    expect(viewerRuntime?.status).toBe("stopped");
    expect(stage.runtimes.has("sandbox-2")).toBe(false);
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-3"]);
  });

  it("New section after going back", async function dropsForwardPages(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);
    await follow(stage, history.followLink(SAMPLE_RUN_HASH));
    const bookList = stage.runtimes.get("sandbox-1");
    await openSection(stage, "settings");
    await follow(stage, history.goBack());
    await follow(stage, history.goBack());

    await openSection(stage, "mods");

    expect(bookList?.status).toBe("stopped");
    expect(stage.runtimes.has("sandbox-1")).toBe(false);
    expect(listIds(stage)).toEqual(["sandbox-2"]);
    expect(history.entries).toHaveLength(2);
  });
});

describe("openStageSection", function describeOpenStageSection(): void {
  it("opens the section's mod with its run link", async function opensModSection(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);

    await openSection(stage, "mods");

    expect(history.entries[1]).toEqual({
      state: stageState(1, "mods"),
      hash: "#/run?mod=mod_explorer",
    });
    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-1",
      canClose: true,
      mod: { title: "Mods" },
    });
    expect(readStageSnapshot(stage).activeSection).toBe("mods");
  });

  it("does nothing for an unknown section", async function ignoresUnknown(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);

    expect(openStageSection(stage, "atlas")).toBe(false);
    expect(history.entries).toHaveLength(1);
  });

  it("Back where you left off", async function showsLastView(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromMods(history);
    const viewerRuntime = stage.runtimes.get("sandbox-2");
    await openSection(stage, "home");

    await openSection(stage, "mods");

    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(stage.runtimes.get("sandbox-2")).toBe(viewerRuntime);
    expect(history.entries[4]).toEqual({
      state: stageState(4, "mods"),
      hash: readVisible(stage).hash,
    });
  });

  it("Activating the current section returns to its start", async function showsRoot(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromMods(history);
    const explorerRuntime = stage.runtimes.get("sandbox-1");

    await openSection(stage, "mods");

    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(stage.runtimes.get("sandbox-1")).toBe(explorerRuntime);
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-2"]);
  });

  it("One explorer for repeated visits", async function keepsOneExplorer(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);

    for (const section of ["mods", "home", "mods", "home", "mods"]) {
      await openSection(stage, section);
    }

    expect(listIds(stage)).toEqual(["sandbox-1"]);
    expect(readVisible(stage).id).toBe("sandbox-1");
  });

  it("Closed root opens a new one", async function opensNewRoot(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);
    await openSection(stage, "mods");
    closeSandbox(stage, "sandbox-1");

    await openSection(stage, "mods");

    expect(listIds(stage)).toEqual(["sandbox-2"]);
    expect(readVisible(stage).id).toBe("sandbox-2");
  });

  it("Last page of a page section", async function showsLastPage(): Promise<void> {
    const history = new FakeHistory("#/guides/first_steps");
    const stage = await startPageStage(history);
    await openSection(stage, "home");

    await openSection(stage, "guides");

    expect(history.hash).toBe("#/guides/first_steps");
    expect(readStageSnapshot(stage).visible).toEqual({
      kind: "page",
      section: "guides",
      page: "first_steps",
    });
  });

  it("shows the index page when the page section is the current one", async function showsIndex(): Promise<void> {
    const history = new FakeHistory("#/guides/first_steps");
    const stage = await startPageStage(history);

    await openSection(stage, "guides");

    expect(history.hash).toBe("#/guides");
  });

  it("Back after switching sections", async function goesBackAcrossSections(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);
    await openSection(stage, "mods");
    await openSection(stage, "home");
    await openSection(stage, "mods");

    await follow(stage, history.goBack());
    expect(readStageSnapshot(stage).visible).toEqual({
      kind: "page",
      section: "home",
      page: null,
    });
    await follow(stage, history.goBack());

    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(listIds(stage)).toEqual(["sandbox-1"]);
  });

  it("opens a Home mod at #/ without a close button", async function opensHomeModSection(): Promise<void> {
    const history = new FakeHistory("#/settings");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    await openSection(stage, "home");

    expect(history.hash).toBe("#/");
    expect(readVisible(stage)).toMatchObject({ hash: "#/", canClose: false });
  });
});

describe("active section", function describeActiveSection(): void {
  it("Viewer keeps Mods active", async function inheritsSection(): Promise<void> {
    const history = new FakeHistory("");

    const stage = await openViewerFromMods(history);

    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(readStageSnapshot(stage).activeSection).toBe("mods");
    expect(stage.state.sandboxes[1].section).toBe("mods");
  });

  it("Kept after a reload", async function keepsAfterReload(): Promise<void> {
    const history = new FakeHistory("");
    await openViewerFromMods(history);
    const reloadedStage = buildStage(history, "light", PAGE_HOME_ROUTING);

    await follow(reloadedStage, history.readNavigation());

    expect(readStageSnapshot(reloadedStage).activeSection).toBe("mods");
  });

  it("learns the root again after a reload", async function relearnsRoot(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);
    await openSection(stage, "mods");
    const reloadedStage = buildStage(history, "light", PAGE_HOME_ROUTING);
    await follow(reloadedStage, history.readNavigation());

    await openSection(reloadedStage, "mods");

    expect(listIds(reloadedStage)).toEqual(["sandbox-1"]);
  });

  it("Link to another mod", async function belongsToNoSection(): Promise<void> {
    const history = new FakeHistory(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);

    const stage = await startPageStage(history);

    expect(readStageSnapshot(stage).activeSection).toBeNull();
    expect(history.entries[0].state).toEqual(stageState(0, null));
  });

  it("Typed link to a section's mod", async function matchesSectionLink(): Promise<void> {
    const history = new FakeHistory("#/run?mod=mod_explorer");

    const stage = await startPageStage(history);

    expect(readStageSnapshot(stage).activeSection).toBe("mods");
  });
});

describe("openStageLink", function describeOpenStageLink(): void {
  it("pushes the run link and records the opener", async function pushesLink(): Promise<void> {
    const history = new FakeHistory("");

    const stage = await openViewerFromHome(history);

    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
      {
        state: stageState(1, "home"),
        hash: `${SAMPLE_COLLECTION_RUN_HASH}&from=explorer`,
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

  it("refuses a mod hidden behind a page", async function refusesBehindPage(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);
    await openSection(stage, "settings");

    expect(openStageLink(stage, VIEWER_LINK, "sandbox-1")).toBe(false);
    expect(history.entries).toHaveLength(2);
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
      state: stageState(1, "home"),
      hash: "#/",
    });
  });

  it("Close a mod opened from a link", async function closesLinkedMod(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);

    closeSandbox(stage, "sandbox-1");

    expect(listIds(stage)).toEqual([]);
    expect(readStageSnapshot(stage)).toMatchObject({
      visible: { kind: "page", section: "home", page: null },
      activeSection: "home",
    });
    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
    ]);
  });

  it("opens the Home mod again when Home is a mod", async function opensHomeMod(): Promise<void> {
    const history = new FakeHistory(COLLECTION_HASH);
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    closeSandbox(stage, "sandbox-1");
    await settleStage(stage);

    expect(listIds(stage)).toEqual(["sandbox-2"]);
    expect(readVisible(stage)).toMatchObject({ hash: "#/", canClose: false });
    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
    ]);
  });

  it("Home mod has no close button", async function hidesHomeClose(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);

    await follow(stage, history.readNavigation());

    expect(readVisible(stage)).toMatchObject({ hash: "#/", canClose: false });
  });

  it("The explorer can be closed", async function closesExplorer(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await startPageStage(history);
    await openSection(stage, "mods");
    expect(readVisible(stage).canClose).toBe(true);

    closeSandbox(stage, "sandbox-1");

    expect(listIds(stage)).toEqual([]);
    expect(readStageSnapshot(stage).visible).toEqual({
      kind: "page",
      section: "home",
      page: null,
    });
    expect(history.entries[1]).toEqual({
      state: stageState(1, "home"),
      hash: "#/",
    });
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

function buildConfirm(message: string): AppAction {
  const action: AppAction = {
    kind: "confirm",
    message,
    confirmLabel: "OK",
    cancelLabel: "Cancel",
  };
  return action;
}

/** The message of the action the snapshot shows, or `null`. */
function readShownMessage(stage: Stage): string | null {
  const shown = readStageSnapshot(stage).action;
  if (shown === null || shown.action.kind !== "confirm") {
    return null;
  }
  return shown.action.message;
}

describe("requestStageAction", function describeRequestStageAction(): void {
  it("Two confirmations", async function showsOneAtATime(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    const first = requestStageAction(stage, "sandbox-1", buildConfirm("First"));
    const second = requestStageAction(
      stage,
      "sandbox-1",
      buildConfirm("Second"),
    );
    const firstShown = readStageSnapshot(stage).action;

    expect(firstShown).toMatchObject({
      action: { kind: "confirm", message: "First" },
      mod: { title: "Book List", source: SAMPLE_MOD_SOURCE },
    });
    expect(Object.isFrozen(firstShown)).toBe(true);
    answerStageAction(stage, firstShown?.id ?? -1, true);
    await expect(first).resolves.toBe(true);
    expect(readShownMessage(stage)).toBe("Second");
    answerStageAction(stage, readStageSnapshot(stage).action?.id ?? -1, false);
    await expect(second).resolves.toBe(false);
    expect(readStageSnapshot(stage).action).toBeNull();
  });

  it("ignores an answer to an unknown id", async function ignoresUnknownId(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    void requestStageAction(stage, "sandbox-1", buildConfirm("First"));
    const listener = vi.fn<() => void>();
    subscribeStage(stage, listener);
    const shownId = readStageSnapshot(stage).action?.id ?? -1;

    answerStageAction(stage, shownId + 1, true);

    expect(readShownMessage(stage)).toBe("First");
    expect(listener).not.toHaveBeenCalled();
  });

  it("gives null to a hidden sandbox and shows nothing", async function refusesHidden(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);

    const answer = requestStageAction(
      stage,
      "sandbox-1",
      buildConfirm("Hidden"),
    );

    expect(answer).toBeNull();
    expect(readStageSnapshot(stage).action).toBeNull();
  });

  it("gives null to a sandbox that is not running", async function refusesStopped(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    frameLoadedAgain(stage, "sandbox-1");

    expect(
      requestStageAction(stage, "sandbox-1", buildConfirm("Stopped")),
    ).toBeNull();
  });

  it("answers the mod's ui.confirm with the user's answer", async function answersMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");

    postRequest(attached.modPort, 1, "ui.confirm", { message: "Delete?" });
    await waitForMessages();
    expect(readShownMessage(stage)).toBe("Delete?");
    expect(attached.received).toEqual([]);
    answerStageAction(stage, readStageSnapshot(stage).action?.id ?? -1, true);
    await waitForMessages();

    expect(attached.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: true },
    ]);
  });
});

describe("a mod that leaves gets no", function describeLeftActions(): void {
  it("Back while a dialog is open", async function dropsOnBack(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const answer = requestStageAction(
      stage,
      "sandbox-2",
      buildConfirm("Viewer asks"),
    );

    await follow(stage, history.goBack());

    await expect(answer).resolves.toBe(false);
    expect(readStageSnapshot(stage).action).toBeNull();
    expect(readVisible(stage).id).toBe("sandbox-1");
  });

  it("drops the actions of a closed sandbox", async function dropsOnClose(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const answer = requestStageAction(
      stage,
      "sandbox-2",
      buildConfirm("Viewer asks"),
    );

    closeSandbox(stage, "sandbox-2");

    await expect(answer).resolves.toBe(false);
    expect(readStageSnapshot(stage).action).toBeNull();
  });

  it("keeps the actions of the sandbox that stays visible", async function keepsVisible(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    void requestStageAction(stage, "sandbox-1", buildConfirm("Home asks"));

    await follow(stage, history.readNavigation());

    expect(readShownMessage(stage)).toBe("Home asks");
  });

  it("drops the actions of a sandbox hidden by a followed link", async function dropsOnLink(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const answer = requestStageAction(
      stage,
      "sandbox-1",
      buildConfirm("Home asks"),
    );

    await follow(stage, history.followLink(SAMPLE_RUN_HASH));

    await expect(answer).resolves.toBe(false);
    expect(readStageSnapshot(stage).action).toBeNull();
  });

  it("Stopped while a dialog is open", async function dropsOnStop(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");
    postRequest(attached.modPort, 1, "files.save", {
      name: "books.csv",
      content: "title\n",
    });
    await waitForMessages();
    expect(readStageSnapshot(stage).action?.action.kind).toBe("save");

    frameLoadedAgain(stage, "sandbox-1");
    await waitForMessages();

    expect(readStageSnapshot(stage).action).toBeNull();
    expect(attached.received).toEqual([]);
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

describe("changeStageColorScheme", function describeChangeColorScheme(): void {
  it("keeps the theme of the color scheme it was created with", function buildsTheme(): void {
    const stage = buildStage(new FakeHistory(""), "dark");

    expect(stage.theme).toEqual(buildTheme("dark"));
  });

  it("Color scheme changed while the mod loads", async function connectsWithNewTheme(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history, "light");
    followHistory(stage, history.hash, history.state);

    changeStageColorScheme(stage, "dark");
    await settleStage(stage);
    const attached = attachCollectingFrame(stage, "sandbox-1");

    expect(readConnectColorScheme(attached.posted[0])).toBe("dark");
  });

  it("pushes nothing to a loading mod, which connects with the new theme", async function skipsLoading(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history, "light");
    followHistory(stage, history.hash, history.state);
    const runtime = stage.runtimes.get("sandbox-1");

    changeStageColorScheme(stage, "dark");
    expect(runtime?.status).toBe("loading");
    await settleStage(stage);
    const attached = attachCollectingFrame(stage, "sandbox-1");
    await waitForMessages();

    expect(attached.received).toEqual([]);
    expect(readConnectColorScheme(attached.posted[0])).toBe("dark");
  });

  it("Visible and hidden mods are told", async function pushesToEveryMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const hidden = attachCollectingFrame(stage, "sandbox-1");
    const visible = attachCollectingFrame(stage, "sandbox-2");

    changeStageColorScheme(stage, "dark");
    await waitForMessages();

    const pushed = {
      jsonrpc: "2.0",
      method: "theme.changed",
      params: buildTheme("dark"),
    };
    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(hidden.received).toEqual([pushed]);
    expect(visible.received).toEqual([pushed]);
    expect(stage.theme).toEqual(buildTheme("dark"));
  });

  it("Same color scheme, no event", async function skipsSameScheme(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history, "dark");
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");

    changeStageColorScheme(stage, "dark");
    await waitForMessages();

    expect(attached.received).toEqual([]);
  });

  it("pushes nothing to a stopped mod", async function skipsStopped(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history, "light");
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");
    frameLoadedAgain(stage, "sandbox-1");

    changeStageColorScheme(stage, "dark");
    await waitForMessages();

    expect(attached.received).toEqual([]);
  });
});

function postRequest(
  port: MessagePort,
  id: number,
  method: string,
  params: object,
): void {
  port.postMessage({ jsonrpc: "2.0", id, method, params });
}
