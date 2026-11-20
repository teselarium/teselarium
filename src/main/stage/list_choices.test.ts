import { describe, expect, it, vi } from "vitest";
import {
  checkListFilter,
  chooseListSort,
  createListChoices,
  LIST_FILTERS,
  LIST_SORTS,
  readListChoicesSnapshot,
  subscribeListChoices,
} from "./list_choices.ts";

describe("list choices", function describeListChoices(): void {
  it("Reload: a new store starts with each list's default sort and no filter", function startsWithDefaults(): void {
    const store = createListChoices();

    expect(readListChoicesSnapshot(store)).toEqual({
      mod: { sort: "mosaics-first", filters: [] },
      collection: { sort: "mosaics-first", filters: [] },
      mosaic: { sort: "pair-first", filters: [] },
    });
  });

  it("Kept for another sandbox: a choice is kept across reads, for its list only", function keepsChoices(): void {
    const store = createListChoices();

    chooseListSort(store, "mod", "name");
    checkListFilter(store, "mod", "compatible", true);
    checkListFilter(store, "mod", "unsaved", true);
    checkListFilter(store, "mod", "compatible", false);

    expect(readListChoicesSnapshot(store).mod).toEqual({
      sort: "name",
      filters: ["unsaved"],
    });
    expect(readListChoicesSnapshot(store).collection).toEqual({
      sort: "mosaics-first",
      filters: [],
    });
  });

  it("tells the listeners with a new frozen snapshot, also for the sort already chosen", function notifies(): void {
    const store = createListChoices();
    const listener = vi.fn<() => void>();
    subscribeListChoices(store, listener);
    const before = readListChoicesSnapshot(store);

    chooseListSort(store, "mosaic", "pair-first");

    expect(listener).toHaveBeenCalledOnce();
    expect(readListChoicesSnapshot(store)).not.toBe(before);
    expect(Object.isFrozen(readListChoicesSnapshot(store).mosaic)).toBe(true);
  });

  it("offers each list's sorts and filters with their labels", function offersChoices(): void {
    expect(LIST_SORTS.mod.map(readLabel)).toEqual([
      "Mosaics first",
      "Name",
      "Match ratio",
      "Matching tiles",
    ]);
    expect(LIST_SORTS.mosaic.map(readLabel)).toEqual([
      "This pair first",
      "Name",
      "Match ratio",
      "Matching tiles",
    ]);
    expect(LIST_FILTERS.collection.map(readLabel)).toEqual([
      "Compatible only",
      "Has mosaics",
      "Unsaved",
    ]);
    expect(LIST_FILTERS.mosaic.map(readLabel)).toEqual([
      "This pair only",
      "Same mod",
      "Same collection",
      "Compatible only",
      "Unsaved",
    ]);
  });
});

function readLabel(option: { label: string }): string {
  return option.label;
}
