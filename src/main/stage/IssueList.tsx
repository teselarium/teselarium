import type { ReactElement } from "react";
import type { ModIssue } from "../../lib/mod/index.ts";

interface IssueListProps {
  issues: readonly ModIssue[];
}

function renderIssue(issue: ModIssue, index: number): ReactElement {
  return (
    <li key={index} className={`issue issue-${issue.level}`}>
      <strong>{issue.level}</strong> <code>{issue.source}</code>{" "}
      <span>{issue.message}</span>
    </li>
  );
}

/** The issues of the visible sandbox, in the order they were found. */
export function IssueList({ issues }: IssueListProps): ReactElement {
  if (issues.length === 0) {
    return <p className="issues-empty">No issues.</p>;
  }
  const items: ReactElement[] = [];
  for (const [index, issue] of issues.entries()) {
    items.push(renderIssue(issue, index));
  }
  return (
    <ul className="issues" aria-label="Issues">
      {items}
    </ul>
  );
}
