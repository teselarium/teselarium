import { describe, expect, it } from "vitest";
import type { EntryScore } from "../../lib/core/combinations/index.ts";
import { buildTestRow, buildTestScore, listRowTitles } from "./test_rows.ts";
import type { CombinationRow } from "./combination_rows.ts";
import {
  matchEntries,
  matchPageOptions,
  showPinnedRows,
} from "./list_search.ts";

function buildMosaicOption(title: string, score: EntryScore): CombinationRow {
  return buildTestRow(title, { mosaics: "icon", score });
}

/** Country Map in a Flashcards sandbox on the laureates: its mosaic scores 17/17, the plain pair 0/17. */
function buildCountryMap(): CombinationRow {
  const countryMap = buildTestRow("Country Map", {
    mosaics: { count: 1, matching: null },
    score: buildTestScore(0, 17),
    options: [
      buildMosaicOption("Nobel laureates on the map", buildTestScore(17, 17)),
      buildTestRow("Without a mosaic", {
        id: "Country Map without",
        searchText: "Country Map",
        score: buildTestScore(0, 17),
      }),
    ],
  });
  return countryMap;
}

function buildModEntries(): CombinationRow[] {
  const entries = [
    buildTestRow("Book List", { score: buildTestScore(0, 17) }),
    buildCountryMap(),
    buildTestRow("Flashcards", { score: buildTestScore(0, 17) }),
  ];
  return entries;
}

describe("matchEntries", function describeMatchEntries(): void {
  it("Search the mods: keeps the titles that hold the text, ignoring letter case", function matchesTitles(): void {
    const matched = matchEntries(buildModEntries(), "MAP");

    expect(matched).toHaveLength(1);
    expect(matched[0].entry.title).toBe("Country Map");
    expect(matched[0].match.by).toBe("title");
  });

  it("keeps every entry for an empty search", function keepsAll(): void {
    expect(matchEntries(buildModEntries(), "")).toHaveLength(3);
  });

  it("Found by its mosaic: `laureates on` matches Country Map through its mosaic", function matchesThroughMosaics(): void {
    const matched = matchEntries(buildModEntries(), "laureates on");

    expect(matched).toHaveLength(1);
    const found = matched[0];
    expect(found.match).toEqual({
      by: "mosaics",
      mosaicIds: ["Nobel laureates on the map"],
    });
    expect(found.entry.mosaics).toEqual({ count: 1, matching: 1 });
    expect(found.entry.foundMosaics).toEqual({
      title: "Nobel laureates on the map",
      moreCount: 0,
    });
    expect(found.pageSearch).toBe("laureates on");
  });

  it("Found by its own title: `country` matches Country Map by title, and its page opens with no search", function matchesByTitle(): void {
    const matched = matchEntries(buildModEntries(), "country");

    expect(matched[0].match.by).toBe("title");
    expect(matched[0].entry.foundMosaics).toBeNull();
    expect(matched[0].entry.mosaics).toEqual({ count: 1, matching: null });
    expect(matched[0].pageSearch).toBe("");
  });

  it("Best of the options: an entry with a page shows its best option's score", function showsBestScore(): void {
    const matched = matchEntries(buildModEntries(), "");

    expect(matched[1].entry.score).toEqual(buildTestScore(17, 17));
  });

  it("shows the loading mark until every option the page would show has its score", function waitsForOptions(): void {
    const countryMap = buildCountryMap();
    const loading: CombinationRow = {
      ...countryMap,
      options: [
        buildMosaicOption("Nobel laureates on the map", buildTestScore(17, 17)),
        buildTestRow("Without a mosaic", {
          searchText: "Country Map",
          score: { state: "loading" },
        }),
      ],
    };

    const byTitle = matchEntries([loading], "");
    const byMosaic = matchEntries([loading], "laureates on");

    expect(byTitle[0].entry.score).toEqual({ state: "loading" });
    expect(byMosaic[0].entry.score).toEqual(buildTestScore(17, 17));
  });

  it("names how many more mosaics match after the first", function countsMoreMosaics(): void {
    const atlas = buildTestRow("Atlas", {
      mosaics: { count: 3, matching: null },
      options: [
        buildMosaicOption("Laureates by birth", buildTestScore(1, 2)),
        buildMosaicOption("Cities", buildTestScore(1, 2)),
        buildMosaicOption("Laureates by death", buildTestScore(2, 2)),
      ],
    });

    const matched = matchEntries([atlas], "laureates");

    expect(matched[0].entry.mosaics).toEqual({ count: 3, matching: 2 });
    expect(matched[0].entry.foundMosaics).toEqual({
      title: "Laureates by birth",
      moreCount: 1,
    });
    expect(matched[0].entry.score).toEqual(buildTestScore(2, 2));
  });

  it("finds an unsaved combination by its mod's and collection's titles", function matchesUnsavedCombination(): void {
    const unsaved = buildTestRow("Unsaved combination", {
      searchText: "Flashcards + Nobel Prize in Literature laureates",
    });

    expect(matchEntries([unsaved], "flashcards")).toHaveLength(1);
    expect(matchEntries([unsaved], "literature")).toHaveLength(1);
    expect(matchEntries([unsaved], "country")).toHaveLength(0);
  });
});

describe("matchPageOptions", function describeMatchPageOptions(): void {
  it("Page with the search: only the matching mosaics, and no Without a mosaic", function matchesMosaics(): void {
    const options = matchPageOptions(buildCountryMap(), "laureates on");

    expect(listRowTitles(options)).toEqual(["Nobel laureates on the map"]);
  });

  it("finds Without a mosaic by its entry's title", function matchesWithout(): void {
    const options = matchPageOptions(buildCountryMap(), "country");

    expect(listRowTitles(options)).toEqual(["Without a mosaic"]);
  });

  it("lists every option for an empty search", function listsAll(): void {
    const options = matchPageOptions(buildCountryMap(), "");

    expect(listRowTitles(options)).toEqual([
      "Nobel laureates on the map",
      "Without a mosaic",
    ]);
  });
});

describe("showPinnedRows", function describeShowPinnedRows(): void {
  it("None hidden: pinned rows are hidden while searching", function hidesPinned(): void {
    const none = buildTestRow("None");

    expect(showPinnedRows([none], "nobel")).toEqual([]);
    expect(showPinnedRows([none], "")).toEqual([none]);
  });
});
