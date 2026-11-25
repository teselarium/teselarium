// A copy of the mod viewer's report rendering (mod_viewer/src/check_report.ts)
// without its tests list, since a mosaic check reports no tests of its own
// here and a default mod cannot import another mod's files (design.md of
// add-mosaic-explorer, D4). Keep both copies alike.

import type { ModCheckFinding, ModCheckReport } from "../../mod_api.d.ts";
import { buildBadge } from "./page_elements.ts";

/** The badge variant of each check status. */
const CHECK_STATUS_VARIANTS: Record<ModCheckReport["status"], string> = {
  pass: "success",
  warn: "warning",
  fail: "destructive",
};

/** The heading of each check status. */
const CHECK_STATUS_TITLES: Record<ModCheckReport["status"], string> = {
  pass: "Check passed",
  warn: "Check passed with warnings",
  fail: "Check failed",
};

/** A finding: its level as a badge, its step and message, and its source. */
function buildFindingItem(finding: ModCheckFinding): HTMLElement {
  const item = document.createElement("li");
  const variant = finding.level === "error" ? "destructive" : "warning";
  const source = document.createElement("code");
  source.textContent = finding.source;
  item.append(
    buildBadge(finding.level, variant),
    ` ${finding.step}: ${finding.message} `,
    source,
  );
  return item;
}

function buildFindingList(findings: ModCheckFinding[]): HTMLElement {
  if (findings.length === 0) {
    const none = document.createElement("p");
    none.textContent = "No findings.";
    return none;
  }
  const list = document.createElement("ul");
  list.setAttribute("aria-label", "Findings");
  for (const finding of findings) {
    list.append(buildFindingItem(finding));
  }
  return list;
}

function buildReportHeading(report: ModCheckReport): HTMLElement {
  const heading = document.createElement("h2");
  heading.append(
    CHECK_STATUS_TITLES[report.status] ?? report.status,
    " ",
    buildBadge(
      report.status,
      CHECK_STATUS_VARIANTS[report.status] ?? "outline",
    ),
  );
  return heading;
}

/** The report of `mosaics.check`: its status as a badge, then its findings. */
export function buildCheckReport(report: ModCheckReport): HTMLElement {
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Check report");
  section.append(buildReportHeading(report));
  if (!report.mountChecked) {
    const notice = document.createElement("p");
    notice.textContent = "The mod was not mounted: its files have errors.";
    section.append(notice);
  }
  section.append(buildFindingList(report.findings));
  return section;
}
