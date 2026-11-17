import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { FakeHistory } from "../../../test/fake_history.ts";
import type { FakeNavigation } from "../../../test/fake_history.ts";
import { createMemorySiteDecisions } from "../../../test/memory_site_decisions.ts";
import type { MemorySiteDecisions } from "../../../test/memory_site_decisions.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  buildProbeDecision,
  LEAFLET_SCRIPT_SOURCE,
  LIBRARY_MOD_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  PROBE_CONNECT_PERMISSION,
  PROBE_MOD_SOURCE,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_RUN_HASH,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_RUN_HASH,
  serveLibraryMod,
  serveOtherApiMod,
  serveProbeMod,
  serveTestMod,
  serveUntypedMod,
  TEST_NPM_HOST,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import { fetchTestFile, testTexts } from "../../../test/test_files.ts";
import {
  attachCheckingFrame,
  closeCheckPorts,
  finishMount,
  startCheck,
  startCheckStage,
} from "../../../test/check_stages.ts";
import {
  MOD_HOME_ROUTING,
  PAGE_HOME_ROUTING,
} from "../../../test/test_stages.ts";
import {
  describeCancelledApiMismatch,
  MOD_API_VERSION,
} from "../engine/index.ts";
import type { AppAction } from "../engine/index.ts";
import { buildTheme } from "../theme/index.ts";
import type { ColorScheme } from "../theme/index.ts";
import type { MessageLevel } from "./stage_messages.ts";
import type { StageRouting } from "./stage_routes.ts";
import {
  answerApiMismatch,
  answerSiteConsent,
  answerStageAction,
  attachFrame,
  changeStageColorScheme,
  changeStageFullscreen,
  changeStageTheaterMode,
  changeStageTileLinkedMedia,
  clearNotifications,
  closeSandbox,
  createStage,
  dismissMessage,
  followHistory,
  frameLoadedAgain,
  markMessagesRead,
  openStageLink,
  openStageSection,
  readStageSnapshot,
  reloadTiles,
  requestStageAction,
  subscribeStage,
  warnFullscreenRefused,
} from "./stage_controller.ts";
import type { SandboxSnapshot, Stage } from "./stage_controller.ts";

/** A sandbox's errors and warnings, in the order of its messages, as issues. */
function readIssues(
  sandbox: SandboxSnapshot,
): { level: string; source: string; message: string }[] {
  const issues: { level: string; source: string; message: string }[] = [];
  for (const message of sandbox.messages) {
    if (message.level !== "info") {
      issues.push({
        level: message.level,
        source: message.source,
        message: message.text,
      });
    }
  }
  return issues;
}

/** The sample mod with its collection: no section has this link. */
const COLLECTION_HASH = SAMPLE_COLLECTION_RUN_HASH;
const VIEWER_LINK = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: SAMPLE_COLLECTION_REFERENCE,
  params: { from: "explorer" },
};

/** The mod written for another API, opened as a link. */
const OTHER_API_LINK = {
  mod: OTHER_API_MOD_SOURCE,
  collection: null,
  params: {},
};
const OTHER_API_HASH = `#/run?mod=${encodeURIComponent(OTHER_API_MOD_SOURCE)}`;

const openPorts: MessagePort[] = [];

