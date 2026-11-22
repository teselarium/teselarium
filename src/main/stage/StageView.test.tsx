import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import {
  attachFrame,
  checkFrameLoadedAgain,
  followHistory,
  openStageLink,
  readStageSnapshot,
  reloadTiles,
} from "../../lib/core/stage/index.ts";
import type { CheckSnapshot, Stage } from "../../lib/core/stage/index.ts";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../test/fake_frames.ts";
import {
  MISSING_MOD_REFERENCE,
  MISSING_MOD_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_API_RANGE,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_MOSAIC_REFERENCE,
  serveOtherApiMod,
  serveTestMosaic,
  serveUntypedMod,
  UNTYPED_MOD_SOURCE,
} from "../../test/sample_mods.ts";
import { FIXTURES_BASE_URL } from "../../test/sample_files.ts";
import { testTexts } from "../../test/test_files.ts";
import { FakeHistory } from "../../test/fake_history.ts";
import {
  buildTestCombinations,
  buildTestStage,
  ignoreShownSandbox,
  MOD_HOME_ROUTING,
  PAGE_HOME_ROUTING,
  refuseSidebarRoom,
  settleStage,
  startTestStage,
} from "../../test/test_stages.ts";
import { MOD_API_VERSION } from "../../lib/core/engine/index.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import { createPlayerSites } from "../settings/player_sites.ts";
import { createRecentlyUsed } from "../settings/recently_used.ts";
import type { PlayerSites } from "../settings/player_sites.ts";
import {
  FakeResizeObserver,
  forgetFakeResizeObservers,
  resizeObservedElements,
} from "../../test/fake_resize_observer.ts";
import { readTooltipOnFocus } from "../../test/tooltip_texts.ts";
import { createTestUserCatalog } from "../../test/test_user_catalog.ts";
import { createListChoices } from "./list_choices.ts";
import { StageView } from "./StageView.tsx";
import { createTheaterSetting, THEATER_MODE_KEY } from "./theater_setting.ts";

function createTestPlayerSites(): PlayerSites {
  const playerSites = createPlayerSites({ storage: createMemoryStorage() });
  return playerSites;
}

/** The stage view's answers to its stage bar: the sidebar's, in the app. */
interface SidebarRoom {
  onAskRoom: (sandboxId: string) => boolean;
  onShowSandbox: (sandboxId: string) => void;
}

const NO_SIDEBAR: SidebarRoom = Object.freeze({
  onAskRoom: refuseSidebarRoom,
  onShowSandbox: ignoreShownSandbox,
});

/** Renders the stage view inside the tooltip provider the app gives it. */
function renderStageView(
  stage: Stage,
  storage: MemoryStorage = createMemoryStorage(),
  sidebarRoom: SidebarRoom = NO_SIDEBAR,
): RenderResult {
  const recentlyUsed = createRecentlyUsed({ storage });
  return render(
    <TooltipProvider>
      <StageView
        stage={stage}
        combinations={buildTestCombinations(stage)}
        listChoices={createListChoices()}
        recentlyUsed={recentlyUsed}
        userCatalog={createTestUserCatalog(stage, recentlyUsed)}
        playerSites={createTestPlayerSites()}
        theater={createTheaterSetting({ storage, stage })}
        onAskRoom={sidebarRoom.onAskRoom}
        onShowSandbox={sidebarRoom.onShowSandbox}
      />
    </TooltipProvider>,
  );
}

const OTHER_API_HASH = `#/run?mod=${encodeURIComponent(OTHER_API_MOD_SOURCE)}`;

const openPorts: MessagePort[] = [];
const appendedFrames: HTMLIFrameElement[] = [];

afterEach(function cleanUp(): void {
  vi.unstubAllGlobals();
  forgetFakeResizeObservers();
  testTexts.clear();
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
  for (const frame of appendedFrames) {
    frame.remove();
  }
  appendedFrames.length = 0;
});

const SAMPLE_LINK = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: SAMPLE_COLLECTION_REFERENCE,
  params: {},
};

function listWrappers(container: HTMLElement): HTMLElement[] {
  const wrappers: HTMLElement[] = [];
  for (const wrapper of container.querySelectorAll<HTMLElement>(
    "[data-sandbox-id]",
  )) {
    wrappers.push(wrapper);
  }
  return wrappers;
}

/** Renders the stage opened at the mod written for another API, which asks. */
async function renderAskingStage(): Promise<HTMLElement> {
  serveOtherApiMod();
  const stage = await startTestStage(OTHER_API_HASH);
  const { container } = renderStageView(stage);
  return container;
}

async function answerQuestion(buttonName: string): Promise<void> {
  const dialog = screen.getByRole("dialog", { name: "Other API" });
  await act(async function answer(): Promise<void> {
    fireEvent.click(within(dialog).getByRole("button", { name: buttonName }));
    await Promise.resolve();
  });
}

async function openFromVisible(stage: Stage, openerId: string): Promise<void> {
  await act(async function openLink(): Promise<void> {
    openStageLink(stage, SAMPLE_LINK, openerId);
    await settleStage(stage);
  });
}

/** Waits until the stage lists a check, after its bundle check. */
async function waitForCheck(stage: Stage): Promise<CheckSnapshot> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const entry = readStageSnapshot(stage).checks[0];
    if (entry !== undefined) {
      return entry;
    }
    await act(waitForMessages);
  }
  throw new Error("Expected the stage to list a check");
}

/** Opens the "More actions" menu with the keyboard. */
function openMoreActions(): void {
  fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), {
    key: "Enter",
  });
}

function theaterButton(): HTMLElement {
  return screen.getByRole("button", { name: "Theater mode" });
}

