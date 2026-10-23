import type { ReactElement } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";
import type { ModIssue } from "../../lib/mod/index.ts";
import type { IssueLevel } from "../../lib/tile/index.ts";

interface IssueListProps {
  issues: readonly ModIssue[];
}

/**
 * The level badge's colors: an outline badge in the level's role, like the
 * `destructive` and `warning` badges of the mods' base stylesheet. shadcn's
 * Badge has no warning variant.
 */
const LEVEL_BADGE_CLASSES: Readonly<Record<IssueLevel, string>> = {
  error: "border-destructive text-destructive",
  warning: "border-warning text-warning",
};

function renderIssue(issue: ModIssue, index: number): ReactElement {
  return (
    <li key={index} className="[overflow-wrap:anywhere]">
      <Badge variant="outline" className={LEVEL_BADGE_CLASSES[issue.level]}>
        {issue.level}
      </Badge>{" "}
      <code>{issue.source}</code> <span>{issue.message}</span>
    </li>
  );
}

/** The issues of the visible sandbox, in the order they were found. */
export function IssueList({ issues }: IssueListProps): ReactElement {
  if (issues.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No issues.</p>;
  }
  const items: ReactElement[] = [];
  for (const [index, issue] of issues.entries()) {
    items.push(renderIssue(issue, index));
  }
  return (
    <ul
      className="mt-2 list-disc space-y-1 pl-5 text-sm marker:text-muted-foreground"
      aria-label="Issues"
    >
      {items}
    </ul>
  );
}
