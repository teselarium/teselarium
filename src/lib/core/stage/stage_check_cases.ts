import type { ModIssue } from "../../mod/index.ts";
import type {
  AppAction,
  ModCheckFinding,
  ModSessionOptions,
  ModTestResult,
  OpenLinkOutcome,
  ResponseError,
} from "../engine/index.ts";
import type { AnswerMethod, SandboxTestReport } from "../sandbox/index.ts";

/** How long a case, or the listing of the cases, may run, from its frame's first load. */
export const CHECK_CASE_LIMIT_MS = 10000;

export const CASE_LIMIT_MESSAGE = `The test did not finish within ${CHECK_CASE_LIMIT_MS / 1000} seconds.`;

export const LIST_LIMIT_MESSAGE = `The test file did not register its tests within ${CHECK_CASE_LIMIT_MS / 1000} seconds.`;

/**
 * The error codes that tell a mod used the mod API wrongly: a message that is
 * not a request (-32600), an unknown method (-32601) and bad params (-32602).
 * Shared with the mount check.
 */
export const API_MISUSE_CODES: ReadonlySet<number> = new Set([
  -32600, -32601, -32602,
]);

/** The request that asked for each kind of action. Shared with the mount check. */
export const ACTION_METHODS: Record<AppAction["kind"], AnswerMethod> = {
  link: "links.open",
  save: "files.save",
  confirm: "ui.confirm",
  player: "players.open",
};

/** The callbacks of a check frame's session, which the check passes to `connectModSession`. */
export type CheckFrameHooks = Pick<
  ModSessionOptions,
  | "onIssue"
  | "onOpenLink"
  | "onRequestAction"
  | "onCheckMod"
  | "onNotify"
  | "onErrorResponse"
  | "onTestReport"
>;

/** What a list frame reports: the case names, or why there are none. */
export type CaseListing =
  { kind: "listed"; names: string[] } | { kind: "failed"; message: string };

/** One case of a check's tests while its frame runs. Mutable: its answer queues fill as the case runs. */
export interface CheckCase {
  name: string;
  /** The checked mod file's source, the source of the case's error responses. */
  modSource: string;
  /** The test file's address, the source of the case's failure. */
  testSource: string;
  /** The check's findings, where the case adds its own. */
  findings: ModCheckFinding[];
  /** The scripted answers of each method, oldest first. */
  answers: Map<AnswerMethod, (boolean | null)[]>;
}

/** The message of an error response, as the mount check and the cases record it. Shared with the mount check. */
export function describeErrorResponse(
  method: string | null,
  error: ResponseError,
): string {
  if (method === null) {
    return `The mod sent a message that is not a request, answered with error ${error.code}: ${error.message}`;
  }
  return `The mod's request "${method}" was answered with error ${error.code}: ${error.message}`;
}

/** The `test` error of a test file that could not be loaded, or gave no cases. */
export function buildTestFileError(
  testSource: string,
  message: string,
): ModCheckFinding {
  const finding: ModCheckFinding = {
    step: "test",
    level: "error",
    source: testSource,
    message,
  };
  return finding;
}

function refuseCheckOpen(): OpenLinkOutcome {
  return "not-visible";
}

function refuseCheckRequest(): null {
  return null;
}

function cancelCheckAction(): Promise<boolean> {
  return Promise.resolve(false);
}

function ignoreFrameIssue(): void {
  // A list frame only lists: the mod is not mounted, so it has nothing to record.
}

function ignoreNotification(): void {
  // A frame of the tests shows nothing: a case reads the request from `requests`.
}

function ignoreErrorResponse(): void {
  // A list frame sends no requests: its test file has no engine API object.
}

function readListing(
  onListing: (listing: CaseListing) => void,
  report: SandboxTestReport,
): void {
  if (report.kind === "listed") {
    onListing({ kind: "listed", names: report.names });
  }
  if (report.kind === "listFailed") {
    onListing({ kind: "failed", message: report.message });
  }
}

/**
 * The hooks of a list frame's session: it reports the case names, or why
 * there are none, to `onListing`, and records nothing else.
 */
export function buildListFrameHooks(
  onListing: (listing: CaseListing) => void,
): CheckFrameHooks {
  const hooks: CheckFrameHooks = {
    onIssue: ignoreFrameIssue,
    onOpenLink: refuseCheckOpen,
    onRequestAction: cancelCheckAction,
    onCheckMod: refuseCheckRequest,
    onNotify: ignoreNotification,
    onErrorResponse: ignoreErrorResponse,
    onTestReport: readListing.bind(undefined, onListing),
  };
  return hooks;
}

