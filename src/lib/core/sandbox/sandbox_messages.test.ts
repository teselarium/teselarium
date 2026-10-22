import { describe, expect, it } from "vitest";
import {
  readBlockedDialog,
  readBlockedRequest,
  readMountFailure,
  SANDBOX_BLOCKED_METHOD,
  SANDBOX_CONNECT_METHOD,
  SANDBOX_DIALOG_BLOCKED_METHOD,
  SANDBOX_MOUNT_FAILED_METHOD,
} from "./index.ts";
import { THEME_CHANGED_METHOD } from "../engine/index.ts";
import SANDBOX_LOADER from "./sandbox_loader.js?raw";

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

describe("frame loader message names", function describeMethodNames(): void {
  it("match the ones the frame loader uses", function matchesLoader(): void {
    const methodNames = [
      SANDBOX_CONNECT_METHOD,
      SANDBOX_BLOCKED_METHOD,
      SANDBOX_MOUNT_FAILED_METHOD,
      SANDBOX_DIALOG_BLOCKED_METHOD,
    ];

    for (const methodName of methodNames) {
      expect(SANDBOX_LOADER).toContain(`"${methodName}"`);
    }
    expect(methodNames).toEqual([
      "sandbox.connect",
      "sandbox.blocked",
      "sandbox.mountFailed",
      "sandbox.dialogBlocked",
    ]);
  });

  it("include the engine's theme.changed event", function matchesThemeChanged(): void {
    expect(THEME_CHANGED_METHOD).toBe("theme.changed");
    expect(SANDBOX_LOADER).toContain(
      `const THEME_CHANGED_METHOD = "${THEME_CHANGED_METHOD}";`,
    );
  });
});