describe("theater mode button", function describeTheaterButton(): void {
  it("is named Theater mode and not pressed while theater mode is off", async function showsOff(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    expect(theaterButton()).toHaveAttribute("aria-pressed", "false");
    fireEvent.focus(theaterButton());
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Theater mode",
    );
  });

  it("Turn theater mode on", async function turnsOn(): Promise<void> {
    const storage = createMemoryStorage();
    const stage = await startTestStage("");
    renderStageView(stage, storage);

    fireEvent.click(theaterButton());

    expect(readStageSnapshot(stage).isTheaterMode).toBe(true);
    expect(theaterButton()).toHaveAttribute("aria-pressed", "true");
    expect(storage.getItem(THEATER_MODE_KEY)).toBe("true");
    fireEvent.focus(theaterButton());
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Theater mode",
    );
  });

  it("Turn theater mode off", async function turnsOff(): Promise<void> {
    const storage = createMemoryStorage();
    const stage = await startTestStage("");
    renderStageView(stage, storage);
    fireEvent.click(theaterButton());

    fireEvent.click(theaterButton());

    expect(readStageSnapshot(stage).isTheaterMode).toBe(false);
    expect(theaterButton()).toHaveAttribute("aria-pressed", "false");
    expect(storage.getItem(THEATER_MODE_KEY)).toBe("false");
  });

  it("is shown while the mod loads", function showsWhileLoading(): void {
    const history = new FakeHistory(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);
    const stage = buildTestStage(history, MOD_HOME_ROUTING);
    followHistory(stage, history.hash, history.state);

    renderStageView(stage);

    expect(readStageSnapshot(stage).sandboxes[0].status).toBe("loading");
    expect(theaterButton()).toBeInTheDocument();
  });

  it("Shown for a failed sandbox", async function showsWhenFailed(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${MISSING_MOD_REFERENCE}`);
    renderStageView(stage);

    expect(readStageSnapshot(stage).sandboxes[0].status).toBe("failed");
    expect(theaterButton()).toBeInTheDocument();
  });

  it("Home mod without a close button", async function endsWithoutClose(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    const buttons = within(stageBar).getAllByRole("button");
    expect(readStageSnapshot(stage).sandboxes[0].canClose).toBe(false);
    expect(buttons.slice(-2)).toEqual([theaterButton(), fullscreenButton()]);
    expect(fullscreenButton().nextElementSibling).toBeNull();
  });
});

function fullscreenButton(): HTMLElement {
  return screen.getByRole("button", { name: "Fullscreen" });
}

function queryFullscreenButton(): HTMLElement | null {
  return screen.queryByRole("button", { name: "Fullscreen" });
}

/** Plays the browser: `element` becomes the document's fullscreen element, and `fullscreenchange` fires. */
function playFullscreenChange(element: Element | null): void {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: element,
  });
  act(function dispatchChange(): void {
    document.dispatchEvent(new Event("fullscreenchange"));
  });
}

function forgetFullscreenElement(): void {
  Reflect.deleteProperty(document, "fullscreenElement");
}

/** The elements `recordFullscreenRequest` was called on. */
const fullscreenRequests: Element[] = [];

/** Plays a browser that grants fullscreen, and records the element asked for. */
function recordFullscreenRequest(this: Element): Promise<void> {
  fullscreenRequests.push(this);
  return Promise.resolve();
}

/** Plays a browser that refuses fullscreen. */
function refuseFullscreen(): Promise<void> {
  return Promise.reject(new TypeError("Permissions check failed"));
}

describe("fullscreen", function describeFullscreen(): void {
  afterEach(forgetFullscreenElement);

  it("follows fullscreenchange", async function followsChange(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    playFullscreenChange(screen.getByTitle("Book List"));
    expect(stage.fullscreenSandboxId).toBe("sandbox-1");

    playFullscreenChange(null);
    expect(stage.fullscreenSandboxId).toBeNull();
  });

  it("ignores a fullscreen element that is not a mod's frame", async function ignoresOther(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    playFullscreenChange(document.body);

    expect(stage.fullscreenSandboxId).toBeNull();
  });

  it("stops following fullscreenchange once unmounted", async function stopsFollowing(): Promise<void> {
    const stage = await startTestStage("");
    const { unmount } = renderStageView(stage);
    const frame = screen.getByTitle("Book List");
    unmount();

    playFullscreenChange(frame);

    expect(stage.fullscreenSandboxId).toBeNull();
  });

  it("Running mod", async function showsForRunning(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    expect(readStageSnapshot(stage).sandboxes[0].status).toBe("running");
    expect(fullscreenButton()).toBeInTheDocument();
    fireEvent.focus(fullscreenButton());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Fullscreen");
  });

  it("is not shown while the mod loads", function hidesWhileLoading(): void {
    const history = new FakeHistory(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);
    const stage = buildTestStage(history, MOD_HOME_ROUTING);
    followHistory(stage, history.hash, history.state);

    renderStageView(stage);

    expect(queryFullscreenButton()).toBeNull();
  });

  it("Failed sandbox", async function hidesWhenFailed(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${MISSING_MOD_REFERENCE}`);
    renderStageView(stage);

    expect(queryFullscreenButton()).toBeNull();
  });

  it("Waiting for an answer", async function hidesWhileAsking(): Promise<void> {
    await renderAskingStage();

    expect(screen.getByRole("dialog", { name: "Other API" })).toBeVisible();
    expect(queryFullscreenButton()).toBeNull();
  });

  it("requests fullscreen on the visible mod's frame", async function requestsFrame(): Promise<void> {
    const original = HTMLIFrameElement.prototype.requestFullscreen;
    HTMLIFrameElement.prototype.requestFullscreen = recordFullscreenRequest;
    try {
      const stage = await startTestStage("");
      renderStageView(stage);

      await act(async function pressFullscreen(): Promise<void> {
        fireEvent.click(fullscreenButton());
        await Promise.resolve();
      });

      const frame = screen.getByTitle("Book List");
      expect(fullscreenRequests).toEqual([frame]);
      expect(document.activeElement).toBe(frame);
    } finally {
      HTMLIFrameElement.prototype.requestFullscreen = original;
      fullscreenRequests.length = 0;
    }
  });

  it("Fullscreen refused", async function warnsRefused(): Promise<void> {
    const original = HTMLIFrameElement.prototype.requestFullscreen;
    HTMLIFrameElement.prototype.requestFullscreen = refuseFullscreen;
    try {
      const stage = await startTestStage("");
      renderStageView(stage);

      await act(async function pressFullscreen(): Promise<void> {
        fireEvent.click(fullscreenButton());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(findLevelButton("Warnings")).toHaveAccessibleName(
        "Warnings: 1, 1 unread",
      );
      await openLevel("Warnings");
      const item = screen.getByRole("listitem");
      expect(item).toHaveTextContent("App");
      expect(item).toHaveTextContent(SAMPLE_MOD_SOURCE);
      expect(item).toHaveTextContent(
        "Fullscreen is not available: Permissions check failed",
      );
    } finally {
      HTMLIFrameElement.prototype.requestFullscreen = original;
    }
  });
});

