import type { CombinationRow } from "./combination_rows.ts";
import type { EntryGroup } from "./list_order.ts";

/** The order a list shows, by row ids, kept while its rows stay in place. Frozen by convention. */
export interface SettledGroup {
  heading: string | null;
  ids: readonly string[];
}

/** How often, at most, a settling list sorts again. */
export const SETTLE_INTERVAL_MS = 300;

/** The ids of `groups`, in order. */
export function readSettledGroups(
  groups: readonly EntryGroup[],
): SettledGroup[] {
  const settled: SettledGroup[] = [];
  for (const group of groups) {
    const ids: string[] = [];
    for (const entry of group.entries) {
      ids.push(entry.id);
    }
    settled.push({ heading: group.heading, ids });
  }
  return settled;
}

/** Whether two orders show the same rows in the same places. */
export function isSameOrder(
  a: readonly SettledGroup[],
  b: readonly SettledGroup[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function indexEntries(
  groups: readonly EntryGroup[],
): Map<string, CombinationRow> {
  const entries = new Map<string, CombinationRow>();
  for (const group of groups) {
    for (const entry of group.entries) {
      entries.set(entry.id, entry);
    }
  }
  return entries;
}

/** The kept rows of a settled group, in its order, skipping those no longer shown. */
function keepSettledRows(
  group: SettledGroup,
  entries: ReadonlyMap<string, CombinationRow>,
  placed: Set<string>,
): CombinationRow[] {
  const rows: CombinationRow[] = [];
  for (const id of group.ids) {
    const entry = entries.get(id);
    if (entry !== undefined && !placed.has(id)) {
      rows.push(entry);
      placed.add(id);
    }
  }
  return rows;
}

/** The arranged group with `heading`, added at the end when there is none yet. */
function findOrAddGroup(
  arranged: { heading: string | null; entries: CombinationRow[] }[],
  heading: string | null,
): { heading: string | null; entries: CombinationRow[] } {
  for (const group of arranged) {
    if (group.heading === heading) {
      return group;
    }
  }
  const added = { heading, entries: [] as CombinationRow[] };
  arranged.push(added);
  return added;
}

/**
 * The rows of `fresh`, the order the list would show now, placed as
 * `settled` keeps them: each row in its settled group and place, with what
 * it shows now, such as a score that arrived. A row that is no longer shown
 * is left out, and a new one is appended to its group, or to a new group
 * with its heading.
 */
export function arrangeSettledGroups(
  fresh: readonly EntryGroup[],
  settled: readonly SettledGroup[],
): EntryGroup[] {
  const entries = indexEntries(fresh);
  const placed = new Set<string>();
  const arranged: { heading: string | null; entries: CombinationRow[] }[] = [];
  for (const group of settled) {
    arranged.push({
      heading: group.heading,
      entries: keepSettledRows(group, entries, placed),
    });
  }
  for (const group of fresh) {
    for (const entry of group.entries) {
      if (!placed.has(entry.id)) {
        findOrAddGroup(arranged, group.heading).entries.push(entry);
        placed.add(entry.id);
      }
    }
  }
  return arranged;
}
