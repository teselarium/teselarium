import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachCheckingFrame,
  closeCheckPorts,
  finishMount,
  finishPlayedCase,
  listFindingMessages,
  sendNotification,
  sendRequest,
  startCases,
  startCheck,
  startCheckStage,
  waitForReceived,
} from "../../../test/check_stages.ts";
import type {
  CheckStage,
  PlayedCheckFrame,
} from "../../../test/check_stages.ts";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_MOSAIC_SOURCE,
  serveTestedMod,
  TESTED_MOD_SOURCE,
  TESTED_MOD_TEST_SOURCE,
} from "../../../test/sample_mods.ts";
import { testTexts } from "../../../test/test_files.ts";
import type { ModCheckReport } from "../engine/index.ts";
import { CHECK_CASE_LIMIT_MS } from "./stage_check_cases.ts";
import {
  checkFrameLoadedAgain,
  readStageSnapshot,
} from "./stage_controller.ts";

beforeEach(function useFakeTimers(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(function cleanUp(): void {
  vi.useRealTimers();
  testTexts.clear();
  closeCheckPorts();
});

interface CaseCheck {
  checkStage: CheckStage;
  reporting: Promise<ModCheckReport>;
  caseFrame: PlayedCheckFrame;
}

/** Checks the tested mod up to the frame of its first case, whose list reported `names`. */
async function startCaseCheck(names: string[]): Promise<CaseCheck> {
  serveTestedMod();
  const checkStage = await startCheckStage();
  const reporting = startCheck(checkStage, {
    source: TESTED_MOD_SOURCE,
    collection: null,
  });
  const caseFrame = await startCases(checkStage, names);
  const caseCheck: CaseCheck = { checkStage, reporting, caseFrame };
  return caseCheck;
}

function queueAnswer(
  caseFrame: PlayedCheckFrame,
  method: string,
  value: unknown,
): void {
  sendNotification(caseFrame, "sandbox.answerQueued", { method, value });
}

function markReported(reported: { done: boolean }): void {
  reported.done = true;
}

describe("Case frames", function describeCaseFrames(): void {
  it("connects a case frame with the test code and the case's name", async function connectsCase(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["lists books"]);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.test).toEqual({
      code: testTexts.get(TESTED_MOD_TEST_SOURCE),
      caseName: "lists books",
    });
    expect(report.tests).toEqual([
      { name: "lists books", status: "pass", message: null },
    ]);
  });
});

