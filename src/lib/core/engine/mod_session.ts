import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { Tile, TileIssue } from "../../tile/index.ts";
import {
  describeBlockedDialog,
  describeBlockedRequest,
  openSandboxChannel,
  readBlockedDialog,
  readBlockedRequest,
  readMountFailure,
  readSandboxTestReport,
  SANDBOX_BLOCKED_METHOD,
  SANDBOX_DIALOG_BLOCKED_METHOD,
  SANDBOX_MOUNT_FAILED_METHOD,
  SANDBOX_MOUNTED_METHOD,
} from "../sandbox/index.ts";
import type {
  SandboxConnectParams,
  SandboxTestParams,
  SandboxTestReport,
} from "../sandbox/index.ts";
import type { SiteDecision } from "../permissions/index.ts";
import type { ModStorage } from "../storage/index.ts";
import type { Theme } from "../theme/index.ts";
import type { AppAction } from "./app_actions.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
import { FILES_METHODS } from "./files_methods.ts";
import { LINKS_METHODS } from "./links_methods.ts";
import type {
  LaunchContext,
  ModContext,
  ModLaunch,
  RunLink,
} from "./mod_launch.ts";
import {
  buildErrorResponse,
  buildNotification,
  buildResultResponse,
  findMethod,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  readModMessage,
} from "./mod_messages.ts";
import type {
  ErrorResponse,
  ModNotification,
  ModRequest,
  ResponseError,
  ResultResponse,
} from "./mod_messages.ts";
import type { ModCheckReport } from "./mod_check_report.ts";
import type {
  ModCheckRequest,
  ModMethodContext,
  ModMethodTable,
} from "./mod_methods.ts";
import type { TileBodies } from "./mod_tile_bodies.ts";
import { MODS_METHODS } from "./mods_methods.ts";
import { PLAYERS_METHODS } from "./players_methods.ts";
import { STORAGE_METHODS } from "./storage_methods.ts";
import { TILES_METHODS } from "./tiles_methods.ts";
import { UI_METHODS } from "./ui_methods.ts";

/** The services a session needs from the app. */
export interface ModSessionOptions {
  storage: ModStorage;
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;
  /** `baseUrl` is the app's address. */
  fetchOptions: FileFetchOptions;
  /** The remembered site decisions, read by `mods.inspect`. */
  readSiteDecisions: () => readonly SiteDecision[];
  onIssue: (issue: ModIssue) => void;
  /** Asks the stage to open a link. `false` when the sandbox is not the visible one. */
  onOpenLink: (link: RunLink) => boolean;
  /**
   * Asks the stage to show an action to the user. Resolves with the user's
   * answer, or is `null` when the sandbox is not the visible one.
   */
  onRequestAction: (action: AppAction) => Promise<boolean> | null;
  /** Asks the stage to check a mod. `null` when the sandbox is not the visible one. */
  onCheckMod: (request: ModCheckRequest) => Promise<ModCheckReport> | null;
  /** The theme the mod mounts with: the one current when the frame connects. */
  theme: Theme;
  /**
   * Called when the mod's `mount` finished: for `sandbox.mounted`, and for
   * `sandbox.mountFailed` after its issue is reported. Running sandboxes pass none.
   */
  onMounted?: () => void;
  /**
   * Called for every error response sent, with the request's method, or
   * `null` for a message that is not a request, and the response's error.
   */
  onErrorResponse?: (method: string | null, error: ResponseError) => void;
  /**
   * What a frame of a check's tests runs: the test file's code and the case
   * to run, or `null` to list the cases. Only checks pass it.
   */
  test?: SandboxTestParams;
  /**
   * Called with each test notification of a check's frame
   * (`readSandboxTestReport`). Running sandboxes pass none, and ignore them.
   */
  onTestReport?: (report: SandboxTestReport) => void;
}

/** The engine's side of one running mod. Mutable, because a channel is state. */
export interface ModSession {
  port: MessagePort;
  methodContext: ModMethodContext;
  onIssue: (issue: ModIssue) => void;
  /** Keys of the issues already reported, so each is reported once. */
  reportedIssueKeys: Set<string>;
  onMounted: (() => void) | null;
  onErrorResponse:
    ((method: string | null, error: ResponseError) => void) | null;
  onTestReport: ((report: SandboxTestReport) => void) | null;
  /** Whether blocked image and media reports get the redirect hint: tile links were on as the mod started. */
  hintsTileLinks: boolean;
  stopped: boolean;
}

