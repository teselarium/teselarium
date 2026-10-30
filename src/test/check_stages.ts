import { vi } from "vitest";
import type { Mock } from "vitest";
import type {
  ModCheckReport,
  ModCheckRequest,
  ModContext,
} from "../lib/core/engine/index.ts";
import {
  attachCheckFrame,
  createStage,
  followHistory,
  readStageSnapshot,
} from "../lib/core/stage/index.ts";
import type { CheckSnapshot, Stage } from "../lib/core/stage/index.ts";
import { CHECK_SETTLE_MS } from "../lib/core/stage/stage_checks.ts";
import { checkStageMod } from "../lib/core/stage/stage_controller.ts";
import type { SandboxTestParams } from "../lib/core/sandbox/index.ts";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "./fake_frames.ts";
import { FakeHistory } from "./fake_history.ts";
import { createMemoryStorage } from "./memory_storage.ts";
import type { MemoryStorage } from "./memory_storage.ts";
import { APP_BASE_URL } from "./sample_files.ts";
import { APP_ORIGIN } from "./sample_mods.ts";
import { fetchTestFile, readRequestedUrl } from "./test_files.ts";
import { PAGE_HOME_ROUTING } from "./test_stages.ts";

/** The mod viewer, granted `open` for `"*"`: the visible mod that asks for checks. */
const VIEWER_HASH = "#/run?mod=mod_viewer";

/** A stage showing the mod viewer, which asks for checks, with its spies. */
export interface CheckStage {
  stage: Stage;
  history: FakeHistory;
  storage: MemoryStorage;
  fetchSpy: Mock<typeof fetch>;
  requesterId: string;
}

/** A fake check frame: the test plays the frame loader, or the test runner, through the mod's port. */
export interface PlayedCheckFrame {
  key: string;
  modPort: MessagePort;
  received: unknown[];
  context: ModContext;
  /** The `test` of the frame's `sandbox.connect`, or `null` for the mount check's frame. */
  test: SandboxTestParams | null;
}

/** The mod ports of the played frames. Each test file closes them after each test with `closeCheckPorts`. */
const checkPorts: MessagePort[] = [];

/** Keeps a port to close after the test, such as the requester's. */
export function trackCheckPort(port: MessagePort): void {
  checkPorts.push(port);
}

export function closeCheckPorts(): void {
  for (const port of checkPorts) {
    port.close();
  }
  checkPorts.length = 0;
}

/** A stage showing the mod viewer, whose launch settled. */
export async function startCheckStage(): Promise<CheckStage> {
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
    loadsTileLinkedMedia: true,
  });
  followHistory(stage, history.hash, history.state);
  for (const runtime of stage.runtimes.values()) {
    await runtime.settled;
  }
  const requesterId = readStageSnapshot(stage).sandboxes[0].id;
  const checkStage = { stage, history, storage, fetchSpy, requesterId };
  return checkStage;
}

export function listRequestedUrls(fetchSpy: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of fetchSpy.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

/** Waits until the stage's snapshot lists a check frame other than `previousKey`. */
export async function waitForCheckEntry(
  stage: Stage,
  previousKey: string | null = null,
): Promise<CheckSnapshot> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const entry = readStageSnapshot(stage).checks[0];
    if (entry !== undefined && entry.key !== previousKey) {
      return entry;
    }
    await waitForMessages();
  }
  throw new Error("Expected the stage to list a check frame");
}

/**
 * Attaches a fake frame to the check's frame listed after `previousKey`,
 * playing the frame loader, or the test runner, through the mod's port.
 */
export async function attachCheckingFrame(
  checkStage: CheckStage,
  previousKey: string | null = null,
): Promise<PlayedCheckFrame> {
  const entry = await waitForCheckEntry(checkStage.stage, previousKey);
  const fakeFrame = createFakeFrame();
  attachCheckFrame(checkStage.stage, entry.id, entry.key, fakeFrame.target);
  const modPort = readModPort(fakeFrame);
  checkPorts.push(modPort);
  const connect = fakeFrame.posted[0].message as {
    params: { context: ModContext; test?: SandboxTestParams };
  };
  const checkFrame: PlayedCheckFrame = {
    key: entry.key,
    modPort,
    received: collectMessages(modPort),
    context: connect.params.context,
    test: connect.params.test ?? null,
  };
  return checkFrame;
}

export function sendNotification(
  checkFrame: PlayedCheckFrame,
  method: string,
  params: object,
): void {
  checkFrame.modPort.postMessage({ jsonrpc: "2.0", method, params });
}

export function sendRequest(
  checkFrame: PlayedCheckFrame,
  id: number,
  method: string,
  params: object,
): void {
  checkFrame.modPort.postMessage({ jsonrpc: "2.0", id, method, params });
}

/** Waits until the mod side received `count` messages. */
export async function waitForReceived(
  checkFrame: PlayedCheckFrame,
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
export async function finishMount(checkFrame: PlayedCheckFrame): Promise<void> {
  sendNotification(checkFrame, "sandbox.mounted", {});
  await waitForMessages();
  await vi.advanceTimersByTimeAsync(CHECK_SETTLE_MS);
}

export function listFindingMessages(report: ModCheckReport): string[] {
  const messages: string[] = [];
  for (const finding of report.findings) {
    messages.push(finding.message);
  }
  return messages;
}

/** Asks the stage to check a mod for the viewer. */
export function startCheck(
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

/**
 * Plays the mount check of a mod with tests and its list frame, which
 * reports `names`. Returns the first case's frame.
 */
export async function startCases(
  checkStage: CheckStage,
  names: string[],
): Promise<PlayedCheckFrame> {
  const mountFrame = await attachCheckingFrame(checkStage);
  await finishMount(mountFrame);
  const listFrame = await attachCheckingFrame(checkStage, mountFrame.key);
  sendNotification(listFrame, "sandbox.testsListed", { names });
  await waitForMessages();
  const caseFrame = await attachCheckingFrame(checkStage, listFrame.key);
  return caseFrame;
}

/** Plays the end of a case: `sandbox.caseFinished` with `message`, `null` for a pass. */
export async function finishPlayedCase(
  caseFrame: PlayedCheckFrame,
  message: string | null,
): Promise<void> {
  sendNotification(caseFrame, "sandbox.caseFinished", {
    status: message === null ? "pass" : "fail",
    message,
  });
  await waitForMessages();
}
