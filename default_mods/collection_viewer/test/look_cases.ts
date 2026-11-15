import type { CaseContext } from "../../mod_api.d.ts";
import {
  FIXTURE_REFERENCES,
  findElement,
  findTileCount,
  mountWithTarget,
} from "./case_helpers.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.issuesCollection);

  context.expect(listOwnLookDeclarations()).toEqual([]);
}

export async function drawsCardBackground(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  context
    .expect(getComputedStyle(findElement(context, "article")).backgroundColor)
    .toBe(readTokenAs("--ot-card", "color"));
}

export async function drawsIssueBadges(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.issuesCollection);

  const errorBadge = findElement(
    context,
    'section[aria-label="Entry issues"] span[data-ot-variant="destructive"]',
  );
  const warningBadge = findElement(
    context,
    'section[aria-label="Entry issues"] span[data-ot-variant="warning"]',
  );
  context
    .expect(getComputedStyle(errorBadge).borderTopColor)
    .toBe(readTokenAs("--ot-destructive", "color"));
  context
    .expect(getComputedStyle(warningBadge).borderTopColor)
    .toBe(readTokenAs("--ot-warning", "color"));
}

export async function drawsTilesInCard(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const table = findElement(context, 'section[aria-label="Tiles"] table');
  const card = table.closest("article");
  context.expect(card !== null).toBe(true);
  context
    .expect(card === null ? null : getComputedStyle(card).backgroundColor)
    .toBe(readTokenAs("--ot-card", "color"));
  const headings: (string | null)[] = [];
  for (const heading of table.querySelectorAll("th")) {
    headings.push(heading.textContent);
  }
  context.expect(headings).toEqual(["Tile", "Address"]);
  const count = findTileCount(context);
  context.expect(count.closest("article")).toBe(null);
  context.expect(count.getAttribute("role")).toBe(null);
  context.expect(count.getAttribute("aria-live")).toBe("polite");
  context.expect(getComputedStyle(count).borderTopStyle).toBe("none");
}

/** The maximum width of the filter field, in rem: wide enough for a file name, not the whole frame. */
const FILTER_MAX_WIDTH_REM = 24;

export async function keepsFilterNarrow(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);

  const field = findElement(context, 'input[type="search"]');
  const remPixels = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  context
    .expect(
      field.getBoundingClientRect().width <= FILTER_MAX_WIDTH_REM * remPixels,
    )
    .toBe(true);
}
