import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { FakeHistory } from "../../../test/fake_history.ts";
import { createMemoryStorage } from "../../../test/memory_storage.ts";
import type { MemoryStorage } from "../../../test/memory_storage.ts";
import { APP_BASE_URL, FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  MISSING_TYPE_MOD_SOURCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  serveMissingTypeMod,
  serveTestMod,
  serveTwoBooks,
  serveUntypedMod,
  TWO_BOOKS_REFERENCE,
  TWO_BOOKS_SOURCE,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { PAGE_HOME_ROUTING } from "../../../test/test_stages.ts";
import type {
  ModCheckReport,
  ModCheckRequest,
  ModContext,
} from "../engine/index.ts";
import { readModValue, writeModValue } from "../storage/index.ts";
import {
  attachCheckFrame,
  attachFrame,
  checkFrameLoadedAgain,
  checkStageMod,
  closeSandbox,
  createStage,
  followHistory,
  readStageSnapshot,
} from "./stage_controller.ts";
import type { CheckSnapshot, Stage } from "./stage_controller.ts";
import { CHECK_MOUNT_LIMIT_MS, CHECK_SETTLE_MS } from "./stage_checks.ts";

/** The mod viewer, granted `open` for `"*"`: the visible mod that asks for checks. */
const VIEWER_HASH = "#/run?mod=mod_viewer";

/** A fixture mod on the app's origin with `open` for `"*"`, so its `mods.open` reaches the stage. */
const OPENING_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/opening/mod_conf.yaml`;

interface CheckStage {
  stage: Stage;
  history: FakeHistory;
  storage: MemoryStorage;
  fetchSpy: Mock<typeof fetch>;
  requesterId: string;
}

interface CheckFrame {
  modPort: MessagePort;
  received: unknown[];
  context: ModContext;
}

const openPorts: MessagePort[] = [];

beforeEach(function useFakeTimers(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(function cleanUp(): void {
  vi.useRealTimers();
  testTexts.clear();
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

function serveOpeningMod(): void {
  serveTestMod(OPENING_MOD_SOURCE, [
    '  name: "opening"',
    '  version: "0.1.0"',
    '  entrypoint: "./main.js"',
    "  permissions:",
    "    open:",
    '      - host: "*"',
    '        reason: "Opens mods"',
  ]);
}

/** A stage showing the mod viewer, whose launch settled. */
async function startCheckStage(): Promise<CheckStage> {
  const history = new FakeHistory(VIEWER_HASH);
  const storage = createMemoryStorage();
  const fetchSpy = vi.fn<typeof fetch>(fetchTestFile);
  const stage = createStage({
    history,
    defaults: { folder: "./default_mods/", switchedOff: [] },
    routing: PAGE_HOME_ROUTING,
    appOrigin: APP_ORIGIN,
    baseUrl: APP_BASE_URL,
    storage,
    fetch: fetchSpy,
    colorScheme: "light",
  });
  followHistory(stage, history.hash, history.state);
  for (const runtime of stage.runtimes.values()) {
    await runtime.settled;
  }
  const requesterId = readStageSnapshot(stage).sandboxes[0].id;
  const checkStage = { stage, history, storage, fetchSpy, requesterId };
  return checkStage;
}

function listRequestedUrls(fetchSpy: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of fetchSpy.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function startCheck(
  checkStage: CheckStage,
  request: ModCheckRequest,
): Promise<ModCheckReport> {
  const reporting = checkStageMod(
    checkStage.stage,
    checkStage.requesterId,
    request,
  );
  if (reporting === null) {
    throw new Error(`Expected the stage to check "${request.source}"`);
  }
  return reporting;
}

/** Waits until the stage's snapshot lists a check, after its bundle check. */
async function waitForCheckEntry(stage: Stage): Promise<CheckSnapshot> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const entry = readStageSnapshot(stage).checks[0];
    if (entry !== undefined) {
      return entry;
    }
    await waitForMessages();
  }
  throw new Error("Expected the stage to list a check");
}

/** Attaches a fake frame to the check, playing the frame loader through the mod's port. */
async function attachCheckingFrame(
  checkStage: CheckStage,
): Promise<CheckFrame> {
  const entry = await waitForCheckEntry(checkStage.stage);
  const fakeFrame = createFakeFrame();
  attachCheckFrame(checkStage.stage, entry.id, fakeFrame.target);
  const modPort = readModPort(fakeFrame);
  openPorts.push(modPort);
  const connect = fakeFrame.posted[0].message as {
    params: { context: ModContext };
  };
  const checkFrame: CheckFrame = {
    modPort,
    received: collectMessages(modPort),
    context: connect.params.context,
  };
  return checkFrame;
}

function sendNotification(
  checkFrame: CheckFrame,
  method: string,
  params: object,
): void {
  checkFrame.modPort.postMessage({ jsonrpc: "2.0", method, params });
}

function sendRequest(
  checkFrame: CheckFrame,
  id: number,
  method: string,
  params: object,
): void {
  checkFrame.modPort.postMessage({ jsonrpc: "2.0", id, method, params });
}

/** Waits until the mod side received `count` messages. */
async function waitForReceived(
  checkFrame: CheckFrame,
  count: number,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (checkFrame.received.length >= count) {
      return;
    }
    await waitForMessages();
  }
}

/** Plays a `mount` that resolves, then lets the settle time pass. */
async function finishMount(checkFrame: CheckFrame): Promise<void> {
  sendNotification(checkFrame, "sandbox.mounted", {});
  await waitForMessages();
  await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS);
}

function listFindingMessages(report: ModCheckReport): string[] {
  const messages: string[] = [];
  for (const finding of report.findings) {
    messages.push(finding.message);
  }
  return messages;
}

function listTileSources(context: ModContext): string[] {
  const tileSources: string[] = [];
  for (const tile of context.tiles) {
    tileSources.push(tile.source);
  }
  return tileSources;
}

function recordCheckCount(stage: Stage, checkCounts: number[]): void {
  checkCounts.push(readStageSnapshot(stage).checks.length);
}

function markReported(reported: { done: boolean }): void {
  reported.done = true;
}

describe("Check a mod", function describeCheckMod(): void {
  it("Check the sample mod", async function checksSampleMod(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(report).toEqual({
      source: SAMPLE_MOD_SOURCE,
      status: "pass",
      mountChecked: true,
      findings: [],
    });
    expect(listTileSources(checkFrame.context)).toEqual(SAMPLE_TILE_SOURCES);
    expect(checkFrame.context.mod.source).toBe(SAMPLE_MOD_SOURCE);
    expect(checkFrame.context.params).toEqual({});
  });

  it("Check with another collection", async function checksWithCollection(): Promise<void> {
    serveTwoBooks();
    const checkStage = await startCheckStage();
    checkStage.fetchSpy.mockClear();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: TWO_BOOKS_REFERENCE,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(listTileSources(checkFrame.context)).toEqual([
      SAMPLE_TILE_SOURCES[1],
      SAMPLE_TILE_SOURCES[2],
    ]);
    const requestedUrls = listRequestedUrls(checkStage.fetchSpy);
    expect(requestedUrls).toContain(TWO_BOOKS_SOURCE);
    expect(requestedUrls).not.toContain(SAMPLE_COLLECTION_SOURCE);
  });

  it("Mod without a sample collection", async function checksWithoutCollection(): Promise<void> {
    serveUntypedMod();
    const checkStage = await startCheckStage();
    checkStage.fetchSpy.mockClear();

    const reporting = startCheck(checkStage, {
      source: UNTYPED_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(report.status).toBe("pass");
    expect(checkFrame.context.tiles).toEqual([]);
    expect(listRequestedUrls(checkStage.fetchSpy)).toEqual([
      UNTYPED_MOD_SOURCE,
      `${FIXTURES_BASE_URL}mods/untyped/main.js`,
    ]);
  });

  it("goes through the requester's mods.check", async function checksThroughSession(): Promise<void> {
    const checkStage = await startCheckStage();
    const requesterFrame = createFakeFrame();
    attachFrame(
      checkStage.stage,
      checkStage.requesterId,
      requesterFrame.target,
    );
    const requesterPort = readModPort(requesterFrame);
    openPorts.push(requesterPort);
    const requesterReceived = collectMessages(requesterPort);

    requesterPort.postMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "mods.check",
      params: { mod: SAMPLE_MOD_REFERENCE },
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await waitForMessages();

    expect(requesterReceived).toEqual([
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          source: SAMPLE_MOD_SOURCE,
          status: "pass",
          mountChecked: true,
          findings: [],
        },
      },
    ]);
  });

  it("refuses a requester that is not the visible sandbox", async function refusesHiddenRequester(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = checkStageMod(checkStage.stage, "sandbox-hidden", {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });

    expect(reporting).toBeNull();
  });
});

describe("Mount check", function describeMountCheck(): void {
  it("Bundle error skips the mount", async function skipsMount(): Promise<void> {
    serveMissingTypeMod();
    const checkStage = await startCheckStage();
    const checkCounts: number[] = [];
    checkStage.stage.listeners.add(
      recordCheckCount.bind(undefined, checkStage.stage, checkCounts),
    );

    const report = await startCheck(checkStage, {
      source: MISSING_TYPE_MOD_SOURCE,
      collection: null,
    });

    expect(report.mountChecked).toBe(false);
    expect(report.status).toBe("fail");
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
    expect(checkCounts).not.toContain(1);
  });

  it("Frame removed after the check", async function removesCheckEntry(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const entry = await waitForCheckEntry(checkStage.stage);
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(entry.title).toBe("Book List");
    expect(entry.sandboxDocument).toContain("<script");
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("What the mount check records", function describeMountRecords(): void {
  it("Mount throws", async function recordsMountFailure(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendNotification(checkFrame, "sandbox.mountFailed", {
      message: "map failed",
    });
    await waitForMessages();
    await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS);
    const report = await reporting;

    expect(report.status).toBe("fail");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      step: "mount",
      level: "error",
      source: SAMPLE_MOD_SOURCE,
    });
    expect(report.findings[0].message).toContain("map failed");
  });

  it("Unknown method", async function recordsUnknownMethod(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendRequest(checkFrame, 1, "tiles.delete", {});
    await waitForReceived(checkFrame, 1);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(report.status).toBe("fail");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ step: "mount", level: "error" });
    expect(report.findings[0].message).toContain("tiles.delete");
    expect(report.findings[0].message).toContain("Unknown method");
  });

  it("records bad params and a message that is not a request", async function recordsBadRequests(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendRequest(checkFrame, 1, "storage.get", { key: 3 });
    checkFrame.modPort.postMessage({ id: 2, method: 12 });
    await waitForReceived(checkFrame, 2);
    await finishMount(checkFrame);
    const report = await reporting;

    const messages = listFindingMessages(report);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("storage.get");
    expect(messages[0]).toContain('"key" must be a non-empty string');
    expect(messages[1]).toContain("Not a valid JSON-RPC 2.0 request");
  });

  it("Blocked image", async function recordsBlockedImage(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendNotification(checkFrame, "sandbox.blocked", {
      blockedUrl: "https://images.example.net/cover.jpg",
      directive: "img-src",
    });
    await finishMount(checkFrame);
    const report = await reporting;

    expect(report.status).toBe("warn");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      step: "mount",
      level: "warning",
    });
    expect(report.findings[0].message).toContain("https://images.example.net");
    expect(report.findings[0].message).toContain("permissions.show");
  });

  it("Mount never finishes", async function failsSlowMount(): Promise<void> {
    const checkStage = await startCheckStage();
    const reported = { done: false };

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    void reporting.then(markReported.bind(undefined, reported));
    await attachCheckingFrame(checkStage);
    await vi.advanceTimersByTimeAsync(CHECK_MOUNT_LIMIT_MS - 1);
    const reportedEarly = reported.done;
    await vi.advanceTimersByTimeAsync(1);
    const report = await reporting;

    expect(CHECK_MOUNT_LIMIT_MS).toBe(10000);
    expect(reportedEarly).toBe(false);
    expect(report.status).toBe("fail");
    expect(report.findings).toEqual([
      {
        step: "mount",
        level: "error",
        source: SAMPLE_MOD_SOURCE,
        message: "The mod's mount did not finish within 10 seconds.",
      },
    ]);
  });

  it("waits 1 second after mount and records a request sent within it", async function recordsDuringSettle(): Promise<void> {
    const checkStage = await startCheckStage();
    const reported = { done: false };

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    void reporting.then(markReported.bind(undefined, reported));
    const checkFrame = await attachCheckingFrame(checkStage);
    sendNotification(checkFrame, "sandbox.mounted", {});
    await waitForMessages();
    await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS / 2);
    sendRequest(checkFrame, 1, "tiles.delete", {});
    await waitForReceived(checkFrame, 1);
    const reportedEarly = reported.done;
    await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS / 2);
    const report = await reporting;

    expect(CHECK_SETTLE_MS).toBe(1000);
    expect(reportedEarly).toBe(false);
    expect(listFindingMessages(report)[0]).toContain("tiles.delete");
  });

  it("records a frame that loads again as a stopped mod", async function recordsLeftPage(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    await attachCheckingFrame(checkStage);
    const entry = readStageSnapshot(checkStage.stage).checks[0];
    checkFrameLoadedAgain(checkStage.stage, entry.id);
    const report = await reporting;

    expect(report.status).toBe("fail");
    expect(report.mountChecked).toBe(true);
    expect(report.findings).toEqual([
      {
        step: "mount",
        level: "error",
        source: SAMPLE_MOD_SOURCE,
        message: "The mod left its page and was stopped.",
      },
    ]);
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });
});

describe("Requests that need the user", function describeUserRequests(): void {
  it("Mod asks for a confirmation while mounting", async function answersConfirm(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendRequest(checkFrame, 1, "ui.confirm", { message: "Delete?" });
    await waitForReceived(checkFrame, 1);
    const action = readStageSnapshot(checkStage.stage).action;
    await finishMount(checkFrame);
    const report = await reporting;

    expect(action).toBeNull();
    expect(checkFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: false },
    ]);
    expect(report.status).toBe("warn");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      step: "mount",
      level: "warning",
    });
    expect(report.findings[0].message).toContain("ui.confirm");
  });

  it("answers links.open and files.save false, and refuses mods.open and mods.check", async function answersUserRequests(): Promise<void> {
    serveOpeningMod();
    const checkStage = await startCheckStage();
    const sandboxCount = readStageSnapshot(checkStage.stage).sandboxes.length;

    const reporting = startCheck(checkStage, {
      source: OPENING_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendRequest(checkFrame, 1, "links.open", { url: "https://example.org/" });
    sendRequest(checkFrame, 2, "files.save", { name: "a.txt", content: "x" });
    sendRequest(checkFrame, 3, "mods.open", { mod: "mod_viewer" });
    sendRequest(checkFrame, 4, "mods.check", { mod: "mod_viewer" });
    await waitForReceived(checkFrame, 4);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(checkFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: false },
      { jsonrpc: "2.0", id: 2, result: false },
      {
        jsonrpc: "2.0",
        id: 3,
        error: { code: -32002, message: expect.any(String) },
      },
      {
        jsonrpc: "2.0",
        id: 4,
        error: { code: -32002, message: expect.any(String) },
      },
    ]);
    const messages = listFindingMessages(report);
    expect(messages).toHaveLength(4);
    expect(messages[0]).toContain("links.open");
    expect(messages[1]).toContain("files.save");
    expect(messages[2]).toContain("mods.open");
    expect(messages[3]).toContain("mods.check");
    expect(report.status).toBe("warn");
    expect(readStageSnapshot(checkStage.stage).sandboxes).toHaveLength(
      sandboxCount,
    );
  });
});

describe("Throwaway storage slot", function describeThrowawaySlot(): void {
  it("Real slot untouched", async function keepsRealSlot(): Promise<void> {
    const checkStage = await startCheckStage();
    writeModValue(
      checkStage.storage,
      SAMPLE_MOD_SOURCE,
      "selected",
      "kallocain",
    );
    const storedItems = new Map(checkStage.storage.items);

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendRequest(checkFrame, 1, "storage.get", { key: "selected" });
    sendRequest(checkFrame, 2, "storage.set", {
      key: "selected",
      value: "fictions",
    });
    await waitForReceived(checkFrame, 2);
    await finishMount(checkFrame);
    await reporting;

    expect(checkFrame.received[0]).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: null,
    });
    expect(checkStage.storage.items).toEqual(storedItems);
    expect(
      readModValue(checkStage.storage, SAMPLE_MOD_SOURCE, "selected"),
    ).toBe("kallocain");
  });
});

describe("A check leaves the stage unchanged", function describeStageUnchanged(): void {
  it("Viewer stays visible", async function keepsViewerVisible(): Promise<void> {
    const checkStage = await startCheckStage();
    const before = readStageSnapshot(checkStage.stage);
    const historyBefore = structuredClone(checkStage.history.entries);

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    sendNotification(checkFrame, "sandbox.mountFailed", {
      message: "map failed",
    });
    await waitForMessages();
    const during = readStageSnapshot(checkStage.stage);
    await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS);
    await reporting;
    const after = readStageSnapshot(checkStage.stage);

    expect(during.sandboxes).toEqual(before.sandboxes);
    expect(after.sandboxes).toEqual(before.sandboxes);
    expect(after.visible).toEqual(before.visible);
    expect(after.action).toBeNull();
    expect(checkStage.history.entries).toEqual(historyBefore);
    expect(checkStage.stage.runtimes.size).toBe(1);
  });

  it("closing the requester ends its checks", async function endsChecksOfClosedRequester(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    await attachCheckingFrame(checkStage);
    closeSandbox(checkStage.stage, checkStage.requesterId);
    const report = await reporting;

    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(report.mountChecked).toBe(true);
  });

  it("mounts nothing when the requester closed during the bundle check", async function skipsMountForClosedRequester(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    closeSandbox(checkStage.stage, checkStage.requesterId);
    const report = await reporting;

    expect(report.mountChecked).toBe(false);
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });
});
