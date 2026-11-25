import { useId, useState } from "react";
import type { ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { Checkbox } from "@/vendor/shadcn/ui/checkbox.tsx";
import {
  describePermissionLine,
  isDecisionOf,
  readDecisionDeclarer,
} from "../../lib/core/permissions/index.ts";
import type {
  DecisionDeclarer,
  SiteDecision,
} from "../../lib/core/permissions/index.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  readSiteDecisionsSnapshot,
  rememberSiteDecisions,
  removeDeclaredSiteDecisions,
  removeSiteDecision,
  subscribeSiteDecisions,
} from "./site_decisions.ts";
import type { SiteDecisions } from "./site_decisions.ts";

/** The remembered decisions of one mod file or one mosaic file. */
interface ModDecisionGroup {
  declarer: DecisionDeclarer;
  /** The title of the last remembered decision, so a renamed mod or mosaic shows its newer title. */
  title: string;
  /** Sorted by category, then host. */
  decisions: SiteDecision[];
}

/** What a checkbox shows or reports: `"indeterminate"` for a mixed group. */
type CheckedState = boolean | "indeterminate";

/**
 * The vendored Checkbox styles only the checked state. A mixed group gets the
 * checked colors, and a dash in place of the tick.
 */
const MIXED_CHECKBOX_CLASSES =
  "relative data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:[&_svg]:hidden data-[state=indeterminate]:after:absolute data-[state=indeterminate]:after:inset-x-[3px] data-[state=indeterminate]:after:top-1/2 data-[state=indeterminate]:after:h-0.5 data-[state=indeterminate]:after:-translate-y-1/2 data-[state=indeterminate]:after:rounded-full data-[state=indeterminate]:after:bg-current";

interface SiteDecisionListProps {
  siteDecisions: SiteDecisions;
}

interface ModGroupItemProps {
  group: ModDecisionGroup;
  siteDecisions: SiteDecisions;
}

interface SiteDecisionRowProps {
  decision: SiteDecision;
  /** The group's title, for the accessible names. */
  title: string;
  siteDecisions: SiteDecisions;
}

function compareKeys(firstKey: string[], secondKey: string[]): number {
  for (let index = 0; index < firstKey.length; index += 1) {
    const order = firstKey[index].localeCompare(secondKey[index]);
    if (order !== 0) {
      return order;
    }
  }
  return 0;
}

function compareDecisionLines(
  first: SiteDecision,
  second: SiteDecision,
): number {
  return compareKeys(
    [first.category, first.host],
    [second.category, second.host],
  );
}

/**
 * By title, then source, mods and mosaics together, so the list does not
 * move when a decision is added.
 */
function compareGroups(
  first: ModDecisionGroup,
  second: ModDecisionGroup,
): number {
  return compareKeys(
    [first.title, first.declarer.source, first.declarer.subject],
    [second.title, second.declarer.source, second.declarer.subject],
  );
}

function findGroup(
  groups: ModDecisionGroup[],
  decision: SiteDecision,
): ModDecisionGroup | null {
  for (const group of groups) {
    if (isDecisionOf(decision, group.declarer)) {
      return group;
    }
  }
  return null;
}

/**
 * One group per mod file and per mosaic file, in the order of the snapshot,
 * which ends with the latest decisions.
 */
function collectGroups(decisions: readonly SiteDecision[]): ModDecisionGroup[] {
  const groups: ModDecisionGroup[] = [];
  for (const decision of decisions) {
    const group = findGroup(groups, decision);
    if (group === null) {
      groups.push({
        declarer: readDecisionDeclarer(decision),
        title: decision.title,
        decisions: [decision],
      });
    } else {
      group.title = decision.title;
      group.decisions.push(decision);
    }
  }
  return groups;
}

/** The decisions grouped by mod or mosaic, groups and decisions sorted. */
function groupDecisionsByMod(
  decisions: readonly SiteDecision[],
): ModDecisionGroup[] {
  const groups = collectGroups(decisions);
  for (const group of groups) {
    group.decisions.sort(compareDecisionLines);
  }
  const sortedGroups = groups.sort(compareGroups);
  return sortedGroups;
}

function countAllowed(decisions: SiteDecision[]): number {
  let count = 0;
  for (const decision of decisions) {
    if (decision.allowed) {
      count += 1;
    }
  }
  return count;
}

/** Such as `1 allowed, 2 refused`, leaving out a zero. */
function describeCounts(decisions: SiteDecision[]): string {
  const allowedCount = countAllowed(decisions);
  const refusedCount = decisions.length - allowedCount;
  const parts: string[] = [];
  if (allowedCount > 0) {
    parts.push(`${allowedCount} allowed`);
  }
  if (refusedCount > 0) {
    parts.push(`${refusedCount} refused`);
  }
  const counts = parts.join(", ");
  return counts;
}

function buildDecisionKey(decision: SiteDecision): string {
  const key = `${decision.category} ${decision.host}`;
  return key;
}

/** The group checkbox's state: checked when every decision is allowed, unchecked when none is, mixed otherwise. */
function readGroupCheckedState(decisions: SiteDecision[]): CheckedState {
  const allowedCount = countAllowed(decisions);
  if (allowedCount === decisions.length) {
    return true;
  }
  if (allowedCount === 0) {
    return false;
  }
  return "indeterminate";
}

