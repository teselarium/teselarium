import type { IssueLevel } from "../../tile/index.ts";

/** The part of a check that found a problem: loading the files, or mounting the mod. */
export type ModCheckStep = "bundle" | "mount";

/** `"fail"` with an error finding, `"warn"` with warnings only, `"pass"` without findings. */
export type ModCheckStatus = "pass" | "warn" | "fail";

/** A problem found by a mod check. `source` is the file or mod it is about. */
export interface ModCheckFinding {
  step: ModCheckStep;
  level: IssueLevel;
  source: string;
  message: string;
}

/** The result of a mod check. Plain data. */
export interface ModCheckReport {
  /** Resolved URL of the checked mod file. */
  source: string;
  status: ModCheckStatus;
  /** Whether the mod was mounted, which needs a bundle without errors. */
  mountChecked: boolean;
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

/** Builds the report of a check, with its status read from the findings' levels. */
export function buildModCheckReport(
  source: string,
  findings: ModCheckFinding[],
  mountChecked: boolean,
): ModCheckReport {
  const report: ModCheckReport = {
    source,
    status: readCheckStatus(findings),
    mountChecked,
    findings: copyFindings(findings),
  };
  return report;
}
