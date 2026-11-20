import { describe, expect, it } from "vitest";
import { readNextThemeChoice, readThemeLabel } from "./theme_options.ts";

describe("theme options", function describeThemeOptions(): void {
  it("cycles System, Light, Dark and back to System", function cyclesChoices(): void {
    expect(readNextThemeChoice("system")).toBe("light");
    expect(readNextThemeChoice("light")).toBe("dark");
    expect(readNextThemeChoice("dark")).toBe("system");
  });

  it("labels each choice", function labelsChoices(): void {
    expect(readThemeLabel("system")).toBe("System");
    expect(readThemeLabel("dark")).toBe("Dark");
  });
});
