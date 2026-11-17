import { describe, expect, it } from "vitest";
import {
  readBlockedDialog,
  readBlockedRequest,
  readMountFailure,
  readSandboxTestReport,
  SANDBOX_ANSWER_QUEUED_METHOD,
  SANDBOX_BLOCKED_METHOD,
  SANDBOX_CASE_FINISHED_METHOD,
  SANDBOX_CONNECT_METHOD,
  SANDBOX_DIALOG_BLOCKED_METHOD,
  SANDBOX_MOUNT_FAILED_METHOD,
  SANDBOX_MOUNTED_METHOD,
  SANDBOX_TESTS_FAILED_METHOD,
  SANDBOX_TESTS_LISTED_METHOD,
} from "./index.ts";
import { THEME_CHANGED_METHOD } from "../engine/index.ts";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";
import SANDBOX_TEST_RUNNER from "./sandbox_test_runner.js?raw";

describe("readBlockedRequest", function describeReadBlockedRequest(): void {
  it("reads the params the frame loader sends", function readsParams(): void {
    const blockedRequest = readBlockedRequest({
      blockedUrl: "https://images.example.net/cover.jpg",
      directive: "img-src",
    });

    expect(blockedRequest).toEqual({
      blockedUrl: "https://images.example.net/cover.jpg",
      directive: "img-src",
    });
  });

  it("gives null for a missing field", function rejectsMissingField(): void {
    expect(readBlockedRequest({ directive: "img-src" })).toBeNull();
  });

  it("gives null for a field that is not a string", function rejectsNumber(): void {
    expect(readBlockedRequest({ blockedUrl: 3, directive: "img-src" })).toBe(
      null,
    );
  });

  it("gives null for params that are not a mapping", function rejectsList(): void {
    expect(readBlockedRequest(["https://x.net", "img-src"])).toBeNull();
    expect(readBlockedRequest(null)).toBeNull();
    expect(readBlockedRequest(undefined)).toBeNull();
  });
});

describe("readMountFailure", function describeReadMountFailure(): void {
  it("reads the error message", function readsMessage(): void {
    expect(readMountFailure({ message: "map failed" })).toBe("map failed");
  });

  it("gives null for a missing message", function rejectsMissing(): void {
    expect(readMountFailure({})).toBeNull();
  });

  it("gives null for a message that is not a string", function rejectsNumber(): void {
    expect(readMountFailure({ message: 12 })).toBeNull();
  });

  it("gives null for params that are not a mapping", function rejectsText(): void {
    expect(readMountFailure("map failed")).toBeNull();
  });
});

describe("readBlockedDialog", function describeReadBlockedDialog(): void {
  it("reads each blocked function's name", function readsNames(): void {
    for (const name of ["alert", "confirm", "prompt", "print"]) {
      expect(readBlockedDialog({ name })).toBe(name);
    }
  });

  it("gives null for an unknown name", function rejectsUnknown(): void {
    expect(readBlockedDialog({ name: "open" })).toBeNull();
    expect(readBlockedDialog({ name: "toString" })).toBeNull();
  });

  it("gives null for params of the wrong shape", function rejectsShape(): void {
    expect(readBlockedDialog({})).toBeNull();
    expect(readBlockedDialog({ name: 3 })).toBeNull();
    expect(readBlockedDialog("alert")).toBeNull();
  });
});