export function createCheckCase(
  name: string,
  modSource: string,
  testSource: string,
  findings: ModCheckFinding[],
): CheckCase {
  const checkCase: CheckCase = {
    name,
    modSource,
    testSource,
    findings,
    answers: new Map(),
  };
  return checkCase;
}

function describeInCase(checkCase: CheckCase, message: string): string {
  return `In the test "${checkCase.name}": ${message}`;
}

/** A blocked request or dialog of a case, as the mount check records it, naming the case. */
function recordCaseIssue(checkCase: CheckCase, issue: ModIssue): void {
  checkCase.findings.push({
    step: "test",
    level: issue.level,
    source: issue.source,
    message: describeInCase(checkCase, issue.message),
  });
}

function recordCaseErrorResponse(
  checkCase: CheckCase,
  method: string | null,
  error: ResponseError,
): void {
  if (!API_MISUSE_CODES.has(error.code)) {
    return;
  }
  checkCase.findings.push({
    step: "test",
    level: "error",
    source: checkCase.modSource,
    message: describeInCase(checkCase, describeErrorResponse(method, error)),
  });
}

function queueCaseAnswer(
  checkCase: CheckCase,
  method: AnswerMethod,
  value: boolean | null,
): void {
  const queue = checkCase.answers.get(method) ?? [];
  queue.push(value);
  checkCase.answers.set(method, queue);
}

/** The oldest queued answer of `method`, removed from its queue, or `undefined` without one. */
function takeCaseAnswer(
  checkCase: CheckCase,
  method: AnswerMethod,
): boolean | null | undefined {
  const queue = checkCase.answers.get(method);
  if (queue === undefined) {
    return undefined;
  }
  return queue.shift();
}

/** `links.open`, `files.save` and `ui.confirm` of a case: the queued answer, or `false`, with no dialog. */
function answerCaseAction(
  checkCase: CheckCase,
  action: AppAction,
): Promise<boolean> {
  const answer = takeCaseAnswer(checkCase, ACTION_METHODS[action.kind]);
  return Promise.resolve(answer === true);
}

/**
 * `mods.open` of a case: `true` with a queued answer, so the handler answers
 * `null` and nothing opens, and `false` without one, so it answers `-32002`.
 */
/** A case's `mods.open`: opened when the case queued an answer, otherwise refused as from a hidden mod. */
function answerCaseOpen(checkCase: CheckCase): OpenLinkOutcome {
  const isAnswered = takeCaseAnswer(checkCase, "mods.open") !== undefined;
  return isAnswered ? "opened" : "not-visible";
}

function readCaseReport(
  checkCase: CheckCase,
  onFinished: (status: ModTestResult["status"], message: string | null) => void,
  report: SandboxTestReport,
): void {
  if (report.kind === "answerQueued") {
    queueCaseAnswer(checkCase, report.method, report.value);
  }
  if (report.kind === "caseFinished") {
    onFinished(report.status, report.message);
  }
}

/**
 * The hooks of a case frame's session: what the mount check records as
 * `mount` findings becomes `test` findings that name the case, requests that
 * need the user get the queued answers and add no finding, `mods.check` is
 * refused, and `sandbox.caseFinished` goes to `onFinished`.
 */
export function buildCaseFrameHooks(
  checkCase: CheckCase,
  onFinished: (status: ModTestResult["status"], message: string | null) => void,
): CheckFrameHooks {
  const hooks: CheckFrameHooks = {
    onIssue: recordCaseIssue.bind(undefined, checkCase),
    onOpenLink: answerCaseOpen.bind(undefined, checkCase),
    onRequestAction: answerCaseAction.bind(undefined, checkCase),
    onCheckMod: refuseCheckRequest,
    onNotify: ignoreNotification,
    onErrorResponse: recordCaseErrorResponse.bind(undefined, checkCase),
    onTestReport: readCaseReport.bind(undefined, checkCase, onFinished),
  };
  return hooks;
}

/**
 * Ends a case with its result. A failed case also adds a `test` error, after
 * the case's own findings, whose source is the test file.
 */
export function finishCheckCase(
  checkCase: CheckCase,
  status: ModTestResult["status"],
  message: string | null,
): ModTestResult {
  if (status === "pass") {
    const passedResult: ModTestResult = {
      name: checkCase.name,
      status,
      message: null,
    };
    return passedResult;
  }
  const failureMessage = message ?? "The test failed.";
  checkCase.findings.push({
    step: "test",
    level: "error",
    source: checkCase.testSource,
    message: `The test "${checkCase.name}" failed: ${failureMessage}`,
  });
  const failedResult: ModTestResult = {
    name: checkCase.name,
    status,
    message: failureMessage,
  };
  return failedResult;
}
