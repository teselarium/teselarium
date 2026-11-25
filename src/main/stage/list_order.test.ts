import { describe, expect, it } from "vitest";
import { buildTestRow, buildTestScore, listRowTitles } from "./test_rows.ts";
import type { CombinationRow, MosaicPairFacts } from "./combination_rows.ts";
import {
  findOpeningHighlight,
  keepFilteredEntries,
  orderEntries,
  OTHER_COMBINATIONS_HEADING,
  placePinnedRows,
} from "./list_order.ts";
import type { EntryGroup } from "./list_order.ts";

function buildPair(overrides: Partial<MosaicPairFacts>): MosaicPairFacts {
  const pair: MosaicPairFacts = {
    isCurrentPair: false,
    hasCurrentMod: false,
    hasCurrentCollection: false,
    ...overrides,
  };
  return pair;
}

function describeGroups(groups: readonly EntryGroup[]): string[][] {
  const described: string[][] = [];
  for (const group of groups) {
    described.push([String(group.heading), ...listRowTitles(group.entries)]);
  }
  return described;
}

/** Book List, Country Map with one mosaic, and Flashcards, as in a Flashcards sandbox on the laureates. */
function buildModEntries(): CombinationRow[] {
  const entries = [
    buildTestRow("Flashcards", { score: buildTestScore(0, 17) }),
    buildTestRow("Country Map", {
      mosaics: { count: 1, matching: null },
      score: buildTestScore(17, 17),
    }),
    buildTestRow("book List", { score: buildTestScore(3, 17) }),
  ];
  return entries;
}

describe("orderEntries", function describeOrderEntries(): void {
  it("Mod with a mosaic first: then the others A-Z, ignoring letter case", function sortsMosaicsFirst(): void {
    const groups = orderEntries(buildModEntries(), "mosaics-first", "");

    expect(describeGroups(groups)).toEqual([
      ["null", "Country Map", "book List", "Flashcards"],
    ]);
  });

  it("Sort by name: one group A-Z", function sortsByName(): void {
    const groups = orderEntries(buildModEntries(), "name", "");

    expect(describeGroups(groups)).toEqual([
      ["null", "book List", "Country Map", "Flashcards"],
    ]);
  });

  it("This pair first: the pair's entries under its heading, then the other combinations, each A-Z", function sortsPairFirst(): void {
    const entries = [
      buildTestRow("Books by Nobel laureates", { pair: buildPair({}) }),
      buildTestRow("Nobel laureates on the map", {
        pair: buildPair({ isCurrentPair: true }),
      }),
      buildTestRow("Atlas of laureates", { pair: buildPair({}) }),
    ];

    const groups = orderEntries(
      entries,
      "pair-first",
      "For Country Map + Nobel Prize in Literature laureates",
    );

    expect(describeGroups(groups)).toEqual([
      [
        "For Country Map + Nobel Prize in Literature laureates",
        "Nobel laureates on the map",
      ],
      [
        OTHER_COMBINATIONS_HEADING,
        "Atlas of laureates",
        "Books by Nobel laureates",
      ],
    ]);
  });

  it("Ratio, then tiles, unknown scores last by title", function sortsByRatio(): void {
    const entries = [
      buildTestRow("Five", { score: buildTestScore(5, 10) }),
      buildTestRow("Unknown B", { score: { state: "loading" } }),
      buildTestRow("Fifty", { score: buildTestScore(50, 100) }),
      buildTestRow("Unknown A", { score: null }),
      buildTestRow("Nine", { score: buildTestScore(9, 10) }),
    ];

    const groups = orderEntries(entries, "ratio", "");

    expect(describeGroups(groups)).toEqual([
      ["null", "Nine", "Fifty", "Five", "Unknown A", "Unknown B"],
    ]);
  });

  it("Tiles first", function sortsByTiles(): void {
    const entries = [
      buildTestRow("Five", { score: buildTestScore(5, 10) }),
      buildTestRow("Nine", { score: buildTestScore(9, 10) }),
      buildTestRow("Fifty", { score: buildTestScore(50, 100) }),
    ];

    const groups = orderEntries(entries, "tiles", "");

    expect(describeGroups(groups)).toEqual([["null", "Fifty", "Nine", "Five"]]);
  });

  it("Equal ratios by name", function breaksTiesByName(): void {
    const entries = [
      buildTestRow("tile_viewer", {
        score: {
          state: "loaded",
          value: { matching: 17, total: 17, isUntyped: true },
        },
      }),
      buildTestRow("Book List", { score: buildTestScore(17, 17) }),
    ];

    const groups = orderEntries(entries, "ratio", "");

    expect(describeGroups(groups)).toEqual([
      ["null", "Book List", "tile_viewer"],
    ]);
  });

  it("orders two unsaved combinations by their search text", function breaksTiesBySearchText(): void {
    const entries = [
      buildTestRow("Unsaved combination", {
        id: "b",
        searchText: "Flashcards + Laureates",
      }),
      buildTestRow("Unsaved combination", {
        id: "a",
        searchText: "Book List + Laureates",
      }),
    ];

    const groups = orderEntries(entries, "name", "");

    expect(groups[0].entries[0].id).toBe("a");
  });
});