afterEach(function cleanUp(): void {
  testTexts.clear();
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
  siteDecisions: MemorySiteDecisions = createMemorySiteDecisions(),
  theaterMode = false,
): Stage {
  const stage = createStage({
    history,
    defaults: { folder: "./default_mods/", switchedOff: [] },
    routing,
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    npmHost: TEST_NPM_HOST,
    storage: createMemoryStorage(),
    fetch: fetchTestFile,
    colorScheme,
    loadsTileLinkedMedia: true,
    theaterMode,
    readSiteDecisions: siteDecisions.read,
    rememberSiteDecisions: siteDecisions.remember,
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

/** The `layout` of the mount context in a posted `sandbox.connect`. */
function readConnectLayout(message: unknown): string {
  const connect = message as { params: { context: { layout: string } } };
  return connect.params.context.layout;
}

/** A `layout.changed` notification, as the mod receives it. */
function buildLayoutChanged(layout: string): object {
  const notification = {
    jsonrpc: "2.0",
    method: "layout.changed",
    params: { layout },
  };
  return notification;
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

/** Starts at the Home mod, then follows the link of the mod written for another API, in `sandbox-2`. */
async function openOtherApiFromHome(history: FakeHistory): Promise<Stage> {
  serveOtherApiMod();
  const stage = buildStage(history);
  await follow(stage, history.readNavigation());
  await follow(stage, history.followLink(OTHER_API_HASH));
  return stage;
}

function findSandboxSnapshot(stage: Stage, id: string): SandboxSnapshot {
  for (const sandbox of readStageSnapshot(stage).sandboxes) {
    if (sandbox.id === id) {
      return sandbox;
    }
  }
  throw new Error(`Expected a sandbox "${id}" in the snapshot`);
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

    expect(openStageSection(stage, "unknown_section")).toBe(false);
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

describe("npm host", function describeNpmHost(): void {
  it("resolves a launched mod's npm files on the stage's npm host", async function resolvesNpmFiles(): Promise<void> {
    serveLibraryMod();
    const history = new FakeHistory(
      `#/run?mod=${encodeURIComponent(LIBRARY_MOD_SOURCE)}`,
    );
    const stage = buildStage(history, "light", PAGE_HOME_ROUTING);

    await follow(stage, history.readNavigation());
    const runtime = stage.runtimes.get(readVisible(stage).id);

    expect(runtime?.status).toBe("running");
    const libraries = runtime?.loadedMod?.libraries ?? [];
    expect(libraries[0].files[0].source).toBe(LEAFLET_SCRIPT_SOURCE);
    expect(LEAFLET_SCRIPT_SOURCE.startsWith(TEST_NPM_HOST)).toBe(true);
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

  it("can reload the tiles of a sandbox opened with a tile", async function reloadsTileSandbox(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    openStageLink(
      stage,
      {
        mod: SAMPLE_MOD_REFERENCE,
        collection: null,
        tile: "./fixtures/tiles/books/kallocain.md",
        params: {},
      },
      "sandbox-1",
    );
    await settleStage(stage);

    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      status: "running",
      canReloadTiles: true,
      collection: null,
    });
  });

  it("Hidden mod tries to open a mod", async function refusesHidden(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);

    const outcome = openStageLink(stage, VIEWER_LINK, "sandbox-1");

    expect(outcome).toBe("not-visible");
    expect(history.entries).toHaveLength(2);
    expect(readVisible(stage).id).toBe("sandbox-2");
  });

  it("refuses a mod hidden behind a page", async function refusesBehindPage(): Promise<void> {
    const history = new FakeHistory(SAMPLE_RUN_HASH);
    const stage = await startPageStage(history);
    await openSection(stage, "settings");

    expect(openStageLink(stage, VIEWER_LINK, "sandbox-1")).toBe("not-visible");
    expect(history.entries).toHaveLength(2);
  });
});

/** The sample mod without a collection, which a replace opens in place of the viewer. */
const REPLACING_LINK = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: null,
  params: { step: "next" },
};

const REPLACING_HASH = `${SAMPLE_RUN_HASH}&step=next`;

/** On the page stage: opens Mods, the viewer from the explorer, then replaces the viewer. */
async function replaceViewerFromMods(history: FakeHistory): Promise<Stage> {
  const stage = await openViewerFromMods(history);
  openStageLink(stage, REPLACING_LINK, "sandbox-2", { replace: true });
  await settleStage(stage);
  return stage;
}

/** A mod on the app's origin that may open any mod, so it can send `mods.open`. */
const OPENER_MOD_SOURCE = `${APP_BASE_URL}test-mods/opener/mod_conf.yaml`;

function serveOpenerMod(): void {
  serveTestMod(OPENER_MOD_SOURCE, [
    '  title: "opener"',
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    "  permissions:",
    "    open:",
    '      - host: "*"',
    '        reason: "Opens mods"',
  ]);
}

/** On the page stage: runs the opener from a typed link, attaches its frame and sends `mods.open` with `params`. */
async function sendOpenFromOpener(
  params: object,
): Promise<{ stage: Stage; history: FakeHistory; received: unknown[] }> {
  serveOpenerMod();
  const history = new FakeHistory(
    `#/run?mod=${encodeURIComponent(OPENER_MOD_SOURCE)}`,
  );
  const stage = await startPageStage(history);
  const { modPort, received } = attachCollectingFrame(stage, "sandbox-1");
  postRequest(modPort, 1, "mods.open", params);
  await waitForMessages();
  await settleStage(stage);
  const sent = { stage, history, received };
  return sent;
}

describe("Replace the visible sandbox", function describeReplace(): void {
  it("Next tile replaces the current one", async function replacesViewer(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromMods(history);
    const viewerRuntime = stage.runtimes.get("sandbox-2");

    const outcome = openStageLink(stage, REPLACING_LINK, "sandbox-2", {
      replace: true,
    });
    await settleStage(stage);

    expect(outcome).toBe("opened");
    expect(viewerRuntime?.status).toBe("stopped");
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-3"]);
    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-3",
      hash: REPLACING_HASH,
      status: "running",
    });
    expect(stage.state.sandboxes[1]).toMatchObject({
      openerId: "sandbox-1",
      section: "mods",
    });
    expect(history.entries).toHaveLength(3);
    expect(history.entries[2]).toEqual({
      state: stageState(2, "mods"),
      hash: REPLACING_HASH,
    });
    expect(readStageSnapshot(stage).activeSection).toBe("mods");
  });

  it("goes back to the opener with one step back", async function goesBackToOpener(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await replaceViewerFromMods(history);

    await follow(stage, history.goBack());

    expect(readVisible(stage).id).toBe("sandbox-1");
  });

  it("Close after a replace", async function closesReplacing(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await replaceViewerFromMods(history);

    closeSandbox(stage, "sandbox-3");

    expect(listIds(stage)).toEqual(["sandbox-1"]);
    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(readStageSnapshot(stage).activeSection).toBe("mods");
  });

  it("Section after a replace", async function remembersReplacing(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await replaceViewerFromMods(history);
    await openSection(stage, "home");

    await openSection(stage, "mods");

    expect(readVisible(stage).id).toBe("sandbox-3");
    expect(readStageSnapshot(stage).activeSection).toBe("mods");
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-3"]);
  });

  it("keeps the forward entries", async function keepsForward(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromMods(history);
    await openSection(stage, "guides");
    await follow(stage, history.goBack());

    openStageLink(stage, REPLACING_LINK, "sandbox-2", { replace: true });
    await settleStage(stage);

    expect(history.entries).toHaveLength(4);
    expect(history.entries[2].hash).toBe(REPLACING_HASH);
    expect(history.entries[3].hash).toBe("#/guides");
  });

  it("Home mod cannot be replaced", async function refusesHomeMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    const outcome = openStageLink(stage, REPLACING_LINK, "sandbox-1", {
      replace: true,
    });

    expect(outcome).toBe("home-mod");
    expect(listIds(stage)).toEqual(["sandbox-1"]);
    expect(history.entries).toEqual([
      { state: stageState(0, "home"), hash: "#/" },
    ]);
  });

  it("Hidden mod cannot replace itself", async function refusesHidden(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);

    const outcome = openStageLink(stage, REPLACING_LINK, "sandbox-1", {
      replace: true,
    });

    expect(outcome).toBe("not-visible");
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-2"]);
  });

  it("stops the requester before the handler answers, so no response reaches it", async function answersNothing(): Promise<void> {
    const { stage, history, received } = await sendOpenFromOpener({
      mod: SAMPLE_MOD_REFERENCE,
      replace: true,
    });

    expect(received).toEqual([]);
    expect(listIds(stage)).toEqual(["sandbox-2"]);
    expect(readVisible(stage).hash).toBe(SAMPLE_RUN_HASH);
    expect(history.entries).toHaveLength(1);
  });

  it("answers null to a request without replace", async function answersPush(): Promise<void> {
    const { stage, history, received } = await sendOpenFromOpener({
      mod: SAMPLE_MOD_REFERENCE,
    });

    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: null }]);
    expect(listIds(stage)).toEqual(["sandbox-1", "sandbox-2"]);
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
    expect(readIssues(visible)).toEqual([
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

describe("answerApiMismatch", function describeAnswerApiMismatch(): void {
  it("Matching and range-less mods never ask", async function startsWithoutAsking(): Promise<void> {
    serveUntypedMod(null);
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    expect(readVisible(stage)).toMatchObject({
      status: "running",
      apiMismatch: null,
    });
    await follow(
      stage,
      history.followLink(`#/run?mod=${encodeURIComponent(UNTYPED_MOD_SOURCE)}`),
    );

    expect(readVisible(stage)).toMatchObject({
      status: "running",
      apiMismatch: null,
    });
    expect(readVisible(stage).sandboxDocument).not.toBeNull();
  });

  it("asks before starting a mod for another API", async function asks(): Promise<void> {
    const history = new FakeHistory("");

    const stage = await openOtherApiFromHome(history);

    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      status: "asking",
      mod: {
        title: "Other API",
        version: "2.0.0",
        source: OTHER_API_MOD_SOURCE,
      },
      sandboxDocument: null,
      canReloadTiles: false,
      apiMismatch: { range: OTHER_API_RANGE, apiVersion: MOD_API_VERSION },
      messages: [],
      modReference: OTHER_API_MOD_SOURCE,
      collection: null,
    });
  });

  it("Run anyway", async function runsAnyway(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openOtherApiFromHome(history);

    answerApiMismatch(stage, "sandbox-2", true);

    expect(readVisible(stage)).toMatchObject({
      status: "running",
      apiMismatch: null,
    });
    expect(readVisible(stage).sandboxDocument).toContain(
      "Content-Security-Policy",
    );
  });

  it("Cancel", async function cancels(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openOtherApiFromHome(history);

    answerApiMismatch(stage, "sandbox-2", false);

    const visible = readVisible(stage);
    expect(visible).toMatchObject({
      id: "sandbox-2",
      status: "failed",
      sandboxDocument: null,
      canClose: true,
      apiMismatch: null,
      errorMessage: describeCancelledApiMismatch(OTHER_API_RANGE),
    });
    expect(visible.errorMessage).toContain(OTHER_API_RANGE);
    expect(visible.errorMessage).toContain(MOD_API_VERSION);
    expect(history.entries[history.index].hash).toBe(OTHER_API_HASH);
  });

  it("ignores a repeated answer", async function ignoresRepeatedAnswer(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openOtherApiFromHome(history);

    answerApiMismatch(stage, "sandbox-2", true);
    answerApiMismatch(stage, "sandbox-2", false);

    expect(readVisible(stage).status).toBe("running");
  });

  it("Back while asking", async function hidesOnBack(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openOtherApiFromHome(history);

    await follow(stage, history.goBack());
    answerApiMismatch(stage, "sandbox-2", true);

    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(findSandboxSnapshot(stage, "sandbox-2")).toMatchObject({
      isVisible: false,
      status: "asking",
      sandboxDocument: null,
    });
    await follow(stage, history.goForward());
    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      status: "asking",
      apiMismatch: { range: OTHER_API_RANGE, apiVersion: MOD_API_VERSION },
    });
  });

  it("closing while asking stops the runtime, and a later answer does nothing", async function stopsOnClose(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openOtherApiFromHome(history);
    const runtime = stage.runtimes.get("sandbox-2");

    closeSandbox(stage, "sandbox-2");
    answerApiMismatch(stage, "sandbox-2", true);

    expect(runtime?.status).toBe("stopped");
    expect(runtime?.session).toBeNull();
    expect(stage.runtimes.has("sandbox-2")).toBe(false);
    expect(listIds(stage)).not.toContain("sandbox-2");
  });

  it("Asked after a page reload", async function asksAfterReload(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openOtherApiFromHome(history);
    answerApiMismatch(stage, "sandbox-2", true);
    const reloadedStage = buildStage(history);

    await follow(reloadedStage, history.readNavigation());

    expect(readVisible(reloadedStage)).toMatchObject({
      status: "asking",
      apiMismatch: { range: OTHER_API_RANGE, apiVersion: MOD_API_VERSION },
    });
  });

  it("Opened by another mod", async function asksForOpenedMod(): Promise<void> {
    serveOtherApiMod();
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    openStageLink(stage, OTHER_API_LINK, "sandbox-1");
    await settleStage(stage);

    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      status: "asking",
      apiMismatch: { range: OTHER_API_RANGE, apiVersion: MOD_API_VERSION },
    });
  });
});

