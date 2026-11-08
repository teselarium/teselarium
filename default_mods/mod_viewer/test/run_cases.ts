import type { CaseContext } from "../../mod_api.d.ts";
import {
  clickButton,
  FIXTURE_REFERENCES,
  findButton,
  findElement,
  findRequests,
  findSettledOpen,
  mountWithTarget,
  readInspection,
} from "./case_helpers.ts";

/** Mounts the viewer on the listed mod, with the next `mods.open` answered so it opens nothing. */
async function mountAnsweringOpen(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.listedMod);
  context.answer("mods.open", null);
}

async function expectOpenParams(
  context: CaseContext,
  expectedParams: Record<string, string>,
): Promise<void> {
  const openRequest = await context.waitFor(
    findSettledOpen.bind(undefined, context),
  );
  context.expect(openRequest.params).toEqual(expectedParams);
  context.expect(openRequest.result).toBe(null);
}

export async function runsWithSampleTiles(context: CaseContext): Promise<void> {
  await mountAnsweringOpen(context);

  clickButton(context, "Run with sample tiles");

  const inspection = readInspection(context);
  context.expect(inspection.sampleCollection).toBeTruthy();
  await expectOpenParams(context, {
    mod: inspection.source,
    collection: inspection.sampleCollection ?? "",
  });
}

export async function runsWithTypedCollection(
  context: CaseContext,
): Promise<void> {
  await mountAnsweringOpen(context);
  const field = findElement(context, "#collection-address") as HTMLInputElement;
  field.value = "  ./typed/collection.yaml  ";

  clickButton(context, "Run with this collection");

  await expectOpenParams(context, {
    mod: readInspection(context).source,
    collection: "./typed/collection.yaml",
  });
}

export async function runsNothingWithEmptyField(
  context: CaseContext,
): Promise<void> {
  await mountAnsweringOpen(context);

  clickButton(context, "Run with this collection");

  context.expect(findRequests(context, "mods.open").length).toBe(0);
}

export async function runsWithoutTiles(context: CaseContext): Promise<void> {
  await mountAnsweringOpen(context);

  clickButton(context, "Run without tiles");

  await expectOpenParams(context, { mod: readInspection(context).source });
}

export async function offersNoSampleRunWithoutSample(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.noRange);

  context.expect(findButton(context, "Run with sample tiles")).toBe(null);
  context.expect(findButton(context, "Run without tiles") !== null).toBe(true);
}
