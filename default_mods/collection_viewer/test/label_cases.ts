import type { CaseContext } from "../../mod_api.d.ts";
import { filterTileIndexes } from "../src/tile_filter.ts";
import { labelTiles } from "../src/tile_labels.ts";

// The pure modules, called directly: addresses in, labels out, and labels
// and text in, indexes out.

export function labelsByFileName(context: CaseContext): void {
  context
    .expect(
      labelTiles([
        "https://example.org/tiles/2024__han_kang.md",
        "https://example.org/tiles/2016__bob_dylan.md",
      ]),
    )
    .toEqual(["2024__han_kang.md", "2016__bob_dylan.md"]);
}

export function decodesFileNames(context: CaseContext): void {
  context
    .expect(labelTiles(["https://example.org/tiles/caf%C3%A9.md"]))
    .toEqual(["café.md"]);
}

export function keepsUndecodableFileNames(context: CaseContext): void {
  context
    .expect(labelTiles(["https://example.org/tiles/100%25%E0%A4%A.md"]))
    .toEqual(["100%25%E0%A4%A.md"]);
}

export function addsParentForSharedFileNames(context: CaseContext): void {
  context
    .expect(
      labelTiles([
        "https://example.org/a/index.md",
        "https://example.org/tiles/other.md",
        "https://example.org/b/index.md",
      ]),
    )
    .toEqual(["a/index.md", "other.md", "b/index.md"]);
}

export function keepsLabelsThatStillClash(context: CaseContext): void {
  context
    .expect(
      labelTiles([
        "https://example.org/one/notes/index.md",
        "https://example.org/two/notes/index.md",
      ]),
    )
    .toEqual(["notes/index.md", "notes/index.md"]);
}

export function filtersIgnoringCase(context: CaseContext): void {
  const labels = ["2024__han_kang.md", "2016__bob_dylan.md", "JOHANNES.md"];

  context.expect(filterTileIndexes(labels, "HAN")).toEqual([0, 2]);
  context.expect(filterTileIndexes(labels, "dylan")).toEqual([1]);
  context.expect(filterTileIndexes(labels, "missing")).toEqual([]);
}

export function keepsEveryIndexForAnEmptyFilter(context: CaseContext): void {
  const labels = ["a.md", "b.md"];

  context.expect(filterTileIndexes(labels, "")).toEqual([0, 1]);
}
