import type { CaseContext } from "../../mod_api.d.ts";
import {
  countValueLines,
  isPreviewCollapsed,
  planMetadataPreview,
} from "../src/metadata_lines.ts";
import type { FieldPreview } from "../src/metadata_lines.ts";

// The pure line budget, called directly: values in, line counts out, and
// metadata in, the collapsed preview of each field out.

const WHOLE: FieldPreview = { kind: "whole" };
const HIDDEN: FieldPreview = { kind: "hidden" };

function buildCut(shownItems: number, moreItems: number): FieldPreview {
  const preview: FieldPreview = { kind: "cut", shownItems, moreItems };
  return preview;
}

function buildItems(count: number): string[] {
  const items: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    items.push(`Item ${index}`);
  }
  return items;
}

export function countsValueLines(context: CaseContext): void {
  context.expect(countValueLines(156)).toBe(1);
  context.expect(countValueLines("Swedish")).toBe(1);
  context.expect(countValueLines(null)).toBe(1);
  context
    .expect(countValueLines("https://example.org/books/kallocain"))
    .toBe(1);
  context.expect(countValueLines("https://example.org/cover.JPG?w=2")).toBe(2);
  context.expect(countValueLines(["a", "b", "c"])).toBe(3);
  context.expect(countValueLines(["a", "https://example.org/a.png"])).toBe(3);
  context.expect(countValueLines({ year: 1940, place: "Stockholm" })).toBe(2);
  context.expect(countValueLines({ years: [1940, 1966] })).toBe(2);
  context.expect(countValueLines([])).toBe(1);
  context.expect(countValueLines({})).toBe(1);
}

export function keepsShortMetadataWhole(context: CaseContext): void {
  const previews = planMetadataPreview({
    title: "Kallocain",
    pages: 156,
    read: true,
  });

  context.expect(previews).toEqual([WHOLE, WHOLE, WHOLE]);
  context.expect(isPreviewCollapsed(previews)).toBe(false);
}

export function keepsSixLinesWhole(context: CaseContext): void {
  const previews = planMetadataPreview({
    a: 1,
    b: 2,
    cover: "https://example.org/cover.png",
    genres: ["x", "y"],
  });

  context.expect(previews).toEqual([WHOLE, WHOLE, WHOLE, WHOLE]);
  context.expect(isPreviewCollapsed(previews)).toBe(false);
}

export function cutsTheListThatDoesNotFit(context: CaseContext): void {
  const previews = planMetadataPreview({
    pages: 156,
    read: true,
    year: 1940,
    language: "Swedish",
    genres: buildItems(5),
    source: "https://example.org/books/kallocain",
  });

  context
    .expect(previews)
    .toEqual([WHOLE, WHOLE, WHOLE, WHOLE, buildCut(1, 4), HIDDEN]);
  context.expect(isPreviewCollapsed(previews)).toBe(true);
}

export function hidesFieldsAfterTheFirstThatDoesNotFit(
  context: CaseContext,
): void {
  const previews = planMetadataPreview({
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    edition: { year: 1940, place: "Stockholm" },
    f: 6,
  });

  context
    .expect(previews)
    .toEqual([WHOLE, WHOLE, WHOLE, WHOLE, WHOLE, HIDDEN, HIDDEN]);
}

export function hidesAListWithNoRoomForAnItem(context: CaseContext): void {
  const previews = planMetadataPreview({
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    genres: buildItems(3),
  });

  context.expect(previews).toEqual([WHOLE, WHOLE, WHOLE, WHOLE, WHOLE, HIDDEN]);
}

export function cutsALongFirstList(context: CaseContext): void {
  const previews = planMetadataPreview({
    names: buildItems(20),
    pages: 156,
  });

  context.expect(previews).toEqual([buildCut(5, 15), HIDDEN]);
}

export function showsALargeFirstMappingWhole(context: CaseContext): void {
  const previews = planMetadataPreview({
    edition: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 },
    pages: 156,
  });

  context.expect(previews).toEqual([WHOLE, HIDDEN]);
}
