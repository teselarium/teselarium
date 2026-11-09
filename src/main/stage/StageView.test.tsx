import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
  serveOtherApiMod,
} from "../../test/sample_mods.ts";
import { testTexts } from "../../test/test_files.ts";
import { FakeHistory } from "../../test/fake_history.ts";
import {
  buildTestStage,
  MOD_HOME_ROUTING,
  PAGE_HOME_ROUTING,
  settleStage,
  startTestStage,
} from "../../test/test_stages.ts";
import { MOD_API_VERSION } from "../../lib/core/engine/index.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import { createPlayerSites } from "../settings/player_sites.ts";
import type { PlayerSites } from "../settings/player_sites.ts";
import { StageView } from "./StageView.tsx";

function createTestPlayerSites(): PlayerSites {
  const playerSites = createPlayerSites({ storage: createMemoryStorage() });
  return playerSites;
}

/** Renders the stage view inside the tooltip provider the app gives it. */
function renderStageView(stage: Stage): RenderResult {
  return render(
    <TooltipProvider>
      <StageView stage={stage} playerSites={createTestPlayerSites()} />
    </TooltipProvider>,
  );
}

const OTHER_API_HASH = `#/run?mod=${encodeURIComponent(OTHER_API_MOD_SOURCE)}`;

const openPorts: MessagePort[] = [];

afterEach(function cleanUp(): void {
  testTexts.clear();
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
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

    expect(screen.getByText("Book List")).toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Reload tiles" })).toBeNull();
  });

  it("shows Reload tiles for a mod opened with a collection", async function showsReload(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);

    expect(
      screen.getByRole("button", { name: "Reload tiles" }),
    ).toBeInTheDocument();
  });

  it("shows the title and the version of the visible mod", async function showsTitle(): Promise<void> {
    const stage = await startTestStage("");
    renderStageView(stage);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });

    expect(within(stageBar).getByText("Book List")).toBeInTheDocument();
    expect(within(stageBar).getByText("1.0.0")).toBeInTheDocument();
  });

  it("Missing mod file", async function showsLoadFailure(): Promise<void> {
    const stage = await startTestStage(`#/run?mod=${MISSING_MOD_REFERENCE}`);
    const { container } = renderStageView(stage);

    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_MOD_SOURCE);
    expect(screen.getByRole("alert")).toHaveTextContent("404");
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
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
      "Mod information",
      "Reload tiles",
      "Errors: 0, 0 unread",
      "Warnings: 0, 0 unread",
      "Notifications: 1, 1 unread",
      "Close",
    ]);
    const title = within(stageBar).getByText("Book List");
    expect(
      title.compareDocumentPosition(within(stageBar).getByText("1.0.0")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      within(stageBar)
        .getByText("1.0.0")
        .compareDocumentPosition(
          within(stageBar).getByRole("button", { name: "Mod information" }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(stageBar.querySelector("[data-slot=separator]")).not.toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
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
    expect(within(stageBar).getByText("Loading mod…")).toBeInTheDocument();
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

  it("dismisses a notification and clears them all", async function dismisses(): Promise<void> {
    const stage = await startTestStage(
      `#/run?mod=${SAMPLE_MOD_REFERENCE}&collection=${SAMPLE_COLLECTION_REFERENCE}`,
    );
    renderStageView(stage);
    await act(async function reload(): Promise<void> {
      await reloadTiles(stage, "sandbox-1");
    });
    await openLevel("Notifications");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: /^Dismiss: / })[0]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
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
