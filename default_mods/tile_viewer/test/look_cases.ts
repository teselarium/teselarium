import type { CaseContext } from "../../mod_api.d.ts";
import {
  findButton,
  findElement,
  mountWithFixtureTile,
} from "./case_helpers.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md");

  context.expect(listOwnLookDeclarations()).toEqual([]);
}

export async function drawsTheTileAsACard(context: CaseContext): Promise<void> {
  await mountWithFixtureTile(context, "kallocain.md");

  const card = findElement(context, "article");
  context
    .expect(getComputedStyle(card).backgroundColor)
    .toBe(readTokenAs("--tes-card", "color"));
  context.expect(card.querySelector("h1")).toBeTruthy();
  context.expect(card.querySelector("small")).toBeTruthy();
  context
    .expect(card.querySelector('section[aria-label="Metadata"] dl'))
    .toBeTruthy();
  context.expect(card.querySelector(":scope > hr")).toBeTruthy();
  context.expect(card.querySelector(":scope > tes-tile-body")).toBeTruthy();
  context
    .expect(getComputedStyle(findButton(context, "Next")).backgroundColor)
    .toBe(readTokenAs("--tes-primary", "color"));
  context
    .expect(getComputedStyle(findButton(context, "Previous")).backgroundColor)
    .not.toBe(readTokenAs("--tes-primary", "color"));
}
