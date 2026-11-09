import type { FileFetchOptions } from "../../files/index.ts";
import { loadModTestCode } from "../../mod/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { IssueLevel } from "../../tile/index.ts";
import {
  buildModCheckReport,
  buildModLaunch,
  buildModTestDocument,
  checkModBundle,
  connectModSession,
  stopModSession,
} from "../engine/index.ts";
import type {
  AppAction,
  ModCheckFinding,
  ModCheckReport,
  ModCheckRequest,
  ModLaunch,
  ModSession,
  ModSessionOptions,
  ModTestResult,
  ResolvedDefaultModSettings,
  ResponseError,
  RunLink,
  UserNotification,
} from "../engine/index.ts";
import { grantModPermissions } from "../permissions/index.ts";
import type { SiteDecision } from "../permissions/index.ts";
import { createMemoryStorage } from "../storage/index.ts";
import type { Theme } from "../theme/index.ts";
import {
  ACTION_METHODS,
  API_MISUSE_CODES,
  buildCaseFrameHooks,
  buildListFrameHooks,
  buildTestFileError,
  CASE_LIMIT_MESSAGE,
  CHECK_CASE_LIMIT_MS,
  createCheckCase,
  describeErrorResponse,
  finishCheckCase,
  LIST_LIMIT_MESSAGE,
} from "./stage_check_cases.ts";
import type {
  CaseListing,
  CheckCase,
  CheckFrameHooks,
} from "./stage_check_cases.ts";

/** How long a check keeps watching the mod after its `mount` finished. */
export const CHECK_SETTLE_MS = 1000;

/** How long a check waits for the mod's `mount` to finish, from the frame's first load. */
export const CHECK_MOUNT_LIMIT_MS = 10000;

const MOUNT_LIMIT_MESSAGE = `The mod's mount did not finish within ${CHECK_MOUNT_LIMIT_MS / 1000} seconds.`;

/** What a check's frame does: mount the mod, list the cases of its test file, or run one case. */
export type CheckPhase = "mount" | "list" | "case";

/**
 * The frame a check runs now. Each new frame gets a new key, so the page
 * makes a new iframe for it, and a late `load` of a replaced frame is
 * ignored. Mutable, because it follows a session and timers.
 */