describe("readSandboxTestReport", function describeReadTestReport(): void {
  it("reads the listed case names", function readsListed(): void {
    const report = readSandboxTestReport("sandbox.testsListed", {
      names: ["lists books", "highlights a book"],
    });

    expect(report).toEqual({
      kind: "listed",
      names: ["lists books", "highlights a book"],
    });
  });

  it("gives null for listed names of the wrong shape", function rejectsNames(): void {
    expect(readSandboxTestReport("sandbox.testsListed", {})).toBeNull();
    expect(
      readSandboxTestReport("sandbox.testsListed", { names: "lists books" }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.testsListed", { names: ["a", 3] }),
    ).toBeNull();
  });

  it("reads why there are no cases", function readsListFailure(): void {
    const report = readSandboxTestReport("sandbox.testsFailed", {
      message: "the test file registers no test",
    });

    expect(report).toEqual({
      kind: "listFailed",
      message: "the test file registers no test",
    });
  });

  it("gives null for a list failure without a message", function rejectsListFailure(): void {
    expect(readSandboxTestReport("sandbox.testsFailed", {})).toBeNull();
    expect(
      readSandboxTestReport("sandbox.testsFailed", { message: 3 }),
    ).toBeNull();
  });

  it("reads a boolean answer to each method that asks the user", function readsBooleanAnswers(): void {
    for (const method of [
      "links.open",
      "files.save",
      "ui.confirm",
      "players.open",
    ]) {
      const report = readSandboxTestReport("sandbox.answerQueued", {
        method,
        value: true,
      });

      expect(report).toEqual({ kind: "answerQueued", method, value: true });
    }
  });

  it("reads a null answer to mods.open", function readsModsOpenAnswer(): void {
    const report = readSandboxTestReport("sandbox.answerQueued", {
      method: "mods.open",
      value: null,
    });

    expect(report).toEqual({
      kind: "answerQueued",
      method: "mods.open",
      value: null,
    });
  });

  it("reads a null answer to mosaics.open", function readsMosaicsOpenAnswer(): void {
    const report = readSandboxTestReport("sandbox.answerQueued", {
      method: "mosaics.open",
      value: null,
    });

    expect(report).toEqual({
      kind: "answerQueued",
      method: "mosaics.open",
      value: null,
    });
  });

  it("gives null for an answer whose value has the wrong type for its method", function rejectsAnswerType(): void {
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "ui.confirm",
        value: "yes",
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "players.open",
        value: "yes",
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "links.open",
        value: null,
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "mods.open",
        value: true,
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "mosaics.open",
        value: false,
      }),
    ).toBeNull();
  });

  it("gives null for an answer to another method", function rejectsAnswerMethod(): void {
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "storage.get",
        value: true,
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.answerQueued", {
        method: "toString",
        value: true,
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.answerQueued", { value: true }),
    ).toBeNull();
  });

  it("reads a passing case", function readsPassingCase(): void {
    const report = readSandboxTestReport("sandbox.caseFinished", {
      status: "pass",
      message: null,
    });

    expect(report).toEqual({
      kind: "caseFinished",
      status: "pass",
      message: null,
    });
  });

  it("reads a failing case", function readsFailingCase(): void {
    const report = readSandboxTestReport("sandbox.caseFinished", {
      status: "fail",
      message: "no books",
    });

    expect(report).toEqual({
      kind: "caseFinished",
      status: "fail",
      message: "no books",
    });
  });

  it("gives null for a finished case of the wrong shape", function rejectsCase(): void {
    expect(
      readSandboxTestReport("sandbox.caseFinished", {
        status: "skip",
        message: null,
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.caseFinished", {
        status: "fail",
        message: null,
      }),
    ).toBeNull();
    expect(
      readSandboxTestReport("sandbox.caseFinished", {
        status: "pass",
        message: "passed",
      }),
    ).toBeNull();
    expect(readSandboxTestReport("sandbox.caseFinished", null)).toBeNull();
  });

  it("gives null for a method that is not a test report", function rejectsMethod(): void {
    expect(readSandboxTestReport("sandbox.mounted", {})).toBeNull();
    expect(readSandboxTestReport("toString", {})).toBeNull();
  });
});

describe("frame loader message names", function describeMethodNames(): void {
  it("match the ones the frame loader uses", function matchesLoader(): void {
    const methodNames = [
      SANDBOX_CONNECT_METHOD,
      SANDBOX_BLOCKED_METHOD,
      SANDBOX_MOUNT_FAILED_METHOD,
      SANDBOX_MOUNTED_METHOD,
      SANDBOX_DIALOG_BLOCKED_METHOD,
    ];

    for (const methodName of methodNames) {
      expect(SANDBOX_LOADER).toContain(`"${methodName}"`);
    }
    expect(methodNames).toEqual([
      "sandbox.connect",
      "sandbox.blocked",
      "sandbox.mountFailed",
      "sandbox.mounted",
      "sandbox.dialogBlocked",
    ]);
  });

  it("name the test notifications", function namesTestNotifications(): void {
    expect([
      SANDBOX_TESTS_LISTED_METHOD,
      SANDBOX_TESTS_FAILED_METHOD,
      SANDBOX_ANSWER_QUEUED_METHOD,
      SANDBOX_CASE_FINISHED_METHOD,
    ]).toEqual([
      "sandbox.testsListed",
      "sandbox.testsFailed",
      "sandbox.answerQueued",
      "sandbox.caseFinished",
    ]);
  });

  it("match the ones the test runner uses", function matchesRunner(): void {
    for (const methodName of [
      SANDBOX_TESTS_LISTED_METHOD,
      SANDBOX_TESTS_FAILED_METHOD,
      SANDBOX_ANSWER_QUEUED_METHOD,
      SANDBOX_CASE_FINISHED_METHOD,
    ]) {
      expect(SANDBOX_TEST_RUNNER).toContain(`"${methodName}"`);
    }
  });

  it("sandbox.mounted is sent once mount resolved", function sendsMountedAfterMount(): void {
    const mountCall = SANDBOX_LOADER.indexOf(
      "await modModule.default(engine, loader.context);",
    );
    const mountedNotification = SANDBOX_LOADER.indexOf(
      "sendNotification(MOUNTED_METHOD, {});",
    );

    expect(mountCall).toBeGreaterThan(-1);
    expect(mountedNotification).toBeGreaterThan(mountCall);
  });

  it("include the engine's theme.changed event", function matchesThemeChanged(): void {
    expect(THEME_CHANGED_METHOD).toBe("theme.changed");
    expect(SANDBOX_LOADER).toContain(
      `const THEME_CHANGED_METHOD = "${THEME_CHANGED_METHOD}";`,
    );
  });
});