/** Engine to mod: the resolved color scheme changed. The frame loader sets its attribute first. */
export const THEME_CHANGED_METHOD = "theme.changed";

/** Engine to mod: "Reload tiles" reloaded the mod's collection. */
export const TILES_CHANGED_METHOD = "tiles.changed";

/** JSON-RPC's code for an error inside the engine. It only answers a bug. */
const INTERNAL_ERROR = -32603;

/** Every request the engine answers: one handler table per namespace. */
export const ENGINE_METHODS: ModMethodTable = {
  ...STORAGE_METHODS,
  ...MODS_METHODS,
  ...LINKS_METHODS,
  ...FILES_METHODS,
  ...UI_METHODS,
  ...TILES_METHODS,
  ...PLAYERS_METHODS,
};

/** Two issues are equal when their level, source and message are equal. */
function buildIssueKey(issue: ModIssue): string {
  const issueKey = JSON.stringify([issue.level, issue.source, issue.message]);
  return issueKey;
}

function reportIssue(session: ModSession, issue: ModIssue): void {
  const issueKey = buildIssueKey(issue);
  if (session.reportedIssueKeys.has(issueKey)) {
    return;
  }
  session.reportedIssueKeys.add(issueKey);
  session.onIssue(issue);
}

function sendToMod(session: ModSession, message: object): void {
  if (session.stopped) {
    return;
  }
  session.port.postMessage(message);
}

/** Sends a response, and tells `onErrorResponse` about an error response that was sent. */
function sendResponse(
  session: ModSession,
  method: string | null,
  response: ResultResponse | ErrorResponse,
): void {
  if (session.stopped) {
    return;
  }
  session.port.postMessage(response);
  if ("error" in response && session.onErrorResponse !== null) {
    session.onErrorResponse(method, response.error);
  }
}

function buildMethodErrorResponse(
  request: ModRequest,
  error: unknown,
): ErrorResponse {
  if (error instanceof ModMethodError) {
    return buildErrorResponse(request.id, error.code, error.message);
  }
  console.error(error);
  return buildErrorResponse(
    request.id,
    INTERNAL_ERROR,
    `${request.method}: ${describeEngineError(error)}`,
  );
}

async function buildRequestResponse(
  session: ModSession,
  request: ModRequest,
): Promise<ResultResponse | ErrorResponse> {
  const method = findMethod(ENGINE_METHODS, request.method);
  if (method === null) {
    return buildErrorResponse(
      request.id,
      METHOD_NOT_FOUND,
      `Unknown method "${request.method}"`,
    );
  }
  try {
    const result = await method(session.methodContext, request.params);
    return buildResultResponse(request.id, result);
  } catch (error) {
    return buildMethodErrorResponse(request, error);
  }
}

/** Answers a request exactly once, unless the session stopped meanwhile. */
async function answerRequest(
  session: ModSession,
  request: ModRequest,
): Promise<void> {
  const response = await buildRequestResponse(session, request);
  sendResponse(session, request.method, response);
}

function reportBlockedRequest(session: ModSession, params: unknown): void {
  const blocked = readBlockedRequest(params);
  if (blocked === null) {
    return;
  }
  const context = session.methodContext;
  reportIssue(
    session,
    describeBlockedRequest(
      blocked,
      context.mod,
      context.grants,
      session.hintsTileLinks,
    ),
  );
}

function reportBlockedDialog(session: ModSession, params: unknown): void {
  const name = readBlockedDialog(params);
  if (name === null) {
    return;
  }
  reportIssue(session, describeBlockedDialog(name, session.methodContext.mod));
}

function reportMountFailure(session: ModSession, params: unknown): void {
  const message = readMountFailure(params);
  if (message === null) {
    return;
  }
  reportIssue(session, {
    level: "error",
    source: session.methodContext.mod.source,
    message: `The mod could not be mounted: ${message}`,
  });
}

function reportMounted(session: ModSession): void {
  if (session.onMounted !== null) {
    session.onMounted();
  }
}

function reportTestNotification(
  session: ModSession,
  notification: ModNotification,
): void {
  if (session.onTestReport === null) {
    return;
  }
  const report = readSandboxTestReport(
    notification.method,
    notification.params,
  );
  if (report !== null) {
    session.onTestReport(report);
  }
}

