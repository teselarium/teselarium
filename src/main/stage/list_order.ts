import {
  compareByRatio,
  compareByTiles,
} from "../../lib/core/combinations/index.ts";
import type { CombinationRow } from "./combination_rows.ts";

/**
 * How a list orders its entries. "mosaics-first" is the mod and collection
 * lists' default, "pair-first" the mosaic list's.
 */
export type ListSort =
  "mosaics-first" | "pair-first" | "name" | "ratio" | "tiles";

/** What a list's filter menu can keep. Checked choices are combined: an entry must meet each. */
export type ListFilter =
  | "compatible"
  | "has-mosaics"
  | "unsaved"
  | "pair-only"
  | "same-mod"
  | "same-collection";

/** Entries under an optional heading. */
export interface EntryGroup {
  heading: string | null;
  entries: readonly CombinationRow[];
}

/** The heading of the mosaic list's second group, sorted by "This pair first". */
export const OTHER_COMBINATIONS_HEADING = "Other combinations";

const TITLE_COLLATOR = new Intl.Collator(undefined, { sensitivity: "base" });

/** Titles A-Z, ignoring letter case, then the search text, so two unsaved combinations keep one order. */
function compareTitles(a: CombinationRow, b: CombinationRow): number {
  const titleComparison = TITLE_COLLATOR.compare(a.title, b.title);
  if (titleComparison !== 0) {
    return titleComparison;
  }
  return TITLE_COLLATOR.compare(a.searchText, b.searchText);
}

function compareRatiosThenTitles(a: CombinationRow, b: CombinationRow): number {
  const scoreComparison = compareByRatio(a.score, b.score);
  return scoreComparison !== 0 ? scoreComparison : compareTitles(a, b);
}

function compareTilesThenTitles(a: CombinationRow, b: CombinationRow): number {
  const scoreComparison = compareByTiles(a.score, b.score);
  return scoreComparison !== 0 ? scoreComparison : compareTitles(a, b);
}

/** Whether an entry of the mod or collection list has mosaics with the other capsule's value. */
export function hasMosaics(entry: CombinationRow): boolean {
  const mosaics = entry.mosaics;
  return typeof mosaics === "object" && mosaics !== null && mosaics.count > 0;
}

function isCurrentPair(entry: CombinationRow): boolean {
  return entry.pair?.isCurrentPair === true;
}

function sortEntries(
  entries: readonly CombinationRow[],
  compare: (a: CombinationRow, b: CombinationRow) => number,
): CombinationRow[] {
  const sorted = [...entries].sort(compare);
  return sorted;
}

/** The entries that meet `isFirst`, then the others, each group by title A-Z. */
function splitByTitle(
  entries: readonly CombinationRow[],
  isFirst: (entry: CombinationRow) => boolean,
): { first: CombinationRow[]; rest: CombinationRow[] } {
  const first: CombinationRow[] = [];
  const rest: CombinationRow[] = [];
  for (const entry of sortEntries(entries, compareTitles)) {
    if (isFirst(entry)) {
      first.push(entry);
    } else {
      rest.push(entry);
    }
  }
  const split = { first, rest };
  return split;
}

function buildSingleGroup(entries: readonly CombinationRow[]): EntryGroup[] {
  const groups: EntryGroup[] = [{ heading: null, entries }];
  return groups;
}

/**
 * The entries in `sort` order, in groups:
 * - "mosaics-first": one group, the entries with mosaics first, then the others, each by title A-Z;
 * - "pair-first": the current pair's entries under `pairHeading`, then the others under "Other combinations", each by title A-Z;
 * - "name": one group by title A-Z;
 * - "ratio" and "tiles": one group by `compareByRatio` or `compareByTiles`, then by title A-Z.
 *
 * Titles compare ignoring letter case. Pinned rows are not entries: see `placePinnedRows`.
 */
