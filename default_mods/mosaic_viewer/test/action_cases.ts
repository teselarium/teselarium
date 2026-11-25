import type { CaseContext } from "../../mod_api.d.ts";
import {
  clickButton,
  FIXTURE_PATHS,
  FIXTURE_REFERENCES,
  findButton,
  findElement,
  findRequests,
  findSettledRequest,
  mountWithTarget,
  readResultSource,
} from "./case_helpers.ts";
import { readMosaicFileName } from "../src/mosaic_file_name.ts";

/** The viewers of the mosaic viewer's own config. */
const CONFIG_MOD_VIEWER = "mod_viewer";
const CONFIG_COLLECTION_VIEWER = "collection_viewer";

async function expectViewerOpened(
  context: CaseContext,
  viewer: string,
  target: string,
): Promise<void> {
  const openRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "mods.open"),
  );
  context
    .expect(openRequest.params)
    .toEqual({ mod: viewer, params: { target } });
  context.expect(openRequest.result).toBe(null);
}

export async function opensModViewer(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);
  context.answer("mods.open", null);

  clickButton(context, "Fixture Mod");

  const modSource = readResultSource(context, "mods.inspect");
  context.expect(modSource.endsWith(FIXTURE_PATHS.fixtureMod)).toBe(true);
  await expectViewerOpened(context, CONFIG_MOD_VIEWER, modSource);
}

export async function opensCollectionViewer(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);
  context.answer("mods.open", null);

  clickButton(context, "Fixture collection");

  const collectionSource = readResultSource(context, "collections.inspect");
  context
    .expect(collectionSource.endsWith(FIXTURE_PATHS.fixtureCollection))
    .toBe(true);
  await expectViewerOpened(context, CONFIG_COLLECTION_VIEWER, collectionSource);
}

export async function opensMosaic(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);
  context.answer("mosaics.open", null);

  clickButton(context, "Open mosaic");

  const openRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "mosaics.open"),
  );
  context
    .expect(openRequest.params)
    .toEqual({ mosaic: readResultSource(context, "mosaics.inspect") });
  context.expect(openRequest.result).toBe(null);
  context.expect(findRequests(context, "mods.open").length).toBe(0);
}

function findAlert(context: CaseContext): HTMLElement | null {
  const alert = context.root.querySelector<HTMLElement>('[role="alert"]');
  return alert;
}

export async function showsRefusedCheck(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  clickButton(context, "Check mosaic");

  const button = findButton(context, "Check mosaic");
  context.expect(button?.disabled).toBe(true);
  context
    .expect(findElement(context, '[role="status"]').textContent)
    .toBe("Checking Shown mosaic…");
  const checkRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "mosaics.check"),
  );
  context
    .expect(checkRequest.params)
    .toEqual({ mosaic: readResultSource(context, "mosaics.inspect") });
  context.expect(checkRequest.error?.code).toBe(-32002);
  const alert = await context.waitFor(findAlert.bind(undefined, context));
  context.expect(alert.textContent).toBe(checkRequest.error?.message);
  context.expect(button?.disabled).toBe(false);
}

/** The text the viewer inspected its target with, from its `mosaics.inspect` result. */
function readInspectedContent(context: CaseContext): string {
  const [request] = findRequests(context, "mosaics.inspect");
  const result = request?.result as { content?: unknown } | undefined;
  if (typeof result?.content !== "string") {
    throw new Error(
      "The viewer's mosaics.inspect has no content in its result.",
    );
  }
  return result.content;
}

export async function downloadsMosaic(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);
  context.answer("files.save", true);

  clickButton(context, "Download");

  const saveRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "files.save"),
  );
  context.expect(saveRequest.params).toEqual({
    name: "shown_mosaic.yaml",
    content: readInspectedContent(context),
    type: "application/yaml",
  });
  context.expect(findAlert(context)).toBe(null);
}

export async function showsCancelledDownload(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);
  context.answer("files.save", false);

  clickButton(context, "Download");

  const saveRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "files.save"),
  );
  context.expect(saveRequest.result).toBe(false);
  context.expect(findAlert(context)).toBe(null);
}

export function namesDownloadedFiles(context: CaseContext): void {
  context
    .expect(readMosaicFileName("https://example.org/mosaics/nobel%20map.yaml"))
    .toBe("nobel map.yaml");
  context
    .expect(readMosaicFileName("https://example.org/mosaics/"))
    .toBe("mosaic.yaml");
  context
    .expect(readMosaicFileName("https://example.org/mosaics/a%2Fb.yaml"))
    .toBe("mosaic.yaml");
}
