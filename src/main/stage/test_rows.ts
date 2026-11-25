import type { EntryScore } from "../../lib/core/combinations/index.ts";
import type { CombinationRow } from "./combination_rows.ts";

/** Test fixtures of the stage bar's lists: rows and scores. */

function chooseNothing(): void {
  // A test row is chosen only when a test passes its own `onChoose`.
}

/** A selectable row titled `title`, with no mark, badge, score or page, and `overrides`. */
export function buildTestRow(
  title: string,
  overrides: Partial<CombinationRow> = {},
): CombinationRow {
  const row: CombinationRow = {
    id: title,
    title,
    details: [],
    foundMosaics: null,
    mark: null,
    mosaics: null,
    score: null,
    options: null,
    searchText: title,
    pair: null,
    isSelectable: true,
    failure: null,
    onChoose: chooseNothing,
    onRemove: null,
    ...overrides,
  };
  return row;
}

/** A measured score of `matching` tiles out of `total`. */
export function buildTestScore(matching: number, total: number): EntryScore {
  const score: EntryScore = {
    state: "loaded",
    value: { matching, total, isUntyped: false },
  };
  return score;
}

/** The titles of `rows`, in order. */
export function listRowTitles(rows: readonly CombinationRow[]): string[] {
  const titles: string[] = [];
  for (const row of rows) {
    titles.push(row.title);
  }
  return titles;
}