const PROBE_HASH = `#/run?mod=${encodeURIComponent(PROBE_MOD_SOURCE)}`;
const COVERS_KEY = "show https://upload.wikimedia.org";
const CONNECT_KEY = "connect https://api.example.net";

/** Starts at the Home mod, then follows the link of the foreign probe mod, in `sandbox-2`. */
async function openProbeFromHome(
  history: FakeHistory,
  siteDecisions: MemorySiteDecisions = createMemorySiteDecisions(),
): Promise<Stage> {
  const stage = buildStage(history, "light", MOD_HOME_ROUTING, siteDecisions);
  await follow(stage, history.readNavigation());
  await follow(stage, history.followLink(PROBE_HASH));
  return stage;
}

describe("answerSiteConsent", function describeAnswerSiteConsent(): void {
  it("asks nothing for the sample mod, from the app's origin", async function startsSampleMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);

    await follow(stage, history.readNavigation());

    expect(readVisible(stage)).toMatchObject({
      status: "running",
      siteConsent: null,
    });
  });

  it("Foreign mod with a declared permission", async function asksForeignMod(): Promise<void> {
    serveProbeMod(true);
    const history = new FakeHistory("");

    const stage = await openProbeFromHome(history);

    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      status: "asking",
      mod: { title: "Probe", version: "1.0.0", source: PROBE_MOD_SOURCE },
      sandboxDocument: null,
      apiMismatch: null,
      siteConsent: {
        lines: [
          { key: COVERS_KEY, ...SAMPLE_COVERS_PERMISSION },
          { key: CONNECT_KEY, ...PROBE_CONNECT_PERMISSION },
        ],
      },
    });
    expect(Object.isFrozen(readVisible(stage).siteConsent?.lines[0])).toBe(
      true,
    );
  });

  it("Allow with one line unchecked", async function allowsCheckedLines(): Promise<void> {
    serveProbeMod(true);
    const history = new FakeHistory("");
    const siteDecisions = createMemorySiteDecisions();
    const stage = await openProbeFromHome(history, siteDecisions);

    answerSiteConsent(stage, "sandbox-2", {
      allowed: [COVERS_KEY],
      remember: false,
    });

    const visible = readVisible(stage);
    expect(visible).toMatchObject({ status: "running", siteConsent: null });
    expect(visible.sandboxDocument).toContain("https://upload.wikimedia.org");
    expect(visible.sandboxDocument).not.toContain("https://api.example.net");
    expect(siteDecisions.decisions).toEqual([]);
  });

  it("Show without them", async function runsWithout(): Promise<void> {
    serveProbeMod();
    const history = new FakeHistory("");
    const stage = await openProbeFromHome(history);

    answerSiteConsent(stage, "sandbox-2", { allowed: [], remember: false });

    const visible = readVisible(stage);
    expect(visible.status).toBe("running");
    expect(visible.sandboxDocument).not.toContain(
      "https://upload.wikimedia.org",
    );
    expect(readIssues(visible)).toHaveLength(1);
    expect(readIssues(visible)[0].message).toBe(
      'Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites get only the permissions you allow.',
    );
  });

  it("Escape with Remember", async function escapesWithoutRemembering(): Promise<void> {
    serveProbeMod();
    const history = new FakeHistory("");
    const siteDecisions = createMemorySiteDecisions();
    const stage = await openProbeFromHome(history, siteDecisions);

    answerSiteConsent(stage, "sandbox-2", null);
    closeSandbox(stage, "sandbox-2");
    await follow(stage, history.followLink(PROBE_HASH));

    expect(siteDecisions.decisions).toEqual([]);
    expect(readVisible(stage)).toMatchObject({
      status: "asking",
      siteConsent: { lines: [{ key: COVERS_KEY }] },
    });
  });

  it("Remembered allow", async function remembersAllow(): Promise<void> {
    serveProbeMod();
    const history = new FakeHistory("");
    const siteDecisions = createMemorySiteDecisions();
    const stage = await openProbeFromHome(history, siteDecisions);

    answerSiteConsent(stage, "sandbox-2", {
      allowed: [COVERS_KEY],
      remember: true,
    });
    const reloadedStage = buildStage(
      history,
      "light",
      MOD_HOME_ROUTING,
      siteDecisions,
    );
    await follow(reloadedStage, history.readNavigation());

    expect(siteDecisions.decisions).toEqual([
      buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
    ]);
    expect(readVisible(reloadedStage)).toMatchObject({
      status: "running",
      siteConsent: null,
    });
    expect(readVisible(reloadedStage).sandboxDocument).toContain(
      "https://upload.wikimedia.org",
    );
  });

  it("Another API first", async function asksApiFirst(): Promise<void> {
    serveProbeMod(false, OTHER_API_RANGE);
    const history = new FakeHistory("");
    const stage = await openProbeFromHome(history);

    expect(readVisible(stage)).toMatchObject({
      status: "asking",
      apiMismatch: { range: OTHER_API_RANGE, apiVersion: MOD_API_VERSION },
      siteConsent: null,
    });
    answerApiMismatch(stage, "sandbox-2", true);

    expect(readVisible(stage)).toMatchObject({
      status: "asking",
      apiMismatch: null,
      siteConsent: { lines: [{ key: COVERS_KEY }] },
    });
  });

  it("Cancelled for another API", async function cancelsBeforeSites(): Promise<void> {
    serveProbeMod(false, OTHER_API_RANGE);
    const history = new FakeHistory("");
    const stage = await openProbeFromHome(history);

    answerApiMismatch(stage, "sandbox-2", false);

    expect(readVisible(stage)).toMatchObject({
      status: "failed",
      apiMismatch: null,
      siteConsent: null,
      sandboxDocument: null,
    });
  });

  it("keeps a hidden sandbox waiting", async function waitsWhileHidden(): Promise<void> {
    serveProbeMod();
    const history = new FakeHistory("");
    const stage = await openProbeFromHome(history);

    await follow(stage, history.goBack());
    answerSiteConsent(stage, "sandbox-2", {
      allowed: [COVERS_KEY],
      remember: true,
    });

    expect(readVisible(stage).id).toBe("sandbox-1");
    expect(findSandboxSnapshot(stage, "sandbox-2")).toMatchObject({
      isVisible: false,
      status: "asking",
      sandboxDocument: null,
    });
    await follow(stage, history.goForward());
    expect(readVisible(stage)).toMatchObject({
      id: "sandbox-2",
      status: "asking",
      siteConsent: { lines: [{ key: COVERS_KEY }] },
    });
  });

  it("ignores a repeated answer", async function ignoresRepeatedAnswer(): Promise<void> {
    serveProbeMod();
    const history = new FakeHistory("");
    const siteDecisions = createMemorySiteDecisions();
    const stage = await openProbeFromHome(history, siteDecisions);

    answerSiteConsent(stage, "sandbox-2", {
      allowed: [COVERS_KEY],
      remember: false,
    });
    answerSiteConsent(stage, "sandbox-2", { allowed: [], remember: true });

    expect(readVisible(stage).sandboxDocument).toContain(
      "https://upload.wikimedia.org",
    );
    expect(siteDecisions.decisions).toEqual([]);
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
    expect(Object.isFrozen(runningSnapshot.sandboxes[0].messages)).toBe(true);
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

    expect(readIssues(readVisible(stage))).toHaveLength(1);
    expect(readIssues(readVisible(stage))[0].message).toContain(
      "https://images.example.net",
    );
  });
});