describe("StageView", function describeStageView(): void {
  it("renders one wrapper per sandbox, only the visible one shown", async function rendersWrappers(): Promise<void> {
    const stage = await startTestStage("");
    const { container } = renderStageView(stage);

    await openFromVisible(stage, "sandbox-1");

    const wrappers = listWrappers(container);
    const ids: string[] = [];
    const hidden: boolean[] = [];
    for (const wrapper of wrappers) {
      ids.push(wrapper.dataset.sandboxId ?? "");
      hidden.push(wrapper.hasAttribute("hidden"));
    }
    expect(ids).toEqual(["sandbox-1", "sandbox-2"]);
    expect(hidden).toEqual([true, false]);
  });

  it("renders the running mod's frame with its sandbox and document", async function rendersFrame(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    const frame = screen.getByTitle("Book List");

    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("allow")).toBe("fullscreen *");
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.getAttribute("srcdoc")).toContain("Content-Security-Policy");
  });

  it("Home mod has no close button", async function hidesHomeClose(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    expect(
      screen.getByRole("button", { name: "Mod: Book List" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("shows the close button for a mod opened from a link", async function showsClose(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);
    renderStageView(stage);

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("No collection, no reload", async function hidesReload(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);
    renderStageView(stage);

    openMoreActions();
    expect(screen.queryByRole("menuitem", { name: "Reload tiles" })).toBeNull();
    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    const names: string[] = [];
    for (const button of within(stageBar).getAllByRole("button")) {
      names.push(button.getAttribute("aria-label") ?? "");
    }
    expect(names).toEqual([
      "Mod: Book List",
      "Collection: None",
      "Mosaic: Unsaved combination",
      "Combination: Unsaved combination",
      "Edit as a new mosaic",
      "More actions",
      "Errors: 0, 0 unread",
      "Warnings: 0, 0 unread",
      "Notifications: 0, 0 unread",
      "Theater mode",
      "Fullscreen",
      "Close",
    ]);
  });

  it("Edit button: opens the mosaic viewer in a new sandbox, with the combination behind it", async function opensEditor(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);
    const opener = readStageSnapshot(stage).sandboxes[0];

    fireEvent.click(
      screen.getByRole("button", { name: "Edit as a new mosaic" }),
    );

    const sandboxes = readStageSnapshot(stage).sandboxes;
    expect(sandboxes).toHaveLength(2);
    expect(sandboxes[0].id).toBe(opener.id);
    expect(sandboxes[1].hash).toContain("mod=mosaic_viewer");
    expect(sandboxes[1].hash).toContain("mode=new");
  });

  it("Plain title: no edit button", async function hidesEditButton(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=mod_viewer&target=${SAMPLE_MOD_REFERENCE}`,
    );
    renderStageView(stage);

    expect(screen.queryByRole("button", { name: /^Mod:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  });

  it("shows Reload tiles for a mod opened with a collection", async function showsReload(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);

    openMoreActions();

    expect(
      screen.getByRole("menuitem", { name: "Reload tiles" }),
    ).toBeInTheDocument();
  });

  it("shows the title of the visible mod, without its version", async function showsTitle(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });

    const capsule = within(stageBar).getByRole("button", {
      name: "Mod: Book List",
    });
    expect(capsule).toHaveTextContent("Book List");
    expect(capsule).not.toHaveTextContent("1.0.0");
  });

  it("Missing mod file", async function showsLoadFailure(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${MISSING_MOD_REFERENCE}`);
    const { container } = renderStageView(stage);

    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_MOD_SOURCE);
    expect(screen.getByRole("alert")).toHaveTextContent("404");
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    expect(within(stageBar).getByText("Mod not loaded")).toBeInTheDocument();
    expect(stageBar.querySelector("[data-slot=badge]")).toBeNull();
  });

  it("Missing collection", async function keepsModName(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=./fixtures/tiles/missing.yaml`,
    );
    const { container } = renderStageView(stage);

    expect(readStageSnapshot(stage).sandboxes[0].status).toBe("failed");
    expect(screen.getByRole("alert")).toHaveTextContent(
      `${FIXTURES_BASE_URL}tiles/missing.yaml`,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("404");
    expect(container.querySelector("iframe")).toBeNull();
    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    expect(
      within(stageBar).getByRole("button", { name: "Mod: Book List" }),
    ).toBeInTheDocument();
    expect(
      within(stageBar).getByRole("button", {
        name: "Collection: Collection not loaded",
      }),
    ).toBeInTheDocument();
  });

  it("Sample mod has no issues", async function showsNoIssues(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    const errors = findLevelButton("Errors");
    expect(errors).toHaveAttribute("data-empty");
    expect(findLevelButton("Warnings")).toHaveAttribute("data-empty");
    await openLevel("Errors");
    expect(screen.getByText("No errors.")).toBeInTheDocument();
  });

  it("shows the visible mod's ui.confirm and sends the answer", async function answersConfirm(): Promise<void> {
    const stage = await startTestStage("");
    const fakeFrame = createFakeFrame();
    attachFrame(stage, "sandbox-1", fakeFrame.target);
    const modPort = readModPort(fakeFrame);
    openPorts.push(modPort);
    const received = collectMessages(modPort);
    renderStageView(stage);

    await act(async function askUser(): Promise<void> {
      modPort.postMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "ui.confirm",
        params: { message: "Delete this list?", confirmLabel: "Delete" },
      });
      await waitForMessages();
    });
    const dialog = screen.getByRole("dialog", { name: "Book List" });
    expect(dialog).toHaveTextContent("Delete this list?");
    expect(dialog).toHaveTextContent(SAMPLE_MOD_SOURCE);
    await act(async function confirm(): Promise<void> {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitForMessages();
    });

    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: true }]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("No question for the sample mod", async function asksNothingForSample(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTitle("Book List").tagName).toBe("IFRAME");
  });

  it("asks before starting a mod for another API", async function showsQuestion(): Promise<void> {
    const container = await renderAskingStage();

    const dialog = screen.getByRole("dialog", { name: "Other API" });
    expect(dialog).toHaveTextContent(OTHER_API_MOD_SOURCE);
    expect(dialog).toHaveTextContent("2.0.0");
    expect(dialog).toHaveTextContent(OTHER_API_RANGE);
    expect(dialog).toHaveTextContent(MOD_API_VERSION);
    expect(
      within(dialog).getByRole("button", { name: "Run anyway" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(screen.getByText("Waiting for your answer…")).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("Run anyway", async function runsAnyway(): Promise<void> {
    await renderAskingStage();

    await answerQuestion("Run anyway");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTitle("Other API").tagName).toBe("IFRAME");
    expect(screen.queryByText("Waiting for your answer…")).toBeNull();
  });

  it("Cancel", async function cancels(): Promise<void> {
    const container = await renderAskingStage();

    await answerQuestion("Cancel");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(OTHER_API_RANGE);
    expect(screen.getByRole("alert")).toHaveTextContent(MOD_API_VERSION);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("Cancelled API question", async function keepsNameAfterCancel(): Promise<void> {
    await renderAskingStage();

    await answerQuestion("Cancel");

    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    expect(within(stageBar).getByText("Other API")).toBeInTheDocument();
    expect(within(stageBar).getByText("2.0.0")).toBeInTheDocument();
  });

  it("Escape", async function cancelsOnEscape(): Promise<void> {
    await renderAskingStage();
    const dialog = screen.getByRole("dialog", { name: "Other API" });

    const cancelEvent = new Event("cancel", { cancelable: true });
    await act(async function pressEscape(): Promise<void> {
      fireEvent(dialog, cancelEvent);
      await Promise.resolve();
    });

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(OTHER_API_RANGE);
  });

  it("lists the messages of a level in order with producer, source and text", async function listsMessages(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);

    await reportBlockedImageAndFailure(modPort);
    await openLevel("Warnings");

    const items = within(
      screen.getByRole("list", { name: "Warnings" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("App");
    expect(items[0]).toHaveTextContent(SAMPLE_MOD_SOURCE);
    expect(items[0]).toHaveTextContent("https://images.example.net");
  });

  it("Blocked request while the mod runs", async function listsBlockedRequest(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    expect(findLevelButton("Warnings")).toHaveAccessibleName(
      "Warnings: 0, 0 unread",
    );

    await reportBlockedImage(modPort, "https://images.example.net");

    expect(findLevelButton("Warnings")).toHaveAccessibleName(
      "Warnings: 1, 1 unread",
    );
    await openLevel("Warnings");
    const item = within(
      screen.getByRole("list", { name: "Warnings" }),
    ).getByRole("listitem");
    expect(item).toHaveTextContent("https://images.example.net");
    expect(item).toHaveTextContent("permissions.show");
  });

  it("Read after opening", async function marksRead(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await reportBlockedImageAndFailure(modPort);
    expect(readCapsuleState("Warnings")).toBe("unread");

    await openLevel("Warnings");

    expect(readCapsuleState("Warnings")).toBe("read");
    expect(readCapsuleState("Errors")).toBe("unread");
  });

  it("New message after reading", async function fillsAgain(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await reportBlockedImage(modPort, "https://first.example.net");
    await openLevel("Warnings");
    await closeLevel("Warnings");
    expect(readCapsuleState("Warnings")).toBe("read");

    await reportBlockedImage(modPort, "https://second.example.net");

    expect(readCapsuleState("Warnings")).toBe("unread");
  });

  it("lists the stage bar's items in order", async function ordersItems(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    const names: string[] = [];
    for (const button of within(stageBar).getAllByRole("button")) {
      names.push(button.getAttribute("aria-label") ?? "");
    }
    expect(names).toEqual([
      "Mod: Book List",
      "Collection: Science fiction books",
      "Mosaic: Unsaved combination",
      "Combination: Unsaved combination",
      "Edit as a new mosaic",
      "More actions",
      "Errors: 0, 0 unread",
      "Warnings: 0, 0 unread",
      "Notifications: 1, 1 unread",
      "Theater mode",
      "Fullscreen",
      "Close",
    ]);
    expect(stageBar.querySelector("[data-slot=separator]")).not.toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("announces Link copied in the live region", async function announcesCopy(): Promise<void> {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn<(text: string) => Promise<void>>() },
    });
    const stage = await startTestStage("");
    renderStageView(stage);
    const stageBar = screen.getByRole("region", { name: "Stage bar" });

    openMoreActions();
    await act(async function chooseCopy(): Promise<void> {
      fireEvent.click(screen.getByRole("menuitem", { name: "Copy link" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stageBar.querySelector("[aria-live=polite]")).toHaveTextContent(
      "Link copied",
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Mod not loaded", async function showsModNotLoaded(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${MISSING_MOD_REFERENCE}`);
    renderStageView(stage);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    expect(within(stageBar).getByText("Mod not loaded")).toBeInTheDocument();
    expect(findLevelButton("Errors")).toHaveAccessibleName(
      "Errors: 1, 1 unread",
    );
    await openLevel("Errors");
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("App");
    expect(item).toHaveTextContent(MISSING_MOD_SOURCE);
    expect(item).toHaveTextContent("404");
  });

  it("Loading mod…", function showsLoading(): void {
    const history = new FakeHistory(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);
    const stage = buildTestStage(history, MOD_HOME_ROUTING);
    followHistory(stage, history.hash, history.state);

    renderStageView(stage);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    expect(
      within(stageBar).getByRole("button", { name: "Mod: Loading mod…" }),
    ).toBeInTheDocument();
    expect(within(stageBar).queryByText("1.0.0")).toBeNull();
  });

  it("flashes the level of a message that arrives while the sandbox is shown", async function flashesNewMessage(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    expect(findFlashing()).toEqual([]);

    await reportBlockedImageAndFailure(modPort);

    expect(findFlashing()).toEqual(["error", "warning"]);
  });

  it("does not flash after switching sandboxes", async function staysStillAfterSwitch(): Promise<void> {
    const history = new FakeHistory("");
    const stage = buildTestStage(history, MOD_HOME_ROUTING);
    followHistory(stage, history.hash, history.state);
    await settleStage(stage);
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await openFromVisible(stage, "sandbox-1");

    await reportBlockedImageAndFailure(modPort);
    await act(async function goBack(): Promise<void> {
      const navigation = history.goBack();
      followHistory(stage, navigation.hash, navigation.state);
      await settleStage(stage);
    });

    expect(findLevelButton("Warnings")).toHaveAccessibleName(
      "Warnings: 1, 1 unread",
    );
    expect(findFlashing()).toEqual([]);
    const liveRegion = document.querySelector("[aria-live=polite]");
    expect(liveRegion).toHaveTextContent("");
  });

  it("announces a new error in the live region", async function announcesError(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    const stageBar = screen.getByRole("region", { name: "Stage bar" });
    const liveRegion = stageBar.querySelector("[aria-live=polite]");
    expect(liveRegion).toHaveTextContent("");

    await reportBlockedImageAndFailure(modPort);

    expect(liveRegion).toHaveTextContent("New error from App:");
    expect(liveRegion).toHaveTextContent("map failed");
  });

  it("Unread items stand out", async function marksNewWarning(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await reportBlockedImage(modPort, "https://first.example.net");
    await openLevel("Warnings");
    await closeLevel("Warnings");

    await reportBlockedImage(modPort, "https://second.example.net");
    await openLevel("Warnings");

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("second.example.net");
    expect(within(items[0]).getByText("Unread")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("first.example.net");
    expect(within(items[1]).queryByText("Unread")).toBeNull();
  });

  it("Items read on the last opening are plain", async function marksNothingAgain(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await reportBlockedImage(modPort, "https://first.example.net");
    await openLevel("Warnings");
    expect(screen.getByText("Unread")).toBeInTheDocument();
    await closeLevel("Warnings");

    await openLevel("Warnings");

    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.queryByText("Unread")).toBeNull();
  });

  it("New message on top, marked while the popover is open", async function marksArrival(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await reportBlockedImage(modPort, "https://first.example.net");
    await openLevel("Warnings");
    await closeLevel("Warnings");
    await openLevel("Warnings");

    await reportBlockedImage(modPort, "https://second.example.net");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("second.example.net");
    expect(within(items[0]).getByText("Unread")).toBeInTheDocument();
    expect(within(items[1]).queryByText("Unread")).toBeNull();
    expect(readCapsuleState("Warnings")).toBe("unread");
    await closeLevel("Warnings");
    expect(readCapsuleState("Warnings")).toBe("read");
  });

  it("closes the open popover when the focus moves into a frame", async function closesOnFrameFocus(): Promise<void> {
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    await openLevel("Warnings");
    await reportBlockedImage(modPort, "https://first.example.net");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const frame = appendFrame();

    await moveFocusToFrame(frame);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readCapsuleState("Warnings")).toBe("read");
    expect(document.activeElement).toBe(frame);
  });

  it("Share menu: closes the More actions menu when the focus moves into a frame", async function closesMoreOnFrameFocus(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);
    openMoreActions();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    const frame = appendFrame();

    await moveFocusToFrame(frame);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(frame);
  });

  it("keeps the popover open when the window loses the focus elsewhere", async function staysOpenOnOtherBlur(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);
    await openLevel("Warnings");

    await act(async function blurWindow(): Promise<void> {
      fireEvent.blur(window);
      await waitForMessages();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Dismiss one, then Clear all", async function dismisses(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);
    await act(async function reload(): Promise<void> {
      await reloadTiles(stage, "sandbox-1");
    });
    await openLevel("Notifications");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const keptText = items[1].textContent;

    fireEvent.click(screen.getAllByRole("button", { name: /^Dismiss: / })[0]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent(keptText ?? "");
    expect(findLevelButton("Notifications")).toHaveAccessibleName(
      "Notifications: 1, 0 unread",
    );
    await act(async function reloadAgain(): Promise<void> {
      await reloadTiles(stage, "sandbox-1");
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByText("No notifications.")).toBeInTheDocument();
    expect(findLevelButton("Notifications")).toHaveAttribute("data-empty");
  });
});

function attachTestFrame(stage: Stage, id: string): MessagePort {
  const fakeFrame = createFakeFrame();
  attachFrame(stage, id, fakeFrame.target);
  const modPort = readModPort(fakeFrame);
  openPorts.push(modPort);
  return modPort;
}

/** Has the mod report a blocked image, a warning, then a failed mount, an error. */
async function reportBlockedImageAndFailure(
  modPort: MessagePort,
): Promise<void> {
  await act(async function reportIssues(): Promise<void> {
    postNotification(modPort, "sandbox.blocked", {
      blockedUrl: "https://images.example.net/a.jpg",
      directive: "img-src",
    });
    postNotification(modPort, "sandbox.mountFailed", {
      message: "map failed",
    });
    await waitForMessages();
  });
}

/** An empty frame in the page, removed after the test, which takes the focus as a mod's frame does. */
function appendFrame(): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  appendedFrames.push(frame);
  return frame;
}

