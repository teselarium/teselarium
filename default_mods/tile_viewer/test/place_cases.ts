import type { CaseContext } from "../../mod_api.d.ts";
import {
  buildCaseTile,
  FIXTURE_REFERENCES,
  findButton,
  findElement,
  findRequests,
  mountWithFixtureTile,
  readFixtureTile,
  waitForOpen,
} from "./case_helpers.ts";

function readPosition(context: CaseContext): string | null {
  return findElement(context, 'nav[aria-label="Collection"] > span')
    .textContent;
}

export async function showsPlaceInCollection(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "fahrenheit_451.md");

  context.expect(findButton(context, "Viewer tiles")).toBeTruthy();
  context.expect(readPosition(context)).toBe("2 of 3");
  context.expect(findButton(context, "Previous").disabled).toBe(false);
  context.expect(findButton(context, "Next").disabled).toBe(false);
  const nav = findElement(context, 'nav[aria-label="Collection"]');
  context.expect(nav.nextElementSibling?.tagName).toBe("ARTICLE");
}

export async function disablesPreviousOnFirst(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md");

  context.expect(readPosition(context)).toBe("1 of 3");
  context.expect(findButton(context, "Previous").disabled).toBe(true);
  context.expect(findButton(context, "Next").disabled).toBe(false);
}

export async function disablesNextOnLast(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "reading_list.md");

  context.expect(readPosition(context)).toBe("3 of 3");
  context.expect(findButton(context, "Next").disabled).toBe(true);
  context.expect(findButton(context, "Previous").disabled).toBe(false);
}

export async function replacesWithNext(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "fahrenheit_451.md");
  context.answer("mods.open", null);

  findButton(context, "Next").click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: readFixtureTile(context, "reading_list.md").source,
    params: { from: FIXTURE_REFERENCES.tilesCollection },
    replace: true,
  });
  context.expect(request.result).toBe(null);
}

export async function replacesWithPrevious(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "fahrenheit_451.md");
  context.answer("mods.open", null);

  findButton(context, "Previous").click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "tile_viewer",
    tile: readFixtureTile(context, "kallocain.md").source,
    params: { from: FIXTURE_REFERENCES.tilesCollection },
    replace: true,
  });
}

export async function opensTheCollection(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md");
  context.answer("mods.open", null);

  findButton(context, "Viewer tiles").click();

  const request = await waitForOpen(context);
  context.expect(request.params).toEqual({
    mod: "collection_viewer",
    params: { target: FIXTURE_REFERENCES.tilesCollection },
  });
}

function readErrorText(context: CaseContext): string {
  const region = findElement(context, 'p[role="status"]');
  return region.textContent ?? "";
}

function hasErrorText(context: CaseContext): boolean {
  return readErrorText(context) !== "";
}

export async function showsRefusedOpen(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "fahrenheit_451.md");
  context.expect(readErrorText(context)).toBe("");

  findButton(context, "Next").click();

  await context.waitFor(hasErrorText.bind(undefined, context));
  context
    .expect(readErrorText(context))
    .toBe("mods.open: only the visible mod can open mods");
  context
    .expect(findElement(context, "article h1").textContent)
    .toBe("Fahrenheit 451");
}

export async function showsNoPlaceOutsideFrom(
  context: CaseContext,
): Promise<void> {
  const tile = buildCaseTile(context, "outside.md", { title: "Outside" });
  await context.mount({
    tiles: [tile],
    params: { from: FIXTURE_REFERENCES.tilesCollection },
  });

  context.expect(findRequests(context, "collections.inspect").length).toBe(1);
  context
    .expect(findElement(context, "article h1").textContent)
    .toBe("Outside");
  context.expect(context.root.querySelector("nav")).toBe(null);
}

export async function warnsUnreadFrom(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(
    context,
    "kallocain.md",
    FIXTURE_REFERENCES.missingCollection,
  );

  const [notification] = findRequests(context, "ui.notify");
  context.expect(notification?.params.level).toBe("warning");
  context
    .expect(notification?.params.source)
    .toBe(FIXTURE_REFERENCES.missingCollection);
  context.expect(String(notification?.params.message)).toContain("404");
  context
    .expect(findElement(context, "article h1").textContent)
    .toBe("Kallocain");
  context.expect(context.root.querySelector("nav")).toBe(null);
}
