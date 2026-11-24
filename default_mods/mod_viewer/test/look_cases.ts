import type { CaseContext } from "../../mod_api.d.ts";
import {
  FIXTURE_REFERENCES,
  findButton,
  mountWithTarget,
  readBadge,
} from "./case_helpers.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

function readButtonBackground(context: CaseContext, text: string): string {
  const button = findButton(context, text);
  if (button === null) {
    throw new Error(`The viewer draws no "${text}" button.`);
  }
  return getComputedStyle(button).backgroundColor;
}

export async function showsPermissionBadges(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.listedMod);

  const cells = context.root.querySelectorAll("tbody tr td");
  context.expect(cells.length).toBe(4);
  context.expect(cells[0].textContent).toBe("show");
  context.expect(cells[1].textContent).toBe("https://covers.example.org");
  context.expect(cells[2].textContent).toBe("Shows the covers");
  context
    .expect(readBadge(cells[3].querySelector("span")))
    .toEqual({ text: "granted", variant: "success" });
}

export async function drawsPrimaryAction(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.listedMod);

  context
    .expect(readButtonBackground(context, "Open default mosaic"))
    .toBe(readTokenAs("--tes-primary", "color"));
  context
    .expect(readButtonBackground(context, "Run without tiles"))
    .toBe(readTokenAs("--tes-background", "color"));
}

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.listedMod);

  context.expect(listOwnLookDeclarations()).toEqual([]);
}
