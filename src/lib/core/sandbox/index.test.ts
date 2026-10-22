import { describe, expect, it } from "vitest";
import * as sandboxModule from "./index.ts";

describe("sandbox module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(sandboxModule).sort()).toEqual([
      "SANDBOX_BLOCKED_METHOD",
      "SANDBOX_CONNECT_METHOD",
      "SANDBOX_DIALOG_BLOCKED_METHOD",
      "SANDBOX_MOUNT_FAILED_METHOD",
      "buildSandboxDocument",
      "buildSandboxPolicy",
      "collectContentHosts",
      "describeBlockedDialog",
      "describeBlockedRequest",
      "openSandboxChannel",
      "readBlockedDialog",
      "readBlockedRequest",
      "readMountFailure",
    ]);
  });
});
