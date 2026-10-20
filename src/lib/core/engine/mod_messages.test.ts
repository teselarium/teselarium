import { describe, expect, it } from "vitest";
import {
  buildErrorResponse,
  buildNotification,
  buildResultResponse,
  findMethod,
  INVALID_PARAMS,
  INVALID_REQUEST,
  isSandboxMethod,
  LOAD_FAILED,
  METHOD_NOT_FOUND,
  MOD_SWITCHED_OFF,
  PERMISSION_DENIED,
  readModMessage,
  STORAGE_FAILED,
} from "./mod_messages.ts";

describe("readModMessage", function describeReadModMessage(): void {
  it("reads a request", function readsRequest(): void {
    const message = readModMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "storage.get",
      params: { key: "selected" },
    });

    expect(message).toEqual({
      kind: "request",
      id: 7,
      method: "storage.get",
      params: { key: "selected" },
    });
  });

  it("reads a request with a string id and no params", function readsStringId(): void {
    const message = readModMessage({
      jsonrpc: "2.0",
      id: "a",
      method: "storage.get",
    });

    expect(message).toEqual({
      kind: "request",
      id: "a",
      method: "storage.get",
      params: {},
    });
  });

  it("reads a notification", function readsNotification(): void {
    const message = readModMessage({
      jsonrpc: "2.0",
      method: "sandbox.blocked",
      params: { blockedUrl: "https://x.net/a.png", directive: "img-src" },
    });

    expect(message).toEqual({
      kind: "notification",
      method: "sandbox.blocked",
      params: { blockedUrl: "https://x.net/a.png", directive: "img-src" },
    });
  });

  it("reads a request with params that are not a mapping as invalid", function readsListParams(): void {
    const message = readModMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "storage.get",
      params: ["selected"],
    });

    expect(message).toEqual({ kind: "invalid", id: 3 });
  });

  it("Not a JSON-RPC request", function readsInvalidRequest(): void {
    const message = readModMessage({ id: 4, method: 12 });

    expect(message).toEqual({ kind: "invalid", id: 4 });
  });

  it("ignores data without an id", function ignoresNoId(): void {
    expect(readModMessage({ method: 12 })).toBeNull();
    expect(readModMessage({ jsonrpc: "2.0", method: "x", id: null })).toBe(
      null,
    );
    expect(readModMessage("storage.get")).toBeNull();
    expect(readModMessage(null)).toBeNull();
  });
});

describe("findMethod", function describeFindMethod(): void {
  it("finds an own method", function findsMethod(): void {
    const table = { "storage.get": "handler" };

    expect(findMethod(table, "storage.get")).toBe("handler");
  });

  it("does not find inherited names", function ignoresInherited(): void {
    const table = { "storage.get": "handler" };

    expect(findMethod(table, "toString")).toBeNull();
    expect(findMethod(table, "__proto__")).toBeNull();
    expect(findMethod(table, "constructor")).toBeNull();
  });
});

describe("isSandboxMethod", function describeIsSandboxMethod(): void {
  it("reserves the sandbox. prefix", function reservesPrefix(): void {
    expect(isSandboxMethod("sandbox.blocked")).toBe(true);
    expect(isSandboxMethod("storage.get")).toBe(false);
  });
});

describe("error codes", function describeErrorCodes(): void {
  it("have the JSON-RPC and engine values", function hasValues(): void {
    expect([
      INVALID_REQUEST,
      METHOD_NOT_FOUND,
      INVALID_PARAMS,
      STORAGE_FAILED,
      LOAD_FAILED,
      PERMISSION_DENIED,
      MOD_SWITCHED_OFF,
    ]).toEqual([-32600, -32601, -32602, -32000, -32001, -32002, -32003]);
  });
});

describe("message builders", function describeBuilders(): void {
  it("Response matches the request id", function buildsResult(): void {
    expect(buildResultResponse(7, "kallocain")).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: "kallocain",
    });
  });

  it("builds an error response", function buildsError(): void {
    expect(
      buildErrorResponse(4, INVALID_REQUEST, "Not a JSON-RPC request"),
    ).toEqual({
      jsonrpc: "2.0",
      id: 4,
      error: { code: -32600, message: "Not a JSON-RPC request" },
    });
  });

  it("Events have no id", function buildsNotification(): void {
    const notification = buildNotification("tiles.changed", {
      tiles: [],
      issues: [],
    });

    expect(notification).toEqual({
      jsonrpc: "2.0",
      method: "tiles.changed",
      params: { tiles: [], issues: [] },
    });
    expect(notification).not.toHaveProperty("id");
  });
});
