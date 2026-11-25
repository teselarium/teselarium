import type { SiteDecision } from "../lib/core/permissions/index.ts";

/** An in-memory list of remembered site decisions, with the stage's reader and writer for it. */
export interface MemorySiteDecisions {
  decisions: SiteDecision[];
  read: () => readonly SiteDecision[];
  remember: (decisions: readonly SiteDecision[]) => void;
}

function readDecisionList(list: SiteDecision[]): SiteDecision[] {
  const decisions = [...list];
  return decisions;
}

function addToDecisionList(
  list: SiteDecision[],
  decisions: readonly SiteDecision[],
): void {
  list.push(...decisions);
}

/** Remembered site decisions kept in a list, starting with `initial`. */
export function createMemorySiteDecisions(
  initial: SiteDecision[] = [],
): MemorySiteDecisions {
  const decisions = [...initial];
  const memory: MemorySiteDecisions = {
    decisions,
    read: readDecisionList.bind(undefined, decisions),
    remember: addToDecisionList.bind(undefined, decisions),
  };
  return memory;
}
