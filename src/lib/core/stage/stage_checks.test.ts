import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachCheckingFrame,
  closeCheckPorts,
  finishMount,
  finishPlayedCase,
  listFindingMessages,
  listRequestedUrls,
  sendNotification,
  sendRequest,
  startCheck,
  startCases,
  startCheckStage,
  trackCheckPort,
  waitForCheckEntry,
  waitForReceived,
} from "../../../test/check_stages.ts";
import type {
  CheckStage,
  PlayedCheckFrame,
} from "../../../test/check_stages.ts";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../../test/fake_frames.ts";
import { createMemorySiteDecisions } from "../../../test/memory_site_decisions.ts";
import { FIXTURES_BASE_URL } from "../../../test/sample_files.ts";
import {
  buildProbeDecision,
  COVER_BOOK_COLLECTION_SOURCE,
  COVER_BOOK_IMAGE_URL,
  MISSING_TYPE_MOD_SOURCE,
  PROBE_MOD_SOURCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  serveCoverBook,
  serveMissingTypeMod,
  serveProbeMod,
  serveTestMod,
  serveTwoBooks,
  serveTestedMod,
  serveUntypedMod,
  TESTED_MOD_SOURCE,
  TESTED_MOD_TEST_SOURCE,
  TWO_BOOKS_REFERENCE,
  TWO_BOOKS_SOURCE,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import { testTexts } from "../../../test/test_files.ts";
import type { ModCheckReport, ModContext } from "../engine/index.ts";
import { readModValue, writeModValue } from "../storage/index.ts";
import {
  attachCheckFrame,
  attachFrame,
  changeStageTileLinkedMedia,
  checkFrameLoadedAgain,
  checkStageMod,
  closeSandbox,
  readStageSnapshot,
} from "./stage_controller.ts";
import type { Stage } from "./stage_controller.ts";
import { CHECK_MOUNT_LIMIT_MS, CHECK_SETTLE_MS } from "./stage_checks.ts";

/** A fixture mod on the app's origin with `open` for `"*"`, so its `mods.open` reaches the stage. */
const OPENING_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/opening/mod_conf.yaml`;

beforeEach(function useFakeTimers(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(function cleanUp(): void {
  vi.useRealTimers();
  testTexts.clear();
  closeCheckPorts();
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

function listTileSources(context: ModContext): string[] {
  const tileSources: string[] = [];
  for (const tile of context.tiles) {
    tileSources.push(tile.source);
  }
  return tileSources;
}

function listSiteConsents(stage: Stage): unknown[] {
  const siteConsents: unknown[] = [];
  for (const sandbox of readStageSnapshot(stage).sandboxes) {
    siteConsents.push(sandbox.siteConsent);
  }
  return siteConsents;
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
      testsChecked: false,
      tests: [],
      findings: [],
    });
    expect(listTileSources(checkFrame.context)).toEqual(SAMPLE_TILE_SOURCES);
    expect(checkFrame.context.mod.source).toBe(SAMPLE_MOD_SOURCE);
    expect(checkFrame.context.params).toEqual({});
  });

  it("Check a foreign mod without decisions", async function checksForeignMod(): Promise<void> {
    serveProbeMod();
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: PROBE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(checkFrame.context.permissions).toEqual({
      granted: [],
      denied: [SAMPLE_COVERS_PERMISSION],
    });
    expect(listSiteConsents(checkStage.stage)).toEqual([null]);
    expect(checkStage.siteDecisions.decisions).toEqual([]);
  });

  it("Check a foreign mod with a remembered allow", async function checksRememberedAllow(): Promise<void> {
    serveProbeMod();
    const checkStage = await startCheckStage(
      createMemorySiteDecisions([
        buildProbeDecision(SAMPLE_COVERS_PERMISSION, true),
      ]),
    );

    const reporting = startCheck(checkStage, {
      source: PROBE_MOD_SOURCE,
      collection: null,
    });
    const entry = await waitForCheckEntry(checkStage.stage);
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(checkFrame.context.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [],
    });
    expect(entry.sandboxDocument).toContain("https://upload.wikimedia.org");
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
    trackCheckPort(requesterPort);
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
          testsChecked: false,
          tests: [],
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

  it("Mount check gets the resolved tiles", async function givesResolvedTiles(): Promise<void> {
    serveCoverBook();
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: COVER_BOOK_COLLECTION_SOURCE,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(checkFrame.context.tiles).toHaveLength(1);
    expect(checkFrame.context.tiles[0].metadata.image).toBe(
      COVER_BOOK_IMAGE_URL,
    );
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

describe("Media linked by tiles", function describeCheckTileLinks(): void {
  it("gives the check frame the policy with the tile links", async function givesTileLinkPolicy(): Promise<void> {
    serveUntypedMod();
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: UNTYPED_MOD_SOURCE,
      collection: SAMPLE_COLLECTION_SOURCE,
    });
    const entry = await waitForCheckEntry(checkStage.stage);
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(entry.sandboxDocument).toContain(
      "img-src data: blob: https://example.org https://upload.wikimedia.org/wikipedia/en/a/ab/KallocainCover.jpg",
    );
  });

  it("gives the check frame no tile links with the setting off", async function omitsTileLinkPolicy(): Promise<void> {
    serveUntypedMod();
    const checkStage = await startCheckStage();
    changeStageTileLinkedMedia(checkStage.stage, false);

    const reporting = startCheck(checkStage, {
      source: UNTYPED_MOD_SOURCE,
      collection: SAMPLE_COLLECTION_SOURCE,
    });
    const entry = await waitForCheckEntry(checkStage.stage);
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    await reporting;

    expect(entry.sandboxDocument).toContain(
      "img-src data: blob: https://example.org;",
    );
    expect(entry.sandboxDocument).not.toContain("upload.wikimedia.org");
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
    checkFrameLoadedAgain(checkStage.stage, entry.id, entry.key);
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

describe("Check frame keys", function describeCheckFrameKeys(): void {
  it("ignores a frame whose key is not the check's frame", async function ignoresStaleKey(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const entry = await waitForCheckEntry(checkStage.stage);
    const staleFrame = createFakeFrame();
    attachCheckFrame(
      checkStage.stage,
      entry.id,
      `${entry.key}-replaced`,
      staleFrame.target,
    );
    checkFrameLoadedAgain(checkStage.stage, entry.id, `${entry.key}-replaced`);
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(entry.key).toBe(checkFrame.key);
    expect(staleFrame.posted).toEqual([]);
    expect(report.status).toBe("pass");
    expect(report.findings).toEqual([]);
  });

  it("ignores a second attach of the same frame", async function ignoresSecondAttach(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    const secondFrame = createFakeFrame();
    attachCheckFrame(
      checkStage.stage,
      readStageSnapshot(checkStage.stage).checks[0].id,
      checkFrame.key,
      secondFrame.target,
    );
    await finishMount(checkFrame);
    await reporting;

    expect(secondFrame.posted).toEqual([]);
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

/** Checks the tested mod for the viewer. */
function startTestedCheck(checkStage: CheckStage): Promise<ModCheckReport> {
  return startCheck(checkStage, {
    source: TESTED_MOD_SOURCE,
    collection: null,
  });
}

/** Plays the cases one after another, each ending with its message, `null` for a pass. */
async function playCases(
  checkStage: CheckStage,
  firstFrame: PlayedCheckFrame,
  messages: (string | null)[],
): Promise<PlayedCheckFrame[]> {
  const caseFrames: PlayedCheckFrame[] = [];
  let caseFrame = firstFrame;
  for (const message of messages) {
    caseFrames.push(caseFrame);
    await finishPlayedCase(caseFrame, message);
    if (caseFrames.length < messages.length) {
      caseFrame = await attachCheckingFrame(checkStage, caseFrame.key);
    }
  }
  return caseFrames;
}

/** Plays the mount check of the tested mod and a list frame that fails with `message`. */
async function failListing(
  checkStage: CheckStage,
  message: string,
): Promise<ModCheckReport> {
  const reporting = startTestedCheck(checkStage);
  const mountFrame = await attachCheckingFrame(checkStage);
  await finishMount(mountFrame);
  const listFrame = await attachCheckingFrame(checkStage, mountFrame.key);
  sendNotification(listFrame, "sandbox.testsFailed", { message });
  const report = await reporting;
  return report;
}

describe("Tests run in the check", function describeTestsInCheck(): void {
  it("Mod without tests", async function checksModWithoutTests(): Promise<void> {
    const checkStage = await startCheckStage();

    const reporting = startCheck(checkStage, {
      source: SAMPLE_MOD_SOURCE,
      collection: null,
    });
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(report.testsChecked).toBe(false);
    expect(report.tests).toEqual([]);
    expect(report.findings).toEqual([]);
    expect(checkFrame.test).toBeNull();
  });

  it("Mount error skips the tests", async function skipsTestsAfterMountError(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const checkFrame = await attachCheckingFrame(checkStage);
    sendNotification(checkFrame, "sandbox.mountFailed", {
      message: "map failed",
    });
    await waitForMessages();
    await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS);
    const report = await reporting;

    expect(report.mountChecked).toBe(true);
    expect(report.testsChecked).toBe(false);
    expect(report.tests).toEqual([]);
    expect(listRequestedUrls(checkStage.fetchSpy)).not.toContain(
      TESTED_MOD_TEST_SOURCE,
    );
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });

  it("fetches the test file only after the mount check", async function fetchesTestsAfterMount(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const mountFrame = await attachCheckingFrame(checkStage);
    const requestedWhileMounting = listRequestedUrls(checkStage.fetchSpy);
    await finishMount(mountFrame);
    const listFrame = await attachCheckingFrame(checkStage, mountFrame.key);
    sendNotification(listFrame, "sandbox.testsListed", { names: ["first"] });
    const caseFrame = await attachCheckingFrame(checkStage, listFrame.key);
    await finishPlayedCase(caseFrame, null);
    await reporting;

    expect(requestedWhileMounting).not.toContain(TESTED_MOD_TEST_SOURCE);
    expect(listRequestedUrls(checkStage.fetchSpy)).toContain(
      TESTED_MOD_TEST_SOURCE,
    );
  });

  it("Missing test file", async function reportsMissingTestFile(): Promise<void> {
    serveTestedMod(null);
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const checkFrame = await attachCheckingFrame(checkStage);
    await finishMount(checkFrame);
    const report = await reporting;

    expect(report.mountChecked).toBe(true);
    expect(report.testsChecked).toBe(false);
    expect(report.status).toBe("fail");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      step: "test",
      level: "error",
      source: TESTED_MOD_TEST_SOURCE,
    });
    expect(report.findings[0].message).toContain("404");
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });

  it("closing the requester during the tests ends the check", async function endsTestsOfClosedRequester(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const caseFrame = await startCases(checkStage, ["first", "second"]);
    closeSandbox(checkStage.stage, checkStage.requesterId);
    const report = await reporting;
    await waitForMessages();

    expect(caseFrame.test?.caseName).toBe("first");
    expect(report.tests).toEqual([]);
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Test file format", function describeTestFileFormat(): void {
  it("Syntax error", async function reportsSyntaxError(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const report = await failListing(checkStage, "Unexpected token '}'");

    expect(report.status).toBe("fail");
    expect(report.testsChecked).toBe(false);
    expect(report.findings).toEqual([
      {
        step: "test",
        level: "error",
        source: TESTED_MOD_TEST_SOURCE,
        message: "The tests could not be listed: Unexpected token '}'",
      },
    ]);
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });

  it("Repeated name", async function reportsRepeatedName(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const report = await failListing(
      checkStage,
      'the test file registers the test "lists books" twice',
    );

    expect(report.tests).toEqual([]);
    expect(listFindingMessages(report)[0]).toContain("lists books");
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });

  it("No case", async function reportsNoCase(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const report = await failListing(
      checkStage,
      "the test file registers no test",
    );

    expect(listFindingMessages(report)[0]).toContain(
      "the test file registers no test",
    );
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
  });

  it("treats an empty list of names as no case", async function reportsEmptyList(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const mountFrame = await attachCheckingFrame(checkStage);
    await finishMount(mountFrame);
    const listFrame = await attachCheckingFrame(checkStage, mountFrame.key);
    sendNotification(listFrame, "sandbox.testsListed", { names: [] });
    const report = await reporting;

    expect(report.testsChecked).toBe(false);
    expect(listFindingMessages(report)[0]).toContain(
      "the test file registers no test",
    );
  });
});

describe("Case results", function describeCaseResults(): void {
  it("One case fails", async function runsEveryCase(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const firstFrame = await startCases(checkStage, [
      "first",
      "second",
      "third",
    ]);
    const caseFrames = await playCases(checkStage, firstFrame, [
      null,
      "no books",
      null,
    ]);
    const report = await reporting;

    expect(report.tests).toEqual([
      { name: "first", status: "pass", message: null },
      { name: "second", status: "fail", message: "no books" },
      { name: "third", status: "pass", message: null },
    ]);
    const caseNames: (string | null)[] = [];
    const frameKeys = new Set<string>();
    for (const caseFrame of caseFrames) {
      caseNames.push(caseFrame.test?.caseName ?? null);
      frameKeys.add(caseFrame.key);
    }
    expect(caseNames).toEqual(["first", "second", "third"]);
    expect(frameKeys.size).toBe(3);
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("Failed case", async function failsReport(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const caseFrame = await startCases(checkStage, ["lists books"]);
    await finishPlayedCase(caseFrame, "no books");
    const report = await reporting;

    expect(report.status).toBe("fail");
    expect(report.testsChecked).toBe(true);
    expect(report.tests).toEqual([
      { name: "lists books", status: "fail", message: "no books" },
    ]);
  });

  it("Failed case in the findings", async function recordsFailedCase(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const caseFrame = await startCases(checkStage, ["lists books"]);
    await finishPlayedCase(caseFrame, "no books");
    const report = await reporting;

    expect(report.findings).toEqual([
      {
        step: "test",
        level: "error",
        source: TESTED_MOD_TEST_SOURCE,
        message: 'The test "lists books" failed: no books',
      },
    ]);
  });

  it("Passing case", async function passesReport(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const caseFrame = await startCases(checkStage, ["lists books"]);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(report).toEqual({
      source: TESTED_MOD_SOURCE,
      status: "pass",
      mountChecked: true,
      testsChecked: true,
      tests: [{ name: "lists books", status: "pass", message: null }],
      findings: [],
    });
  });

  it("fails a case whose name the test file no longer registers", async function failsMissingCase(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const caseFrame = await startCases(checkStage, ["random case"]);
    await finishPlayedCase(
      caseFrame,
      'the test file no longer registers the test "random case"',
    );
    const report = await reporting;

    expect(report.tests[0].status).toBe("fail");
    expect(report.tests[0].message).toContain("no longer registers");
  });
});

describe("Each case in a fresh frame", function describeFreshFrames(): void {
  it("Cases do not share storage", async function isolatesStorage(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();

    const reporting = startTestedCheck(checkStage);
    const firstFrame = await startCases(checkStage, ["stores", "reads"]);
    sendRequest(firstFrame, 1, "storage.set", {
      key: "selected",
      value: "kallocain",
    });
    await waitForReceived(firstFrame, 1);
    await finishPlayedCase(firstFrame, null);
    const secondFrame = await attachCheckingFrame(checkStage, firstFrame.key);
    sendRequest(secondFrame, 1, "storage.get", { key: "selected" });
    await waitForReceived(secondFrame, 1);
    await finishPlayedCase(secondFrame, null);
    await reporting;

    expect(secondFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: null },
    ]);
    expect(checkStage.storage.items.size).toBe(0);
  });
});
