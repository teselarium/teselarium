import type { Loadable } from "./combination_catalog.ts";
import type { TileCount } from "./tile_counts.ts";

/** An entry's score: a count being measured, measured or failed, or `null` for an entry with no score. */
export type EntryScore = Loadable<TileCount> | null;

/** The count of a measured score, or `null` for a score not known: loading, failed or none. */
function readKnownCount(score: EntryScore): TileCount | null {
  if (score === null || score.state !== "loaded") {
    return null;
  }
  return score.value;
}

/** Unknown scores last, equal to each other. At least one of `a` and `b` is unknown. */
function compareUnknown(a: TileCount | null, b: TileCount | null): number {
  if (a === null && b === null) {
    return 0;
  }
  return a === null ? 1 : -1;
}

/**
 * Higher `matching / total` first, compared exactly by cross-multiplying, so
 * `12/17` and `24/34` are equal. A count of no tiles has the ratio 0.
 */
function compareRatios(a: TileCount, b: TileCount): number {
  const aTotal = a.total === 0 ? 1 : a.total;
  const bTotal = b.total === 0 ? 1 : b.total;
  const comparison = b.matching * aTotal - a.matching * bTotal;
  return comparison;
}

/** More matching tiles first. */
function compareMatchingTiles(a: TileCount, b: TileCount): number {
  const comparison = b.matching - a.matching;
  return comparison;
}

function compareRatioThenTiles(a: TileCount, b: TileCount): number {
  const ratioComparison = compareRatios(a, b);
  if (ratioComparison !== 0) {
    return ratioComparison;
  }
  return compareMatchingTiles(a, b);
}

function compareTilesThenRatio(a: TileCount, b: TileCount): number {
  const tilesComparison = compareMatchingTiles(a, b);
  if (tilesComparison !== 0) {
    return tilesComparison;
  }
  return compareRatios(a, b);
}

/** Orders known scores with `compareCounts`, and unknown ones last. */
function compareScores(
  a: EntryScore,
  b: EntryScore,
  compareCounts: (a: TileCount, b: TileCount) => number,
): number {
  const aCount = readKnownCount(a);
  const bCount = readKnownCount(b);
  if (aCount === null || bCount === null) {
    return compareUnknown(aCount, bCount);
  }
  return compareCounts(aCount, bCount);
}

/**
 * Orders scores by `matching / total`, highest first, then by matching
 * tiles, most first. Scores not known yet, failed and absent come last, and
 * are equal to each other. Equal scores give 0, for the caller's title
 * tie-break.
 */
export function compareByRatio(a: EntryScore, b: EntryScore): number {
  return compareScores(a, b, compareRatioThenTiles);
}

/**
 * Orders scores by matching tiles, most first, then by `matching / total`,
 * highest first. Unknown scores come last, as in `compareByRatio`.
 */
export function compareByTiles(a: EntryScore, b: EntryScore): number {
  return compareScores(a, b, compareTilesThenRatio);
}

const LOADING_SCORE: EntryScore = Object.freeze({ state: "loading" });

/**
 * The best of `scores` as `compareByRatio` orders them. While any of them is
 * being measured there is no best score yet, and the result is the loading
 * score. Failed and absent scores are left out, and `null` is the result
 * when no score is left.
 */
export function pickBestScore(scores: readonly EntryScore[]): EntryScore {
  let best: EntryScore = null;
  for (const score of scores) {
    if (score?.state === "loading") {
      return LOADING_SCORE;
    }
    if (score?.state === "loaded" && compareByRatio(score, best) < 0) {
      best = score;
    }
  }
  return best;
}
