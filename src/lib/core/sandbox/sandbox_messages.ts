import type { BlockedDialogName, BlockedRequest } from "./sandbox_reports.ts";

/** Engine to frame, on `window`: carries the port and the mod's code and context. */
export const SANDBOX_CONNECT_METHOD = "sandbox.connect";

/** Frame to engine: a request the frame's policy blocked. */
export const SANDBOX_BLOCKED_METHOD = "sandbox.blocked";

/** Frame to engine: the mod could not be imported or mounted. */
export const SANDBOX_MOUNT_FAILED_METHOD = "sandbox.mountFailed";

/**
 * Frame to engine: the mod's `mount` resolved. Part of the loader's protocol,
 * not of the mod API. Sent at most once, and never after `sandbox.mountFailed`.
 */
export const SANDBOX_MOUNTED_METHOD = "sandbox.mounted";

/** Frame to engine: the mod called a browser dialog function the sandbox blocks. */
export const SANDBOX_DIALOG_BLOCKED_METHOD = "sandbox.dialogBlocked";

/** Frame to engine, from a check's list frame: the names of the cases the test file registers. */
export const SANDBOX_TESTS_LISTED_METHOD = "sandbox.testsListed";

/** Frame to engine, from a check's list frame: why the test file gives no cases. */
export const SANDBOX_TESTS_FAILED_METHOD = "sandbox.testsFailed";

/** Frame to engine, from a check's case frame: a case scripted the answer to the next request for a method. */
export const SANDBOX_ANSWER_QUEUED_METHOD = "sandbox.answerQueued";

/** Frame to engine, from a check's case frame: the case's function settled. */
export const SANDBOX_CASE_FINISHED_METHOD = "sandbox.caseFinished";

const BLOCKED_DIALOG_NAMES: ReadonlySet<string> = new Set([
  "alert",
  "confirm",
  "prompt",
  "print",
]);

/**
 * What a frame of a check's tests runs: the test file's code, and the name of
 * the case to run, or `null` to list the cases.
 */
export interface SandboxTestParams {
  code: string;
  caseName: string | null;
}

/**
 * The params of `sandbox.connect`. `context` is the mod's mount context,
 * plain data. Without `test`, the frame mounts the mod.
 */
export interface SandboxConnectParams {
  code: string;
  context: unknown;
  test?: SandboxTestParams;
}

/** The methods a case can script the answer to: those that ask the user, and `mods.open`. */
export type AnswerMethod =
  "links.open" | "files.save" | "ui.confirm" | "players.open" | "mods.open";

/** A test notification of a check's frame, read by `readSandboxTestReport`. */
export type SandboxTestReport =
  | { kind: "listed"; names: string[] }
  | { kind: "listFailed"; message: string }
  | { kind: "answerQueued"; method: AnswerMethod; value: boolean | null }
  | { kind: "caseFinished"; status: "pass" | "fail"; message: string | null };

function isParamsMapping(params: unknown): params is Record<string, unknown> {
  return (
    typeof params === "object" && params !== null && !Array.isArray(params)
  );
}

function readStringField(params: unknown, fieldName: string): string | null {
  if (!isParamsMapping(params)) {
    return null;
  }
  const value = params[fieldName];
  if (typeof value !== "string") {
    return null;
  }
  return value;
}

/** Reads the params of `sandbox.blocked`, or `null` when they have the wrong shape. */
export function readBlockedRequest(params: unknown): BlockedRequest | null {
  const blockedUrl = readStringField(params, "blockedUrl");
  const directive = readStringField(params, "directive");
  if (blockedUrl === null || directive === null) {
    return null;
  }
  const blockedRequest: BlockedRequest = { blockedUrl, directive };
  return blockedRequest;
}

/** Reads the error message of `sandbox.mountFailed`, or `null` when the params have the wrong shape. */
export function readMountFailure(params: unknown): string | null {
  return readStringField(params, "message");
}

function isBlockedDialogName(name: string): name is BlockedDialogName {
  return BLOCKED_DIALOG_NAMES.has(name);
}

/** Reads the function name of `sandbox.dialogBlocked`, or `null` for an unknown name or the wrong shape. */
export function readBlockedDialog(params: unknown): BlockedDialogName | null {
  const name = readStringField(params, "name");
  if (name === null || !isBlockedDialogName(name)) {
    return null;
  }
  return name;
}

function isNameList(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const name of value) {
    if (typeof name !== "string") {
      return false;
    }
  }
  return true;
}

function readTestsListed(params: unknown): SandboxTestReport | null {
  if (!isParamsMapping(params) || !isNameList(params.names)) {
    return null;
  }
  const report: SandboxTestReport = { kind: "listed", names: params.names };
  return report;
}

function readTestsFailed(params: unknown): SandboxTestReport | null {
  const message = readStringField(params, "message");
  if (message === null) {
    return null;
  }
  const report: SandboxTestReport = { kind: "listFailed", message };
  return report;
}

/** Whether `value` is an answer `method` accepts: `null` for `mods.open`, a boolean for the others. */
function isAnswerValue(method: AnswerMethod, value: unknown): boolean {
  if (method === "mods.open") {
    return value === null;
  }
  return typeof value === "boolean";
}

function isAnswerMethod(method: string): method is AnswerMethod {
  return (
    method === "links.open" ||
    method === "files.save" ||
    method === "ui.confirm" ||
    method === "players.open" ||
    method === "mods.open"
  );
}

function readAnswerQueued(params: unknown): SandboxTestReport | null {
  if (!isParamsMapping(params)) {
    return null;
  }
  const method = params.method;
  if (typeof method !== "string" || !isAnswerMethod(method)) {
    return null;
  }
  if (!isAnswerValue(method, params.value)) {
    return null;
  }
  const report: SandboxTestReport = {
    kind: "answerQueued",
    method,
    value: params.value as boolean | null,
  };
  return report;
}

function readCaseFinished(params: unknown): SandboxTestReport | null {
  if (!isParamsMapping(params)) {
    return null;
  }
  const isPass = params.status === "pass" && params.message === null;
  const isFail = params.status === "fail" && typeof params.message === "string";
  if (!isPass && !isFail) {
    return null;
  }
  const report: SandboxTestReport = {
    kind: "caseFinished",
    status: params.status as "pass" | "fail",
    message: params.message as string | null,
  };
  return report;
}

const TEST_REPORT_READERS: Record<
  string,
  (params: unknown) => SandboxTestReport | null
> = {
  [SANDBOX_TESTS_LISTED_METHOD]: readTestsListed,
  [SANDBOX_TESTS_FAILED_METHOD]: readTestsFailed,
  [SANDBOX_ANSWER_QUEUED_METHOD]: readAnswerQueued,
  [SANDBOX_CASE_FINISHED_METHOD]: readCaseFinished,
};

/**
 * Reads a test notification of a check's frame, or `null` when `method` is
 * not one or its params have the wrong shape.
 */
export function readSandboxTestReport(
  method: string,
  params: unknown,
): SandboxTestReport | null {
  if (!Object.hasOwn(TEST_REPORT_READERS, method)) {
    return null;
  }
  return TEST_REPORT_READERS[method](params);
}
