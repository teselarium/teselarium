import { describe, expect, it } from "vitest";
import type { EntryGroup } from "./list_order.ts";
import {
  arrangeSettledGroups,
  isSameOrder,
  readSettledGroups,
} from "./list_settling.ts";
import { buildTestRow, buildTestScore, listRowTitles } from "./test_rows.ts";

describe("arrangeSettledGroups", function describeArrangeSettledGroups(): void {
  it("Score arrives after the pointer moved: each row keeps its place and shows its new score", function keepsPlaces(): void {
    const settled = readSettledGroups([
      { heading: null, entries: [buildTestRow("A"), buildTestRow("B")] },
    ]);
    const fresh: EntryGroup[] = [
      {
        heading: null,
        entries: [
          buildTestRow("B", { score: buildTestScore(3, 3) }),
          buildTestRow("A"),
        ],
      },
    ];

    const arranged = arrangeSettledGroups(fresh, settled);

    expect(listRowTitles(arranged[0].entries)).toEqual(["A", "B"]);
    expect(arranged[0].entries[1].score).toEqual(buildTestScore(3, 3));
  });

  it("leaves out rows no longer shown, and appends new ones to their group", function appendsNewRows(): void {
    const settled = readSettledGroups([
      { heading: "For pair", entries: [buildTestRow("A")] },
      { heading: "Other", entries: [buildTestRow("B"), buildTestRow("C")] },
    ]);
    const fresh: EntryGroup[] = [
      { heading: "For pair", entries: [buildTestRow("D"), buildTestRow("A")] },
      { heading: "Other", entries: [buildTestRow("C")] },
      { heading: "New", entries: [buildTestRow("E")] },
    ];

    const arranged = arrangeSettledGroups(fresh, settled);

    expect(arranged).toHaveLength(3);
    expect(listRowTitles(arranged[0].entries)).toEqual(["A", "D"]);
    expect(listRowTitles(arranged[1].entries)).toEqual(["C"]);
    expect(arranged[2].heading).toBe("New");
  });
});

describe("isSameOrder", function describeIsSameOrder(): void {
  it("compares groups and ids", function comparesOrders(): void {
    const a = [{ heading: null, ids: ["A", "B"] }];

    expect(isSameOrder(a, [{ heading: null, ids: ["A", "B"] }])).toBe(true);
    expect(isSameOrder(a, [{ heading: null, ids: ["B", "A"] }])).toBe(false);
  });
});
