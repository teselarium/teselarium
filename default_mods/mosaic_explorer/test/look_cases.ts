import type { CaseContext, ModEngine } from "../../mod_api.d.ts";
import { buildExplorerPage, renderMosaicList } from "../src/explorer_page.ts";
import type { ExplorerView } from "../src/explorer_view.ts";
import {
  findButton,
  findElement,
  LISTED_MOSAIC_LOCATION,
  MISSING_MOSAIC_LOCATION,
  mountWithMosaics,
} from "./explorer_cases.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithMosaics(context, [
    LISTED_MOSAIC_LOCATION,
    MISSING_MOSAIC_LOCATION,
  ]);

  context.expect(listOwnLookDeclarations()).toEqual([]);
}

export async function drawsCardBackground(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [LISTED_MOSAIC_LOCATION]);

  const card = findElement(context, "li > article");
  context
    .expect(getComputedStyle(card).backgroundColor)
    .toBe(readTokenAs("--tes-card", "color"));
}

export async function drawsFailureBorder(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [MISSING_MOSAIC_LOCATION]);

  const alert = findElement(context, 'li > [role="alert"]');
  context
    .expect(getComputedStyle(alert).borderTopColor)
    .toBe(readTokenAs("--tes-destructive", "color"));
}

export async function drawsOpenAsPrimary(context: CaseContext): Promise<void> {
  await mountWithMosaics(context, [LISTED_MOSAIC_LOCATION]);

  context
    .expect(
      getComputedStyle(findButton(context, "Open Listed mosaic"))
        .backgroundColor,
    )
    .toBe(readTokenAs("--tes-primary", "color"));
  context
    .expect(
      getComputedStyle(findButton(context, "View Listed mosaic"))
        .backgroundColor,
    )
    .toBe(readTokenAs("--tes-background", "color"));
}

/**
 * The page before the inspections settle, drawn by the explorer's own page
 * builder, since a mount's inspections settle before `mount` resolves.
 */
export async function drawsBusyListWhileLoading(
  context: CaseContext,
): Promise<void> {
  await mountWithMosaics(context, []);
  const view: ExplorerView = {
    engine: {} as ModEngine,
    viewer: "mosaic_viewer",
    content: document.createElement("section"),
    status: document.createElement("p"),
    listingCount: 0,
  };

  buildExplorerPage(view, "Mosaics");

  context.expect(view.content.ariaBusy).toBe("true");
  context.expect(view.content.textContent).toBe("Loading mosaics…");
  renderMosaicList(view, []);
  context.expect(view.content.ariaBusy).toBe(null);
}