describe("Scripted answers", function describeScriptedAnswers(): void {
  it("Confirm answered yes", async function answersConfirmYes(): Promise<void> {
    const { checkStage, caseFrame, reporting } = await startCaseCheck([
      "deletes a book",
    ]);

    queueAnswer(caseFrame, "ui.confirm", true);
    sendRequest(caseFrame, 1, "ui.confirm", { message: "Delete?" });
    await waitForReceived(caseFrame, 1);
    const action = readStageSnapshot(checkStage.stage).action;
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: true },
    ]);
    expect(action).toBeNull();
    expect(report.findings).toEqual([]);
    expect(report.status).toBe("pass");
  });

  it("No answer queued", async function answersConfirmNo(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["deletes a book"]);

    sendRequest(caseFrame, 1, "ui.confirm", { message: "Delete?" });
    await waitForReceived(caseFrame, 1);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: false },
    ]);
    expect(report.findings).toEqual([]);
  });

  it("uses each queued answer once, in order", async function usesAnswersInOrder(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["deletes a book"]);

    queueAnswer(caseFrame, "ui.confirm", true);
    queueAnswer(caseFrame, "ui.confirm", false);
    sendRequest(caseFrame, 1, "ui.confirm", { message: "Delete?" });
    sendRequest(caseFrame, 2, "ui.confirm", { message: "Really?" });
    sendRequest(caseFrame, 3, "ui.confirm", { message: "Sure?" });
    await waitForReceived(caseFrame, 3);
    await finishPlayedCase(caseFrame, null);
    await reporting;

    expect(caseFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: true },
      { jsonrpc: "2.0", id: 2, result: false },
      { jsonrpc: "2.0", id: 3, result: false },
    ]);
  });

  it("answers links.open, files.save and mods.open with the queued answers, and opens nothing", async function answersQueued(): Promise<void> {
    const { checkStage, caseFrame, reporting } = await startCaseCheck([
      "shares a book",
    ]);
    const sandboxCount = readStageSnapshot(checkStage.stage).sandboxes.length;

    queueAnswer(caseFrame, "links.open", true);
    queueAnswer(caseFrame, "files.save", true);
    queueAnswer(caseFrame, "mods.open", null);
    sendRequest(caseFrame, 1, "links.open", { url: "https://example.org/" });
    sendRequest(caseFrame, 2, "files.save", { name: "a.txt", content: "x" });
    sendRequest(caseFrame, 3, "mods.open", { mod: "mod_viewer" });
    sendRequest(caseFrame, 4, "mods.open", { mod: "mod_viewer" });
    await waitForReceived(caseFrame, 4);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: true },
      { jsonrpc: "2.0", id: 2, result: true },
      { jsonrpc: "2.0", id: 3, result: null },
      {
        jsonrpc: "2.0",
        id: 4,
        error: { code: -32002, message: expect.any(String) },
      },
    ]);
    expect(readStageSnapshot(checkStage.stage).sandboxes).toHaveLength(
      sandboxCount,
    );
    expect(readStageSnapshot(checkStage.stage).action).toBeNull();
    expect(report.findings).toEqual([]);
  });

  it("answers mosaics.open only with an answer queued for it", async function answersQueuedMosaicOpen(): Promise<void> {
    const { checkStage, caseFrame, reporting } = await startCaseCheck([
      "opens a mosaic",
    ]);
    const sandboxCount = readStageSnapshot(checkStage.stage).sandboxes.length;

    queueAnswer(caseFrame, "mods.open", null);
    sendRequest(caseFrame, 1, "mosaics.open", { mosaic: "./m.yaml" });
    queueAnswer(caseFrame, "mosaics.open", null);
    sendRequest(caseFrame, 2, "mosaics.open", { mosaic: "./m.yaml" });
    await waitForReceived(caseFrame, 2);
    await finishPlayedCase(caseFrame, null);
    await reporting;

    expect(caseFrame.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32002, message: expect.any(String) },
      },
      { jsonrpc: "2.0", id: 2, result: null },
    ]);
    expect(readStageSnapshot(checkStage.stage).sandboxes).toHaveLength(
      sandboxCount,
    );
  });

  it("keeps a queued links.open answer when the URL is bad", async function keepsAnswerForBadUrl(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["opens a link"]);

    queueAnswer(caseFrame, "links.open", true);
    sendRequest(caseFrame, 1, "links.open", { url: "ftp://example.org/" });
    sendRequest(caseFrame, 2, "links.open", { url: "https://example.org/" });
    await waitForReceived(caseFrame, 2);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: expect.any(String) },
      },
      { jsonrpc: "2.0", id: 2, result: true },
    ]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ step: "test", level: "error" });
    expect(report.findings[0].message).toContain('In the test "opens a link"');
    expect(report.findings[0].message).toContain("-32602");
  });

  it("answers catalog.list with the queued catalog", async function answersQueuedCatalog(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["lists mods"]);
    const catalog = {
      mods: [{ source: "./default_mods/mod_explorer/fixtures/listed_mod" }],
      collections: [],
      mosaics: [],
    };

    queueAnswer(caseFrame, "catalog.list", catalog);
    sendRequest(caseFrame, 1, "catalog.list", {});
    await waitForReceived(caseFrame, 1);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: catalog },
    ]);
    expect(report.findings).toEqual([]);
  });

  it("Case without a scripted catalog", async function answersAppCatalog(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["lists mods"]);
    const catalog = { mods: [], collections: [], mosaics: [] };

    queueAnswer(caseFrame, "catalog.list", catalog);
    sendRequest(caseFrame, 1, "catalog.list", {});
    sendRequest(caseFrame, 2, "catalog.list", {});
    await waitForReceived(caseFrame, 2);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      { jsonrpc: "2.0", id: 1, result: catalog },
      {
        jsonrpc: "2.0",
        id: 2,
        result: {
          mods: [{ source: SAMPLE_MOD_SOURCE }],
          collections: [{ source: SAMPLE_COLLECTION_SOURCE }],
          mosaics: [{ source: SAMPLE_MOSAIC_SOURCE, defaultOf: null }],
        },
      },
    ]);
    expect(report.findings).toEqual([]);
  });

  it("refuses mods.check from a case without a finding", async function refusesCheck(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["checks a mod"]);

    sendRequest(caseFrame, 1, "mods.check", { mod: "mod_viewer" });
    await waitForReceived(caseFrame, 1);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received).toEqual([
      {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32002, message: expect.any(String) },
      },
    ]);
    expect(report.findings).toEqual([]);
    expect(report.status).toBe("pass");
  });
});