export interface StageCheckFrame {
  key: string;
  /** The frame's `srcdoc`: the mod's frame document, or the test runner's. */
  sandboxDocument: string;
  session: ModSession | null;
  limitTimer: ReturnType<typeof setTimeout> | null;
  settleTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * A check whose bundle passed: its mod is mounted in a hidden frame, then its
 * tests run, one frame at a time. Mutable.
 */
export interface StageCheck {
  id: string;
  /** The sandbox that asked for the check. */
  requesterId: string;
  /** The checked mod file's source, as the report names it. */
  source: string;
  launch: ModLaunch;
  phase: CheckPhase;
  /** The frame running now, or `null` while the test file is fetched. */
  frame: StageCheckFrame | null;
  /** How many frames the check started, for the next frame's key. */
  frameCount: number;
  /** The bundle findings, then the mount and test findings in the order they were found. */
  findings: ModCheckFinding[];
  /** The test file's code, once fetched. */
  testCode: string | null;
  /** The case names the list frame reported, in order. */
  caseNames: string[];
  /** The results of the cases that ended, or `null` until the cases start. */
  testResults: ModTestResult[] | null;
  /** The case whose frame runs now. */
  currentCase: CheckCase | null;
  resolveReport: (report: ModCheckReport) => void;
}

/** The stage's running checks, apart from its sandboxes and its history. Mutable. */
export interface StageChecks {
  entries: Map<string, StageCheck>;
  nextId: number;
}

/** What the checks need from the stage. */
export interface CheckServices {
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;
  /** `baseUrl` is the app's address. */
  fetchOptions: FileFetchOptions;
  /** The stage's current theme, read when a check frame connects. */
  readTheme: () => Theme;
  /** Whether a sandbox is open and running, so a check whose requester left mounts and tests nothing. */
  isSandboxRunning: (sandboxId: string) => boolean;
  /** Called when a check started, changed its frame or ended, so the stage publishes a snapshot. */
  onChange: () => void;
  /** Whether the checked mod's frames load the media its tiles link, as an opened mod would. */
  loadsTileLinkedMedia: boolean;
  /**
   * The remembered site decisions: the checked mod gets the permissions they
   * allow, and nothing is asked. Its `mods.inspect` reads them too.
   */
  readSiteDecisions: () => readonly SiteDecision[];
}

type CheckDraft = Pick<
  StageCheck,
  "requesterId" | "source" | "launch" | "findings"
>;

export function createStageChecks(): StageChecks {
  const checks: StageChecks = { entries: new Map(), nextId: 1 };
  return checks;
}

function hasErrorFinding(findings: ModCheckFinding[]): boolean {
  for (const finding of findings) {
    if (finding.level === "error") {
      return true;
    }
  }
  return false;
}

/** The link a checked mod is launched with: no params, as a mod opened by its reference. */
function buildCheckLink(source: string, collection: string | null): RunLink {
  const link: RunLink = { mod: source, collection, params: {} };
  return link;
}

function isCheckRunning(checks: StageChecks, check: StageCheck): boolean {
  return checks.entries.get(check.id) === check;
}

/** Gives the check a new frame with `sandboxDocument`, which the page renders. */
function startCheckFrame(
  services: CheckServices,
  check: StageCheck,
  phase: CheckPhase,
  sandboxDocument: string,
): void {
  check.frameCount += 1;
  check.phase = phase;
  check.frame = {
    key: `${check.id}-frame-${check.frameCount}`,
    sandboxDocument,
    session: null,
    limitTimer: null,
    settleTimer: null,
  };
  services.onChange();
}

/** Clears the frame's timers, stops its session and drops it, so the page removes it. */
function stopCheckFrame(check: StageCheck): void {
  const frame = check.frame;
  if (frame === null) {
    return;
  }
  if (frame.limitTimer !== null) {
    clearTimeout(frame.limitTimer);
  }
  if (frame.settleTimer !== null) {
    clearTimeout(frame.settleTimer);
  }
  if (frame.session !== null) {
    stopModSession(frame.session);
  }
  check.frame = null;
}

function placeStageCheck(
  checks: StageChecks,
  services: CheckServices,
  draft: CheckDraft,
  resolveReport: (report: ModCheckReport) => void,
): void {
  const check: StageCheck = {
    ...draft,
    id: `check-${checks.nextId}`,
    phase: "mount",
    frame: null,
    frameCount: 0,
    testCode: null,
    caseNames: [],
    testResults: null,
    currentCase: null,
    resolveReport,
  };
  checks.nextId += 1;
  checks.entries.set(check.id, check);
  startCheckFrame(services, check, "mount", check.launch.sandboxDocument);
}

/**
 * Checks a mod for the sandbox `requesterId`: runs the bundle check and, when
 * it found no error and the requester still runs, adds a check whose frames
 * the page renders: the mount check, then the mod's tests. Resolves with the
 * report once the check ended.
 */
export async function runStageCheck(
  checks: StageChecks,
  services: CheckServices,
  requesterId: string,
  request: ModCheckRequest,
): Promise<ModCheckReport> {
  const bundleCheck = await checkModBundle(
    request.source,
    request.collection,
    services.fetchOptions,
  );
  if (
    bundleCheck.mod === null ||
    hasErrorFinding(bundleCheck.findings) ||
    !services.isSandboxRunning(requesterId)
  ) {
    return buildModCheckReport(
      request.source,
      bundleCheck.findings,
      false,
      null,
    );
  }
  const launch = buildModLaunch(
    bundleCheck.mod,
    buildCheckLink(request.source, request.collection),
    bundleCheck.modTiles,
    grantModPermissions(
      bundleCheck.mod,
      services.appOrigin,
      services.readSiteDecisions(),
    ),
    services.loadsTileLinkedMedia,
  );
  const draft: CheckDraft = {
    requesterId,
    source: request.source,
    launch,
    findings: [...bundleCheck.findings],
  };
  const report = await new Promise<ModCheckReport>(
    placeStageCheck.bind(undefined, checks, services, draft),
  );
  return report;
}

function addMountFinding(
  check: StageCheck,
  level: IssueLevel,
  message: string,
): void {
  check.findings.push({
    step: "mount",
    level,
    source: check.source,
    message,
  });
}

function recordCheckIssue(check: StageCheck, issue: ModIssue): void {
  check.findings.push({
    step: "mount",
    level: issue.level,
    source: issue.source,
    message: issue.message,
  });
}

/**
 * A notification from the checked mod: an error or a warning is a `mount`
 * finding at its level, with its source and text, and `info` is no finding.
 * The check shows nothing, so nothing reaches a stage bar.
 */
function recordCheckNotification(
  check: StageCheck,
  notification: UserNotification,
): void {
  if (notification.level === "info") {
    return;
  }
  check.findings.push({
    step: "mount",
    level: notification.level,
    source: notification.source,
    message: notification.text,
  });
}

function recordErrorResponse(
  check: StageCheck,
  method: string | null,
  error: ResponseError,
): void {
  if (!API_MISUSE_CODES.has(error.code)) {
    return;
  }
  addMountFinding(check, "error", describeErrorResponse(method, error));
}

function describeCancelledRequest(method: string): string {
  return `The mod requested ${method} while it was checked. A check shows no dialog, so the request was answered false, as if the user cancelled.`;
}

function describeRefusedRequest(method: string): string {
  return `The mod requested ${method} while it was checked. A check opens and checks no other mods, so the request was refused.`;
}

/** `links.open`, `files.save` and `ui.confirm` of a checked mod: answered `false`, with no dialog. */
function cancelCheckedAction(
  check: StageCheck,
  action: AppAction,
): Promise<boolean> {
  addMountFinding(
    check,
    "warning",
    describeCancelledRequest(ACTION_METHODS[action.kind]),
  );
  return Promise.resolve(false);
}

/** `mods.open` of a checked mod: refused, so the handler answers `-32002`. */
function refuseCheckedOpen(check: StageCheck): boolean {
  addMountFinding(check, "warning", describeRefusedRequest("mods.open"));
  return false;
}

/** `mods.check` of a checked mod: refused, so the handler answers `-32002`. */
function refuseCheckedCheck(check: StageCheck): null {
  addMountFinding(check, "warning", describeRefusedRequest("mods.check"));
  return null;
}

/**
 * Ends a check: stops its frame, removes it so the page removes the frame,
 * and resolves its report. Does nothing for a check that already ended.
 */
function endStageCheck(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
): void {
  if (!isCheckRunning(checks, check)) {
    return;
  }
  stopCheckFrame(check);
  checks.entries.delete(check.id);
  services.onChange();
  check.resolveReport(
    buildModCheckReport(check.source, check.findings, true, check.testResults),
  );
}

/** Adds a `mount` error to the check, and ends it, so its tests do not run. */
function failMountCheck(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  message: string,
): void {
  if (!isCheckRunning(checks, check)) {
    return;
  }
  addMountFinding(check, "error", message);
  endStageCheck(checks, services, check);
}

/** The test file's address. Only a mod with tests reaches the test phases. */
function readTestSource(check: StageCheck): string {
  return check.launch.mod.testSource ?? check.source;
}

/** Adds a `test` error about the test file, and ends the check without case results. */
function failTestFile(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  message: string,
): void {
  if (!isCheckRunning(checks, check)) {
    return;
  }
  check.findings.push(buildTestFileError(readTestSource(check), message));
  endStageCheck(checks, services, check);
}

function describeLoadError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function failTestFileLoad(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  error: unknown,
): void {
  failTestFile(checks, services, check, describeLoadError(error));
}

/** The test file is fetched: its list frame starts. */
function startListFrame(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  testCode: string,
): void {
  if (!isCheckRunning(checks, check)) {
    return;
  }
  check.testCode = testCode;
  startCheckFrame(services, check, "list", buildModTestDocument(check.launch));
}

/**
 * The mount check ended. When the mod has a test file, the mount check found
 * no error and the requester still runs, the test file is fetched and the
 * tests start; otherwise the check ends.
 */
function endMountPhase(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
): void {
  if (!isCheckRunning(checks, check)) {
    return;
  }
  if (
    check.launch.mod.testSource === null ||
    hasErrorFinding(check.findings) ||
    !services.isSandboxRunning(check.requesterId)
  ) {
    endStageCheck(checks, services, check);
    return;
  }
  stopCheckFrame(check);
  check.phase = "list";
  services.onChange();
  loadModTestCode(check.launch.mod, services.fetchOptions).then(
    startListFrame.bind(undefined, checks, services, check),
    failTestFileLoad.bind(undefined, checks, services, check),
  );
}

/** The mod's `mount` finished: the limit is cleared, and the mount check ends after the settle time. */
function startSettleTime(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  frame: StageCheckFrame,
): void {
  if (check.frame !== frame || frame.settleTimer !== null) {
    return;
  }
  if (frame.limitTimer !== null) {
    clearTimeout(frame.limitTimer);
    frame.limitTimer = null;
  }
  frame.settleTimer = setTimeout(
    endMountPhase.bind(undefined, checks, services, check),
    CHECK_SETTLE_MS,
  );
}

function startCase(services: CheckServices, check: StageCheck): void {
  const caseIndex = check.testResults?.length ?? 0;
  check.currentCase = createCheckCase(
    check.caseNames[caseIndex],
    check.source,
    readTestSource(check),
    check.findings,
  );
  startCheckFrame(services, check, "case", buildModTestDocument(check.launch));
}

/** A case ended: its result is kept, and the next case starts, or the check ends after the last one. */
function finishCase(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  checkCase: CheckCase,
  status: ModTestResult["status"],
  message: string | null,
): void {
  if (!isCheckRunning(checks, check) || check.currentCase !== checkCase) {
    return;
  }
  const result = finishCheckCase(checkCase, status, message);
  const testResults = check.testResults ?? [];
  testResults.push(result);
  check.testResults = testResults;
  check.currentCase = null;
  stopCheckFrame(check);
  if (testResults.length < check.caseNames.length) {
    startCase(services, check);
    return;
  }
  endStageCheck(checks, services, check);
}

/** The list frame reported: the cases start, or a listing error ends the check. */
function receiveListing(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  listing: CaseListing,
): void {
  if (!isCheckRunning(checks, check) || check.phase !== "list") {
    return;
  }
  if (listing.kind === "failed") {
    failTestFile(
      checks,
      services,
      check,
      `The tests could not be listed: ${listing.message}`,
    );
    return;
  }
  if (listing.names.length === 0) {
    failTestFile(
      checks,
      services,
      check,
      "The tests could not be listed: the test file registers no test",
    );
    return;
  }
  stopCheckFrame(check);
  check.caseNames = [...listing.names];
  check.testResults = [];
  startCase(services, check);
}

/** Connects a frame's session with the check's services, the frame's own hooks and a throwaway storage slot. */
function connectCheckSession(
  services: CheckServices,
  check: StageCheck,
  frameTarget: Pick<Window, "postMessage">,
  hooks: CheckFrameHooks & Pick<ModSessionOptions, "onMounted" | "test">,
): ModSession {
  return connectModSession(frameTarget, check.launch, {
    storage: createMemoryStorage(),
    appOrigin: services.appOrigin,
    defaults: services.defaults,
    fetchOptions: services.fetchOptions,
    readSiteDecisions: services.readSiteDecisions,
    theme: services.readTheme(),
    ...hooks,
  });
}

function attachMountFrame(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  frame: StageCheckFrame,
  frameTarget: Pick<Window, "postMessage">,
): void {
  frame.session = connectCheckSession(services, check, frameTarget, {
    onIssue: recordCheckIssue.bind(undefined, check),
    onOpenLink: refuseCheckedOpen.bind(undefined, check),
    onRequestAction: cancelCheckedAction.bind(undefined, check),
    onCheckMod: refuseCheckedCheck.bind(undefined, check),
    onNotify: recordCheckNotification.bind(undefined, check),
    onMounted: startSettleTime.bind(undefined, checks, services, check, frame),
    onErrorResponse: recordErrorResponse.bind(undefined, check),
  });
  frame.limitTimer = setTimeout(
    failMountCheck.bind(
      undefined,
      checks,
      services,
      check,
      MOUNT_LIMIT_MESSAGE,
    ),
    CHECK_MOUNT_LIMIT_MS,
  );
}

function attachListFrame(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  frame: StageCheckFrame,
  frameTarget: Pick<Window, "postMessage">,
): void {
  frame.session = connectCheckSession(services, check, frameTarget, {
    ...buildListFrameHooks(
      receiveListing.bind(undefined, checks, services, check),
    ),
    test: { code: check.testCode ?? "", caseName: null },
  });
  frame.limitTimer = setTimeout(
    failTestFile.bind(undefined, checks, services, check, LIST_LIMIT_MESSAGE),
    CHECK_CASE_LIMIT_MS,
  );
}

function attachCaseFrame(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
  frame: StageCheckFrame,
  frameTarget: Pick<Window, "postMessage">,
): void {
  const checkCase = check.currentCase;
  if (checkCase === null) {
    return;
  }
  const onFinished = finishCase.bind(
    undefined,
    checks,
    services,
    check,
    checkCase,
  );
  frame.session = connectCheckSession(services, check, frameTarget, {
    ...buildCaseFrameHooks(checkCase, onFinished),
    test: { code: check.testCode ?? "", caseName: checkCase.name },
  });
  frame.limitTimer = setTimeout(
    finishCase.bind(
      undefined,
      checks,
      services,
      check,
      checkCase,
      "fail",
      CASE_LIMIT_MESSAGE,
    ),
    CHECK_CASE_LIMIT_MS,
  );
}

/** The check `id`'s frame with `key`, or `null` when the check ended or its frame was replaced. */
function findCheckFrame(
  checks: StageChecks,
  id: string,
  key: string,
): { check: StageCheck; frame: StageCheckFrame } | null {
  const check = checks.entries.get(id);
  if (check === undefined || check.frame === null) {
    return null;
  }
  if (check.frame.key !== key) {
    return null;
  }
  const found = { check, frame: check.frame };
  return found;
}

/**
 * Connects the session of the check `id`'s frame `key`, on the frame's first
 * load, with a throwaway storage slot and the phase's own answers to the
 * requests that would need the user, and starts the phase's limit. A frame
 * that was replaced, or is already connected, is ignored.
 */
export function attachStageCheckFrame(
  checks: StageChecks,
  services: CheckServices,
  id: string,
  key: string,
  frameTarget: Pick<Window, "postMessage">,
): void {
  const found = findCheckFrame(checks, id, key);
  if (found === null || found.frame.session !== null) {
    return;
  }
  const { check, frame } = found;
  if (check.phase === "mount") {
    attachMountFrame(checks, services, check, frame, frameTarget);
  }
  if (check.phase === "list") {
    attachListFrame(checks, services, check, frame, frameTarget);
  }
  if (check.phase === "case") {
    attachCaseFrame(checks, services, check, frame, frameTarget);
  }
}

/**
 * The check `id`'s frame `key` loaded another document: the mod left its
 * page. The mount check ends the check with a `mount` error, the list frame
 * with a `test` error, and a case fails with `message`. A frame that was
 * replaced is ignored.
 */
export function stopReloadedCheckFrame(
  checks: StageChecks,
  services: CheckServices,
  id: string,
  key: string,
  message: string,
): void {
  const found = findCheckFrame(checks, id, key);
  if (found === null) {
    return;
  }
  const check = found.check;
  if (check.phase === "mount") {
    failMountCheck(checks, services, check, message);
  }
  if (check.phase === "list") {
    failTestFile(checks, services, check, message);
  }
  if (check.phase === "case" && check.currentCase !== null) {
    finishCase(checks, services, check, check.currentCase, "fail", message);
  }
}

/** Ends every check the sandbox `requesterId` asked for, when it is closed. */
export function endRequesterChecks(
  checks: StageChecks,
  services: CheckServices,
  requesterId: string,
): void {
  const requesterChecks: StageCheck[] = [];
  for (const check of checks.entries.values()) {
    if (check.requesterId === requesterId) {
      requesterChecks.push(check);
    }
  }
  for (const check of requesterChecks) {
    endStageCheck(checks, services, check);
  }
}