/**
 * The frame loader's notifications become issues, a finished mount is told
 * to `onMounted`, and the test runner's to `onTestReport`. Any other
 * notification is ignored.
 */
function handleModNotification(
  session: ModSession,
  notification: ModNotification,
): void {
  reportTestNotification(session, notification);
  if (notification.method === SANDBOX_BLOCKED_METHOD) {
    reportBlockedRequest(session, notification.params);
  }
  if (notification.method === SANDBOX_MOUNT_FAILED_METHOD) {
    reportMountFailure(session, notification.params);
    reportMounted(session);
  }
  if (notification.method === SANDBOX_MOUNTED_METHOD) {
    reportMounted(session);
  }
  if (notification.method === SANDBOX_DIALOG_BLOCKED_METHOD) {
    reportBlockedDialog(session, notification.params);
  }
}

/** The port's message handler, bound to its session. */
function handleModPortMessage(session: ModSession, event: MessageEvent): void {
  if (session.stopped) {
    return;
  }
  const message = readModMessage(event.data);
  if (message === null) {
    return;
  }
  if (message.kind === "invalid") {
    sendResponse(
      session,
      null,
      buildErrorResponse(
        message.id,
        INVALID_REQUEST,
        "Not a valid JSON-RPC 2.0 request",
      ),
    );
    return;
  }
  if (message.kind === "notification") {
    handleModNotification(session, message);
    return;
  }
  void answerRequest(session, message);
}

function buildMountContext(
  launchContext: LaunchContext,
  theme: Theme,
): ModContext {
  const context: ModContext = { ...launchContext, theme };
  return context;
}

function buildConnectParams(
  launch: ModLaunch,
  options: ModSessionOptions,
): SandboxConnectParams {
  const connectParams: SandboxConnectParams = {
    code: launch.mod.code,
    context: buildMountContext(launch.context, options.theme),
  };
  if (options.test !== undefined) {
    connectParams.test = options.test;
  }
  return connectParams;
}

/**
 * Opens the private channel to a mod's frame, sends it the mod's code and
 * its mount context with the session's theme (and, in a check's test frames,
 * the test params), and answers the mod's requests until the session is stopped.
 */
export function connectModSession(
  frameTarget: Pick<Window, "postMessage">,
  launch: ModLaunch,
  options: ModSessionOptions,
): ModSession {
  const port = openSandboxChannel(
    frameTarget,
    buildConnectParams(launch, options),
  );
  const session: ModSession = {
    port,
    methodContext: {
      mod: launch.mod,
      grants: launch.context.permissions,
      storage: options.storage,
      appOrigin: options.appOrigin,
      defaults: options.defaults,
      fetchOptions: options.fetchOptions,
      tileBodies: launch.tileBodies,
      readSiteDecisions: options.readSiteDecisions,
      onOpenLink: options.onOpenLink,
      onRequestAction: options.onRequestAction,
      onCheckMod: options.onCheckMod,
    },
    onIssue: options.onIssue,
    reportedIssueKeys: new Set(),
    onMounted: options.onMounted ?? null,
    onErrorResponse: options.onErrorResponse ?? null,
    onTestReport: options.onTestReport ?? null,
    hintsTileLinks: launch.tileLinks !== null,
    stopped: false,
  };
  port.onmessage = handleModPortMessage.bind(undefined, session);
  return session;
}

/**
 * Pushes `tiles.changed` with the reloaded tiles and their issues, and
 * replaces the session's tile bodies with theirs, so `tiles.renderBody` and
 * `players.open` follow the reloaded tiles.
 */
export function pushTilesChanged(
  session: ModSession,
  tiles: Tile[],
  issues: TileIssue[],
  tileBodies: TileBodies,
): void {
  session.methodContext.tileBodies = tileBodies;
  sendToMod(
    session,
    buildNotification(TILES_CHANGED_METHOD, { tiles, issues }),
  );
}

/** Pushes `theme.changed` with the new theme. */
export function pushThemeChanged(session: ModSession, theme: Theme): void {
  sendToMod(session, buildNotification(THEME_CHANGED_METHOD, theme));
}

/** Closes the channel. Later messages, pushes and answers to pending requests do nothing. */
export function stopModSession(session: ModSession): void {
  session.stopped = true;
  session.port.onmessage = null;
  session.port.close();
}
