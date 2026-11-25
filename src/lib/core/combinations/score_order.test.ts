import { describe, expect, it } from "vitest";
import { compareByRatio, compareByTiles, pickBestScore } from "./index.ts";
import type { EntryScore } from "./index.ts";

function buildScore(matching: number, total: number): EntryScore {
  const score: EntryScore = {
    state: "loaded",
    value: { matching, total, isUntyped: false },
  };
  return score;
}

const LOADING: EntryScore = { state: "loading" };
const FAILED: EntryScore = { state: "failed", reason: "HTTP 404" };

/** The scores sorted by `compare`, as `matching/total`, or `-` for an unknown score. */
function sortScores(
  scores: readonly EntryScore[],
  compare: (a: EntryScore, b: EntryScore) => number,
): string[] {
  const sorted = [...scores].sort(compare);
  const texts: string[] = [];
  for (const score of sorted) {
    texts.push(
      score?.state === "loaded"
        ? `${score.value.matching}/${score.value.total}`
        : "-",
    );
  }
  return texts;
}

describe("compareByRatio", function describeCompareByRatio(): void {
  it("Ratio, then tiles", function sortsByRatio(): void {
    const scores = [buildScore(5, 10), buildScore(50, 100), buildScore(9, 10)];

    expect(sortScores(scores, compareByRatio)).toEqual([
      "9/10",
      "50/100",
      "5/10",
    ]);
  });

  it("compares equal ratios exactly, so 12/17 and 24/34 tie and the tiles decide", function comparesExactly(): void {
    expect(
      compareByRatio(buildScore(12, 17), buildScore(24, 34)),
    ).toBeGreaterThan(0);
    expect(compareByRatio(buildScore(12, 17), buildScore(12, 17))).toBe(0);
  });

  it("puts unknown scores last, equal to each other", function sortsUnknownLast(): void {
    const scores = [
      LOADING,
      buildScore(0, 17),
      null,
      FAILED,
      buildScore(3, 17),
    ];

    expect(sortScores(scores, compareByRatio)).toEqual([
      "3/17",
      "0/17",
      "-",
      "-",
      "-",
    ]);
    expect(compareByRatio(LOADING, null)).toBe(0);
    expect(compareByRatio(FAILED, LOADING)).toBe(0);
  });

  it("gives a count of no tiles the ratio 0", function sortsEmptyLow(): void {
    expect(
      sortScores([buildScore(0, 0), buildScore(1, 10)], compareByRatio),
    ).toEqual(["1/10", "0/0"]);
  });
});

describe("compareByTiles", function describeCompareByTiles(): void {
  it("Tiles first", function sortsByTiles(): void {
    const scores = [buildScore(5, 10), buildScore(9, 10), buildScore(50, 100)];

    expect(sortScores(scores, compareByTiles)).toEqual([
      "50/100",
      "9/10",
      "5/10",
    ]);
  });

  it("orders equal tiles by ratio, and 12/17 and 24/34 by ratio as equal", function breaksTiesByRatio(): void {
    expect(compareByTiles(buildScore(12, 17), buildScore(12, 34))).toBeLessThan(
      0,
    );
    expect(
      compareByTiles(buildScore(12, 17), buildScore(24, 34)),
    ).toBeGreaterThan(0);
  });

  it("puts unknown scores last", function sortsUnknownLast(): void {
    expect(
      sortScores([null, LOADING, buildScore(0, 1)], compareByTiles),
    ).toEqual(["0/1", "-", "-"]);
  });
});

describe("pickBestScore", function describePickBestScore(): void {
  it("picks the best ratio", function picksBest(): void {
    const best = buildScore(17, 17);

    expect(pickBestScore([buildScore(0, 17), best, buildScore(9, 17)])).toBe(
      best,
    );
  });

  it("has no best score while any score is unknown", function waitsForScores(): void {
    expect(pickBestScore([buildScore(17, 17), LOADING])).toEqual(LOADING);
  });

  it("leaves out failed and absent scores, and gives null with none left", function skipsMissing(): void {
    const known = buildScore(2, 17);

    expect(pickBestScore([FAILED, known, null])).toBe(known);
    expect(pickBestScore([FAILED, null])).toBeNull();
    expect(pickBestScore([])).toBeNull();
  });
});