describe("keepFilteredEntries", function describeKeepFilteredEntries(): void {
  it("Compatible only: drops a score with no matching tile", function keepsCompatible(): void {
    const kept = keepFilteredEntries(buildModEntries(), ["compatible"]);

    expect(listRowTitles(kept)).toEqual(["Country Map", "book List"]);
  });

  it("Counting rows are kept, and so are entries with no score or a failed one", function keepsUnknown(): void {
    const entries = [
      buildTestRow("Counting", { score: { state: "loading" } }),
      buildTestRow("No score", { score: null }),
      buildTestRow("Failed", {
        score: { state: "failed", reason: "HTTP 404" },
      }),
      buildTestRow("No match", { score: buildTestScore(0, 3) }),
    ];

    const kept = keepFilteredEntries(entries, ["compatible"]);

    expect(listRowTitles(kept)).toEqual(["Counting", "No score", "Failed"]);
  });

  it("Has mosaics", function keepsWithMosaics(): void {
    const kept = keepFilteredEntries(buildModEntries(), ["has-mosaics"]);

    expect(listRowTitles(kept)).toEqual(["Country Map"]);
  });

  it("Unsaved: only the ring", function keepsTried(): void {
    const entries = [
      buildTestRow("Current", { mark: "current" }),
      buildTestRow("Tried", { mark: "tried" }),
      buildTestRow("Plain"),
    ];

    const kept = keepFilteredEntries(entries, ["unsaved"]);

    expect(listRowTitles(kept)).toEqual(["Tried"]);
  });

  it("This pair only, Same mod and Same collection", function keepsPairFacts(): void {
    const entries = [
      buildTestRow("Pair", {
        pair: buildPair({
          isCurrentPair: true,
          hasCurrentMod: true,
          hasCurrentCollection: true,
        }),
      }),
      buildTestRow("Same mod", { pair: buildPair({ hasCurrentMod: true }) }),
      buildTestRow("Same collection", {
        pair: buildPair({ hasCurrentCollection: true }),
      }),
      buildTestRow("Other", { pair: buildPair({}) }),
    ];

    expect(listRowTitles(keepFilteredEntries(entries, ["pair-only"]))).toEqual([
      "Pair",
    ]);
    expect(listRowTitles(keepFilteredEntries(entries, ["same-mod"]))).toEqual([
      "Pair",
      "Same mod",
    ]);
    expect(
      listRowTitles(keepFilteredEntries(entries, ["same-collection"])),
    ).toEqual(["Pair", "Same collection"]);
  });

  it("keeps only the entries that meet every checked choice", function combinesFilters(): void {
    const entries = [
      buildTestRow("Tried, compatible", {
        mark: "tried",
        score: buildTestScore(2, 3),
      }),
      buildTestRow("Tried, no match", {
        mark: "tried",
        score: buildTestScore(0, 3),
      }),
      buildTestRow("Compatible", { score: buildTestScore(3, 3) }),
    ];

    const kept = keepFilteredEntries(entries, ["unsaved", "compatible"]);

    expect(listRowTitles(kept)).toEqual(["Tried, compatible"]);
  });

  it("keeps every entry without a checked choice", function keepsAll(): void {
    expect(keepFilteredEntries(buildModEntries(), [])).toHaveLength(3);
  });
});

describe("placePinnedRows", function describePlacePinnedRows(): void {
  it("None stays: every filter keeps the pinned rows, first", function keepsPinnedRows(): void {
    const none = buildTestRow("None");
    const filtered = keepFilteredEntries(buildModEntries(), ["has-mosaics"]);

    const groups = placePinnedRows(
      orderEntries(filtered, "mosaics-first", ""),
      [none],
    );

    expect(describeGroups(groups)).toEqual([["null", "None", "Country Map"]]);
  });

  it("No mosaic for the pair: the pair group holds only the pinned row, and empty groups are left out", function placesInPairGroup(): void {
    const unsaved = buildTestRow("Unsaved combination");
    const entries = [buildTestRow("Books", { pair: buildPair({}) })];

    const groups = placePinnedRows(
      orderEntries(entries, "pair-first", "For Flashcards + Laureates"),
      [unsaved],
    );
    const filteredGroups = placePinnedRows(
      orderEntries([], "pair-first", "For Flashcards + Laureates"),
      [],
    );

    expect(describeGroups(groups)).toEqual([
      ["For Flashcards + Laureates", "Unsaved combination"],
      [OTHER_COMBINATIONS_HEADING, "Books"],
    ]);
    expect(filteredGroups).toEqual([]);
  });
});

describe("findOpeningHighlight", function describeFindOpeningHighlight(): void {
  it("Current mod highlighted: the current entry, wherever it is", function findsCurrent(): void {
    const rows = [
      buildTestRow("Country Map"),
      buildTestRow("Book List"),
      buildTestRow("Flashcards", { mark: "current" }),
    ];

    expect(findOpeningHighlight(rows)).toBe("Flashcards");
  });

  it("Tile link: the next row that can be chosen after a current row that cannot", function skipsTile(): void {
    const rows = [
      buildTestRow("2016__bob_dylan.md", {
        mark: "current",
        isSelectable: false,
      }),
      buildTestRow("None"),
      buildTestRow("Laureates"),
    ];

    expect(findOpeningHighlight(rows)).toBe("None");
  });

  it("Current entry filtered out: the first row that can be chosen", function fallsBackToFirst(): void {
    const rows = [
      buildTestRow("Gone", { isSelectable: false }),
      buildTestRow("Country Map"),
    ];

    expect(findOpeningHighlight(rows)).toBe("Country Map");
    expect(findOpeningHighlight([])).toBe("");
  });
});
