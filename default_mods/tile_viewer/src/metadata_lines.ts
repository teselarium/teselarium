// Pure: the metadata in, how much of it the collapsed view shows out. Lines
// are counted from the values, not measured, so the collapsed view keeps
// whole values: 1 line for a scalar, 2 for an image address, whose thumbnail
// is two lines high, the sum of the items of a list or the values of a
// mapping, and 1 for an empty list or mapping. A long text that wraps takes
// more lines than it counts.

import type { ModYamlMapping, ModYamlValue } from "../../mod_api.d.ts";
import { isImageAddress } from "./metadata_addresses.ts";

/** How many lines the collapsed metadata shows, the `and <n> more` lines included. */
export const METADATA_LINE_BUDGET = 6;

/** The lines an image address takes: its thumbnail is two lines high. */
const IMAGE_LINES = 2;

/**
 * What the collapsed view shows of a field: all of it, none of it, or the
 * first `shownItems` items of a list followed by an `and <moreItems> more`
 * line.
 */
export type FieldPreview =
  | { kind: "whole" }
  | { kind: "hidden" }
  | { kind: "cut"; shownItems: number; moreItems: number };

const WHOLE_FIELD: FieldPreview = Object.freeze({ kind: "whole" });

const HIDDEN_FIELD: FieldPreview = Object.freeze({ kind: "hidden" });

function sumValueLines(values: ModYamlValue[]): number {
  let lines = 0;
  for (const value of values) {
    lines += countValueLines(value);
  }
  return Math.max(lines, 1);
}

/** The lines a value takes in the metadata's value column. */
export function countValueLines(value: ModYamlValue): number {
  if (Array.isArray(value)) {
    return sumValueLines(value);
  }
  if (value !== null && typeof value === "object") {
    return sumValueLines(Object.values(value));
  }
  if (typeof value === "string" && isImageAddress(value)) {
    return IMAGE_LINES;
  }
  return 1;
}

/** How many of a list's first items fit in `lines`. */
function countFittingItems(items: ModYamlValue[], lines: number): number {
  let used = 0;
  let count = 0;
  for (const item of items) {
    used += countValueLines(item);
    if (used > lines) {
      break;
    }
    count += 1;
  }
  return count;
}

/**
 * The preview of the first field that does not fit in `remaining` lines: a
 * list keeps the items that fit with its `and <n> more` line, and the first
 * field always shows, a list with at least one item.
 */
function previewOverflowingField(
  value: ModYamlValue,
  remaining: number,
  isFirst: boolean,
): FieldPreview {
  if (!Array.isArray(value)) {
    return isFirst ? WHOLE_FIELD : HIDDEN_FIELD;
  }
  const fittingItems = countFittingItems(value, remaining - 1);
  const shownItems = isFirst ? Math.max(fittingItems, 1) : fittingItems;
  if (shownItems === 0) {
    return HIDDEN_FIELD;
  }
  const cut: FieldPreview = {
    kind: "cut",
    shownItems,
    moreItems: value.length - shownItems,
  };
  return cut;
}

/**
 * The collapsed preview of each field, in frontmatter order: the fields show
 * whole while they fit in `budget` lines, the first that does not fit is cut
 * or hidden, and every field after it is hidden.
 */
export function planMetadataPreview(
  metadata: ModYamlMapping,
  budget: number = METADATA_LINE_BUDGET,
): FieldPreview[] {
  const previews: FieldPreview[] = [];
  let remaining = budget;
  let hasOverflowed = false;
  for (const value of Object.values(metadata)) {
    const lines = countValueLines(value);
    if (hasOverflowed) {
      previews.push(HIDDEN_FIELD);
    } else if (lines <= remaining) {
      previews.push(WHOLE_FIELD);
      remaining -= lines;
    } else {
      previews.push(
        previewOverflowingField(value, remaining, previews.length === 0),
      );
      hasOverflowed = true;
    }
  }
  return previews;
}

/** Whether the collapsed view hides anything, so the metadata needs its button. */
export function isPreviewCollapsed(previews: FieldPreview[]): boolean {
  for (const preview of previews) {
    if (preview.kind !== "whole") {
      return true;
    }
  }
  return false;
}
