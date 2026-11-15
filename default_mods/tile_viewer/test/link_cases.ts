import type { CaseContext } from "../../mod_api.d.ts";
import {
  buildCaseTile,
  FIXTURE_REFERENCES,
  findMetadataValue,
  findRequests,
  mountWithFixtureTile,
  readFixtureTile,
  waitForBodyLink,
  waitForOpen,
} from "./case_helpers.ts";

export async function opensLinkedTileWithFrom(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md");
  const link = await waitForBodyLink(context, "/fahrenheit_451.md");
  context.answer("mods.open", null);

  link.click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: readFixtureTile(context, "fahrenheit_451.md").source,
    params: { from: FIXTURE_REFERENCES.tilesCollection },
  });
  context.expect(findRequests(context, "links.open")).toEqual([]);
}

export async function opensOutsideTileWithoutFrom(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md");
  const link = await waitForBodyLink(context, "/outside.md");
  context.answer("mods.open", null);

  link.click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: link.href,
    params: {},
  });
}

export async function opensLinkedTileWithoutAnyFrom(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md", null);
  const link = await waitForBodyLink(context, "/fahrenheit_451.md");
  context.answer("mods.open", null);

  link.click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: readFixtureTile(context, "fahrenheit_451.md").source,
    params: {},
  });
}

export async function opensMetadataTileLink(
  context: CaseContext,
): Promise<void> {
  const nextTile = readFixtureTile(context, "fahrenheit_451.md").source;
  await context.mount({
    tiles: [buildCaseTile(context, "linking.md", { next: nextTile })],
  });
  context.answer("mods.open", null);

  findMetadataValue(context, "next").querySelector("a")?.click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: nextTile,
    params: {},
  });
}

/** Whether the last click reached `document`'s later listeners cancelled. */
interface ClickRecord {
  cancelled: boolean | null;
}

function recordCancelled(record: ClickRecord, event: Event): void {
  record.cancelled = event.defaultPrevented;
}

/**
 * A link to another address is left to the frame loader, which asks to open
 * it with `links.open`: the viewer does not cancel the click. A case does not
 * record the loader's own requests, so it reads whether the click was
 * cancelled, from a listener added after the viewer's.
 */
export async function leavesOtherLinksToTheApp(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md", null);
  const record: ClickRecord = { cancelled: null };
  document.addEventListener("click", recordCancelled.bind(undefined, record));

  findMetadataValue(context, "source").querySelector("a")?.click();

  context.expect(record.cancelled).toBe(false);
  context.expect(findRequests(context, "mods.open")).toEqual([]);
}
