import type { CaseContext } from "../../mod_api.d.ts";
import {
  FIXTURE_REFERENCES,
  findElement,
  listShownLabels,
  findTileCount,
  listTileItems,
  mountWithTarget,
  readInspection,
  readTileLabel,
  typeInFilter,
  listWrongTableRoles,
} from "./case_helpers.ts";

/** The end of the shown collection's source, whatever the app's address. */
const SHOWN_COLLECTION_PATH =
  "/default_mods/collection_viewer/fixtures/shown_collection.yaml";

/** The labels of the shown collection's tiles, in entry order. */
const SHOWN_LABELS = [
  "2024__han_kang.md",
  "2016__bob_dylan.md",
  "café.md",
  "a/index.md",
  "b/index.md",
  "1944__johannes_v_jensen.md",
  "2021__abdulrazak_gurnah.md",
];

function readSourceText(context: CaseContext): string {
  const source = findElement(context, "article dd").textContent;
  return source ?? "";
}

function readCountText(context: CaseContext): string {
  const count = findTileCount(context).textContent;
  return count ?? "";
}

export async function showsTargetCollection(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const card = findElement(context, "article");
  context
    .expect(card.querySelector("h1")?.textContent)
    .toBe("Shown collection");
  context
    .expect(card.querySelector("p")?.textContent)
    .toBe("A fixture collection that the viewer's tests show.");
  context
    .expect(readSourceText(context).endsWith(SHOWN_COLLECTION_PATH))
    .toBe(true);
  context.expect(readSourceText(context)).toBe(readInspection(context).source);
  context.expect(listShownLabels(context)).toEqual(SHOWN_LABELS);
  context.expect(context.root.querySelector('[role="alert"]')).toBe(null);
  context.expect(context.root.querySelector("[aria-busy]")).toBe(null);
}

export async function showsTileAddresses(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const inspection = readInspection(context);
  const items = listTileItems(context);
  context.expect(items.length).toBe(inspection.tiles.length);
  for (const [index, item] of items.entries()) {
    context
      .expect(item.querySelector("small")?.textContent)
      .toBe(inspection.tiles[index]);
  }
  context
    .expect(items[2].querySelector("small")?.textContent)
    .toContain("/caf%C3%A9.md");
}

export async function labelsSharedFileNames(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const items = listTileItems(context);
  context.expect(readTileLabel(items[3])).toBe("a/index.md");
  context.expect(readTileLabel(items[4])).toBe("b/index.md");
}

export async function labelsEncodedFileName(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  context.expect(readTileLabel(listTileItems(context)[2])).toBe("café.md");
}

export async function showsEntryIssues(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.issuesCollection);

  const issues = context.root.querySelectorAll(
    'section[aria-label="Entry issues"] li',
  );
  context.expect(issues.length).toBe(2);
  const errorBadge = issues[0].querySelector<HTMLElement>("span");
  context.expect(errorBadge?.textContent).toBe("error");
  context.expect(errorBadge?.dataset.tesVariant).toBe("destructive");
  context.expect(issues[0].textContent).toContain("entry 2");
  context
    .expect(issues[0].querySelector("code")?.textContent)
    .toBe(readInspection(context).source);
  const warningBadge = issues[1].querySelector<HTMLElement>("span");
  context.expect(warningBadge?.textContent).toBe("warning");
  context.expect(warningBadge?.dataset.tesVariant).toBe("warning");
  context.expect(listShownLabels(context)).toEqual(["2024__han_kang.md"]);
}

export async function showsNoIssueListWithoutIssues(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  context
    .expect(context.root.querySelector('section[aria-label="Entry issues"]'))
    .toBe(null);
}

export async function filtersTiles(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  context.expect(readCountText(context)).toBe("Showing 7 of 7 tiles");
  typeInFilter(context, "HAN");

  context
    .expect(listShownLabels(context))
    .toEqual(["2024__han_kang.md", "1944__johannes_v_jensen.md"]);
  context.expect(readCountText(context)).toBe("Showing 2 of 7 tiles");
}

export async function clearsFilter(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);
  typeInFilter(context, "dylan");

  typeInFilter(context, "");

  context.expect(listShownLabels(context)).toEqual(SHOWN_LABELS);
  context.expect(readCountText(context)).toBe("Showing 7 of 7 tiles");
}

export async function labelsFilterField(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const label = findElement(context, 'section[aria-label="Tiles"] label');
  context.expect(label.textContent).toContain("Filter by file name");
  context
    .expect(label.querySelector('input[type="search"]') !== null)
    .toBe(true);
}

function expectNoCollectionGiven(context: CaseContext): void {
  context
    .expect(findElement(context, '[role="status"]').textContent)
    .toBe("No collection was given.");
  context.expect(readInspectRequestCount(context)).toBe(0);
}

function readInspectRequestCount(context: CaseContext): number {
  let count = 0;
  for (const request of context.requests) {
    if (request.method === "collections.inspect") {
      count += 1;
    }
  }
  return count;
}

export async function saysNoTarget(context: CaseContext): Promise<void> {
  await context.mount({ params: {} });

  expectNoCollectionGiven(context);
}

export async function saysEmptyTarget(context: CaseContext): Promise<void> {
  await mountWithTarget(context, "");

  expectNoCollectionGiven(context);
}

export async function showsMissingTargetError(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.missingCollection);

  const alert = findElement(context, '[role="alert"]');
  context.expect(alert.textContent).toContain("404");
  context
    .expect(alert.textContent)
    .toContain(
      "/default_mods/collection_viewer/fixtures/missing_collection.yaml",
    );
  context.expect(context.root.querySelector("[aria-busy]")).toBe(null);
}

export async function showsTargetFormatError(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.noTilesList);

  context
    .expect(findElement(context, '[role="alert"]').textContent)
    .toContain('"tiles" must be a list');
}

export async function givesTableRoles(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const table = findElement(context, 'section[aria-label="Tiles"] table');
  context.expect(listWrongTableRoles(table)).toEqual([]);
}
