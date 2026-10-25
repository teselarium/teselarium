import { describe, expect, it } from "vitest";
import {
  MISSING_MOD_SOURCE,
  SAMPLE_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import { buildModCheckReport } from "./mod_check_report.ts";
import type { ModCheckFinding } from "./mod_check_report.ts";

const RANGE_WARNING: ModCheckFinding = {
  step: "bundle",
  level: "warning",
  source: SAMPLE_MOD_SOURCE,
  message: 'The mod declares no "api" range.',
};

const MOUNT_ERROR: ModCheckFinding = {
  step: "mount",
  level: "error",
  source: SAMPLE_MOD_SOURCE,
  message: "The mod failed to mount: map failed",
};

describe("Check report", function describeCheckReport(): void {
  it("passes without findings", function passesWithoutFindings(): void {
    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, [], true);

    expect(report).toEqual({
      source: SAMPLE_MOD_SOURCE,
      status: "pass",
      mountChecked: true,
      findings: [],
    });
  });

  it("Warnings only", function warnsWithWarningsOnly(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [RANGE_WARNING],
      true,
    );

    expect(report.status).toBe("warn");
    expect(report.findings).toEqual([RANGE_WARNING]);
  });

  it("fails when a finding is an error", function failsWithError(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [RANGE_WARNING, MOUNT_ERROR],
      true,
    );

    expect(report.status).toBe("fail");
    expect(report.findings).toEqual([RANGE_WARNING, MOUNT_ERROR]);
  });

  it("keeps whether the mount check ran", function keepsMountChecked(): void {
    const report = buildModCheckReport(MISSING_MOD_SOURCE, [], false);

    expect(report.mountChecked).toBe(false);
  });

  it("does not share the findings it was given", function copiesFindings(): void {
    const findings = [RANGE_WARNING];

    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, findings, true);
    findings.push(MOUNT_ERROR);

    expect(report.findings).toEqual([RANGE_WARNING]);
    expect(report.status).toBe("warn");
  });

  it("Plain data", function isPlainData(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [RANGE_WARNING, MOUNT_ERROR],
      true,
    );

    expect(structuredClone(report)).toEqual(report);
  });
});