/**
 * Moves the focus to `frame` as a click in it does in Firefox: the window's
 * blur comes first, while the focus is still in the app, and the frame gets
 * the focus afterwards. Then waits for the stage bar's check and for Radix's
 * focus on close.
 */
async function moveFocusToFrame(frame: HTMLIFrameElement): Promise<void> {
  await act(async function focusFrame(): Promise<void> {
    fireEvent.blur(window);
    frame.focus();
    await waitForMessages();
    await waitForMessages();
  });
}

/** Has the mod report an image blocked at `host`, a warning. */
async function reportBlockedImage(
  modPort: MessagePort,
  host: string,
): Promise<void> {
  await act(async function reportIssue(): Promise<void> {
    postNotification(modPort, "sandbox.blocked", {
      blockedUrl: `${host}/a.jpg`,
      directive: "img-src",
    });
    await waitForMessages();
  });
}

/** Closes the open popover of a level by pressing its button again, and checks it closed. */
async function closeLevel(label: string): Promise<void> {
  await openLevel(label);
  expect(screen.queryByRole("dialog")).toBeNull();
}

/** The stage bar's button of a level, by the start of its accessible name. */
function findLevelButton(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label}: `) });
}

async function openLevel(label: string): Promise<void> {
  await act(async function clickLevel(): Promise<void> {
    fireEvent.click(findLevelButton(label));
    await Promise.resolve();
  });
}

function readCapsuleState(label: string): string | null {
  const capsule =
    findLevelButton(label).querySelector<HTMLElement>("[data-capsule]");
  return capsule?.dataset.capsule ?? null;
}

/** The levels whose button flashes. */
function findFlashing(): string[] {
  const levels: string[] = [];
  for (const button of document.querySelectorAll<HTMLElement>("[data-level]")) {
    if (button.querySelector("[data-flash]") !== null) {
      levels.push(button.dataset.level ?? "");
    }
  }
  return levels;
}

function postNotification(
  port: MessagePort,
  method: string,
  params: object,
): void {
  port.postMessage({ jsonrpc: "2.0", method, params });
}

/** Publishes a snapshot whose only check runs the frame `key`, as the stage does when a check starts a frame. */
function publishCheckFrame(stage: Stage, key: string): void {
  const check: CheckSnapshot = Object.freeze({
    id: "check-9",
    key,
    sandboxDocument: "<!doctype html>",
    title: "Probe",
  });
  act(function publishSnapshot(): void {
    stage.snapshot = Object.freeze({
      ...stage.snapshot,
      checks: Object.freeze([check]),
    });
    for (const listener of stage.listeners) {
      listener();
    }
  });
}

describe("CheckFrame", function describeCheckFrame(): void {
  it("renders a hidden frame per check, outside the sandboxes, until the check ends", async function rendersCheckFrame(): Promise<void> {
    const stage = await startTestStage(
      "#/run?mod=mod_viewer",
      PAGE_HOME_ROUTING,
    );
    const viewerId = readStageSnapshot(stage).sandboxes[0].id;
    const fakeFrame = createFakeFrame();
    attachFrame(stage, viewerId, fakeFrame.target);
    const viewerPort = readModPort(fakeFrame);
    openPorts.push(viewerPort);
    const received = collectMessages(viewerPort);
    const { container } = renderStageView(stage);

    viewerPort.postMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "mods.check",
      params: { mod: SAMPLE_MOD_REFERENCE },
    });
    const check = await waitForCheck(stage);
    const checkFrame = container.querySelector<HTMLIFrameElement>(
      `iframe[data-check-id="${check.id}"]`,
    );

    expect(checkFrame).not.toBeNull();
    expect(checkFrame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(checkFrame?.getAttribute("srcdoc")).toContain(
      "Content-Security-Policy",
    );
    expect(checkFrame?.hasAttribute("inert")).toBe(true);
    expect(checkFrame?.getAttribute("aria-hidden")).toBe("true");
    expect(checkFrame?.closest("[data-sandbox-id]")).toBeNull();
    expect(checkFrame?.hidden).toBe(false);

    await act(async function endCheck(): Promise<void> {
      checkFrameLoadedAgain(stage, check.id, check.key);
      await waitForMessages();
    });

    expect(container.querySelector("iframe[data-check-id]")).toBeNull();
    expect(received).toMatchObject([
      { id: 1, result: { status: "fail", mountChecked: true } },
    ]);
  });

  it("renders a new iframe for a new frame of the same check", async function rendersNewFrame(): Promise<void> {
    const stage = await startTestStage("");
    const { container } = renderStageView(stage);

    publishCheckFrame(stage, "check-9-frame-1");
    const firstFrame = container.querySelector("iframe[data-check-id]");
    publishCheckFrame(stage, "check-9-frame-2");
    const secondFrame = container.querySelector("iframe[data-check-id]");

    expect(firstFrame).not.toBeNull();
    expect(secondFrame).not.toBeNull();
    expect(secondFrame).not.toBe(firstFrame);
    expect(firstFrame?.isConnected).toBe(false);
    expect(secondFrame?.getAttribute("data-check-id")).toBe("check-9");
  });
});

function readStageBar(): HTMLElement {
  return screen.getByRole("region", { name: "Stage bar" });
}

function findCapsule(name: string): HTMLElement {
  return within(readStageBar()).getByRole("button", { name });
}

const MOSAIC_HASH = `#/run?mosaic=${SAMPLE_MOSAIC_REFERENCE}`;