describe("What a case records", function describeCaseRecords(): void {
  it("Unknown method in a case", async function recordsUnknownMethod(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["deletes a book"]);

    sendRequest(caseFrame, 1, "tiles.delete", {});
    await waitForReceived(caseFrame, 1);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(report.status).toBe("fail");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      step: "test",
      level: "error",
      source: TESTED_MOD_SOURCE,
    });
    expect(report.findings[0].message).toContain("deletes a book");
    expect(report.findings[0].message).toContain("tiles.delete");
    expect(report.findings[0].message).toContain("Unknown method");
  });

  it("Expected error notification", async function recordsNoNotification(): Promise<void> {
    const { caseFrame, reporting, checkStage } = await startCaseCheck([
      "warns without books",
    ]);
    const before = readStageSnapshot(checkStage.stage).sandboxes[0].messages;

    sendRequest(caseFrame, 1, "ui.notify", {
      message: "No books found",
      level: "error",
    });
    await waitForReceived(caseFrame, 1);
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(caseFrame.received[0]).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: null,
    });
    expect(report.status).toBe("pass");
    expect(report.findings).toEqual([]);
    expect(readStageSnapshot(checkStage.stage).sandboxes[0].messages).toEqual(
      before,
    );
  });

  it("Blocked image in a case", async function recordsBlockedImage(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["shows covers"]);

    sendNotification(caseFrame, "sandbox.blocked", {
      blockedUrl: "https://images.example.net/cover.jpg",
      directive: "img-src",
    });
    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(report.status).toBe("warn");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      step: "test",
      level: "warning",
      source: TESTED_MOD_SOURCE,
    });
    expect(report.findings[0].message).toBe(
      'In the test "shows covers": Blocked image request to https://images.example.net. Add it to permissions.show in mod_conf.yaml. If a tile links this file, link its final address: links that redirect to another site are blocked.',
    );
  });

  it("Expected mount failure", async function recordsNoMountFailure(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["fails to mount"]);

    await finishPlayedCase(caseFrame, null);
    const report = await reporting;

    expect(report.status).toBe("pass");
    expect(report.findings).toEqual([]);
    expect(report.tests).toEqual([
      { name: "fails to mount", status: "pass", message: null },
    ]);
  });

  it("records a case's findings before its failure", async function ordersFindings(): Promise<void> {
    const { caseFrame, reporting } = await startCaseCheck(["deletes a book"]);

    sendRequest(caseFrame, 1, "tiles.delete", {});
    await waitForReceived(caseFrame, 1);
    await finishPlayedCase(caseFrame, "no books");
    const report = await reporting;

    const messages = listFindingMessages(report);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("tiles.delete");
    expect(messages[1]).toBe('The test "deletes a book" failed: no books');
    expect(report.findings[1].source).toBe(TESTED_MOD_TEST_SOURCE);
  });
});

describe("Case limits", function describeCaseLimits(): void {
  it("Case too long", async function failsLongCase(): Promise<void> {
    const { reporting } = await startCaseCheck(["waits forever"]);
    const reported = { done: false };
    void reporting.then(markReported.bind(undefined, reported));

    await vi.advanceTimersByTimeAsync(CHECK_CASE_LIMIT_MS - 1);
    const reportedEarly = reported.done;
    await vi.advanceTimersByTimeAsync(1);
    const report = await reporting;

    expect(CHECK_CASE_LIMIT_MS).toBe(10000);
    expect(reportedEarly).toBe(false);
    expect(report.tests).toEqual([
      {
        name: "waits forever",
        status: "fail",
        message: "The test did not finish within 10 seconds.",
      },
    ]);
    expect(report.findings).toEqual([
      {
        step: "test",
        level: "error",
        source: TESTED_MOD_TEST_SOURCE,
        message:
          'The test "waits forever" failed: The test did not finish within 10 seconds.',
      },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails a case whose frame loads again, and runs the next one", async function failsReloadedCase(): Promise<void> {
    const { checkStage, caseFrame, reporting } = await startCaseCheck([
      "leaves the page",
      "lists books",
    ]);

    checkFrameLoadedAgain(
      checkStage.stage,
      readStageSnapshot(checkStage.stage).checks[0].id,
      caseFrame.key,
    );
    const secondFrame = await attachCheckingFrame(checkStage, caseFrame.key);
    await finishPlayedCase(secondFrame, null);
    const report = await reporting;

    expect(report.tests).toEqual([
      {
        name: "leaves the page",
        status: "fail",
        message: "The mod left its page and was stopped.",
      },
      { name: "lists books", status: "pass", message: null },
    ]);
    expect(secondFrame.test?.caseName).toBe("lists books");
  });

  it("ends the check with a test error when the list frame never reports", async function failsSilentList(): Promise<void> {
    serveTestedMod();
    const checkStage = await startCheckStage();
    const reporting = startCheck(checkStage, {
      source: TESTED_MOD_SOURCE,
      collection: null,
    });
    const mountFrame = await attachCheckingFrame(checkStage);
    await finishMount(mountFrame);
    const listFrame = await attachCheckingFrame(checkStage, mountFrame.key);

    await vi.advanceTimersByTimeAsync(CHECK_CASE_LIMIT_MS);
    const report = await reporting;

    expect(listFrame.test).toEqual({
      code: testTexts.get(TESTED_MOD_TEST_SOURCE),
      caseName: null,
    });
    expect(report.testsChecked).toBe(false);
    expect(report.tests).toEqual([]);
    expect(report.findings).toEqual([
      {
        step: "test",
        level: "error",
        source: TESTED_MOD_TEST_SOURCE,
        message: "The test file did not register its tests within 10 seconds.",
      },
    ]);
    expect(readStageSnapshot(checkStage.stage).checks).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
