import { describe, expect, it } from "vitest";
import {
  MISSING_MOD_SOURCE,
  SAMPLE_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import { buildModCheckReport } from "./mod_check_report.ts";
import type { ModCheckFinding, ModTestResult } from "./mod_check_report.ts";

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

const TEST_SOURCE = "https://example.org/samples/mods/book_list/test.js";

const PASSING_CASE: ModTestResult = {
  name: "lists the sample books",
  status: "pass",
  message: null,
};

const FAILING_CASE: ModTestResult = {
  name: "lists books",
  status: "fail",
  message: "no books",
};

const FAILED_CASE_ERROR: ModCheckFinding = {
  step: "test",
  level: "error",
  source: TEST_SOURCE,
  message: 'The test "lists books" failed: no books',
};

describe("Check report", function describeCheckReport(): void {
  it("passes without findings", function passesWithoutFindings(): void {
    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, [], true, null);

    expect(report).toEqual({
      source: SAMPLE_MOD_SOURCE,
      status: "pass",
      mountChecked: true,
      testsChecked: false,
      tests: [],
      findings: [],
    });
  });

  it("Warnings only", function warnsWithWarningsOnly(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [RANGE_WARNING],
      true,
      null,
    );

    expect(report.status).toBe("warn");
    expect(report.findings).toEqual([RANGE_WARNING]);
  });

  it("fails when a finding is an error", function failsWithError(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [RANGE_WARNING, MOUNT_ERROR],
      true,
      null,
    );

    expect(report.status).toBe("fail");
    expect(report.findings).toEqual([RANGE_WARNING, MOUNT_ERROR]);
  });

  it("keeps whether the mount check ran", function keepsMountChecked(): void {
    const report = buildModCheckReport(MISSING_MOD_SOURCE, [], false, null);

    expect(report.mountChecked).toBe(false);
  });

  it("does not share the findings it was given", function copiesFindings(): void {
    const findings = [RANGE_WARNING];

    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, findings, true, null);
    findings.push(MOUNT_ERROR);

    expect(report.findings).toEqual([RANGE_WARNING]);
    expect(report.status).toBe("warn");
  });

  it("Plain data", function isPlainData(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [RANGE_WARNING, MOUNT_ERROR],
      true,
      null,
    );

    expect(structuredClone(report)).toEqual(report);
  });

  it("Mod without tests", function hasNoTests(): void {
    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, [], true, null);

    expect(report.testsChecked).toBe(false);
    expect(report.tests).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it("Passing case", function keepsPassingCase(): void {
    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, [], true, [
      PASSING_CASE,
    ]);

    expect(report.testsChecked).toBe(true);
    expect(report.tests).toEqual([
      { name: "lists the sample books", status: "pass", message: null },
    ]);
    expect(report.status).toBe("pass");
  });

  it("Failed case in the findings", function failsWithFailedCase(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [FAILED_CASE_ERROR],
      true,
      [PASSING_CASE, FAILING_CASE],
    );

    expect(report.status).toBe("fail");
    expect(report.tests).toEqual([PASSING_CASE, FAILING_CASE]);
    expect(report.findings).toEqual([FAILED_CASE_ERROR]);
  });

  it("does not share the test results it was given", function copiesTests(): void {
    const tests = [PASSING_CASE];

    const report = buildModCheckReport(SAMPLE_MOD_SOURCE, [], true, tests);
    tests.push(FAILING_CASE);
    report.tests[0].name = "renamed";

    expect(report.tests).toHaveLength(1);
    expect(PASSING_CASE.name).toBe("lists the sample books");
  });

  it("Plain data with tests", function isPlainDataWithTests(): void {
    const report = buildModCheckReport(
      SAMPLE_MOD_SOURCE,
      [FAILED_CASE_ERROR],
      true,
      [PASSING_CASE, FAILING_CASE],
    );

    expect(structuredClone(report)).toEqual(report);
  });
});