/** Every decision of a group, allowed or refused. */
function setEveryAllowed(
  decisions: SiteDecision[],
  isAllowed: boolean,
): SiteDecision[] {
  const changedDecisions: SiteDecision[] = [];
  for (const decision of decisions) {
    changedDecisions.push({ ...decision, allowed: isAllowed });
  }
  return changedDecisions;
}

/** One remembered decision: its Allowed checkbox, the line and the answer, and its Remove button. */
function SiteDecisionRow({
  decision,
  title,
  siteDecisions,
}: SiteDecisionRowProps): ReactElement {
  function handleCheckedChange(checked: CheckedState): void {
    rememberSiteDecisions(siteDecisions, [
      { ...decision, allowed: checked === true },
    ]);
  }

  function handleRemoveClick(): void {
    removeSiteDecision(siteDecisions, decision);
  }

  const line = describePermissionLine(decision);
  return (
    <li className="flex items-center gap-3 py-2">
      <Checkbox
        aria-label={`Allow ${title}: ${line}`}
        checked={decision.allowed}
        onCheckedChange={handleCheckedChange}
      />
      <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
        {line}
      </span>
      <span className="w-14 text-xs text-muted-foreground">
        {decision.allowed ? "Allowed" : "Refused"}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Remove ${title}: ${line}`}
        onClick={handleRemoveClick}
      >
        Remove
      </Button>
    </li>
  );
}

/** The key of a group in the list: its subject and its source. */
function buildGroupKey(group: ModDecisionGroup): string {
  const key = `${group.declarer.subject} ${group.declarer.source}`;
  return key;
}

/** The label of a mosaic's group, which a mod's group does not have. */
function renderSubjectLabel(group: ModDecisionGroup): ReactElement | null {
  if (group.declarer.subject !== "mosaic") {
    return null;
  }
  return (
    <>
      <span className="rounded-sm border px-1 text-xs font-normal text-muted-foreground">
        Mosaic
      </span>{" "}
    </>
  );
}

/**
 * The decisions of one mod or one mosaic: a header with the group checkbox,
 * the button that expands the group, with the "Mosaic" label of a mosaic, the
 * title and the counts, the Remove all button and the source, then the
 * decision rows while expanded. Collapsed when the page opens; the group
 * checkbox and Remove all work collapsed.
 */
function ModGroupItem({
  group,
  siteDecisions,
}: ModGroupItemProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const decisionsId = useId();

  function handleToggleClick(): void {
    setIsExpanded(!isExpanded);
  }

  function handleRemoveAllClick(): void {
    removeDeclaredSiteDecisions(siteDecisions, group.declarer);
  }

  const groupCheckedState = readGroupCheckedState(group.decisions);

  // Unchecked or mixed allows every decision; checked refuses every one.
  function handleGroupCheckedChange(): void {
    rememberSiteDecisions(
      siteDecisions,
      setEveryAllowed(group.decisions, groupCheckedState !== true),
    );
  }

  const rows: ReactElement[] = [];
  for (const decision of group.decisions) {
    rows.push(
      <SiteDecisionRow
        key={buildDecisionKey(decision)}
        decision={decision}
        title={group.title}
        siteDecisions={siteDecisions}
      />,
    );
  }
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <Checkbox
          className={MIXED_CHECKBOX_CLASSES}
          aria-label={`Allow all decisions of ${group.title}`}
          checked={groupCheckedState}
          onCheckedChange={handleGroupCheckedChange}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start px-1 py-1 text-left whitespace-normal"
          aria-expanded={isExpanded}
          aria-controls={decisionsId}
          onClick={handleToggleClick}
        >
          <ChevronRight
            aria-hidden="true"
            className={
              isExpanded
                ? "rotate-90 transition-transform"
                : "transition-transform"
            }
          />
          {renderSubjectLabel(group)}
          <span className="[overflow-wrap:anywhere]">{group.title}</span>{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {describeCounts(group.decisions)}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Remove all decisions of ${group.title}`}
          onClick={handleRemoveAllClick}
        >
          Remove all
        </Button>
      </div>
      <code className="block pl-7 text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {group.declarer.source}
      </code>
      <ul
        id={decisionsId}
        aria-label={`Decisions of ${group.title}`}
        hidden={!isExpanded}
        className="divide-y pl-7"
      >
        {rows}
      </ul>
    </li>
  );
}

/** The remembered site decisions grouped by mod and by mosaic, or a line saying there are none. */
export function SiteDecisionList({
  siteDecisions,
}: SiteDecisionListProps): ReactElement {
  const decisions = useStoreSnapshot(
    siteDecisions,
    subscribeSiteDecisions,
    readSiteDecisionsSnapshot,
  );
  if (decisions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No remembered decisions.</p>
    );
  }
  const items: ReactElement[] = [];
  for (const group of groupDecisionsByMod(decisions)) {
    items.push(
      <ModGroupItem
        key={buildGroupKey(group)}
        group={group}
        siteDecisions={siteDecisions}
      />,
    );
  }
  return (
    <ul aria-label="Remembered mods" className="divide-y">
      {items}
    </ul>
  );
}