describe("combination capsules", function describeCombinationCapsules(): void {
  it("Combination capsules: the mosaic's mod, collection and title", async function showsMosaicCapsules(): Promise<void> {
    const stage = await startTestStage(MOSAIC_HASH);
    renderStageView(stage);

    expect(findCapsule("Mod: Book List")).toHaveTextContent(/^Book List$/);
    expect(findCapsule("Collection: Science fiction books")).toHaveTextContent(
      "Science fiction books",
    );
    expect(findCapsule("Mosaic: Books on the shelf")).toHaveTextContent(
      "Books on the shelf",
    );
    expect(findCapsule("Combination: Books on the shelf")).toBeInTheDocument();
    const separators = readStageBar().querySelectorAll("[aria-hidden=true]");
    const texts: string[] = [];
    for (const separator of separators) {
      texts.push(separator.textContent ?? "");
    }
    expect(texts).toContain("+");
    expect(texts).toContain("→");
  });

  it("Folded capsule of an unsaved combination: the mosaic's look, and rows with the mod's and collection's titles", async function foldsUnsaved(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);

    const folded = findCapsule("Combination: Unsaved combination");
    expect(folded).toHaveTextContent("Unsaved combination");
    expect(folded.className).toContain("border-dashed");
    expect(folded.querySelector("svg.lucide-opentesela-mosaic")).not.toBeNull();
    expect(folded.querySelector("svg.lucide-opentesela-mod")).toBeNull();
    fireEvent.keyDown(folded, { key: "Enter" });
    const names: string[] = [];
    for (const item of screen.getAllByRole("menuitem")) {
      names.push(item.textContent ?? "");
    }
    expect(names).toEqual([
      "Mosaic: Unsaved combination",
      "Mod: Book List",
      "Collection: Science fiction books",
    ]);
  });

  it("Capsule icons: the sidebar's icons for mod, collection and mosaic", async function usesSidebarIcons(): Promise<void> {
    const stage = await startTestStage(MOSAIC_HASH);
    renderStageView(stage);

    expect(
      findCapsule("Mod: Book List").querySelector("svg.lucide-opentesela-mod"),
    ).not.toBeNull();
    expect(
      findCapsule("Collection: Science fiction books").querySelector(
        "svg.lucide-shapes",
      ),
    ).not.toBeNull();
    expect(
      findCapsule("Mosaic: Books on the shelf").querySelector(
        "svg.lucide-opentesela-mosaic",
      ),
    ).not.toBeNull();
    expect(
      findCapsule("Combination: Books on the shelf").querySelector(
        "svg.lucide-opentesela-mosaic",
      ),
    ).not.toBeNull();
  });

  it("orders the capsules mod, +, collection, arrow, mosaic", async function ordersCapsules(): Promise<void> {
    const stage = await startTestStage(MOSAIC_HASH);
    renderStageView(stage);

    const row = findCapsule("Mod: Book List").parentElement;
    const texts: string[] = [];
    for (const child of row?.children ?? []) {
      texts.push(child.getAttribute("aria-label") ?? child.textContent ?? "");
    }
    expect(texts).toEqual([
      "Mod: Book List",
      "+",
      "Collection: Science fiction books",
      "→",
      "Mosaic: Books on the shelf",
    ]);
  });

  it("Unsaved combination: a dashed mosaic capsule", async function showsUnsaved(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);

    expect(findCapsule("Mosaic: Unsaved combination")).toHaveClass(
      "border-dashed",
    );
    expect(findCapsule("Mosaic: Unsaved combination")).toHaveTextContent(
      "Unsaved combination",
    );
  });

  it("shows the decoded file name of a tile link's tile", async function showsTileName(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&tile=./fixtures/tiles/books/kallocain.md`,
    );
    renderStageView(stage);

    expect(findCapsule("Collection: kallocain.md")).toBeInTheDocument();
  });

  it("Missing collection file", async function showsMissingCollection(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=./fixtures/tiles/missing.yaml`,
    );
    renderStageView(stage);

    expect(
      findCapsule("Collection: Collection not loaded"),
    ).toBeInTheDocument();
  });

  it("Loading collection…", function showsLoadingCollection(): void {
    const history = new FakeHistory(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    const stage = buildTestStage(history, MOD_HOME_ROUTING);
    followHistory(stage, history.hash, history.state);

    renderStageView(stage);

    expect(findCapsule("Collection: Loading collection…")).toBeInTheDocument();
  });

  it("Mod viewer: a mod no list holds, without a collection, has a plain title", async function showsPlainTitle(): Promise<void> {
    serveUntypedMod();
    const stage = await startTestStage(
      `#/run?mod=${encodeURIComponent(UNTYPED_MOD_SOURCE)}&target=x`,
    );
    renderStageView(stage);

    const names: string[] = [];
    for (const button of within(readStageBar()).getAllByRole("button")) {
      names.push(button.getAttribute("aria-label") ?? "");
    }
    expect(names[0]).toBe("More actions");
    expect(readStageBar().querySelector("[data-slot=badge]")).not.toBeNull();
  });

  it("Missing mod file of a combination: Mod not loaded in the mod capsule", async function showsMissingMod(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${MISSING_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);

    expect(findCapsule("Mod: Mod not loaded")).toBeInTheDocument();
    expect(within(readStageBar()).queryByText("1.0.0")).toBeNull();
  });
});

