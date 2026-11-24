import type { CaseContext } from "../../mod_api.d.ts";
import {
  FIXTURE_REFERENCES,
  findButton,
  findElement,
  findSection,
  mountWithTarget,
} from "./case_helpers.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

function readButtonBackground(context: CaseContext, text: string): string {
  const button = findButton(context, text);
  if (button === null) {
    throw new Error(`The viewer draws no "${text}" button.`);
  }
  return getComputedStyle(button).backgroundColor;
}

export async function drawsOpenAsPrimary(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  context
    .expect(readButtonBackground(context, "Open mosaic"))
    .toBe(readTokenAs("--tes-primary", "color"));
  context
    .expect(readButtonBackground(context, "Check mosaic"))
    .toBe(readTokenAs("--tes-background", "color"));
  context
    .expect(findButton(context, "Fixture Mod")?.dataset.tesVariant)
    .toBe("ghost");
}

export async function drawsMosaicCard(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  context
    .expect(getComputedStyle(findElement(context, "article")).backgroundColor)
    .toBe(readTokenAs("--tes-card", "color"));
}

export async function drawsFailureBorder(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.missingCollection);

  const alert = findSection(context, "Collection").querySelector(
    '[role="alert"]',
  ) as HTMLElement;
  context
    .expect(getComputedStyle(alert).borderTopColor)
    .toBe(readTokenAs("--tes-destructive", "color"));
}

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  context.expect(listOwnLookDeclarations()).toEqual([]);
}