export function orderEntries(
  entries: readonly CombinationRow[],
  sort: ListSort,
  pairHeading: string,
): EntryGroup[] {
  if (sort === "mosaics-first") {
    const split = splitByTitle(entries, hasMosaics);
    return buildSingleGroup([...split.first, ...split.rest]);
  }
  if (sort === "pair-first") {
    const split = splitByTitle(entries, isCurrentPair);
    const groups: EntryGroup[] = [
      { heading: pairHeading, entries: split.first },
      { heading: OTHER_COMBINATIONS_HEADING, entries: split.rest },
    ];
    return groups;
  }
  if (sort === "ratio") {
    return buildSingleGroup(sortEntries(entries, compareRatiosThenTitles));
  }
  if (sort === "tiles") {
    return buildSingleGroup(sortEntries(entries, compareTilesThenTitles));
  }
  return buildSingleGroup(sortEntries(entries, compareTitles));
}

/** Whether an entry's score has a matching tile, or is not known yet, or the entry has no score. */
function isCompatible(entry: CombinationRow): boolean {
  const score = entry.score;
  if (score === null || score.state !== "loaded") {
    return true;
  }
  return score.value.matching > 0;
}

function isTried(entry: CombinationRow): boolean {
  return entry.mark === "tried";
}

function hasCurrentMod(entry: CombinationRow): boolean {
  return entry.pair?.hasCurrentMod === true;
}

function hasCurrentCollection(entry: CombinationRow): boolean {
  return entry.pair?.hasCurrentCollection === true;
}

const FILTER_RULES: Readonly<
  Record<ListFilter, (entry: CombinationRow) => boolean>
> = Object.freeze({
  compatible: isCompatible,
  "has-mosaics": hasMosaics,
  unsaved: isTried,
  "pair-only": isCurrentPair,
  "same-mod": hasCurrentMod,
  "same-collection": hasCurrentCollection,
});

function meetsEveryFilter(
  entry: CombinationRow,
  filters: readonly ListFilter[],
): boolean {
  for (const filter of filters) {
    if (!FILTER_RULES[filter](entry)) {
      return false;
    }
  }
  return true;
}

/**
 * The entries that meet every checked filter, in order:
 * - "compatible": a score with a matching tile, a score not known yet, or no score;
 * - "has-mosaics": mosaics with the other capsule's value;
 * - "unsaved": marked with the ring, tried recently and not saved in the app;
 * - "pair-only": a mosaic of the current pair;
 * - "same-mod" and "same-collection": a mosaic naming the current mod, or the current collection (none when "None" is current).
 *
 * Pinned rows are not entries, so every filter keeps them.
 */
export function keepFilteredEntries(
  entries: readonly CombinationRow[],
  filters: readonly ListFilter[],
): CombinationRow[] {
  const kept: CombinationRow[] = [];
  for (const entry of entries) {
    if (meetsEveryFilter(entry, filters)) {
      kept.push(entry);
    }
  }
  return kept;
}

/**
 * The groups with the pinned rows, such as the tile, "None" or the current
 * "Unsaved combination", at the start of the first group, outside every sort
 * and filter. Empty groups are left out.
 */
export function placePinnedRows(
  groups: readonly EntryGroup[],
  pinnedRows: readonly CombinationRow[],
): EntryGroup[] {
  const placed: EntryGroup[] = [];
  for (const [index, group] of groups.entries()) {
    const entries =
      index === 0 ? [...pinnedRows, ...group.entries] : group.entries;
    if (entries.length > 0) {
      placed.push({ heading: group.heading, entries });
    }
  }
  return placed;
}

/**
 * The row a list highlights when it opens, among `rows` in the order shown:
 * the current entry; when it cannot be chosen, as the tile of a tile link,
 * the next row that can; without a current entry shown, the first row that
 * can be chosen. `""` when no row can be chosen.
 */
export function findOpeningHighlight(rows: readonly CombinationRow[]): string {
  let isAfterCurrent = false;
  for (const row of rows) {
    isAfterCurrent = isAfterCurrent || row.mark === "current";
    if (isAfterCurrent && row.isSelectable) {
      return row.id;
    }
  }
  for (const row of rows) {
    if (row.isSelectable) {
      return row.id;
    }
  }
  return "";
}