describe("changeStageTileLinkedMedia", function describeChangeTileLinkedMedia(): void {
  it("starts with the setting it was created with", function keepsStartSetting(): void {
    const stage = buildStage(new FakeHistory(""));

    expect(stage.loadsTileLinkedMedia).toBe(true);
  });

  it("Switched off before opening a mod", async function launchesWithoutTileLinks(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    changeStageTileLinkedMedia(stage, false);

    await follow(stage, history.readNavigation());

    expect(stage.runtimes.get("sandbox-1")?.launch?.tileLinks).toBeNull();
  });

  it("Running mod keeps its policy", async function keepsRunningLaunch(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const runtime = stage.runtimes.get("sandbox-1");
    const launch = runtime?.launch;
    const snapshot = readStageSnapshot(stage);
    const listener = vi.fn<() => void>();
    subscribeStage(stage, listener);

    changeStageTileLinkedMedia(stage, false);

    expect(launch?.tileLinks).not.toBeNull();
    expect(stage.runtimes.get("sandbox-1")).toBe(runtime);
    expect(runtime?.launch).toBe(launch);
    expect(readStageSnapshot(stage)).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();
  });

  it("Applies when the mod is opened again", async function appliesToNextLaunch(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    changeStageTileLinkedMedia(stage, false);
    openStageLink(stage, VIEWER_LINK, "sandbox-1");
    await settleStage(stage);

    expect(stage.runtimes.get("sandbox-1")?.launch?.tileLinks).not.toBeNull();
    expect(stage.runtimes.get("sandbox-2")?.launch?.tileLinks).toBeNull();
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

describe("changeStageTheaterMode", function describeChangeTheaterMode(): void {
  it("Hidden mod follows", async function pushesToHiddenMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const hidden = attachCollectingFrame(stage, "sandbox-1");
    const visible = attachCollectingFrame(stage, "sandbox-2");

    changeStageTheaterMode(stage, true);
    await waitForMessages();

    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(hidden.received).toEqual([buildLayoutChanged("theater")]);
    expect(visible.received).toEqual([buildLayoutChanged("theater")]);
    expect(stage.runtimes.get("sandbox-1")?.status).toBe("running");
    expect(stage.runtimes.get("sandbox-2")?.status).toBe("running");
    expect(readStageSnapshot(stage).isTheaterMode).toBe(true);
  });

  it("New sandboxes start in the current mode", async function connectsInTheater(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    changeStageTheaterMode(stage, true);

    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");

    expect(readConnectLayout(attached.posted[0])).toBe("theater");
  });

  it("starts in the theater mode it was created with", async function startsInTheater(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(
      history,
      "light",
      MOD_HOME_ROUTING,
      createMemorySiteDecisions(),
      true,
    );

    expect(readStageSnapshot(stage).isTheaterMode).toBe(true);
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");

    expect(readConnectLayout(attached.posted[0])).toBe("theater");
  });

  it("mounts contained while theater mode is off", async function connectsContained(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);

    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");

    expect(readConnectLayout(attached.posted[0])).toBe("contained");
    expect(readStageSnapshot(stage).isTheaterMode).toBe(false);
  });

  it("Theater turned on while the mod loads", async function connectsWithNewLayout(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    followHistory(stage, history.hash, history.state);
    const runtime = stage.runtimes.get("sandbox-1");

    changeStageTheaterMode(stage, true);
    expect(runtime?.status).toBe("loading");
    await settleStage(stage);
    const attached = attachCollectingFrame(stage, "sandbox-1");
    await waitForMessages();

    expect(attached.received).toEqual([]);
    expect(readConnectLayout(attached.posted[0])).toBe("theater");
  });

  it("Theater turned off", async function pushesContained(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    changeStageTheaterMode(stage, true);
    const attached = attachCollectingFrame(stage, "sandbox-1");

    changeStageTheaterMode(stage, false);
    await waitForMessages();

    expect(attached.received).toEqual([buildLayoutChanged("contained")]);
    expect(readStageSnapshot(stage).isTheaterMode).toBe(false);
  });

  it("pushes and publishes nothing when theater mode stays the same", async function skipsSameMode(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");
    const snapshot = readStageSnapshot(stage);

    changeStageTheaterMode(stage, false);
    await waitForMessages();

    expect(attached.received).toEqual([]);
    expect(readStageSnapshot(stage)).toBe(snapshot);
  });

  it("Fullscreen mod keeps its layout", async function skipsFullscreenMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const attached = attachCollectingFrame(stage, "sandbox-1");
    changeStageFullscreen(stage, "sandbox-1");
    await waitForMessages();
    expect(attached.received).toEqual([buildLayoutChanged("fullscreen")]);

    changeStageTheaterMode(stage, true);
    await waitForMessages();

    expect(attached.received).toEqual([buildLayoutChanged("fullscreen")]);
  });

  it("Check frames are contained", async function checksContained(): Promise<void> {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const checkStage = await startCheckStage();
      changeStageTheaterMode(checkStage.stage, true);

      const reporting = startCheck(checkStage, {
        source: SAMPLE_MOD_SOURCE,
        collection: null,
      });
      const checkFrame = await attachCheckingFrame(checkStage);
      await finishMount(checkFrame);
      await reporting;

      expect(checkFrame.context.layout).toBe("contained");
    } finally {
      vi.useRealTimers();
      closeCheckPorts();
    }
  });
});

