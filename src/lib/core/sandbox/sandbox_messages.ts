import type { BlockedDialogName, BlockedRequest } from "./sandbox_reports.ts";

/** Engine to frame, on `window`: carries the port and the mod's code and context. */
export const SANDBOX_CONNECT_METHOD = "sandbox.connect";

/** Frame to engine: a request the frame's policy blocked. */
export const SANDBOX_BLOCKED_METHOD = "sandbox.blocked";

/** Frame to engine: the mod could not be imported or mounted. */
export const SANDBOX_MOUNT_FAILED_METHOD = "sandbox.mountFailed";

/** Frame to engine: the mod called a browser dialog function the sandbox blocks. */
export const SANDBOX_DIALOG_BLOCKED_METHOD = "sandbox.dialogBlocked";

const BLOCKED_DIALOG_NAMES: ReadonlySet<string> = new Set([
  "alert",
  "confirm",
  "prompt",
  "print",
]);

/** The params of `sandbox.connect`. `context` is the mod's mount context, plain data. */
export interface SandboxConnectParams {
  code: string;
  context: unknown;
}

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
