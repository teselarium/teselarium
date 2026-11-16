import { describe, expect, it } from "vitest";
import {
  describeApiRangeMismatch,
  describeCancelledApiMismatch,
  describeMissingApiRange,
  isVersionInApiRange,
  matchModApiRange,
  MOD_API_VERSION,
} from "./mod_api_version.ts";

describe("MOD_API_VERSION", function describeModApiVersion(): void {
  it("Version of this API", function isCurrentVersion(): void {
    expect(MOD_API_VERSION).toBe("0.1.13");
  });
});

describe("isVersionInApiRange", function describeVersionInRange(): void {
  it("Caret range on 0.1", function matchesCaretOnZeroMinor(): void {
    expect(isVersionInApiRange("0.1.0", "^0.1.0")).toBe(true);
    expect(isVersionInApiRange("0.1.9", "^0.1.0")).toBe(true);
    expect(isVersionInApiRange("0.2.0", "^0.1.0")).toBe(false);
  });

  it("Range for a later API", function refusesLaterApi(): void {
    expect(isVersionInApiRange("0.1.0", "^0.2.0")).toBe(false);
  });

  it("Comparison range", function matchesComparison(): void {
    expect(isVersionInApiRange("0.1.0", ">=0.1.0 <1.0.0")).toBe(true);
  });
});

describe("matchModApiRange", function describeMatchModApiRange(): void {
  it("matches a range against the mod API version", function matchesApiVersion(): void {
    expect(matchModApiRange("^0.1.0")).toBe(true);
    expect(matchModApiRange("^0.2.0")).toBe(false);
  });

  it("gives null without a range", function givesNullWithoutRange(): void {
    expect(matchModApiRange(null)).toBeNull();
  });
});

describe("mod API texts", function describeModApiTexts(): void {
  it("names api and the version in the missing-range warning", function describesMissingRange(): void {
    const message = describeMissingApiRange();

    expect(message).toContain('"api"');
    expect(message).toContain(MOD_API_VERSION);
  });

  it("names the range and the version in the mismatch warning", function describesMismatch(): void {
    const message = describeApiRangeMismatch("^0.2.0");

    expect(message).toContain('"^0.2.0"');
    expect(message).toContain(MOD_API_VERSION);
  });

  it("names the range and the version in the cancel error", function describesCancel(): void {
    const message = describeCancelledApiMismatch("^0.2.0");

    expect(message).toContain("^0.2.0");
    expect(message).toContain(MOD_API_VERSION);
  });

  it("names api and the version in the cancel error without a range", function describesCancelWithoutRange(): void {
    const message = describeCancelledApiMismatch(null);

    expect(message).toContain('"api"');
    expect(message).toContain(MOD_API_VERSION);
  });
});