describe("changeStageFullscreen", function describeChangeFullscreen(): void {
  it("Leaving fullscreen", async function returnsToTheater(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    changeStageTheaterMode(stage, true);
    const attached = attachCollectingFrame(stage, "sandbox-1");
    changeStageFullscreen(stage, "sandbox-1");

    changeStageFullscreen(stage, null);
    await waitForMessages();

    expect(attached.received).toEqual([
      buildLayoutChanged("fullscreen"),
      buildLayoutChanged("theater"),
    ]);
  });

  it("pushes only to the fullscreen sandbox", async function pushesToOneMod(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    const hidden = attachCollectingFrame(stage, "sandbox-1");
    const visible = attachCollectingFrame(stage, "sandbox-2");

    changeStageFullscreen(stage, "sandbox-2");
    await waitForMessages();

    expect(hidden.received).toEqual([]);
    expect(visible.received).toEqual([buildLayoutChanged("fullscreen")]);
  });

  it("Fullscreen refused", async function warnsRefused(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());

    warnFullscreenRefused(stage, "sandbox-1", "Permissions check failed");

    expect(readIssues(readVisible(stage))).toContainEqual({
      level: "warning",
      source: SAMPLE_MOD_SOURCE,
      message: "Fullscreen is not available: Permissions check failed",
    });
  });

  it("forgets the fullscreen sandbox when it is closed", async function clearsClosed(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openViewerFromHome(history);
    changeStageFullscreen(stage, "sandbox-2");

    closeSandbox(stage, "sandbox-2");

    expect(stage.fullscreenSandboxId).toBeNull();
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

function isInfo(message: { level: MessageLevel }): boolean {
  return message.level === "info";
}

/** Attaches a frame to the sandbox and has it report a blocked image, which adds a warning. */
async function reportBlockedImage(stage: Stage, id: string): Promise<void> {
  const { modPort } = attachCollectingFrame(stage, id);
  modPort.postMessage({
    jsonrpc: "2.0",
    method: "sandbox.blocked",
    params: {
      blockedUrl: "https://images.example.net/a.jpg",
      directive: "img-src",
    },
  });
  await waitForMessages();
}

/**
 * Opens the sample mod with its collection as `sandbox-2`, which notifies
 * the loaded collection, and reloads its tiles until it has `count`
 * notifications.
 */
async function openWithNotifications(
  history: FakeHistory,
  count: number,
): Promise<Stage> {
  const stage = buildStage(history);
  await follow(stage, history.readNavigation());
  await follow(stage, history.followLink(COLLECTION_HASH));
  for (let reloads = 1; reloads < count; reloads += 1) {
    await reloadTiles(stage, "sandbox-2");
  }
  return stage;
}

function countLevel(sandbox: SandboxSnapshot, level: MessageLevel): number {
  let count = 0;
  for (const message of sandbox.messages) {
    if (message.level === level) {
      count += 1;
    }
  }
  return count;
}

function listUnreadLevels(sandbox: SandboxSnapshot): MessageLevel[] {
  const levels: MessageLevel[] = [];
  for (const message of sandbox.messages) {
    if (!message.isRead) {
      levels.push(message.level);
    }
  }
  return levels;
}

describe("Message read state", function describeMessageReadState(): void {
  it("starts unread and is read once the level is marked", async function marksLevelRead(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    await reportBlockedImage(stage, "sandbox-1");
    expect(listUnreadLevels(readVisible(stage))).toContain("warning");
    const listener = vi.fn<() => void>();
    subscribeStage(stage, listener);

    markMessagesRead(stage, "sandbox-1", "warning");

    expect(listUnreadLevels(readVisible(stage))).not.toContain("warning");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("Read state stays with its sandbox", async function keepsReadState(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    await reportBlockedImage(stage, "sandbox-1");
    markMessagesRead(stage, "sandbox-1", "warning");

    await follow(stage, history.followLink(COLLECTION_HASH));
    await reportBlockedImage(stage, "sandbox-2");
    expect(listUnreadLevels(readVisible(stage))).toContain("warning");
    await follow(stage, history.goBack());

    const visible = readVisible(stage);
    expect(visible.id).toBe("sandbox-1");
    expect(countLevel(visible, "warning")).toBe(1);
    expect(listUnreadLevels(visible)).not.toContain("warning");
  });
});

describe("Dismissing notifications", function describeDismissing(): void {
  it("dismissing lowers the info count", async function dismissesOne(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openWithNotifications(history, 2);
    const notifications = readVisible(stage).messages.filter(isInfo);
    expect(notifications).toHaveLength(2);

    dismissMessage(stage, "sandbox-2", notifications[0].id);

    const kept = readVisible(stage).messages.filter(isInfo);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe(notifications[1].id);
  });

  it("Clear all leaves the warnings", async function clearsAll(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openWithNotifications(history, 3);
    await reportBlockedImage(stage, "sandbox-2");
    expect(countLevel(readVisible(stage), "info")).toBe(3);

    clearNotifications(stage, "sandbox-2");

    const visible = readVisible(stage);
    expect(countLevel(visible, "info")).toBe(0);
    expect(countLevel(visible, "warning")).toBe(1);
  });

  it("does not dismiss a warning", async function keepsWarning(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    await reportBlockedImage(stage, "sandbox-1");
    const warningId = readVisible(stage).messages[0].id;

    dismissMessage(stage, "sandbox-1", warningId);

    expect(countLevel(readVisible(stage), "warning")).toBe(1);
  });

  it("an unknown sandbox or message id does nothing", async function ignoresUnknown(): Promise<void> {
    const history = new FakeHistory("");
    const stage = await openWithNotifications(history, 1);
    const before = readVisible(stage).messages;
    expect(before).toHaveLength(1);
    const listener = vi.fn<() => void>();
    subscribeStage(stage, listener);

    dismissMessage(stage, "sandbox-9", before[0].id);
    dismissMessage(stage, "sandbox-2", 999);
    clearNotifications(stage, "sandbox-9");
    markMessagesRead(stage, "sandbox-9", "info");

    expect(readVisible(stage).messages).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Messages from the mod", function describeModMessages(): void {
  it("Hidden mod notifies", async function keepsHiddenMessage(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildStage(history);
    await follow(stage, history.readNavigation());
    const { modPort, received } = attachCollectingFrame(stage, "sandbox-1");
    await follow(stage, history.followLink(COLLECTION_HASH));

    modPort.postMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "ui.notify",
      params: { message: "Done" },
    });
    await waitForMessages();

    expect(received.at(-1)).toEqual({ jsonrpc: "2.0", id: 1, result: null });
    expect(readVisible(stage).id).toBe("sandbox-2");
    expect(readTextsOf(readVisible(stage))).not.toContain("Done");
    await follow(stage, history.goBack());
    const visible = readVisible(stage);
    expect(visible.id).toBe("sandbox-1");
    expect(visible.messages.at(-1)).toMatchObject({
      level: "info",
      producer: "mod",
      source: SAMPLE_MOD_SOURCE,
      text: "Done",
      isRead: false,
    });
  });
});

function readTextsOf(sandbox: SandboxSnapshot): string[] {
  const texts: string[] = [];
  for (const message of sandbox.messages) {
    texts.push(message.text);
  }
  return texts;
}
