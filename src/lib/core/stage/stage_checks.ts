import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { IssueLevel } from "../../tile/index.ts";
import {
  buildModCheckReport,
  buildModLaunch,
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
  ResolvedDefaultModSettings,
  ResponseError,
  RunLink,
} from "../engine/index.ts";
import { createMemoryStorage } from "../storage/index.ts";
import type { Theme } from "../theme/index.ts";

/** How long a check keeps watching the mod after its `mount` finished. */
export const CHECK_SETTLE_MS = 1000;

/** How long a check waits for the mod's `mount` to finish, from the frame's first load. */
export const CHECK_MOUNT_LIMIT_MS = 10000;

const MOUNT_LIMIT_MESSAGE = `The mod's mount did not finish within ${CHECK_MOUNT_LIMIT_MS / 1000} seconds.`;

/**
 * The error codes that tell a mod used the mod API wrongly: a message that is
 * not a request (-32600), an unknown method (-32601) and bad params (-32602).
 */
const API_MISUSE_CODES: ReadonlySet<number> = new Set([-32600, -32601, -32602]);

/** The request that asked for each kind of action. */
const ACTION_METHODS: Record<AppAction["kind"], string> = {
  link: "links.open",
  save: "files.save",
  confirm: "ui.confirm",
};

/** A check whose bundle passed: its mod is mounted in a hidden frame. Mutable, because it follows a session and timers. */
export interface StageCheck {
  id: string;
  /** The sandbox that asked for the check. */
  requesterId: string;
  /** The checked mod file's source, as the report names it. */
  source: string;
  launch: ModLaunch;
  session: ModSession | null;
  /** The bundle findings, then the mount findings in the order they were found. */
  findings: ModCheckFinding[];
  limitTimer: ReturnType<typeof setTimeout> | null;
  settleTimer: ReturnType<typeof setTimeout> | null;
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
  /** Whether a sandbox is open and running, so a check whose requester left mounts nothing. */
  isSandboxRunning: (sandboxId: string) => boolean;
  /** Called when a check started or ended, so the stage publishes a snapshot. */
  onChange: () => void;
}

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

function placeStageCheck(
  checks: StageChecks,
  services: CheckServices,
  draft: Omit<StageCheck, "id" | "resolveReport">,
  resolveReport: (report: ModCheckReport) => void,
): void {
  const check: StageCheck = {
    ...draft,
    id: `check-${checks.nextId}`,
    resolveReport,
  };
  checks.nextId += 1;
  checks.entries.set(check.id, check);
  services.onChange();
}

/**
 * Checks a mod for the sandbox `requesterId`: runs the bundle check and, when
 * it found no error and the requester still runs, adds a check whose frame
 * the page renders. Resolves with the report once the check ended.
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
    return buildModCheckReport(request.source, bundleCheck.findings, false);
  }
  const launch = buildModLaunch(
    bundleCheck.mod,
    buildCheckLink(request.source, request.collection),
    bundleCheck.modTiles,
    services.appOrigin,
  );
  const draft: Omit<StageCheck, "id" | "resolveReport"> = {
    requesterId,
    source: request.source,
    launch,
    session: null,
    findings: [...bundleCheck.findings],
    limitTimer: null,
    settleTimer: null,
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

function describeErrorResponse(
  method: string | null,
  error: ResponseError,
): string {
  if (method === null) {
    return `The mod sent a message that is not a request, answered with error ${error.code}: ${error.message}`;
  }
  return `The mod's request "${method}" was answered with error ${error.code}: ${error.message}`;
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

function clearCheckTimers(check: StageCheck): void {
  if (check.limitTimer !== null) {
    clearTimeout(check.limitTimer);
    check.limitTimer = null;
  }
  if (check.settleTimer !== null) {
    clearTimeout(check.settleTimer);
    check.settleTimer = null;
  }
}

/**
 * Ends a check: clears its timers, stops its session, removes it so the page
 * removes its frame, and resolves its report. Does nothing for a check that
 * already ended.
 */
function endStageCheck(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
): void {
  if (checks.entries.get(check.id) !== check) {
    return;
  }
  clearCheckTimers(check);
  if (check.session !== null) {
    stopModSession(check.session);
  }
  checks.entries.delete(check.id);
  services.onChange();
  check.resolveReport(buildModCheckReport(check.source, check.findings, true));
}

/** Adds a `mount` error to the check `id`, and ends it. Does nothing for an unknown id. */
export function failStageCheck(
  checks: StageChecks,
  services: CheckServices,
  id: string,
  message: string,
): void {
  const check = checks.entries.get(id);
  if (check === undefined) {
    return;
  }
  addMountFinding(check, "error", message);
  endStageCheck(checks, services, check);
}

/** The mod's `mount` finished: the limit is cleared, and the check ends after the settle time. */
function startSettleTime(
  checks: StageChecks,
  services: CheckServices,
  check: StageCheck,
): void {
  if (check.settleTimer !== null || !checks.entries.has(check.id)) {
    return;
  }
  clearCheckTimers(check);
  check.settleTimer = setTimeout(
    endStageCheck.bind(undefined, checks, services, check),
    CHECK_SETTLE_MS,
  );
}

/**
 * Connects the session of the check `id` to its frame, on the frame's first
 * load, with a throwaway storage slot and the check's own answers to the
 * requests that would need the user. Starts the mount limit.
 */
export function attachStageCheckFrame(
  checks: StageChecks,
  services: CheckServices,
  id: string,
  frameTarget: Pick<Window, "postMessage">,
): void {
  const check = checks.entries.get(id);
  if (check === undefined || check.session !== null) {
    return;
  }
  check.session = connectModSession(frameTarget, check.launch, {
    storage: createMemoryStorage(),
    appOrigin: services.appOrigin,
    defaults: services.defaults,
    fetchOptions: services.fetchOptions,
    onIssue: recordCheckIssue.bind(undefined, check),
    onOpenLink: refuseCheckedOpen.bind(undefined, check),
    onRequestAction: cancelCheckedAction.bind(undefined, check),
    onCheckMod: refuseCheckedCheck.bind(undefined, check),
    onMounted: startSettleTime.bind(undefined, checks, services, check),
    onErrorResponse: recordErrorResponse.bind(undefined, check),
    theme: services.readTheme(),
  });
  check.limitTimer = setTimeout(
    failStageCheck.bind(undefined, checks, services, id, MOUNT_LIMIT_MESSAGE),
    CHECK_MOUNT_LIMIT_MS,
  );
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
