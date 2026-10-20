import { isYamlMapping } from "../../files/index.ts";
import type { YamlMapping } from "../../files/index.ts";

/** The request is not a valid JSON-RPC 2.0 request, but has an `id`. */
export const INVALID_REQUEST = -32600;
/** No engine method has that name. */
export const METHOD_NOT_FOUND = -32601;
/** The params do not have the shape the method needs. */
export const INVALID_PARAMS = -32602;
/** The browser storage failed. */
export const STORAGE_FAILED = -32000;
/** A mod file could not be loaded. */
export const LOAD_FAILED = -32001;
/** The mod has no granted permission for the request. */
export const PERMISSION_DENIED = -32002;
/** The requested default mod is switched off. */
export const MOD_SWITCHED_OFF = -32003;

/** Methods with this prefix belong to the frame loader. */
const SANDBOX_METHOD_PREFIX = "sandbox.";

const JSON_RPC_VERSION = "2.0";

export type MessageId = string | number;

/** A request from a mod. Absent params are read as an empty mapping. */
export interface ModRequest {
  kind: "request";
  id: MessageId;
  method: string;
  params: YamlMapping;
}

/** A notification from a mod: a request without `id`, never answered. */
export interface ModNotification {
  kind: "notification";
  method: string;
  params: YamlMapping;
}

/** Data with an `id` that is not a valid request. It is answered with `INVALID_REQUEST`. */
export interface InvalidModRequest {
  kind: "invalid";
  id: MessageId;
}

export type ModMessage = ModRequest | ModNotification | InvalidModRequest;

export interface ResponseError {
  code: number;
  message: string;
}

export interface ResultResponse {
  jsonrpc: "2.0";
  id: MessageId;
  /** Plain data built by a request handler. */
  result: unknown;
}

export interface ErrorResponse {
  jsonrpc: "2.0";
  id: MessageId;
  error: ResponseError;
}

export interface EngineNotification {
  jsonrpc: "2.0";
  method: string;
  params: object;
}

function isMessageId(value: unknown): value is MessageId {
  return typeof value === "string" || typeof value === "number";
}

/** Params absent or a mapping. Absent params become an empty mapping, anything else `null`. */
function readParams(data: YamlMapping): YamlMapping | null {
  if (!Object.hasOwn(data, "params")) {
    const noParams: YamlMapping = {};
    return noParams;
  }
  if (!isYamlMapping(data.params)) {
    return null;
  }
  return data.params;
}

function readWellFormedMessage(
  data: YamlMapping,
): ModRequest | ModNotification | null {
  const params = readParams(data);
  if (
    data.jsonrpc !== JSON_RPC_VERSION ||
    typeof data.method !== "string" ||
    params === null
  ) {
    return null;
  }
  if (isMessageId(data.id)) {
    const request: ModRequest = {
      kind: "request",
      id: data.id,
      method: data.method,
      params,
    };
    return request;
  }
  if (Object.hasOwn(data, "id")) {
    return null;
  }
  const notification: ModNotification = {
    kind: "notification",
    method: data.method,
    params,
  };
  return notification;
}

/**
 * Sorts data received from a mod: a request, a notification, an invalid
 * request that has a string or number `id`, or `null` for anything else,
 * which is ignored.
 */
export function readModMessage(data: unknown): ModMessage | null {
  if (!isYamlMapping(data)) {
    return null;
  }
  const message = readWellFormedMessage(data);
  if (message !== null) {
    return message;
  }
  if (!isMessageId(data.id)) {
    return null;
  }
  const invalidRequest: InvalidModRequest = { kind: "invalid", id: data.id };
  return invalidRequest;
}

/** Looks a method up in a handler table. Inherited names such as `toString` are not methods. */
export function findMethod<Method>(
  table: Record<string, Method>,
  method: string,
): Method | null {
  if (!Object.hasOwn(table, method)) {
    return null;
  }
  return table[method];
}

/** True for the `sandbox.` methods of the frame loader. */
export function isSandboxMethod(method: string): boolean {
  return method.startsWith(SANDBOX_METHOD_PREFIX);
}

export function buildResultResponse(
  id: MessageId,
  result: unknown,
): ResultResponse {
  const response: ResultResponse = { jsonrpc: JSON_RPC_VERSION, id, result };
  return response;
}

export function buildErrorResponse(
  id: MessageId,
  code: number,
  message: string,
): ErrorResponse {
  const response: ErrorResponse = {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: { code, message },
  };
  return response;
}

/** An event the engine pushes to a mod: no `id`, never answered. */
export function buildNotification(
  method: string,
  params: object,
): EngineNotification {
  const notification: EngineNotification = {
    jsonrpc: JSON_RPC_VERSION,
    method,
    params,
  };
  return notification;
}
