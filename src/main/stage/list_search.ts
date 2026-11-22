import { pickBestScore } from "../../lib/core/combinations/index.ts";
import type { EntryScore } from "../../lib/core/combinations/index.ts";
import type { CombinationRow } from "./combination_rows.ts";

/**
 * Why a search keeps an entry: its own text holds the query (`title`), or
 * only some of its mosaics' titles do (`mosaics`), with the ids of those
 * page options.
 */
export interface EntryMatch {
  by: "title" | "mosaics";
  mosaicIds: readonly string[];
}

/** An entry the search keeps, as the list shows it, and why. */
export interface MatchedEntry {
  /** The entry with its best score, badge and found mosaics for this search. */
  entry: CombinationRow;
  match: EntryMatch;
  /** The search its page opens with: the query for a match through mosaics, otherwise none. */
  pageSearch: string;
}

function holdsQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

/** Whether an option of a page is a mosaic, not "Without a mosaic". */
function isMosaicOption(option: CombinationRow): boolean {
  return option.mosaics === "icon";
}

/** The mosaics among `options`, in order. */
function keepMosaicOptions(
  options: readonly CombinationRow[],
): CombinationRow[] {
  const mosaics: CombinationRow[] = [];
  for (const option of options) {
    if (isMosaicOption(option)) {
      mosaics.push(option);
    }
  }
  return mosaics;
}

function listIds(rows: readonly CombinationRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(row.id);
  }
  return ids;
}

/**
 * The options of `entry`'s page that `query` finds, in page order: a mosaic
 * by its title, "Without a mosaic" by its entry's title (its search text).
 * An empty query finds every option.
 */
export function matchPageOptions(
  entry: CombinationRow,
  query: string,
): CombinationRow[] {
  const matched: CombinationRow[] = [];
  for (const option of entry.options ?? []) {
    if (holdsQuery(option.searchText, query)) {
      matched.push(option);
    }
  }
  return matched;
}

/** Why `query` keeps `entry`, or `null` when it does not. */
function matchEntry(entry: CombinationRow, query: string): EntryMatch | null {
  const mosaicIds = listIds(keepMosaicOptions(entry.options ?? []));
  if (holdsQuery(entry.searchText, query)) {
    const titleMatch: EntryMatch = { by: "title", mosaicIds };
    return titleMatch;
  }
  const matchingIds = listIds(
    keepMosaicOptions(matchPageOptions(entry, query)),
  );
  if (matchingIds.length === 0) {
    return null;
  }
  const mosaicsMatch: EntryMatch = { by: "mosaics", mosaicIds: matchingIds };
  return mosaicsMatch;
}

function listScores(rows: readonly CombinationRow[]): EntryScore[] {
  const scores: EntryScore[] = [];
  for (const row of rows) {
    scores.push(row.score);
  }
  return scores;
}

/**
 * The entry as the main list shows it for this match: an entry with a page
 * shows the best score of the options its page would show; one found only
 * through its mosaics shows how many match in its badge, and the first
 * matching mosaic's title under its own.
 */
function showMatch(
  entry: CombinationRow,
  match: EntryMatch,
  pageSearch: string,
): CombinationRow {
  if (entry.options === null) {
    return entry;
  }
  const pageOptions = matchPageOptions(entry, pageSearch);
  const mosaics = entry.mosaics;
  const isFoundThroughMosaics = match.by === "mosaics";
  const firstMatch = isFoundThroughMosaics
    ? keepMosaicOptions(pageOptions)[0]
    : undefined;
  const shown: CombinationRow = {
    ...entry,
    score: pickBestScore(listScores(pageOptions)),
    mosaics:
      isFoundThroughMosaics && typeof mosaics === "object" && mosaics !== null
        ? { count: mosaics.count, matching: match.mosaicIds.length }
        : mosaics,
    foundMosaics:
      firstMatch === undefined
        ? null
        : { title: firstMatch.title, moreCount: match.mosaicIds.length - 1 },
  };
  return shown;
}

/**
 * The entries `query` keeps, ignoring letter case, in their order: those
 * whose search text holds it, and those with a mosaic whose title holds it.
 * Each is shown for its match (best score, badge, found mosaics), so the
 * main list and the page always agree. An empty query keeps every entry.
 */
export function matchEntries(
  entries: readonly CombinationRow[],
  query: string,
): MatchedEntry[] {
  const matched: MatchedEntry[] = [];
  for (const entry of entries) {
    const match = matchEntry(entry, query);
    if (match !== null) {
      const pageSearch = match.by === "mosaics" ? query : "";
      matched.push({
        entry: showMatch(entry, match, pageSearch),
        match,
        pageSearch,
      });
    }
  }
  return matched;
}

/** The rows pinned at the top, such as "None": shown only while the search field is empty. */
export function showPinnedRows(
  pinnedRows: readonly CombinationRow[],
  query: string,
): readonly CombinationRow[] {
  if (query !== "") {
    const hidden: CombinationRow[] = [];
    return hidden;
  }
  return pinnedRows;
}
