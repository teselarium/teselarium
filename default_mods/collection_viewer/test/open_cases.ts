import type { CaseContext, CaseRequest } from "../../mod_api.d.ts";
import {
  FIXTURE_REFERENCES,
  findElement,
  findRequests,
  listTileItems,
  mountWithTarget,
  readInspection,
} from "./case_helpers.ts";

/** The button of a tile row, named after the tile's label. */
function findTileButton(context: CaseContext, index: number): HTMLElement {
  const button = listTileItems(context)[index]?.querySelector("td > button");
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`The tile row ${index} has no button.`);
  }
  return button;
}

/** The viewer's first `mods.open` once it settled, or `null` before. */
function findSettledOpen(context: CaseContext): CaseRequest | null {
  for (const request of findRequests(context, "mods.open")) {
    if ("result" in request || "error" in request) {
      return request;
    }
  }
  return null;
}

function readOpenErrorText(context: CaseContext): string {
  return findElement(context, 'body > p[role="status"]').textContent ?? "";
}

function hasOpenError(context: CaseContext): boolean {
  return readOpenErrorText(context) !== "";
}

export async function opensSelectedTile(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);
  const inspection = readInspection(context);
  const button = findTileButton(context, 0);
  context.expect(button.textContent).toBe("2024__han_kang.md");
  context.answer("mods.open", null);

  button.click();

  const request = await context.waitFor(
    findSettledOpen.bind(undefined, context),
  );
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: inspection.tiles[0],
    params: { from: inspection.source },
  });
  context.expect(request.result).toBe(null);
}

export async function showsRefusedOpen(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownCollection);
  context.expect(readOpenErrorText(context)).toBe("");

  findTileButton(context, 0).click();

  await context.waitFor(hasOpenError.bind(undefined, context));
  context
    .expect(readOpenErrorText(context))
    .toBe("mods.open: only the visible mod can open mods");
  context
    .expect(findElement(context, "article h1").textContent)
    .toBe("Shown collection");
  const count = findElement(context, 'section[aria-label="Tiles"] [aria-live]');
  context.expect(count.getAttribute("role")).toBe(null);
}