describe("mosaic name while loading or after a failure", function describeMosaicName(): void {
  it("Loading mosaic…: one capsule in place of the three", function showsLoadingMosaic(): void {
    const history = new FakeHistory(MOSAIC_HASH);
    const stage = buildTestStage(history, MOD_HOME_ROUTING);
    followHistory(stage, history.hash, history.state);

    renderStageView(stage);

    expect(
      within(readStageBar()).getByText("Loading mosaic…"),
    ).toBeInTheDocument();
    expect(
      within(readStageBar()).queryByRole("button", { name: /^Mod:/ }),
    ).toBeNull();
  });

  it("Missing mosaic file", async function showsMissingMosaic(): Promise<void> {
    const stage = await startTestStage(
      "#/run?mosaic=./fixtures/mosaics/missing",
    );
    renderStageView(stage);

    expect(
      within(readStageBar()).getByText("Mosaic not loaded"),
    ).toBeInTheDocument();
    expect(readStageBar().querySelector("[data-slot=badge]")).toBeNull();
  });

  it("Missing mod of a mosaic", async function showsMissingModOfMosaic(): Promise<void> {
    const mosaicSource = `${FIXTURES_BASE_URL}mosaics/lost/mosaic.yaml`;
    serveTestMosaic(mosaicSource, [
      'title: "Lost books"',
      'mod: "../../mods/missing"',
      'collection: "../../tiles/books_collection.yaml"',
    ]);
    const stage = await startTestStage("#/run?mosaic=./fixtures/mosaics/lost");
    renderStageView(stage);

    expect(findCapsule("Mosaic: Lost books")).toBeInTheDocument();
    expect(findCapsule("Mod: Mod not loaded")).toBeInTheDocument();
  });
});

