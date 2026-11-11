import { describe, expect, it } from "vitest";
import { readSandboxLayout } from "./stage_layout.ts";

describe("readSandboxLayout", function describeReadSandboxLayout(): void {
  it("is contained while theater mode is off", function readsContained(): void {
    expect(readSandboxLayout(false, null, "sandbox-1")).toBe("contained");
  });

  it("is theater while theater mode is on", function readsTheater(): void {
    expect(readSandboxLayout(true, null, "sandbox-1")).toBe("theater");
  });

  it("is fullscreen for the fullscreen sandbox, whatever theater mode is", function readsFullscreen(): void {
    expect(readSandboxLayout(false, "sandbox-1", "sandbox-1")).toBe(
      "fullscreen",
    );
    expect(readSandboxLayout(true, "sandbox-1", "sandbox-1")).toBe(
      "fullscreen",
    );
  });

  it("ignores a fullscreen id that names another sandbox", function readsOtherSandbox(): void {
    expect(readSandboxLayout(false, "sandbox-2", "sandbox-1")).toBe(
      "contained",
    );
    expect(readSandboxLayout(true, "sandbox-2", "sandbox-1")).toBe("theater");
  });
});
