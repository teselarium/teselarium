import type { ModTileIssue } from "../../mod_api.d.ts";
import { buildBadge } from "./page_elements.ts";

/** An issue: its level as a badge, its message and its source, as the mod viewer shows check findings. */
function buildIssueItem(issue: ModTileIssue): HTMLElement {
  const item = document.createElement("li");
  const variant = issue.level === "error" ? "destructive" : "warning";
  const source = document.createElement("code");
  source.textContent = issue.source;
  item.append(buildBadge(issue.level, variant), ` ${issue.message} `, source);
  return item;
}

/**
 * The collection's entry issues as a section with a list, or nothing when
 * there are none: the elements to add to the page.
 */
export function buildEntryIssues(issues: ModTileIssue[]): HTMLElement[] {
  const elements: HTMLElement[] = [];
  if (issues.length === 0) {
    return elements;
  }
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Entry issues");
  const heading = document.createElement("h2");
  heading.textContent = "Entry issues";
  const list = document.createElement("ul");
  for (const issue of issues) {
    list.append(buildIssueItem(issue));
  }
  section.append(heading, list);
  elements.push(section);
  return elements;
}