describe("closing on a click outside", function describeClickOutside(): void {
  it("Mod list: closes when the focus moves into a frame, which keeps it", async function closesModList(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);
    fireEvent.click(findCapsule("Mod: Book List"));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    const frame = appendFrame();

    await moveFocusToFrame(frame);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(document.activeElement).toBe(frame);
  });

  it("opens one list at a time", async function opensOneList(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);
    fireEvent.click(findCapsule("Mod: Book List"));

    fireEvent.click(findCapsule("Mosaic: Unsaved combination"));

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Mosaic list");
  });
});

/** A mosaic on the app's origin with the covers' `show` line, for `sites` links. */
const COVERS_SITES_SOURCE = `${FIXTURES_BASE_URL}mosaics/covers/mosaic.yaml`;

function serveCoversSites(): void {
  serveTestMosaic(COVERS_SITES_SOURCE, [
    'title: "Covers on the shelf"',
    'mod: "../../mods/book_list"',
    "permissions:",
    "  show:",
    '    - host: "https://covers.openlibrary.org"',
    '      reason: "Shows the book covers"',
  ]);
}

const SITES_HASH = `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}&sites=${encodeURIComponent(COVERS_SITES_SOURCE)}&sort=year`;

describe("sites chip", function describeSitesChip(): void {
  it("Kept covers: a chip with the number of lines, and their hosts", async function showsSites(): Promise<void> {
    serveCoversSites();
    const stage = await startTestStage(SITES_HASH);
    renderStageView(stage);

    const chip = findCapsule("Sites from Covers on the shelf");
    fireEvent.click(chip);

    expect(chip).toHaveTextContent("1");
    const popover = screen.getByRole("dialog");
    expect(popover).toHaveTextContent("https://covers.openlibrary.org");
    expect(popover).toHaveTextContent("Shows the book covers");
    expect(popover).toHaveTextContent("Granted");
    expect(
      chip.compareDocumentPosition(findCapsule("Mosaic: Unsaved combination")),
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it("The chip's tooltip is its accessible name", async function namesChip(): Promise<void> {
    serveCoversSites();
    const stage = await startTestStage(SITES_HASH);
    renderStageView(stage);
    const chip = findCapsule("Sites from Covers on the shelf");

    const tooltip = await readTooltipOnFocus(chip);

    expect(tooltip).toBe("Sites from Covers on the shelf");
    expect(chip).toHaveAccessibleName(tooltip);
  });

  it("Stop using them: the same combination and params without sites, and no chip", async function dropsSites(): Promise<void> {
    serveCoversSites();
    const stage = await startTestStage(SITES_HASH);
    renderStageView(stage);
    fireEvent.click(findCapsule("Sites from Covers on the shelf"));

    await act(async function clickStop(): Promise<void> {
      fireEvent.click(
        screen.getByRole("button", { name: "Stop using these sites" }),
      );
      await settleStage(stage);
    });

    const visible = readStageSnapshot(stage).sandboxes.find(isVisibleSandbox);
    expect(visible?.link).toMatchObject({
      mod: SAMPLE_MOD_SOURCE,
      sites: null,
      params: { sort: "year" },
    });
    expect(
      within(readStageBar()).queryByRole("button", { name: /^Sites from/ }),
    ).toBeNull();
  });

  it("shows no chip without sites", async function hidesChip(): Promise<void> {
    const stage = await startTestStage(MOSAIC_HASH);
    renderStageView(stage);

    expect(
      within(readStageBar()).queryByRole("button", { name: /^Sites from/ }),
    ).toBeNull();
  });
});

function isVisibleSandbox(sandbox: { isVisible: boolean }): boolean {
  return sandbox.isVisible;
}

/** The stage bar's content box becomes `width` pixels wide. */
function resizeStageBar(width: number): void {
  act(resizeObservedElements.bind(undefined, "section.stage-bar", width));
}

function readStageBarButtonNames(): string[] {
  const names: string[] = [];
  const stageBar = screen.getByRole("region", { name: "Stage bar" });
  for (const button of within(stageBar).getAllByRole("button")) {
    names.push(button.getAttribute("aria-label") ?? "");
  }
  return names;
}

function recordShownSandbox(calls: string[], sandboxId: string): void {
  calls.push(`show ${sandboxId}`);
}

function recordRoomRequest(calls: string[], sandboxId: string): boolean {
  calls.push(`ask ${sandboxId}`);
  return false;
}

/** A sidebar that records what the stage bar tells it, and never makes room. */
function buildRecordingSidebar(calls: string[]): SidebarRoom {
  const sidebarRoom: SidebarRoom = {
    onAskRoom: recordRoomRequest.bind(undefined, calls),
    onShowSandbox: recordShownSandbox.bind(undefined, calls),
  };
  return sidebarRoom;
}

function readOverflowingScrollWidth(): number {
  return 10_000;
}

describe("narrow stage bar", function describeNarrowStageBar(): void {
  it("reports each sandbox shown, before it asks for room", async function reportsBeforeAsking(): Promise<void> {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const scrollWidth = vi
      .spyOn(Element.prototype, "scrollWidth", "get")
      .mockImplementation(readOverflowingScrollWidth);
    try {
      const stage = await startTestStage("");
      const calls: string[] = [];
      renderStageView(
        stage,
        createMemoryStorage(),
        buildRecordingSidebar(calls),
      );

      resizeStageBar(640);
      await openFromVisible(stage, "sandbox-1");

      // The second sandbox's bar measures again as its content loads, so it may ask more than once.
      expect(calls.slice(0, 4)).toEqual([
        "show sandbox-1",
        "ask sandbox-1",
        "show sandbox-2",
        "ask sandbox-2",
      ]);
      expect(new Set(calls.slice(3))).toEqual(new Set(["ask sandbox-2"]));
    } finally {
      scrollWidth.mockRestore();
    }
  });

  it("Phone: the messages button, then Close", async function foldsRightSide(): Promise<void> {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const stage = await startTestStage(`#/run?mod=${SAMPLE_MOD_REFERENCE}`);
    renderStageView(stage);

    resizeStageBar(340);

    const names = readStageBarButtonNames();
    expect(names.slice(-2)).toEqual([
      "Messages: 0 errors, 0 warnings, 0 notifications, 0 unread",
      "Close",
    ]);
    expect(names).not.toContain("Theater mode");
    expect(names).not.toContain("Fullscreen");
    resizeStageBar(480);
    expect(readStageBarButtonNames().slice(-6)).toEqual([
      "Errors: 0, 0 unread",
      "Warnings: 0, 0 unread",
      "Notifications: 0, 0 unread",
      "Theater mode",
      "Fullscreen",
      "Close",
    ]);
  });

  it("Opening marks every level read, and the capsule is muted once it closes", async function readsEveryLevel(): Promise<void> {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    resizeStageBar(340);
    await reportBlockedImageAndFailure(modPort);
    expect(readCapsuleState("Messages")).toBe("unread");

    await openLevel("Messages");

    const popover = screen.getByRole("dialog");
    expect(within(popover).getAllByText("Unread")).toHaveLength(2);
    await closeLevel("Messages");
    expect(readCapsuleState("Messages")).toBe("read");
    expect(findLevelButton("Messages")).toHaveAccessibleName(
      "Messages: 1 error, 1 warning, 0 notifications, 0 unread",
    );
  });

  it("A message that arrives while it is open is read once it closes", async function readsOnClose(): Promise<void> {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const stage = await startTestStage("");
    const modPort = attachTestFrame(stage, "sandbox-1");
    renderStageView(stage);
    resizeStageBar(340);
    await openLevel("Messages");
    expect(screen.getByText("No messages.")).toBeInTheDocument();

    await reportBlockedImage(modPort, "https://images.example.net");
    expect(
      within(screen.getByRole("dialog")).getByText("Unread"),
    ).toBeVisible();
    await closeLevel("Messages");

    expect(readCapsuleState("Messages")).toBe("read");
  });

  it("Crossing 480px closes the open messages popover", async function closesOnCrossing(): Promise<void> {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const stage = await startTestStage("");
    renderStageView(stage);
    resizeStageBar(340);
    await openLevel("Messages");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    resizeStageBar(600);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(findLevelButton("Errors")).toBeInTheDocument();
  });

  it("A width on the same side of 480px keeps the popover open", async function staysOpen(): Promise<void> {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const stage = await startTestStage("");
    renderStageView(stage);
    resizeStageBar(340);
    await openLevel("Messages");

    resizeStageBar(400);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
