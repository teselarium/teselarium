import type { IssueLevel } from "../../tile/index.ts";

/** The part of a check that found a problem: loading the files, mounting the mod, or running its tests. */
export type ModCheckStep = "bundle" | "mount" | "test";

/** `"fail"` with an error finding, `"warn"` with warnings only, `"pass"` without findings. */
export type ModCheckStatus = "pass" | "warn" | "fail";

/** A problem found by a mod check. `source` is the file or mod it is about. */
export interface ModCheckFinding {
  step: ModCheckStep;
  level: IssueLevel;
  source: string;
  message: string;
}

/** The result of one test case of a mod. `message` is `null` for a passing case. */
export interface ModTestResult {
  name: string;
  status: "pass" | "fail";
  message: string | null;
}

/** The result of a mod check. Plain data. */
export interface ModCheckReport {
  /** Resolved URL of the checked mod file, or `null` when a mosaic check failed before its mod was known. */
  source: string | null;
  /** Resolved URL of the mosaic file the check used, or `null` when it used none. */
  mosaic: string | null;
  status: ModCheckStatus;
  /** Whether the mod was mounted, which needs a bundle without errors. */
  mountChecked: boolean;
  /** Whether the mod's test cases ran. */
  testsChecked: boolean;
  /** The result of each test case, in order. */
  tests: ModTestResult[];
  /** The findings in the order they were found. */
  findings: ModCheckFinding[];
}

function readCheckStatus(findings: ModCheckFinding[]): ModCheckStatus {
  let status: ModCheckStatus = "pass";
  for (const finding of findings) {
    if (finding.level === "error") {
      return "fail";
    }
    status = "warn";
  }
  return status;
}

function copyFindings(findings: ModCheckFinding[]): ModCheckFinding[] {
  const findingCopies: ModCheckFinding[] = [];
  for (const finding of findings) {
    findingCopies.push({ ...finding });
  }
  return findingCopies;
}

function copyTestResults(tests: ModTestResult[] | null): ModTestResult[] {
  const testCopies: ModTestResult[] = [];
  if (tests === null) {
    return testCopies;
  }
  for (const test of tests) {
    testCopies.push({ ...test });
  }
  return testCopies;
}

/** What a check report is about: the mod file and the mosaic file the check used. */
export interface CheckedFiles {
  source: string | null;
  mosaic: string | null;
}

/**
 * Builds the report of a check of `checkedFiles`, with its status read from
 * the findings' levels, which already hold each failed case. `tests` is
 * `null` when the cases did not run.
 */
export function buildModCheckReport(
  checkedFiles: CheckedFiles,
  findings: ModCheckFinding[],
  mountChecked: boolean,
  tests: ModTestResult[] | null,
): ModCheckReport {
  const report: ModCheckReport = {
    source: checkedFiles.source,
    mosaic: checkedFiles.mosaic,
    status: readCheckStatus(findings),
    mountChecked,
    testsChecked: tests !== null,
    tests: copyTestResults(tests),
    findings: copyFindings(findings),
  };
  return report;
}
