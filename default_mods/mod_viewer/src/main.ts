/**
 * Default mod: shows the metadata of the mod named by the `target`
 * parameter, runs it, and checks it.
 *
 * It is also an example of getting the app's look without classes: the
 * theme's base stylesheet styles semantic HTML like the app's components (a
 * submit button is the primary button, an `<article>` a card, `role="alert"`
 * an alert), `data-tes-variant` picks the variants that have no semantic HTML
 * (badges, an outline submit button), and this mod's own CSS sets layout only.
 * See "Write HTML, get the app's look" in docs/modules/lib/core/theme/README.md.
 */

import type { ModContext, ModEngine, ModInspection } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";
import { buildErrorAlert, buildStatusMessage } from "./page_elements.ts";
import {
  addViewerStyle,
  renderInspection,
  renderMessage,
} from "./viewer_page.ts";
import type { ViewerView } from "./viewer_view.ts";

function buildViewerView(
  engine: ModEngine,
  context: ModContext,
  inspection: ModInspection,
): ViewerView {
  const view: ViewerView = {
    engine,
    apiVersion: context.api.version,
    inspection,
    collectionInput: null,
    messages: document.createElement("div"),
  };
  return view;
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(
  engine: ModEngine,
  context: ModContext,
): Promise<void> {
  addViewerStyle();
  const target = context.params.target;
  if (typeof target !== "string" || target === "") {
    renderMessage(context.mod.title, buildStatusMessage("No mod was given."));
    return;
  }
  let inspection: ModInspection;
  try {
    inspection = await engine.request("mods.inspect", { mod: target });
  } catch (error) {
    renderMessage(context.mod.title, buildErrorAlert(describeError(error)));
    return;
  }
  renderInspection(buildViewerView(engine, context, inspection));
}
