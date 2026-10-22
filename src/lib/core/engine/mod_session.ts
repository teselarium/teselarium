import type { FileFetchOptions } from "../../files/index.ts";
import type { ModIssue } from "../../mod/index.ts";
import type { Tile, TileIssue } from "../../tile/index.ts";
import {
  describeBlockedRequest,
  openSandboxChannel,
  readBlockedRequest,
  readMountFailure,
  SANDBOX_BLOCKED_METHOD,
  SANDBOX_MOUNT_FAILED_METHOD,
} from "../sandbox/index.ts";
import type { ModStorage } from "../storage/index.ts";
import type { Theme } from "../theme/index.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { describeEngineError, ModMethodError } from "./engine_errors.ts";
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
  ResultResponse,
} from "./mod_messages.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";
import { MODS_METHODS } from "./mods_methods.ts";
import { STORAGE_METHODS } from "./storage_methods.ts";

/** The services a session needs from the app. */
export interface ModSessionOptions {
  storage: ModStorage;
  appOrigin: string;
  defaults: ResolvedDefaultModSettings;
  /** `baseUrl` is the app's address. */
  fetchOptions: FileFetchOptions;
  onIssue: (issue: ModIssue) => void;
  /** Asks the stage to open a link. `false` when the sandbox is not the visible one. */
  onOpenLink: (link: RunLink) => boolean;
  /** The theme the mod mounts with: the one current when the frame connects. */
  theme: Theme;
}

/** The engine's side of one running mod. Mutable, because a channel is state. */
export interface ModSession {
  port: MessagePort;
  methodContext: ModMethodContext;
  onIssue: (issue: ModIssue) => void;
  /** Keys of the issues already reported, so each is reported once. */
  reportedIssueKeys: Set<string>;
  stopped: boolean;
}

/** Engine to mod: the resolved color scheme changed. The frame loader sets its attribute first. */
export const THEME_CHANGED_METHOD = "theme.changed";

/** JSON-RPC's code for an error inside the engine. It only answers a bug. */
const INTERNAL_ERROR = -32603;

/** Every request the engine answers: one handler table per namespace. */
const ENGINE_METHODS: ModMethodTable = {
  ...STORAGE_METHODS,
  ...MODS_METHODS,
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
  sendToMod(session, response);
}

function reportBlockedRequest(session: ModSession, params: unknown): void {
  const blocked = readBlockedRequest(params);
  if (blocked === null) {
    return;
  }
  const context = session.methodContext;
  reportIssue(
    session,
    describeBlockedRequest(blocked, context.mod, context.grants),
  );
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

/** The frame loader's notifications become issues. Any other notification is ignored. */
function handleModNotification(
  session: ModSession,
  notification: ModNotification,
): void {
  if (notification.method === SANDBOX_BLOCKED_METHOD) {
    reportBlockedRequest(session, notification.params);
  }
  if (notification.method === SANDBOX_MOUNT_FAILED_METHOD) {
    reportMountFailure(session, notification.params);
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
    sendToMod(
      session,
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

/**
 * Opens the private channel to a mod's frame, sends it the mod's code and
 * its mount context with the session's theme, and answers the mod's requests until the session is stopped.
 */
export function connectModSession(
  frameTarget: Pick<Window, "postMessage">,
  launch: ModLaunch,
  options: ModSessionOptions,
): ModSession {
  const port = openSandboxChannel(frameTarget, {
    code: launch.mod.code,
    context: buildMountContext(launch.context, options.theme),
  });
  const session: ModSession = {
    port,
    methodContext: {
      mod: launch.mod,
      grants: launch.context.permissions,
      storage: options.storage,
      appOrigin: options.appOrigin,
      defaults: options.defaults,
      fetchOptions: options.fetchOptions,
      onOpenLink: options.onOpenLink,
    },
    onIssue: options.onIssue,
    reportedIssueKeys: new Set(),
    stopped: false,
  };
  port.onmessage = handleModPortMessage.bind(undefined, session);
  return session;
}

/** Pushes `tiles.changed` with the reloaded tiles and their issues. */
export function pushTilesChanged(
  session: ModSession,
  tiles: Tile[],
  issues: TileIssue[],
): void {
  sendToMod(session, buildNotification("tiles.changed", { tiles, issues }));
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
